from flask import Flask, request, jsonify
from rembg import remove
from PIL import Image
import io, base64, os, urllib.request

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

@app.route('/remove', methods=['POST'])
def remove_background():
    data = request.json
    image_url = data.get('imageUrl')
    if not image_url:
        return jsonify({'error': 'imageUrl required'}), 400

    req = urllib.request.Request(image_url, headers={'User-Agent': 'ItsPosting-rembg/1.0'})
    with urllib.request.urlopen(req, timeout=30) as response:
        image_data = response.read()

    input_image = Image.open(io.BytesIO(image_data)).convert('RGBA')
    output_image = remove(input_image)

    buf = io.BytesIO()
    output_image.save(buf, format='PNG')
    return jsonify({'png_base64': base64.b64encode(buf.getvalue()).decode()})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5001)))
