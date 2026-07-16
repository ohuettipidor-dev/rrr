// Диспетчер Роя
import { process as reflex } from './neuron_reflex.js';
import { process as sensors } from './neuron_sensors.js';
import { process as intellect } from './neuron_intellect.js';

const NEURONS = [
    { name: "reflex", process: reflex, priority: 1 },
    { name: "sensors", process: sensors, priority: 2 },
    { name: "intellect", process: intellect, priority: 3 },
];

export async function dispatch(prompt) {
    // Сортируем по приоритету
    const sorted = [...NEURONS].sort((a, b) => a.priority - b.priority);
    for (const neuron of sorted) {
        try {
            const result = await neuron.process(prompt);
            if (result !== null) return result;
        } catch (e) {
            console.error(`Ошибка в нейроне ${neuron.name}:`, e);
        }
    }
    return "🤔 Ни один нейрон не смог ответить.";
      }
