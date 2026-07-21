# -*- coding: utf-8 -*-
import os
import json
import requests
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from groq import Groq

app = FastAPI()
MODEL = "llama-3.3-70b-versatile"

def get_client():
    key = os.environ.get("GROQ_API_KEY")
    if not key:
        raise ValueError("GROQ_API_KEY не задан")
    return Groq(api_key=key)

# ---------- Инструменты ----------

def search_wikipedia(query: str) -> str:
    try:
        url = f"https://ru.wikipedia.org/api/rest_v1/page/summary/{requests.utils.quote(query)}"
        r = requests.get(url, timeout=6)
        if r.status_code == 200:
            data = r.json()
            extract = data.get("extract", "")
            return extract[:1500] if extract else "Ничего не найдено."
        return "Статья не найдена."
    except Exception as e:
        return f"Ошибка поиска: {e}"

def run_python_code(code: str) -> str:
    try:
        exec_globals = {}
        exec(code, exec_globals)
        result = exec_globals.get("result", None)
        if result is not None:
            return str(result)
        output = {k: v for k, v in exec_globals.items() if not k.startswith("__")}
        return str(output) if output else "Код выполнен успешно."
    except Exception as e:
        return f"Ошибка: {e}"

def read_file(filepath: str) -> str:
    if not os.path.exists(filepath):
        return f"Файл '{filepath}' не найден."
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read()[:3000]
    except Exception as e:
        return f"Ошибка чтения: {e}"

def write_file(filepath: str, content: str) -> str:
    try:
        os.makedirs(os.path.dirname(filepath) or ".", exist_ok=True)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        return f"Файл '{filepath}' успешно записан."
    except Exception as e:
        return f"Ошибка записи: {e}"

TOOLS = {
    "search_wikipedia": search_wikipedia,
    "run_python_code": run_python_code,
    "read_file": read_file,
    "write_file": write_file,
}

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "search_wikipedia",
            "description": "Найти информацию по теме в русской Википедии.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Поисковый запрос"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "run_python_code",
            "description": "Выполнить Python-код. Результат сохрани в переменную result.",
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {"type": "string", "description": "Код на Python"}
                },
                "required": ["code"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Прочитать содержимое файла.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filepath": {"type": "string", "description": "Путь к файлу"}
                },
                "required": ["filepath"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Записать текст в файл.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filepath": {"type": "string", "description": "Путь к файлу"},
                    "content": {"type": "string", "description": "Содержимое"}
                },
                "required": ["filepath", "content"]
            }
        }
    }
]

SYSTEM_PROMPT = """Ты — умный и полезный ИИ-агент. Ты можешь использовать инструменты:
- search_wikipedia — поиск информации в Википедии
- run_python_code — выполнение Python-кода
- read_file / write_file — работа с файлами

Отвечай на русском языке. Будь точным и кратким."""

# ---------- Веб-интерфейс ----------

@app.get("/", response_class=HTMLResponse)
async def home():
    return HTMLResponse("""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ИИ Агент</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', sans-serif; background: #0f0f17; color: #e0e0e0; height: 100vh; display: flex; flex-direction: column; }
  header { padding: 16px 24px; background: #1a1a2e; border-bottom: 1px solid #2a2a4a; font-size: 18px; font-weight: 600; color: #a78bfa; }
  #chat { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 14px; }
  .msg { display: flex; flex-direction: column; max-width: 80%; }
  .msg.user { align-self: flex-end; align-items: flex-end; }
  .msg.bot  { align-self: flex-start; align-items: flex-start; }
  .bubble { padding: 12px 16px; border-radius: 18px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
  .user .bubble { background: #4c1d95; border-bottom-right-radius: 4px; }
  .bot  .bubble { background: #1e1e3a; border-bottom-left-radius: 4px; }
  .tool-info { font-size: 12px; color: #7c3aed; margin-bottom: 4px; font-style: italic; }
  #input-area { display: flex; gap: 10px; padding: 16px 20px; background: #1a1a2e; border-top: 1px solid #2a2a4a; }
  #input { flex: 1; padding: 12px 16px; border-radius: 24px; border: 1px solid #3a3a6a; background: #0f0f17; color: #e0e0e0; font-size: 15px; outline: none; }
  #input:focus { border-color: #7c3aed; }
  #send { background: #7c3aed; border: none; border-radius: 50%; width: 46px; height: 46px; color: #fff; font-size: 20px; cursor: pointer; }
  #send:disabled { opacity: 0.4; cursor: not-allowed; }
  .spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid #7c3aed; border-top-color: transparent; border-radius: 50%; animation: spin 0.7s linear infinite; vertical-align: middle; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<header>🤖 ИИ Агент (Groq · Llama 3.3 70B)</header>
<div id="chat"></div>
<div id="input-area">
  <input id="input" type="text" placeholder="Напиши что-нибудь..." autocomplete="off">
  <button id="send" onclick="send()">➤</button>
</div>
<script>
const chat = document.getElementById('chat');
const input = document.getElementById('input');
const btn = document.getElementById('send');

function addMsg(role, html) {
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  const b = document.createElement('div');
  b.className = 'bubble';
  b.innerHTML = html;
  div.appendChild(b);
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return b;
}

async function send() {
  const text = input.value.trim();
  if (!text) return;
  addMsg('user', text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'));
  input.value = '';
  btn.disabled = true;
  const bubble = addMsg('bot', '<span class="spinner"></span>');

  try {
    const res = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: text })
    });
    const data = await res.json();
    bubble.textContent = data.answer || data.error || 'Нет ответа';
    if (data.tools_used && data.tools_used.length > 0) {
      const t = document.createElement('div');
      t.className = 'tool-info';
      t.textContent = '🔧 Инструменты: ' + data.tools_used.join(', ');
      bubble.parentElement.insertBefore(t, bubble);
    }
  } catch(e) {
    bubble.textContent = 'Ошибка: ' + e.message;
  }
  btn.disabled = false;
  input.focus();
}

input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
addMsg('bot', 'Привет! Я ИИ-агент. Могу искать информацию, выполнять код, читать и создавать файлы. Чем помочь?');
</script>
</body>
</html>""")


# ---------- API ----------

@app.post("/chat")
async def chat(request: Request):
    data = await request.json()
    user_prompt = data.get("prompt", "").strip()
    if not user_prompt:
        return {"error": "Пустой запрос"}

    try:
        client = get_client()
    except ValueError as e:
        return {"error": str(e)}

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt}
    ]

    tools_used = []

    for _ in range(6):
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            tools=TOOL_SCHEMAS,
            tool_choice="auto",
            max_tokens=1024,
        )
        msg = response.choices[0].message

        if not msg.tool_calls:
            return {"answer": msg.content or "Готово.", "tools_used": tools_used}

        messages.append({
            "role": "assistant",
            "content": msg.content,
            "tool_calls": [
                {"id": tc.id, "type": "function",
                 "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                for tc in msg.tool_calls
            ]
        })

        for tc in msg.tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments)
            except Exception:
                args = {}

            result = TOOLS[name](**args) if name in TOOLS else f"Инструмент '{name}' не найден."
            if name in TOOLS and name not in tools_used:
                tools_used.append(name)

            messages.append({"role": "tool", "tool_call_id": tc.id, "content": str(result)})

    return {"error": "Превышен лимит итераций.", "tools_used": tools_used}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
