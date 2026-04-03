# -*- coding: utf-8 -*-
import os
import uuid
import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, session
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_login import LoginManager, login_user, logout_user, login_required, current_user, UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///messenger.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER_AVATARS'] = 'static/uploads/avatars'
app.config['UPLOAD_FOLDER_FILES'] = 'static/uploads/files'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

ALLOWED_EXTENSIONS = {
    'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp',
    'mp3', 'wav', 'ogg', 'flac', 'webm', 'mp4',
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'txt', 'zip', 'rar', '7z', 'tar', 'gz'
}

os.makedirs(app.config['UPLOAD_FOLDER_AVATARS'], exist_ok=True)
os.makedirs(app.config['UPLOAD_FOLDER_FILES'], exist_ok=True)

db = SQLAlchemy(app)
socketio = SocketIO(app, cors_allowed_origins="*")
login_manager = LoginManager(app)
login_manager.login_view = 'login'

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ---------- Модели ----------
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    avatar = db.Column(db.String(200), default='default.png')
    status = db.Column(db.String(20), default='offline')
    last_seen = db.Column(db.DateTime, default=datetime.utcnow)
    theme = db.Column(db.String(10), default='dark')
    push_enabled = db.Column(db.Boolean, default=False)

class Group(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, default='')
    avatar = db.Column(db.String(200), default='group_default.png')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    invite_token = db.Column(db.String(100), unique=True, default=lambda: uuid.uuid4().hex)
    creator = db.relationship('User', foreign_keys=[created_by])

