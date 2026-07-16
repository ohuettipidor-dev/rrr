// Нейрон 0: Наставник + Непрерывный Авто-фикс
import { writeFile } from './neuron_github.js';
import { process as intellect } from './neuron_intellect.js';

const reportCard = [];

// Несколько запасных версий Интеллекта, которые будет пробовать Наставник
const FIX_STRATEGIES = [
    {
        name: "Основной API + короткий таймаут",
        code: `// Интеллект (Основной API)
const conversationHistory = [];
export async function process(prompt) {
    conversationHistory.push({ role: "user", content: prompt });
    if (conversationHistory.length > 6) conversationHistory.splice(0, conversationHistory.length - 6);
    try {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 5000);
        const r = await fetch("https://text.pollinations.ai/openai", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ model:"gpt-4o-mini", messages:[{role:"system",content:"Ты Кванто. Говори на русском. Отвечай кратко."}, ...conversationHistory], temperature:0.8, max_tokens:200 }), signal:c.signal });
        clearTimeout(t);
        if (!r.ok) throw new Error("HTTP "+r.status);
        const d = await r.json();
        const txt = d.choices?.[0]?.message?.content;
        if (txt) { conversationHistory.push({ role:"assistant", content:txt }); return txt; }
        return "🤔 Спроси иначе.";
    } catch(e) { return "⚠ Облачный разум временно перегружен."; }
}`
    },
    {
        name: "Основной API + длинный таймаут",
        code: `// Интеллект (Основной API, таймаут 12с)
const conversationHistory = [];
export async function process(prompt) {
    conversationHistory.push({ role: "user", content: prompt });
    if (conversationHistory.length > 6) conversationHistory.splice(0, conversationHistory.length - 6);
    try {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 12000);
        const r = await fetch("https://text.pollinations.ai/openai", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ model:"gpt-4o-mini", messages:[{role:"system",content:"Ты Кванто. Говори на русском. Отвечай кратко."}, ...conversationHistory], temperature:0.8, max_tokens:200 }), signal:c.signal });
        clearTimeout(t);
        if (!r.ok) throw new Error("HTTP "+r.status);
        const d = await r.json();
        const txt = d.choices?.[0]?.message?.content;
        if (txt) { conversationHistory.push({ role:"assistant", content:txt }); return txt; }
        return "🤔 Спроси иначе.";
    } catch(e) { return "⚠ Облачный разум временно перегружен."; }
}`
    },
    {
        name: "Резервный API OpenRouter",
        code: `// Интеллект (Резервный API OpenRouter)
const conversationHistory = [];
export async function process(prompt) {
    conversationHistory.push({ role: "user", content: prompt });
    if (conversationHistory.length > 6) conversationHistory.splice(0, conversationHistory.length - 6);
    try {
        const c = new AbortController();
        const t = setTimeout(() => c.abort(), 7000);
        const r = await fetch("https://openrouter.ai/api/v1/chat/completions", { method:"POST", headers:{"Content-Type":"application/json","Authorization":"Bearer sk-or-v1-9c6f7e8d5a4b3c2d1e0f9a8b7c6d5e4a3b2c1d0e"}, body:JSON.stringify({ model:"gryphe/mythomax-l2-13b", messages:[{role:"system",content:"Ты Кванто. Говори на русском. Отвечай кратко."}, ...conversationHistory], temperature:0.8, max_tokens:200 }), signal:c.signal });
        clearTimeout(t);
        if (!r.ok) throw new Error("HTTP "+r.status);
        const d = await r.json();
        const txt = d.choices?.[0]?.message?.content;
        if (txt) { conversationHistory.push({ role:"assistant", content:txt }); return txt; }
        return "🤔 Спроси иначе.";
    } catch(e) { return "⚠ Облачный разум временно перегружен."; }
}`
    }
];

let currentStrategyIndex = 0;

async function runStressTest() {
    const testPrompts = ["Привет", "Как дела?", "Что нового?"];
    const results = [];
    for (const p of testPrompts) {
        const answer = await intellect(p);
        results.push(answer);
    }
    return results.every(r => !r.includes('⚠ Облачный разум временно перегружен'));
}

export async function process(prompt) {
    const q = prompt.trim();

    if (q.startsWith('!хорошо')) {
        reportCard.push({ type: 'good', time: new Date().toISOString() });
        return "✅ Понял. Это рабочий подход, запомню.";
    }

    if (q.startsWith('!плохо')) {
        const reason = q.replace('!плохо', '').trim() || 'не указана';
        reportCard.push({ type: 'bad', reason, time: new Date().toISOString() });

        // --- НЕПРЕРЫВНЫЙ ЦИКЛ ИСПРАВЛЕНИЯ ---
        let finalReport = `📝 Проблема: "${reason}".\n🔄 Запускаю непрерывный авто-фикс...\n`;
        let success = false;
        const maxAttempts = FIX_STRATEGIES.length;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const strategy = FIX_STRATEGIES[currentStrategyIndex];
            finalReport += `\n🔧 Попытка ${attempt}/${maxAttempts}: ${strategy.name}...`;
            
            // Применяем стратегию
            const writeResult = await writeFile('neurons/neuron_intellect.js', strategy.code, `🛠 Авто-фикс: ${strategy.name}`);
            finalReport += `\n   ${writeResult}`;
            
            // Ждём, пока GitHub обновит файл
            await new Promise(r => setTimeout(r, 2000));
            
            // Тестируем
            finalReport += `\n   🧪 Стресс-тест...`;
            success = await runStressTest();
            
            if (success) {
                finalReport += `\n✅ Контролёр: стресс-тест пройден! Стратегия "${strategy.name}" работает.`;
                break;
            } else {
                finalReport += `\n❌ Контролёр: тест не пройден. Пробую следующую стратегию...`;
                currentStrategyIndex = (currentStrategyIndex + 1) % FIX_STRATEGIES.length;
            }
        }

        if (!success) {
            finalReport += `\n🚨 Все стратегии испробованы. Требуется ручное вмешательство.`;
        } else {
            // Сбрасываем индекс на успешную стратегию для будущих фиксов
            // currentStrategyIndex уже указывает на следующую, но мы вернём на успешную
            currentStrategyIndex = (currentStrategyIndex - 1 + FIX_STRATEGIES.length) % FIX_STRATEGIES.length;
        }

        return finalReport;
    }

    if (q.includes('статистика') || q.includes('отчёт')) {
        if (reportCard.length === 0) return "📊 Нет данных.";
        const good = reportCard.filter(e => e.type === 'good').length;
        const bad = reportCard.filter(e => e.type === 'bad').length;
        return `📊 Статистика:\n✅ Хороших: ${good}\n❌ Плохих: ${bad}`;
    }

    return null;
}
