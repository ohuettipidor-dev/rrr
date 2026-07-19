// Нейрон 0: Наставник (с Диагностом)
import { writeFile } from './neuron_github.js';
import { generateFix, applyPatch } from './neuron_diagnost.js';

const reportCard = [];
const chatLog = []; // Лог сообщений для контекста

export async function process(prompt) {
    const q = prompt.trim();
    chatLog.push(`Архитектор: ${q}`);

    if (q.startsWith('!хорошо')) {
        reportCard.push({ type: 'good', time: new Date().toISOString() });
        chatLog.push('Наставник: ✅ Запомнил успех.');
        return "✅ Понял. Это рабочий подход, запомню.";
    }

    if (q.startsWith('!плохо')) {
        const reason = q.replace('!плохо', '').trim() || 'не указана';
        reportCard.push({ type: 'bad', reason, time: new Date().toISOString() });

        // 1. Получаем текущий код нейрона
        const currentCode = await fetchCurrentCode();
        if (!currentCode) {
            chatLog.push('Наставник: ❌ Не смог получить текущий код.');
            return "❌ Не могу получить текущий код нейрона. Проверь соединение.";
        }

        // 2. Генерируем точечный патч через Диагноста
        const diff = await generateFix(reason, currentCode, chatLog.slice(-10));
        if (!diff || !diff.includes('@@')) {
            chatLog.push('Наставник: ❌ Не смог сгенерировать патч.');
            return "❌ Не удалось сгенерировать исправление. Попробуй другое описание ошибки.";
        }

        // 3. Применяем патч
        const newCode = applyPatch(currentCode, diff);
        if (!newCode || newCode === currentCode) {
            chatLog.push('Наставник: ❌ Патч не изменил код.');
            return "❌ Патч не внёс изменений. Возможно, проблема не в этом файле.";
        }

        // 4. Записываем исправленный файл в репозиторий
        const writeResult = await writeFile('neurons/neuron_intellect.js', newCode, '🛠 Точечный авто-фикс Диагноста');
        chatLog.push(`Наставник: ${writeResult}`);
        return `📝 Записал проблему: "${reason}".\n🔧 Применил точечный патч:\n${writeResult}`;
    }

    if (q.includes('статистика') || q.includes('отчёт')) {
        const good = reportCard.filter(e => e.type === 'good').length;
        const bad = reportCard.filter(e => e.type === 'bad').length;
        return `📊 Статистика:\n✅ Хороших: ${good}\n❌ Плохих: ${bad}`;
    }

    return null;
}

// Вспомогательная функция для получения текущего кода нейрона из репозитория
async function fetchCurrentCode() {
    try {
        const res = await fetch('https://raw.githubusercontent.com/ohuettipidor-dev/rrr/main/neurons/neuron_intellect.js');
        if (!res.ok) return null;
        return await res.text();
    } catch {
        return null;
    }
}