class GroupMember(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    group_id = db.Column(db.Integer, db.ForeignKey('group.id'), nullable=False)
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_admin = db.Column(db.Boolean, default=False)
    user = db.relationship('User', backref='group_memberships')

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    file_path = db.Column(db.String(200), nullable=True)
    file_name = db.Column(db.String(200), nullable=True)
    file_type = db.Column(db.String(20), nullable=True)
    edited = db.Column(db.Boolean, default=False)
    deleted = db.Column(db.Boolean, default=False)
    link_preview = db.Column(db.Text, nullable=True)
    reply_to_id = db.Column(db.Integer, db.ForeignKey('message.id'), nullable=True)
    reply_to = db.relationship('Message', remote_side=[id], backref='replies')

    sender = db.relationship('User', foreign_keys=[sender_id])
    receiver = db.relationship('User', foreign_keys=[receiver_id])

class GroupMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    group_id = db.Column(db.Integer, db.ForeignKey('group.id'), nullable=False)
    file_path = db.Column(db.String(200), nullable=True)
    file_name = db.Column(db.String(200), nullable=True)
    file_type = db.Column(db.String(20), nullable=True)
    edited = db.Column(db.Boolean, default=False)
    deleted = db.Column(db.Boolean, default=False)
    link_preview = db.Column(db.Text, nullable=True)
    reply_to_id = db.Column(db.Integer, db.ForeignKey('group_message.id'), nullable=True)
    reply_to = db.relationship('GroupMessage', remote_side=[id], backref='replies')

    sender = db.relationship('User')
    group = db.relationship('Group')

class GroupMessageRead(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.Integer, db.ForeignKey('group_message.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

class Reaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.Integer, nullable=False)
    message_type = db.Column(db.String(10), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    emoji = db.Column(db.String(10), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

# ---------- Вспомогательные функции ----------
def fetch_link_preview(url):
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        response = requests.get(url, timeout=5, headers=headers)
        soup = BeautifulSoup(response.text, 'html.parser')
        title = soup.find('meta', property='og:title') or soup.find('title')
        title = title.get('content', '') if title and title.get('content') else title.text if title else ''
        description = soup.find('meta', property='og:description') or soup.find('meta', attrs={'name': 'description'})
        description = description.get('content', '') if description else ''
        image = soup.find('meta', property='og:image')
        image = image.get('content', '') if image else ''
        return {'title': title[:200], 'description': description[:300], 'image': image}
    except:
        return None

def extract_urls(text):
    url_regex = r'(https?://[^\s]+)'
    return re.findall(url_regex, text)

# ---------- Маршруты ----------
@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('chat'))
    return render_template('index.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        confirm = request.form['confirm_password']
        if password != confirm:
            flash('Пароли не совпадают', 'danger')
        elif User.query.filter_by(username=username).first():
            flash('Имя пользователя уже занято', 'danger')
        else:
            hashed = generate_password_hash(password)
            user = User(username=username, password=hashed)
            db.session.add(user)
            db.session.commit()
            flash('Регистрация успешна!', 'success')
            return redirect(url_for('login'))
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        user = User.query.filter_by(username=username).first()
        if user and check_password_hash(user.password, password):
            login_user(user)
            user.status = 'online'
            user.last_seen = datetime.utcnow()
            db.session.commit()
            if session.get('invite_token'):
                token = session.pop('invite_token')
                return redirect(url_for('join_group_by_token', token=token))
            return redirect(url_for('chat'))
        flash('Неверное имя пользователя или пароль', 'danger')
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    current_user.status = 'offline'
    current_user.last_seen = datetime.utcnow()
    db.session.commit()
    logout_user()
    return redirect(url_for('index'))

@app.route('/chat')
@login_required
def chat():
    users = User.query.filter(User.id != current_user.id).all()
    conversations = []
    for user in users:
        last_msg = Message.query.filter(
            ((Message.sender_id == current_user.id) & (Message.receiver_id == user.id)) |
            ((Message.sender_id == user.id) & (Message.receiver_id == current_user.id)),
            Message.deleted == False
        ).order_by(Message.timestamp.desc()).first()
        unread = Message.query.filter(
            Message.sender_id == user.id,
            Message.receiver_id == current_user.id,
            Message.is_read == False,
            Message.deleted == False
        ).count()
        conversations.append({'user': user, 'last_message': last_msg, 'unread_count': unread})
    conversations.sort(key=lambda x: x['last_message'].timestamp if x['last_message'] else datetime.min, reverse=True)

    groups = db.session.query(Group).join(GroupMember).filter(GroupMember.user_id == current_user.id).all()
    group_conversations = []
    for g in groups:
        last_msg = GroupMessage.query.filter_by(group_id=g.id, deleted=False).order_by(GroupMessage.timestamp.desc()).first()
        unread = db.session.query(GroupMessageRead).join(GroupMessage).filter(
            GroupMessage.group_id == g.id,
            GroupMessageRead.user_id == current_user.id
        ).count()
        group_conversations.append({'group': g, 'last_message': last_msg, 'unread_count': unread})
    group_conversations.sort(key=lambda x: x['last_message'].timestamp if x['last_message'] else datetime.min, reverse=True)

    return render_template('chat.html',
                           conversations=conversations,
                           groups=group_conversations,
                           current_user=current_user)

@app.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    if request.method == 'POST':
        if 'avatar' in request.files:
            file = request.files['avatar']
            if file and allowed_file(file.filename):
                ext = file.filename.rsplit('.', 1)[1].lower()
                filename = f"avatar_{current_user.id}_{uuid.uuid4().hex}.{ext}"
                filepath = os.path.join(app.config['UPLOAD_FOLDER_AVATARS'], filename)
                file.save(filepath)
                if current_user.avatar != 'default.png':
                    old = os.path.join(app.config['UPLOAD_FOLDER_AVATARS'], current_user.avatar)
                    if os.path.exists(old):
                        os.remove(old)
                current_user.avatar = filename
                db.session.commit()
                flash('Аватар обновлён', 'success')
        if 'theme' in request.form:
            current_user.theme = request.form['theme']
            db.session.commit()
            flash('Тема сохранена', 'success')
        if 'push_enabled' in request.form:
            current_user.push_enabled = request.form['push_enabled'] == 'on'
            db.session.commit()
            flash('Настройки уведомлений сохранены', 'success')
        return redirect(url_for('profile'))
    return render_template('profile.html', user=current_user)

@app.route('/delete_account', methods=['POST'])
@login_required
def delete_account():
    Message.query.filter((Message.sender_id == current_user.id) | (Message.receiver_id == current_user.id)).delete()
    GroupMessage.query.filter_by(sender_id=current_user.id).delete()
    Reaction.query.filter_by(user_id=current_user.id).delete()
    GroupMember.query.filter_by(user_id=current_user.id).delete()
    if current_user.avatar != 'default.png':
        avatar_path = os.path.join(app.config['UPLOAD_FOLDER_AVATARS'], current_user.avatar)
        if os.path.exists(avatar_path):
            os.remove(avatar_path)
    db.session.delete(current_user)
    db.session.commit()
    logout_user()
    flash('Ваш аккаунт удалён', 'success')
    return redirect(url_for('index'))

# Группы
@app.route('/group/new')
@login_required
def new_group():
    return render_template('create_group.html')

@app.route('/create_group', methods=['POST'])
@login_required
def create_group():
    name = request.form['name']
    description = request.form.get('description', '')
    group = Group(name=name, description=description, created_by=current_user.id)
    db.session.add(group)
    db.session.commit()
    member = GroupMember(user_id=current_user.id, group_id=group.id, is_admin=True)
    db.session.add(member)
    db.session.commit()
    flash(f'Группа "{name}" создана!', 'success')
    return redirect(url_for('chat'))

@app.route('/group/<int:group_id>/edit', methods=['GET', 'POST'])
@login_required
def edit_group(group_id):
    group = Group.query.get_or_404(group_id)
    membership = GroupMember.query.filter_by(user_id=current_user.id, group_id=group_id).first()
    if not membership or not membership.is_admin:
        flash('Только администратор может редактировать группу', 'danger')
        return redirect(url_for('group_info', group_id=group_id))
    if request.method == 'POST':
        name = request.form.get('name')
        description = request.form.get('description')
        if name:
            group.name = name
        if description is not None:
            group.description = description
        if 'avatar' in request.files:
            file = request.files['avatar']
            if file and allowed_file(file.filename):
                ext = file.filename.rsplit('.', 1)[1].lower()
                filename = f"group_{group_id}_{uuid.uuid4().hex}.{ext}"
                filepath = os.path.join(app.config['UPLOAD_FOLDER_AVATARS'], filename)
                file.save(filepath)
                if group.avatar != 'group_default.png':
                    old = os.path.join(app.config['UPLOAD_FOLDER_AVATARS'], group.avatar)
                    if os.path.exists(old):
                        os.remove(old)
                group.avatar = filename
        db.session.commit()
        flash('Группа обновлена', 'success')
        return redirect(url_for('group_info', group_id=group_id))
    return render_template('edit_group.html', group=group)

@app.route('/group/<int:group_id>/make_admin/<int:user_id>', methods=['POST'])
@login_required
def make_admin(group_id, user_id):
    membership = GroupMember.query.filter_by(user_id=current_user.id, group_id=group_id).first()
    if not membership or not membership.is_admin:
        return jsonify({'error': 'Недостаточно прав'}), 403
    target = GroupMember.query.filter_by(user_id=user_id, group_id=group_id).first()
    if not target:
        return jsonify({'error': 'Участник не найден'}), 404
    target.is_admin = True
    db.session.commit()
    return jsonify({'success': True})

@app.route('/group/<int:group_id>/remove_admin/<int:user_id>', methods=['POST'])
@login_required
def remove_admin(group_id, user_id):
    membership = GroupMember.query.filter_by(user_id=current_user.id, group_id=group_id).first()
    if not membership or not membership.is_admin:
        return jsonify({'error': 'Недостаточно прав'}), 403
    target = GroupMember.query.filter_by(user_id=user_id, group_id=group_id).first()
    if not target:
        return jsonify({'error': 'Участник не найден'}), 404
    group = Group.query.get(group_id)
    if target.user_id == group.created_by:
        return jsonify({'error': 'Нельзя снять права с создателя группы'}), 400
    target.is_admin = False
    db.session.commit()
    return jsonify({'success': True})

@app.route('/group/<int:group_id>/remove_member/<int:user_id>', methods=['POST'])
@login_required
def remove_member(group_id, user_id):
    membership = GroupMember.query.filter_by(user_id=current_user.id, group_id=group_id).first()
    if not membership or not membership.is_admin:
        return jsonify({'error': 'Недостаточно прав'}), 403
    group = Group.query.get(group_id)
    if user_id == group.created_by:
        return jsonify({'error': 'Нельзя удалить создателя группы'}), 400
    target = GroupMember.query.filter_by(user_id=user_id, group_id=group_id).first()
    if not target:
        return jsonify({'error': 'Участник не найден'}), 404
    db.session.delete(target)
    db.session.commit()
    socketio.emit('group_member_removed', {'group_id': group_id, 'user_id': user_id}, room=f'user_{user_id}')
    return jsonify({'success': True})

@app.route('/group/<int:group_id>/invite')
@login_required
def get_invite_link(group_id):
    membership = GroupMember.query.filter_by(user_id=current_user.id, group_id=group_id).first()
    if not membership:
        return jsonify({'error': 'Вы не участник группы'}), 403
    group = Group.query.get_or_404(group_id)
    if not group.invite_token:
        group.invite_token = uuid.uuid4().hex
        db.session.commit()
    return jsonify({'invite_link': f"{request.host_url}join/{group.invite_token}"})

@app.route('/join/<token>')
def join_group_by_token(token):
    group = Group.query.filter_by(invite_token=token).first_or_404()
    if current_user.is_authenticated:
        existing = GroupMember.query.filter_by(user_id=current_user.id, group_id=group.id).first()
        if existing:
            flash('Вы уже состоите в этой группе', 'info')
            return redirect(url_for('chat'))
        new_member = GroupMember(user_id=current_user.id, group_id=group.id)
        db.session.add(new_member)
        db.session.commit()
        socketio.emit('group_member_added', {'group_id': group.id, 'username': current_user.username}, room=f'group_{group.id}')
        flash(f'Вы присоединились к группе "{group.name}"', 'success')
        return redirect(url_for('chat'))
    else:
        session['invite_token'] = token
        flash('Для присоединения к группе необходимо войти или зарегистрироваться', 'info')
        return redirect(url_for('login'))

@app.route('/group/<int:group_id>/info')
@login_required
def group_info(group_id):
    group = Group.query.get_or_404(group_id)
    member = GroupMember.query.filter_by(user_id=current_user.id, group_id=group_id).first()
    if not member:
        flash('Вы не являетесь участником этой группы', 'danger')
        return redirect(url_for('chat'))
    members = GroupMember.query.filter_by(group_id=group_id).all()
    creator = User.query.get(group.created_by)
    is_admin = member.is_admin
    return render_template('group_info.html', group=group, members=members, creator=creator, is_admin=is_admin, current_user=current_user)

@app.route('/group/<int:group_id>/messages')
@login_required
def get_group_messages(group_id):
    group = Group.query.get_or_404(group_id)
    member = GroupMember.query.filter_by(user_id=current_user.id, group_id=group_id).first()
    if not member:
        return jsonify({'error': 'Не участник'}), 403
    messages = GroupMessage.query.filter_by(group_id=group_id, deleted=False).order_by(GroupMessage.timestamp).all()
    for msg in messages:
        read = GroupMessageRead.query.filter_by(message_id=msg.id, user_id=current_user.id).first()
        if not read:
            r = GroupMessageRead(message_id=msg.id, user_id=current_user.id)
            db.session.add(r)
    db.session.commit()
    total_members = GroupMember.query.filter_by(group_id=group_id).count()
    result = []
    for m in messages:
        read_count = GroupMessageRead.query.filter_by(message_id=m.id).count()
        reply_data = None
        if m.reply_to_id:
            reply = GroupMessage.query.get(m.reply_to_id)
            if reply and not reply.deleted:
                reply_data = {
                    'id': reply.id,
                    'content': reply.content[:100],
                    'sender_name': reply.sender.username
                }
        result.append({
            'id': m.id,
            'content': m.content,
            'file_path': m.file_path,
            'file_name': m.file_name,
            'file_type': m.file_type,
            'sender_id': m.sender_id,
            'sender_name': m.sender.username,
            'sender_avatar': m.sender.avatar,
            'timestamp': m.timestamp.strftime('%H:%M'),
            'is_own': m.sender_id == current_user.id,
            'edited': m.edited,
            'deleted': m.deleted,
            'read_count': read_count,
            'total_members': total_members,
            'link_preview': m.link_preview,
            'reply_to': reply_data
        })
    return jsonify(result)

@app.route('/group/<int:group_id>/add_member', methods=['POST'])
@login_required
def add_group_member(group_id):
    membership = GroupMember.query.filter_by(user_id=current_user.id, group_id=group_id).first()
    if not membership or not membership.is_admin:
        return jsonify({'error': 'Недостаточно прав (только администратор может добавлять участников)'}), 403
    username = request.form.get('username')
    if not username:
        return jsonify({'error': 'Имя пользователя не указано'}), 400
    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify({'error': 'Пользователь не найден'}), 404
    existing = GroupMember.query.filter_by(user_id=user.id, group_id=group_id).first()
    if existing:
        return jsonify({'error': 'Пользователь уже состоит в группе'}), 400
    new_member = GroupMember(user_id=user.id, group_id=group_id)
    db.session.add(new_member)
    db.session.commit()
    socketio.emit('group_member_added', {'group_id': group_id, 'username': user.username}, room=f'group_{group_id}')
    return jsonify({'success': True})

# Загрузка файлов
@app.route('/upload_file', methods=['POST'])
@login_required
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'Нет файла'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Файл не выбран'}), 400
    if file and allowed_file(file.filename):
        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"{uuid.uuid4().hex}.{ext}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER_FILES'], filename)
        file.save(filepath)
        if ext in {'png','jpg','jpeg','gif','bmp','webp'}:
            file_type = 'image'
        elif ext in {'mp3','wav','ogg','flac','webm','mp4'}:
            file_type = 'audio'
        elif ext in {'mp4','avi','mov','mkv','webm'}:
            file_type = 'video'
        else:
            file_type = 'document'
        return jsonify({
            'file_path': f'/static/uploads/files/{filename}',
            'file_type': file_type,
            'file_name': file.filename
        })
    return jsonify({'error': 'Неподдерживаемый формат'}), 400

# Личные сообщения – история
@app.route('/get_messages/<int:user_id>')
@login_required
def get_messages(user_id):
    messages = Message.query.filter(
        ((Message.sender_id == current_user.id) & (Message.receiver_id == user_id)) |
        ((Message.sender_id == user_id) & (Message.receiver_id == current_user.id)),
        Message.deleted == False
    ).order_by(Message.timestamp).all()
    unread = Message.query.filter(
        Message.sender_id == user_id,
        Message.receiver_id == current_user.id,
        Message.is_read == False,
        Message.deleted == False
    ).all()
    for m in unread:
        m.is_read = True
    db.session.commit()
    result = []
    for m in messages:
        reply_data = None
        if m.reply_to_id:
            reply = Message.query.get(m.reply_to_id)
            if reply and not reply.deleted:
                reply_data = {
                    'id': reply.id,
                    'content': reply.content[:100],
                    'sender_name': reply.sender.username
                }
        result.append({
            'id': m.id,
            'content': m.content,
            'file_path': m.file_path,
            'file_name': m.file_name,
            'file_type': m.file_type,
            'sender_id': m.sender_id,
            'timestamp': m.timestamp.strftime('%H:%M'),
            'is_own': m.sender_id == current_user.id,
            'edited': m.edited,
            'deleted': m.deleted,
            'is_read': m.is_read,
            'link_preview': m.link_preview,
            'reply_to': reply_data
        })
    return jsonify(result)

# Предпросмотр ссылок
@app.route('/preview', methods=['POST'])
@login_required
def preview():
    data = request.get_json()
    url = data.get('url')
    if not url:
        return jsonify({'error': 'No URL'}), 400
    preview = fetch_link_preview(url)
    return jsonify(preview or {})

# Реакции
@app.route('/reaction', methods=['POST'])
@login_required
def add_reaction():
    data = request.get_json()
    message_id = data.get('message_id')
    message_type = data.get('message_type')
    emoji = data.get('emoji')
    if not all([message_id, message_type, emoji]):
        return jsonify({'error': 'Missing data'}), 400
    Reaction.query.filter_by(
        message_id=message_id,
        message_type=message_type,
        user_id=current_user.id
    ).delete()
    reaction = Reaction(
        message_id=message_id,
        message_type=message_type,
        user_id=current_user.id,
        emoji=emoji
    )
    db.session.add(reaction)
    db.session.commit()
    if message_type == 'private':
        msg = Message.query.get(message_id)
        if msg:
            emit('reaction_updated', {'message_id': message_id, 'message_type': message_type, 'emoji': emoji, 'user_id': current_user.id}, room=f'user_{msg.receiver_id}')
            emit('reaction_updated', {'message_id': message_id, 'message_type': message_type, 'emoji': emoji, 'user_id': current_user.id}, room=f'user_{msg.sender_id}')
    else:
        msg = GroupMessage.query.get(message_id)
        if msg:
            emit('reaction_updated', {'message_id': message_id, 'message_type': message_type, 'emoji': emoji, 'user_id': current_user.id}, room=f'group_{msg.group_id}')
    return jsonify({'success': True})

@app.route('/get_reactions', methods=['POST'])
@login_required
def get_reactions():
    data = request.get_json()
    message_id = data.get('message_id')
    message_type = data.get('message_type')
    if not message_id or not message_type:
        return jsonify({'error': 'Missing data'}), 400
    reactions = Reaction.query.filter_by(message_id=message_id, message_type=message_type).all()
    result = {}
    for r in reactions:
        if r.emoji not in result:
            result[r.emoji] = []
        result[r.emoji].append(r.user_id)
    return jsonify(result)

# Поиск
@app.route('/search')
@login_required
def search():
    q = request.args.get('q', '').strip()
    if len(q) < 2:
        return jsonify({'users': [], 'groups': [], 'private_messages': [], 'group_messages': []})
    users = User.query.filter(User.username.contains(q), User.id != current_user.id).limit(5).all()
    groups = Group.query.join(GroupMember).filter(Group.name.contains(q), GroupMember.user_id == current_user.id).limit(5).all()
    private_msgs = Message.query.filter(
        ((Message.sender_id == current_user.id) | (Message.receiver_id == current_user.id)),
        Message.content.contains(q),
        Message.deleted == False
    ).order_by(Message.timestamp.desc()).limit(10).all()
    group_msgs = GroupMessage.query.join(Group).join(GroupMember).filter(
        GroupMember.user_id == current_user.id,
        GroupMessage.content.contains(q),
        GroupMessage.deleted == False
    ).order_by(GroupMessage.timestamp.desc()).limit(10).all()
    return jsonify({
        'users': [{'id': u.id, 'username': u.username, 'avatar': u.avatar} for u in users],
        'groups': [{'id': g.id, 'name': g.name} for g in groups],
        'private_messages': [{'id': m.id, 'content': m.content, 'sender': m.sender.username, 'timestamp': m.timestamp.strftime('%H:%M')} for m in private_msgs],
        'group_messages': [{'id': m.id, 'content': m.content, 'group': m.group.name, 'sender': m.sender.username, 'timestamp': m.timestamp.strftime('%H:%M')} for m in group_msgs]
    })

# ---------- WebSocket ----------
@socketio.on('connect')
def handle_connect(*args, **kwargs):
    if current_user.is_authenticated:
        current_user.status = 'online'
        current_user.last_seen = datetime.utcnow()
        db.session.commit()
        join_room(f'user_{current_user.id}')
        groups = GroupMember.query.filter_by(user_id=current_user.id).all()
        for gm in groups:
            join_room(f'group_{gm.group_id}')
        emit('user_status', {'user_id': current_user.id, 'username': current_user.username, 'status': 'online'}, broadcast=True)

@socketio.on('disconnect')
def handle_disconnect():
    if current_user.is_authenticated:
        current_user.status = 'offline'
        current_user.last_seen = datetime.utcnow()
        db.session.commit()
        emit('user_status', {'user_id': current_user.id, 'username': current_user.username, 'status': 'offline'}, broadcast=True)

@socketio.on('private_message')
def handle_private_message(data):
    if current_user.is_authenticated:
        content = data.get('content', '')
        file_path = data.get('file_path')
        file_name = data.get('file_name')
        file_type = data.get('file_type')
        reply_to_id = data.get('reply_to_id')
        link_preview = None
        urls = extract_urls(content)
        if urls:
            preview_data = fetch_link_preview(urls[0])
            if preview_data:
                link_preview = jsonify(preview_data).get_data(as_text=True)
        msg = Message(
            content=content,
            file_path=file_path,
            file_name=file_name,
            file_type=file_type,
            sender_id=current_user.id,
            receiver_id=data['receiver_id'],
            link_preview=link_preview,
            reply_to_id=reply_to_id
        )
        db.session.add(msg)
        db.session.commit()
        reply_data = None
        if reply_to_id:
            reply = Message.query.get(reply_to_id)
            if reply and not reply.deleted:
                reply_data = {'id': reply.id, 'content': reply.content[:100], 'sender_name': reply.sender.username}
        msg_data = {
            'id': msg.id,
            'content': msg.content,
            'file_path': msg.file_path,
            'file_name': msg.file_name,
            'file_type': msg.file_type,
            'sender_id': current_user.id,
            'sender_name': current_user.username,
            'receiver_id': data['receiver_id'],
            'timestamp': msg.timestamp.strftime('%H:%M'),
            'is_own': False,
            'edited': False,
            'deleted': False,
            'link_preview': link_preview,
            'reply_to': reply_data
        }
        emit('new_message', msg_data, room=f'user_{data["receiver_id"]}')
        msg_data['is_own'] = True
        emit('new_message', msg_data, room=f'user_{current_user.id}')

@socketio.on('group_message')
def handle_group_message(data):
    if current_user.is_authenticated:
        group_id = data['group_id']
        member = GroupMember.query.filter_by(user_id=current_user.id, group_id=group_id).first()
        if not member:
            return
        content = data.get('content', '')
        file_path = data.get('file_path')
        file_name = data.get('file_name')
        file_type = data.get('file_type')
        reply_to_id = data.get('reply_to_id')
        link_preview = None
        urls = extract_urls(content)
        if urls:
            preview_data = fetch_link_preview(urls[0])
            if preview_data:
                link_preview = jsonify(preview_data).get_data(as_text=True)
        msg = GroupMessage(
            content=content,
            file_path=file_path,
            file_name=file_name,
            file_type=file_type,
            sender_id=current_user.id,
            group_id=group_id,
            link_preview=link_preview,
            reply_to_id=reply_to_id
        )
        db.session.add(msg)
        db.session.commit()
        read = GroupMessageRead(message_id=msg.id, user_id=current_user.id)
        db.session.add(read)
        db.session.commit()
        total_members = GroupMember.query.filter_by(group_id=group_id).count()
        reply_data = None
        if reply_to_id:
            reply = GroupMessage.query.get(reply_to_id)
            if reply and not reply.deleted:
                reply_data = {'id': reply.id, 'content': reply.content[:100], 'sender_name': reply.sender.username}
        base_data = {
            'id': msg.id,
            'content': msg.content,
            'file_path': msg.file_path,
            'file_name': msg.file_name,
            'file_type': msg.file_type,
            'sender_id': current_user.id,
            'sender_name': current_user.username,
            'sender_avatar': current_user.avatar,
            'group_id': group_id,
            'timestamp': msg.timestamp.strftime('%H:%M'),
            'edited': False,
            'deleted': False,
            'read_count': 1,
            'total_members': total_members,
            'link_preview': link_preview,
            'reply_to': reply_data
        }
        emit('new_group_message', base_data, room=f'group_{group_id}')

@socketio.on('edit_message')
def handle_edit_message(data):
    if current_user.is_authenticated:
        msg_type = data['type']
        msg_id = data['msg_id']
        new_content = data['new_content']
        if msg_type == 'private':
            msg = Message.query.get(msg_id)
            if msg and msg.sender_id == current_user.id:
                msg.content = new_content
                msg.edited = True
                db.session.commit()
                emit('message_edited', {'msg_id': msg_id, 'new_content': new_content, 'type': 'private'}, room=f'user_{msg.receiver_id}')
                emit('message_edited', {'msg_id': msg_id, 'new_content': new_content, 'type': 'private'}, room=f'user_{current_user.id}')
        elif msg_type == 'group':
            msg = GroupMessage.query.get(msg_id)
            if msg and msg.sender_id == current_user.id:
                msg.content = new_content
                msg.edited = True
                db.session.commit()
                emit('message_edited', {'msg_id': msg_id, 'new_content': new_content, 'type': 'group'}, room=f'group_{msg.group_id}')

@socketio.on('delete_message')
def handle_delete_message(data):
    if current_user.is_authenticated:
        msg_type = data['type']
        msg_id = data['msg_id']
        if msg_type == 'private':
            msg = Message.query.get(msg_id)
            if msg and (msg.sender_id == current_user.id or msg.receiver_id == current_user.id):
                msg.deleted = True
                db.session.commit()
                emit('message_deleted', {'msg_id': msg_id, 'type': 'private'}, room=f'user_{msg.receiver_id}')
                emit('message_deleted', {'msg_id': msg_id, 'type': 'private'}, room=f'user_{current_user.id}')
        elif msg_type == 'group':
            msg = GroupMessage.query.get(msg_id)
            if msg and msg.sender_id == current_user.id:
                msg.deleted = True
                db.session.commit()
                emit('message_deleted', {'msg_id': msg_id, 'type': 'group'}, room=f'group_{msg.group_id}')

@socketio.on('typing')
def handle_typing(data):
    if current_user.is_authenticated:
        if data.get('type') == 'private':
            emit('user_typing', {
                'user_id': current_user.id,
                'username': current_user.username,
                'is_typing': data['is_typing']
            }, room=f'user_{data["receiver_id"]}')
        elif data.get('type') == 'group':
            emit('user_typing', {
                'user_id': current_user.id,
                'username': current_user.username,
                'is_typing': data['is_typing'],
                'group_id': data['group_id']
            }, room=f'group_{data["group_id"]}')

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)