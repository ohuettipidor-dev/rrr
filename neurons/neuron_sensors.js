// Нейрон 2: Датчики (погода, новости, Википедия)
export async function process(prompt) {
    const q = prompt.toLowerCase();

    // Погода
    const weatherMatch = q.match(/погода\s+(?:в\s+)?([а-яё\-]+)/i);
    if (weatherMatch) {
        try {
            const city = weatherMatch[1];
            const r = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=%C+%t`);
            return `🌤 Погода в ${city}: ${await r.text()}`;
        } catch { return "⚠ Не могу получить погоду."; }
    }

    // Новости
    if (q.includes("новост")) {
        try {
            const r = await fetch("https://lenta.ru/rss");
            const t = await r.text();
            const dom = new DOMParser().parseFromString(t, "text/xml");
            const items = [...dom.querySelectorAll("item")].slice(0, 3)
                .map(i => i.querySelector("title").textContent).join("\n• ");
            return `📰 Последние новости:\n• ${items}`;
        } catch { return "⚠ Не могу загрузить новости."; }
    }

    // Википедия
    const wikiMatch = q.match(/(?:что\s+такое|кто\s+такой|расскажи\s+про|найди\s+инфу?)\s+(.+)/i);
    if (wikiMatch) {
        try {
            const query = wikiMatch[1].trim();
            const r = await fetch(`https://ru.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
            const j = await r.json();
            return j.extract || "Ничего не найдено.";
        } catch { return "⚠ Ошибка поиска в Википедии."; }
    }

    return null;
}
