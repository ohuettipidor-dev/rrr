// Нейрон 0: Наставник (Диспетчер Авто-Доктора)
import { writeFile } from './neuron_github.js';
import { getPatch, applyPatch } from './neuron_diagnost.js';

const chatLog = []; // Лог сообщений для контекста

export async function process(prompt) {
    const q = prompt.trim();
    chatLog.push(`Архитектор: ${q}`);

    // Ручные команды для теста
    if (q.startsWith('!хорошо')) {
        chatLog.push('Наставник: ✅ Запомнил успех.');
        return "✅ Понял.";
    }

    if (q.startsWith('!плохо')) {
        const reason = q.replace('!плохо', '').trim() || 'не указана';
        chatLog.push(`Наставник: 🚨 Ручной вызов с причиной "${reason}".`);
        const currentCode = await fetchCurrentCode();
        if (!currentCode) return "❌ Не могу получить код нейрона.";
        
        // Используем проблему по умолчанию — "context_lost"
        const diff = await getPatch('context_lost', currentCode, chatLog.slice(-10));
        if (!diff) return "❌ Не удалось сгенерировать патч.";

        const newCode = applyPatch(currentCode, diff);
        if (newCode === currentCode) return "❌ Патч не изменил код.";

        const writeResult = await writeFile('neurons/neuron_intellect.js', newCode, '🛠 Ручной точечный фикс');
        chatLog.push(`Наставник: ${writeResult}`);
        return `📝 Ручной фикс выполнен:\n${writeResult}`;
    }

    if (q.includes('статистика')) {
        return "📊 Статистика временно недоступна.";
    }

    return null;
}

async function fetchCurrentCode() {
    try {
        const res = await fetch('https://raw.githubusercontent.com/ohuettipidor-dev/rrr/main/neurons/neuron_intellect.js');
        if (!res.ok) return null;
        return await res.text();
    } catch {
        return null;
    }
}
