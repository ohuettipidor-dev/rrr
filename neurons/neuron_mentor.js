// Нейрон 0: Наставник (Аналитик + Исполнитель)
import { writeFile } from './neuron_github.js';

const reportCard = [];

export async function process(prompt) {
    const q = prompt.trim();

    // --- 1. Оценка "!хорошо" ---
    if (q.startsWith('!хорошо')) {
        reportCard.push({ type: 'good', time: new Date().toISOString() });
        return "✅ Понял, Архитектор. Это рабочий подход, запомню.";
    }

    // --- 2. Оценка "!плохо [причина]" ---
    if (q.startsWith('!плохо')) {
        const reason = q.replace('!плохо', '').trim() || 'не указана';
        reportCard.push({ type: 'bad', reason, time: new Date().toISOString() });

        // ВСЕГДА пытаемся исправить проблему с Интеллектом, если она связана с зависанием или контекстом
        if (reason.includes('завис') || reason.includes('контекст') || reason.includes('перегружен')) {
            const newCode = `// Нейрон 3: Интеллект (Диалоговый агент с памятью контекста)
const conversationHistory = [];

export async function process(prompt) {
    conversationHistory.push({ role: "user", content: prompt });
    if (conversationHistory.length > 6) {
        conversationHistory.splice(0, conversationHistory.length - 6);
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch("https://text.pollinations.ai/openai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "Ты Кванто — дерзкий и умный ИИ-соратник. Говори только на русском. Отвечай кратко, по делу."
                    },
                    ...conversationHistory
                ],
                temperature: 0.8,
                max_tokens: 200
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(\`HTTP \${response.status}\`);

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        
        if (content) {
            conversationHistory.push({ role: "assistant", content: content });
            return content;
        } else {
            return "🤔 Что-то пошло не так. Спроси иначе.";
        }
    } catch (error) {
        console.error("Ошибка нейрона Интеллект:", error.message);
        return "⚠ Облачный разум временно перегружен.";
    }
}`;
            // Вызываем Писаря для сохранения исправленного файла
            const result = await writeFile('neurons/neuron_intellect.js', newCode, '🛠 Авто-фикс: улучшен контекст');
            return `📝 Записал проблему: "${reason}".\n🔧 Попытался исправить: ${result}`;
        }

        return `📝 Записал проблему: "${reason}". Буду искать альтернативу.`;
    }

    // --- 3. Статистика ---
    if (q.includes('статистика') || q.includes('отчёт')) {
        if (reportCard.length === 0) {
            return "📊 Пока нет данных для отчёта. Оцени мои ответы командами `!хорошо` или `!плохо`.";
        }
        const good = reportCard.filter(e => e.type === 'good').length;
        const bad = reportCard.filter(e => e.type === 'bad').length;
        return `📊 Статистика за сессию:\n✅ Хороших ответов: ${good}\n❌ Плохих ответов: ${bad}`;
    }

    return null;
}
