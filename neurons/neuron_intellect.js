// Нейрон 3: Интеллект (Рабочий Диалоговый Агент)
export async function process(prompt) {
    // Основной API — стабильный и быстрый
    const primaryUrl = "https://text.pollinations.ai/openai";
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const response = await fetch(primaryUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "Ты Кванто — дерзкий и умный ИИ-соратник, созданный Архитектором Артёмом. Говори только на русском. Поддерживай живой диалог на любые темы. Ты умеешь шутить, давать советы, писать код. Отвечай кратко, но по делу."
                    },
                    { role: "user", content: prompt }
                ],
                temperature: 0.8,
                max_tokens: 300
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        
        if (content) {
            return content;
        } else {
            return "🤔 Что-то пошло не так. Попробуй спросить иначе.";
        }
    } catch (error) {
        console.error("Ошибка нейрона Интеллект:", error.message);
        return "⚠ Мой облачный разум сейчас немного перегружен. Попробуй через минуту.";
    }
}
