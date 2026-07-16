// Нейрон: Анализатор (Автоматический страж)
// Он следит за появлением ошибок в чате и запускает Писаря для их исправления.
import { writeFile } from './neuron_github.js';

let lastErrorFixed = null; // Время последней авто-починки
let tokenRequested = false; // Запрашивали ли мы уже токен

// Функция для добавления сообщения в чат
function addMsgToChat(role, text) {
    const chatEl = document.getElementById("chat");
    if (!chatEl) return;
    const div = document.createElement("div");
    div.className = `msg ${role}`;
    div.innerHTML = `<div class="bubble">${text.replace(/\n/g, "<br>")}</div>`;
    chatEl.appendChild(div);
    chatEl.scrollTop = chatEl.scrollHeight;
}

export async function process(prompt) {
    return null;
}

export function startAnalyzer() {
    console.log("🔍 Анализатор активирован. Ожидаю ошибки...");

    setInterval(async () => {
        const botMessages = document.querySelectorAll('.bot .bubble');
        for (const msg of botMessages) {
            const text = msg.textContent;
            if (text.includes('⚠ Облачный разум временно перегружен')) {
                const now = Date.now();
                if (lastErrorFixed && (now - lastErrorFixed < 60000)) {
                    console.log("⏳ Анализатор: недавно уже чинили. Жду.");
                    return;
                }
                console.log("🚨 Анализатор: обнаружена ошибка Интеллекта. Запускаю исправление...");
                lastErrorFixed = now;

                // Новый код Интеллекта с резервным API
                const newIntellectCode = `// Нейрон 3: Интеллект (с резервным API)
const conversationHistory = [];

export async function process(prompt) {
    conversationHistory.push({ role: "user", content: prompt });
    if (conversationHistory.length > 6) {
        conversationHistory.splice(0, conversationHistory.length - 6);
    }

    const apiPool = [
        {
            name: "Pollinations",
            url: "https://text.pollinations.ai/openai",
            model: "gpt-4o-mini",
            key: null
        },
        {
            name: "OpenRouter",
            url: "https://openrouter.ai/api/v1/chat/completions",
            model: "gryphe/mythomax-l2-13b",
            key: "sk-or-v1-9c6f7e8d5a4b3c2d1e0f9a8b7c6d5e4a3b2c1d0e"
        }
    ];

    for (const api of apiPool) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 7000);

            const headers = { "Content-Type": "application/json" };
            if (api.key) {
                headers["Authorization"] = \`Bearer \${api.key}\`;
            }

            const response = await fetch(api.url, {
                method: "POST",
                headers: headers,
                body: JSON.stringify({
                    model: api.model,
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

            if (!response.ok) continue;

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            if (content) {
                conversationHistory.push({ role: "assistant", content: content });
                return content;
            }
        } catch (error) {
            console.warn(\`API \${api.name} не ответил:\`, error.message);
            continue;
        }
    }

    return "🤔 Все каналы связи перегружены. Попробуй позже.";
}`;

                // Вызываем Писаря
                const result = await writeFile(
                    'neurons/neuron_intellect.js',
                    newIntellectCode,
                    '🛡 Авто-фикс Анализатора: добавлен резервный API'
                );

                // Показываем результат в чате
                addMsgToChat('bot', `🛠 Анализатор: обнаружена ошибка. Автоматическое исправление:\n${result}`);
                console.log("🛠 Анализатор: " + result);
            }
        }
    }, 10000);
}
