// Нейрон: Анализатор (Автоматический страж)
import { writeFile } from './neuron_github.js';

let lastErrorFixed = null;

// Список проблем, которые мы умеем определять автоматически
const PROBLEM_TYPES = [
    { keywords: ['перегружен', 'облачный разум'], code: 'overload', description: 'Облачный разум временно перегружен' },
    { keywords: ['контекст', 'не помнит', 'забыл'], code: 'context_lost', description: 'Потеря контекста' },
    { keywords: ['не как человек', 'слишком робот', 'без души'], code: 'robotic', description: 'Отвечает не как человек' },
];

// Функция для вывода сообщения в чат
function addMsgToChat(role, text) {
    const chatEl = document.getElementById("chat");
    if (!chatEl) return;
    const div = document.createElement("div");
    div.className = `msg ${role}`;
    div.innerHTML = `<div class="bubble">${text.replace(/\n/g, "<br>")}</div>`;
    chatEl.appendChild(div);
    chatEl.scrollTop = chatEl.scrollHeight;
}

export async function process(prompt) { return null; }

export function startAnalyzer() {
    setInterval(async () => {
        const botMessages = document.querySelectorAll('.bot .bubble');
        for (const msg of botMessages) {
            const text = msg.textContent;
            // Ищем совпадения с нашим списком проблем
            for (const problem of PROBLEM_TYPES) {
                if (problem.keywords.some(kw => text.toLowerCase().includes(kw))) {
                    const now = Date.now();
                    if (lastErrorFixed && (now - lastErrorFixed < 60000)) return;
                    console.log(`🚨 Анализатор: обнаружена проблема "${problem.description}". Запускаю исправление...`);
                    lastErrorFixed = now;

                    // Вызываем Диагноста с кодом проблемы
                    const diagnosis = await diagnoseAndFix(problem.code, problem.description);
                    
                    // Показываем результат в чате
                    addMsgToChat('bot', `🛠 Авто-Доктор: обнаружена проблема "${problem.description}".\n${diagnosis}`);
                }
            }
        }
    }, 10000);
}

// Функция-заглушка для Диагноста (мы его скоро заменим на полноценный)
async function diagnoseAndFix(problemCode, description) {
    // Пока что просто возвращаем сообщение, что проблема обнаружена
    // В следующем шаге мы подключим сюда реальный LLM
    return `🔍 Диагноз: ${problemCode}. Ищу решение...`;
}
