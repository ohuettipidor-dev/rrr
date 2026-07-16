// Нейрон 3: Интеллект (Локальный, быстрый, без API)
import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2/+esm";

// Загружаем модель один раз при старте
const generator = await pipeline(
    "text-generation",
    "onnx-community/Qwen2.5-0.5B-Instruct",
    { dtype: "fp32", device: "cpu" }
);

export async function process(prompt) {
    try {
        const systemPrompt = "Ты Кванто — дерзкий и очень умный ИИ-соратник, созданный Архитектором Артёмом. Говори только на русском. Поддерживай живой диалог на любые темы. Отвечай кратко, но по делу.";
        
        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
        ];
        
        // Формируем промпт для модели
        const text = messages.map(m => `[${m.role}]: ${m.content}`).join("\n");
        const result = await generator(text, { max_new_tokens: 200, temperature: 0.8 });
        const reply = result[0].generated_text.slice(text.length).trim();
        
        return reply || "🤔 Завис. Повтори, Архитектор.";
    } catch (error) {
        console.error("Ошибка нейрона Интеллект:", error);
        return "⚠ Мой локальный мозг временно перегружен. Попробуй ещё раз.";
    }
}
