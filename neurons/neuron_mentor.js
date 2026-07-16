// Нейрон 0: Наставник + Контролёр
import { writeFile } from './neuron_github.js';
import { process as intellect } from './neuron_intellect.js';

const reportCard = [];

export async function process(prompt) {
    const q = prompt.trim();

    if (q.startsWith('!хорошо')) {
        reportCard.push({ type: 'good', time: new Date().toISOString() });
        return "✅ Понял. Это рабочий подход, запомню.";
    }

    if (q.startsWith('!плохо')) {
        const reason = q.replace('!плохо', '').trim() || 'не указана';
        reportCard.push({ type: 'bad', reason, time: new Date().toISOString() });

        // Исправляем Интеллект
        const newIntellectCode = `// Нейрон 3: Интеллект (Быстрый проверенный канал с контекстом)
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
                    { role: "system", content: "Ты Кванто — дерзкий и умный ИИ-соратник. Говори только на русском. Отвечай кратко, по делу." },
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

        const writeResult = await writeFile('neurons/neuron_intellect.js', newIntellectCode, '🛠 Авто-фикс Наставника');

        // === ЗАПУСК КОНТРОЛЁРА ===
        // После исправления тестируем Интеллект несколькими запросами
        const testPrompts = ["Привет", "Как дела?", "Что нового?"];
        const testResults = [];
        
        for (const testPrompt of testPrompts) {
            const answer = await intellect(testPrompt);
            testResults.push(`❓ ${testPrompt} → ${answer}`);
        }

        const isGood = testResults.every(r => !r.includes('⚠ Облачный разум временно перегружен'));
        
        let statusReport = `📝 Записал проблему: "${reason}".\n🔧 ${writeResult}`;
        
        if (isGood) {
            statusReport += `\n✅ Контролёр: исправление успешно. Стресс-тест пройден.`;
        } else {
            statusReport += `\n❌ Контролёр: проблема осталась. Стресс-тест не пройден.\nРезультаты:\n${testResults.join('\n')}`;
        }
        
        return statusReport;
    }

    if (q.includes('статистика') || q.includes('отчёт')) {
        if (reportCard.length === 0) return "📊 Пока нет данных для отчёта.";
        const good = reportCard.filter(e => e.type === 'good').length;
        const bad = reportCard.filter(e => e.type === 'bad').length;
        return `📊 Статистика:\n✅ Хороших: ${good}\n❌ Плохих: ${bad}`;
    }

    return null;
                             }
