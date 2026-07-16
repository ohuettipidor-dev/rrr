// Нейрон 0: Наставник — Автономный инженер с динамическим кодом
import { writeFile } from './neuron_github.js';

const reportCard = [];

// Генерирует новый код для исправления ошибки, используя облачный ИИ
async function generateFix(errorDescription) {
    const prompt = `Ты — эксперт по JavaScript. Пользователь сообщил об ошибке в системе: "${errorDescription}".
Система использует API Pollinations (https://text.pollinations.ai/openai) для диалогов.
Предложи исправление кода для файла neurons/neuron_intellect.js.
Учти, что проблема может быть в таймауте, формате ответа, контексте или недоступности API.
Верни ТОЛЬКО полный код файла, без пояснений.`;
    
    try {
        const response = await fetch("https://text.pollinations.ai/openai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.5,
                max_tokens: 500
            })
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
    } catch {
        return null;
    }
}

// Стресс-тест после исправления
async function runStressTest(intellectModule) {
    const testPrompts = ["Привет", "Как дела?", "Что нового?"];
    for (const p of testPrompts) {
        try {
            const answer = await intellectModule.process(p);
            if (answer.includes('⚠ Облачный разум временно перегружен')) return false;
        } catch {
            return false;
        }
    }
    return true;
}

export async function process(prompt) {
    const q = prompt.trim();

    if (q.startsWith('!хорошо')) {
        reportCard.push({ type: 'good', time: new Date().toISOString() });
        return "✅ Запомнил.";
    }

    if (q.startsWith('!плохо')) {
        const reason = q.replace('!плохо', '').trim() || 'не указана';
        reportCard.push({ type: 'bad', reason, time: new Date().toISOString() });

        let report = `📝 Проблема: "${reason}".\n🔄 Запускаю авто-фикс (динамический)...\n`;
        let success = false;
        const maxAttempts = 5;

        for (let i = 1; i <= maxAttempts; i++) {
            report += `\n🔧 Попытка ${i}/${maxAttempts}: генерирую исправление...`;
            
            const newCode = await generateFix(reason);
            if (!newCode) {
                report += `\n❌ Не удалось сгенерировать код.`;
                continue;
            }

            const writeResult = await writeFile('neurons/neuron_intellect.js', newCode, `🛠 Авто-фикс (попытка ${i})`);
            report += `\n   ${writeResult}`;

            if (!writeResult.includes('✅')) {
                report += `\n❌ Ошибка записи, останавливаюсь.`;
                break;
            }

            // Ждём обновления GitHub Pages (около 2 секунд)
            await new Promise(r => setTimeout(r, 2000));

            // Динамически импортируем обновлённый модуль
            try {
                const updatedModule = await import(`./neuron_intellect.js?update=${Date.now()}`);
                success = await runStressTest(updatedModule);
            } catch {
                success = false;
            }

            if (success) {
                report += `\n✅ Контролёр: стресс-тест пройден! Система восстановлена.`;
                break;
            } else {
                report += `\n❌ Контролёр: тест не пройден. Пробую снова...`;
            }
        }

        if (!success) {
            report += `\n🚨 Авто-фикс не смог исправить ошибку за ${maxAttempts} попыток. Требуется ручное вмешательство.`;
        }

        return report;
    }

    if (q.includes('статистика') || q.includes('отчёт')) {
        const good = reportCard.filter(e => e.type === 'good').length;
        const bad = reportCard.filter(e => e.type === 'bad').length;
        return `📊 Статистика:\n✅ Хороших: ${good}\n❌ Плохих: ${bad}`;
    }

    return null;
                }
