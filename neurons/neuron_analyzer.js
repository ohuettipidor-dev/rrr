// Нейрон: Анализатор (Наблюдатель)
// Он следит за чатом и сообщает о проблемах.
export async function process(prompt) { return null; }

export function startAnalyzer() {
    setInterval(() => {
        const botMessages = document.querySelectorAll('.bot .bubble');
        for (const msg of botMessages) {
            const text = msg.textContent;
            if (text.includes('⚠ Облачный разум временно перегружен')) {
                console.warn("🔍 Анализатор: обнаружена ошибка Интеллекта.");
            }
            if (text.includes('❌ Ошибка связи с GitHub')) {
                console.error("🔍 Анализатор: обнаружена ошибка связи с GitHub.");
            }
        }
    }, 5000);
}
