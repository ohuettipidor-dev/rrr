from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

LLM_URL = "https://text.pollinations.ai/openai"

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    messages = data.get('messages', [])
    try:
        r = requests.post(LLM_URL, json={
            "model": "gpt-4o-mini",
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": 200
        }, timeout=10)
        if r.status_code == 200:
            return jsonify(r.json())
        else:
            return jsonify({"error": f"LLM error {r.status_code}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
