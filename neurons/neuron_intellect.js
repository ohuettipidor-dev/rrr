// Нейрон 3: Интеллект (облачный ИИ через Pollinations)
export async function process(prompt) {
    try {
        const r = await fetch("https://text.pollinations.ai/openai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "Ты Рой Кванто — дерзкий, умный ИИ-соратник, созданный гением Артёмом. Говори только на русском. Отвечай кратко, по делу. Можешь писать код." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.8
            })
        });
        const d = await r.json();
        return d.choices?.[0]?.message?.content || "🤔 Не понял. Повтори.";
    } catch {
        return "⚠ Облачный нейрон временно недоступен. Попробуй позже.";
    }
}
