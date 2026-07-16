// Нейрон 2: Датчики (погода, новости, Википедия) — CORS-совместимый
export async function process(prompt) {
    const q = prompt.toLowerCase();

    // Погода через Open-Meteo (бесплатно, без ключа, CORS совместим)
    const weatherMatch = q.match(/погода\s+(?:в\s+)?([а-яё\-]+)/i);
    if (weatherMatch) {
        try {
            const city = weatherMatch[1];
            // Сначала получим координаты города через Geocoding API
            const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ru`);
            const geoData = await geoRes.json();
            if (!geoData.results || geoData.results.length === 0) {
                return `🌤 Город "${city}" не найден.`;
            }
            const { latitude, longitude, name } = geoData.results[0];
            // Теперь запросим погоду
            const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
            const weatherData = await weatherRes.json();
            const temp = weatherData.current_weather.temperature;
            const windSpeed = weatherData.current_weather.windspeed;
            return `🌤 Погода в ${name}: 🌡 ${temp}°C, ветер ${windSpeed} м/с`;
        } catch (e) {
            console.error('Ошибка погоды:', e);
            return "⚠ Не могу получить погоду. Попробуй позже.";
        }
    }

    // Новости временно отключены (проблема CORS)
    // В будущем добавим через прокси или другой источник
    if (q.includes("новост")) {
        return "📰 Новости временно недоступны. Я работаю над этим.";
    }

    // Википедия (CORS обычно поддерживается)
    const wikiMatch = q.match(/(?:что\s+такое|кто\s+такой|расскажи\s+про|найди\s+инфу?)\s+(.+)/i);
    if (wikiMatch) {
        try {
            const query = wikiMatch[1].trim();
            const r = await fetch(`https://ru.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
            const j = await r.json();
            return j.extract || "Ничего не найдено в Википедии.";
        } catch {
            return "⚠ Ошибка поиска в Википедии.";
        }
    }

    return null; // Не смог ответить, передаём дальше
}
