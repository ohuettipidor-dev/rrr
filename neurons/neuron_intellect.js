// Нейрон 3: Интеллект (Диалоговый агент с памятью контекста)
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

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

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
}