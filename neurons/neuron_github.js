// Нейрон: Писарь (GitHub Writer)
// Он умеет сохранять и обновлять файлы в репозитории.
export async function writeFile(filePath, content, commitMessage = "Авто-обновление от Роя") {
    const token = prompt("Введите GitHub токен для записи:"); // Безопасный ввод ключа
    if (!token) return "❌ Ключ не введён. Операция отменена.";

    const repo = "ohuettipidor-dev/rrr"; // Твой репозиторий
    const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;

    try {
        // Сначала получаем SHA текущего файла (если он существует)
        let sha = null;
        const getRes = await fetch(apiUrl, {
            headers: { "Authorization": `token ${token}` }
        });
        if (getRes.ok) {
            const getData = await getRes.json();
            sha = getData.sha;
        }

        // Тело запроса
        const body = {
            message: commitMessage,
            content: btoa(unescape(encodeURIComponent(content))), // Кодируем в Base64
            ...(sha ? { sha } : {}) // Если файл есть, передаём SHA для обновления
        };

        // Отправляем запрос на сохранение
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
