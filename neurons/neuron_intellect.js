// Нейрон 3: Интеллект (Диалоговый агент с памятью контекста)
const conversationHistory = [];

export async function process(prompt) {
    // 1. Добавляем сообщение пользователя в историю
    conversationHistory.push({ role: "user", content: prompt });

    // 2. Ограничиваем историю последними 10 сообщениями, чтобы не перегружать запрос
    if (conversationHistory.length > 10) {
        conversationHistory.splice(0, conversationHistory.length - 10);
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        // 3. Отправляем запрос с полной историей
        const response = await fetch("https://text.pollinations.ai/openai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "Ты Кванто — дерзкий и умный ИИ-соратник, созданный Архитектором Артёмом. Говори только на русском. Поддерживай живой диалог на любые темы. Отвечай кратко, но по делу. Задавай встречные вопросы."
                    },
                    ...conversationHistory   // <-- вся история здесь
                ],
                temperature: 0.8,
                max_tokens: 300
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        
        if (content) {
            // 4. Добавляем ответ ассистента в историю
            conversationHistory.push({ role: "assistant", content: content });
            return content;
        } else {
            return "🤔 Что-то пошло не так. Попробуй спросить иначе.";
        }
    } catch (error) {
        console.error("Ошибка нейрона Интеллект:", error.message);
        return "⚠ Мой облачный разум сейчас немного перегружен. Попробуй через минуту.";
    }
}
