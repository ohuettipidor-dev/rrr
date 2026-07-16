// Нейрон: Писарь (GitHub Writer) — Запоминает токен
const TOKEN_STORAGE_KEY = 'github_token_secure';

function getToken() {
    const cached = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (cached) return cached;
    const input = prompt("Введите GitHub токен (сохранится до закрытия вкладки):");
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

    try {
        let sha = null;
        const getRes = await fetch(apiUrl, {
            headers: { "Authorization": `token ${token}` }
        });
        if (getRes.ok) {
            const getData = await getRes.json();
            sha = getData.sha;
        }

        const body = {
            message: commitMessage,
            content: btoa(unescape(encodeURIComponent(content))),
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
            return `❌ Ошибка сохранения: ${err.message}`;
        }
    } catch (error) {
        return `❌ Ошибка связи с GitHub: ${error.message}`;
    }
}
