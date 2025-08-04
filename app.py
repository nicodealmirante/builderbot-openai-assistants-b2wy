from flask import Flask, request, jsonify, send_from_directory
import base64, requests, os

OPENAI_KEY = os.getenv("OPENAI_API_KEY")
app = Flask(__name__, static_folder="static")

@app.route("/")
def home():
    return send_from_directory("static", "index.html")

@app.route("/process", methods=["POST"])
def process():
    file = request.files.get("foto")
    prompt = request.form.get("prompt", "Efecto Selfie Mirror brillante")

    if not file:
        return jsonify({"error": "No se recibió imagen"}), 400

    img_b64 = base64.b64encode(file.read()).decode()

    payload = {
        "model": "gpt-image-1",
        "prompt": prompt,
        "size": "512x512",
        "image": img_b64
    }

    headers = {
        "Authorization": f"Bearer {OPENAI_KEY}",
        "Content-Type": "application/json"
    }

    try:
        r = requests.post("https://api.openai.com/v1/images/generations",
                          headers=headers, json=payload, timeout=60)
        data = r.json()
    except Exception as e:
        return jsonify({"error": f"Error de red: {e}"}), 500

    if r.status_code == 200 and "data" in data:
        return jsonify({"b64": data["data"][0]["b64_json"]})
    else:
        return jsonify({"error": f"HTTP {r.status_code}", "raw": data}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
