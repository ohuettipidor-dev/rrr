// Нейрон-Диагност: общается с LLM и возвращает unified diff
const LLM_ENDPOINT = "https://text.pollinations.ai/openai";

export async function getPatch(problemCode, currentCode, chatLog) {
    // Специализированные промпты для каждой проблемы
    const PROMPTS = {
        overload: `Ты — эксперт по JavaScript. Нейрон чат-бота выдаёт ошибку "⚠ Облачный разум временно перегружен". Это значит, что API не отвечает. Исправь код, добавив запасной API (OpenRouter) и увеличь таймаут. Верни ТОЛЬКО unified diff.`,
        context_lost: `Ты — эксперт по JavaScript. Нейрон чат-бота потерял контекст диалога и отвечает как в первый раз. Исправь код так, чтобы он хранил историю сообщений (conversationHistory) и передавал её в каждом запросе. Верни ТОЛЬКО unified diff.`,
        robotic: `Ты — эксперт по JavaScript. Нейрон чат-бота отвечает слишком сухо и без души. Измени системный промпт (system prompt) так, чтобы он был более дерзким и человечным. Верни ТОЛЬКО unified diff.`
    };

    const systemPrompt = PROMPTS[problemCode] || "Ты — эксперт по JavaScript. Исправь ошибку в коде нейрона. Верни ТОЛЬКО unified diff.";

    const fullPrompt = `${systemPrompt}\n\nВот лог чата:\n\`\`\`\n${chatLog.join('\n')}\n\`\`\`\n\nВот текущий код нейрона:\n\`\`\`javascript\n${currentCode}\n\`\`\``;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(LLM_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: fullPrompt }],
                temperature: 0.2,
                max_tokens: 600
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) return null;
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        return content && content.includes('@@') ? content : null;
    } catch {
        return null;
    }
}

// Функция применения патча (простая версия)
export function applyPatch(originalCode, diffText) {
    const originalLines = originalCode.split('\n');
    const diffLines = diffText.split('\n');
    const patchedLines = [];
    let originalIdx = 0;

    for (const line of diffLines) {
        if (line.startsWith('@@')) {
            const match = line.match(/@@ -(\d+),\d+ \+(\d+),\d+ @@/);
            if (match) {
                const startLine = parseInt(match[1]) - 1;
                while (originalIdx < startLine && originalIdx < originalLines.length) {
                    patchedLines.push(originalLines[originalIdx]);
                    originalIdx++;
                }
            }
        } else if (line.startsWith('-')) {
            originalIdx++;
        } else if (line.startsWith('+')) {
            patchedLines.push(line.substring(1));
        } else {
            if (originalIdx < originalLines.length) {
                patchedLines.push(originalLines[originalIdx]);
                originalIdx++;
            }
        }
    }
    while (originalIdx < originalLines.length) {
        patchedLines.push(originalLines[originalIdx]);
        originalIdx++;
    }
    return patchedLines.join('\n');
            }
