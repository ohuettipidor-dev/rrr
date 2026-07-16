// Нейрон: Писарь (GitHub Writer) — Агрессивный режим с повторами
const TOKEN_STORAGE_KEY = 'github_token_secure';

function getToken() {
    const cached = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (cached) return cached;
    const input = prompt("Введите новый GitHub токен (сохранится до закрытия вкладки):");
    if (input) {
        sessionStorage.setItem(TOKEN_STORAGE_KEY, input);
        return input;
    }
    return null;
}

export async function writeFile(filePath, content, commitMessage = "Авто-обновление от Роя") {
    const token = getToken();
    if (!token) return "❌ Токен не введён. Операция отменена.";

    const repo = "ohuettipidor-dev/rrr";
    const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;

    // Настройка боя: 3 попытки с таймаутом 5 секунд
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🛠 Писарь: попытка ${attempt}...`);
            
            // Получаем SHA текущего файла
            let sha = null;
            const getRes = await fetch(apiUrl, {
                headers: { "Authorization": `token ${token}` }
            });
            if (getRes.ok) {
                const getData = await getRes.json();
                sha = getData.sha;
            } else if (attempt === maxRetries) {
                const errText = await getRes.text();
                return `❌ Не могу прочитать файл: ${getRes.status} ${errText}`;
            }

            // Кодируем контент в Base64
            const contentEncoded = btoa(unescape(encodeURIComponent(content)));
            
            const body = {
                message: commitMessage,
                content: contentEncoded,
                ...(sha ? { sha } : {})
            };

            const putRes = await fetch(apiUrl, {
                method: "PUT",
                headers: {
                    "Authorization": `token ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });

            if (putRes.ok) {
                return `✅ Файл \`${filePath}\` успешно обновлён в репозитории.`;
            } else {
                const err = await putRes.json();
                console.error(`❌ Писарь: ошибка сохранения (попытка ${attempt}):`, err);
                if (attempt === maxRetries) {
                    return `❌ Ошибка сохранения после ${maxRetries} попыток: ${err.message}`;
                }
                // Ждём перед следующей попыткой
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
            console.error(`❌ Писарь: ошибка сети (попытка ${attempt}):`, error);
            if (attempt === maxRetries) {
                return `❌ Ошибка связи с GitHub после ${maxRetries} попыток: ${error.message}. Проверь интернет и VPN.`;
            }
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
    }

    return "❌ Критическая ошибка Писаря.";
}
