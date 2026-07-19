// Нейрон: Анализатор (Автоматический страж + Лекарь)
import { writeFile } from './neuron_github.js';
import { getPatch, applyPatch } from './neuron_diagnost.js';

let lastErrorFixed = null;

// Список проблем
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

// Вспомогательная функция для получения текущего кода нейрона
async function fetchCurrentCode() {
    try {
        const res = await fetch('https://raw.githubusercontent.com/ohuettipidor-dev/rrr/main/neurons/neuron_intellect.js');
        if (!res.ok) return null;
        return await res.text();
    } catch {
        return null;
    }
}

export async function process(prompt) { return null; }

export function startAnalyzer() {
    setInterval(async () => {
        const botMessages = document.querySelectorAll('.bot .bubble');
        for (const msg of botMessages) {
            const text = msg.textContent;
            for (const problem of PROBLEM_TYPES) {
                if (problem.keywords.some(kw => text.toLowerCase().includes(kw))) {
                    const now = Date.now();
                    if (lastErrorFixed && (now - lastErrorFixed < 60000)) return;
                    console.log(`🚨 Анализатор: обнаружена проблема "${problem.description}". Запускаю исправление...`);
                    lastErrorFixed = now;

                    // Получаем текущий код нейрона
                    const currentCode = await fetchCurrentCode();
                    if (!currentCode) {
                        addMsgToChat('bot', '🛠 Авто-Доктор: ❌ Не могу получить код нейрона.');
                        return;
                    }

                    // Генерируем патч через Диагноста
                    const diff = await getPatch(problem.code, currentCode, [text]);
                    if (!diff) {
                        addMsgToChat('bot', '🛠 Авто-Доктор: ❌ Не удалось сгенерировать патч.');
                        return;
                    }

                    // Применяем патч
                    const newCode = applyPatch(currentCode, diff);
                    if (!newCode || newCode === currentCode) {
                        addMsgToChat('bot', '🛠 Авто-Доктор: ❌ Патч не изменил код.');
                        return;
                    }

                    // Сохраняем исправленный файл
                    const writeResult = await writeFile('neurons/neuron_intellect.js', newCode, '🛠 Авто-фикс: ' + problem.description);
                    
                    // Показываем результат в чате
                    addMsgToChat('bot', `🛠 Авто-Доктор: обнаружена проблема "${problem.description}".\n${writeResult}`);
                }
            }
        }
    }, 10000);
}
