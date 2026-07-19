// Нейрон-Диагност: точечная хирургия для Наставника
export async function generateFix(errorDescription, currentCode, chatLog) {
    const prompt = `Ты — эксперт по JavaScript и нейроархитектуре. Твоя задача — исправить ошибку в коде нейрона, используя ТОЛЬКО точечный unified diff. Ты не имеешь права переписывать весь файл. Ты должен изменить только проблемные строки.

Вот описание ошибки от Архитектора: "${errorDescription}"

Вот лог последних сообщений чата (для контекста):
\`\`\`
${chatLog.join('\n')}
\`\`\`

Вот ТЕКУЩИЙ код нейрона, который нужно исправить (не трогай то, что работает):
\`\`\`javascript
${currentCode}
\`\`\`

Верни ТОЛЬКО валидный unified diff (формат: строки, начинающиеся с '+', '-', или '@@'). Не добавляй никаких пояснений.`;

    try {
        const response = await fetch("https://text.pollinations.ai/openai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.2,
                max_tokens: 800
            })
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
    } catch {
        return null;
    }
}

// Функция применения патча к исходному коду (простой алгоритм)
export function applyPatch(originalCode, diffText) {
    const originalLines = originalCode.split('\n');
    const diffLines = diffText.split('\n');
    const patchedLines = [];
    let originalIdx = 0;

    for (const line of diffLines) {
        if (line.startsWith('@@')) {
            // Парсим заголовок чанка, чтобы понять, с какой строки начать
            const match = line.match(/@@ -(\d+),\d+ \+(\d+),\d+ @@/);
            if (match) {
                const startLine = parseInt(match[1]) - 1;
                while (originalIdx < startLine && originalIdx < originalLines.length) {
                    patchedLines.push(originalLines[originalIdx]);
                    originalIdx++;
                }
            }
        } else if (line.startsWith('-')) {
            // Пропускаем удаляемую строку в оригинале
            originalIdx++;
        } else if (line.startsWith('+')) {
            // Добавляем новую строку
            patchedLines.push(line.substring(1));
        } else {
            // Контекстная строка (без префикса)
            if (originalIdx < originalLines.length) {
                patchedLines.push(originalLines[originalIdx]);
                originalIdx++;
            }
        }
    }
    // Добавляем оставшиеся строки после патча
    while (originalIdx < originalLines.length) {
        patchedLines.push(originalLines[originalIdx]);
        originalIdx++;
    }
    return patchedLines.join('\n');
}
