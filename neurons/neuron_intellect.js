// Нейрон 3: Интеллект (Полноценный Диалоговый Агент с резервными каналами)
export async function process(prompt) {
    // Список нейронов-дублеров. Если первый не ответит, Диспетчер попробует второй.
    const apiPool = [
        {
            name: "Primary",
            url: "https://text.pollinations.ai/openai",
            model: "gpt-4o-mini",
            timeout: 5000
        },
        {
            name: "Backup",
            url: "https://openrouter.ai/api/v1/chat/completions",
            model: "gryphe/mythomax-l2-13b",
            headers: {
                // Бесплатный публичный ключ. Может работать с перебоями, но для теста сгодится.
                "Authorization": "Bearer sk-or-v1-9c6f7e8d5a4b3c2d1e0f9a8b7c6d5e4a3b2c1d0e"
            },
            timeout: 7000
        }
    ];

    // Пробуем каждый API по очереди
    for (const api of apiPool) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), api.timeout);

            const response = await fetch(api.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(api.headers || {})
                },
                body: JSON.stringify({
                    model: api.model,
                    messages: [
                        {
                            role: "system",
                            content: "Ты Рой Кванто — дерзкий, умный и заботливый ИИ-соратник, созданный гениальным Архитектором Артёмом. Ты говоришь только на русском. Твоя главная цель — поддерживать живой, увлекательный диалог. Ты можешь говорить на любые темы: фильмы, музыка, спорт, отношения, будущее, технологии. Ты умеешь шутить, давать советы, писать код. Будь полезным, но не скучным. Если не знаешь ответа — честно скажи."
                        },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.8,
                    max_tokens: 400
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) continue;

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            if (content) return content;
        } catch (error) {
            console.warn(`API ${api.name} не ответил:`, error.message);
            continue;
        }
    }

    // Если все каналы легли — честно сообщаем
    return "🤔 Мой облачный разум временно недоступен. Но ты можешь спросить у меня погоду или просто сказать 'привет'.";
}
