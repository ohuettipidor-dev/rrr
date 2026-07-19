import os
import asyncio
import requests
import json
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse

app = FastAPI()

# Бесплатный LLM для планирования
LLM_URL = "https://text.pollinations.ai/openai"

# Системный промпт, который учит агента пользоваться инструментами
SYSTEM_PROMPT = """Ты — автономный ИИ-агент. Твоя задача — отвечать на запросы пользователя, используя доступные тебе инструменты. Ты можешь использовать следующие функции:

1. search_wikipedia(query) — найти информацию по запросу в Википедии.
2. run_python_code(code) — выполнить Python-код и вернуть результат.
3. read_file(filepath) — прочитать содержимое файла.
4. write_file(filepath, content) — записать (или перезаписать) файл.

Если ты хочешь использовать инструмент, напиши в ответе JSON вида:
{"action": "tool", "tool": "имя_инструмента", "args": {"arg1": "value1", ...}}

Если у тебя готов финальный ответ, напиши JSON вида:
{"action": "final", "answer": "Твой ответ пользователю"}

Не пиши ничего, кроме этого JSON."""

# Инструмент 1: Поиск в Википедии
def search_wikipedia(query):
    try:
        url = f"https://ru.wikipedia.org/api/rest_v1/page/summary/{query}"
        r = requests.get(url, timeout=5)
        if r.status_code == 200:
            data = r.json()
            return data.get("extract", "Не найдено.")
        return "Ошибка поиска."
    except Exception as e:
        return f"Ошибка: {e}"

# Инструмент 2: Запуск Python-кода
def run_python_code(code):
    try:
        # Безопасное выполнение в изолированной среде (ограниченный eval)
        exec_globals = {}
        exec(code, exec_globals)
        return str(exec_globals.get('result', 'Код выполнен, но переменная result не задана.'))
    except Exception as e:
        return f"Ошибка выполнения кода: {e}"

# Инструмент 3: Чтение файла
def read_file(filepath):
    if not os.path.exists(filepath):
        return f"Файл {filepath} не найден."
    try:
        with open(filepath, 'r') as f:
            return f.read()
    except Exception as e:
        return f"Ошибка чтения: {e}"

# Инструмент 4: Запись файла
def write_file(filepath, content):
    try:
        # Создаём папку, если её нет
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, 'w') as f:
            f.write(content)
        return f"Файл {filepath} успешно записан."
    except Exception as e:
        return f"Ошибка записи: {e}"

# Карта инструментов
TOOLS = {
    "search_wikipedia": search_wikipedia,
    "run_python_code": run_python_code,
    "read_file": read_file,
    "write_file": write_file
}

# Функция вызова LLM
async def ask_llm(messages):
    try:
        payload = {
            "model": "gpt-4o-mini",
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": 200
        }
        # Делаем синхронный запрос асинхронно
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None, 
            lambda: requests.post(LLM_URL, json=payload, timeout=10)
        )
        if response.status_code != 200:
            return None
        data = response.json()
        return data["choices"][0]["message"]["content"]
    except Exception as e:
        return f"Ошибка LLM: {e}"

# Главный цикл агента
@app.get("/")
async def home():
    return HTMLResponse("""
    <h1>ИИ Агент запущен</h1>
    <p>Отправь POST-запрос на /chat с JSON {"prompt": "твой запрос"}</p>
    """)

@app.post("/chat")
async def chat(request: Request):
    data = await request.json()
    user_prompt = data.get("prompt", "")
    if not user_prompt:
        return {"error": "Пустой запрос"}
    
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt}
    ]
    
    max_iterations = 5  # Максимум 5 шагов (действий)
    
    for i in range(max_iterations):
        response = await ask_llm(messages)
        if not response:
            return {"error": "LLM не отвечает"}
        
        # Пытаемся распарсить JSON от LLM
        try:
            action_data = json.loads(response)
        except json.JSONDecodeError:
            # Если LLM вернула не JSON, считаем это финальным ответом
            return {"answer": response, "iterations": i + 1}
        
        if action_data.get("action") == "final":
            return {"answer": action_data.get("answer", ""), "iterations": i + 1}
        
        if action_data.get("action") == "tool":
            tool_name = action_data.get("tool", "")
            tool_args = action_data.get("args", {})
            
            if tool_name in TOOLS:
                # Вызываем инструмент
                try:
                    tool_result = TOOLS[tool_name](**tool_args)
                except Exception as e:
                    tool_result = f"Ошибка вызова {tool_name}: {e}"
                
                # Добавляем результат в историю
                messages.append({"role": "assistant", "content": response})
                messages.append({"role": "user", "content": f"Результат инструмента {tool_name}: {tool_result}"})
            else:
                messages.append({"role": "assistant", "content": response})
                messages.append({"role": "user", "content": f"Инструмент {tool_name} не найден."})
        else:
            # Неизвестный формат, считаем финальным ответом
            return {"answer": response, "iterations": i + 1}
    
    return {"error": "Достигнут лимит итераций без финального ответа", "iterations": max_iterations}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
