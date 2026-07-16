// Нейрон 3: Интеллект (Локальный диалоговый агент с памятью контекста)
import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2/+esm";

// Загружаем модель один раз при старте
const generator = await pipeline(
    "text-generation",
    "onnx-community/Qwen2.5-0.5B-Instruct",
    { dtype: "fp32", device: "cpu" }
);

// Хранилище истории диалога
const conversationHistory = [
    { role: "system", content: "Ты Кванто — дерзкий и очень умный ИИ-соратник, созданный Архитектором Артёмом. Говори только на русском. Поддерживай живой диалог на любые темы. Отвечай кратко, но по делу. Задавай встречные вопросы, чтобы поддерживать беседу." }
];

export async function process(prompt) {
    try {
        // Добавляем сообщение пользователя в историю
        conversationHistory.push({ role: "user", content: prompt });
        
        // Ограничиваем историю, чтобы не перегружать память
        if (conversationHistory.length > 10) {
            // Оставляем системный промпт и последние 9 сообщений
            conversationHistory.splice(1, conversationHistory.length - 10);
        }
        
        // Формируем промпт из всей истории
        const text = conversationHistory.map(m => `[${m.role}]: ${m.content}`).join("\n");
        const result = await generator(text, { max_new_tokens: 200, temperature: 0.8 });
        const reply = result[0].generated_text.slice(text.length).trim();
        
        // Добавляем ответ в историю
        conversationHistory.push({ role: "assistant", content: reply });
        
        return reply || "🤔 Завис. Повтори, Архитектор.";
    } catch (error) {
        console.error("Ошибка нейрона Интеллект:", error);
        return "⚠ Мой локальный мозг временно перегружен. Попробуй ещё раз.";
    }
}
