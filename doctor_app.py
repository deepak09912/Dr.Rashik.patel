from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from datetime import datetime
import threading
import json
import os
import smtplib
from email.message import EmailMessage

app = Flask(__name__, static_folder='.', static_url_path='', template_folder='.')
CORS(app)

STORE_PATH = os.path.join(os.path.dirname(__file__), 'appointments.json')
lock = threading.Lock()
SMTP_HOST = 'smtp.gmail.com'
SMTP_PORT = 587
EMAIL_USER = os.environ.get('EMAIL_USER', 'deepaksalunke189@gmail.com')
EMAIL_PASSWORD = os.environ.get('EMAIL_PASSWORD', '')
EMAIL_TO = os.environ.get('EMAIL_TO', 'deepaksalunke189@gmail.com')

if not os.path.exists(STORE_PATH):
    with open(STORE_PATH, 'w', encoding='utf-8') as f:
        json.dump([], f)

def load_all():
    with lock:
        try:
            with open(STORE_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []

def save_one(entry):
    with lock:
        try:
            with open(STORE_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            data = []
        data.append(entry)
        with open(STORE_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)


def send_email(entry):
    if not EMAIL_PASSWORD:
        app.logger.warning('EMAIL_PASSWORD is not configured; skipping email send')
        return False

    message = EmailMessage()
    message['Subject'] = 'New Appointment Request — Dr Rasik Patel Clinic'
    message['From'] = EMAIL_USER
    message['To'] = EMAIL_TO
    message.set_content(f"""
New appointment request received:

Name: {entry['name']}
Phone: {entry['phone']}
Preferred date: {entry.get('preferred_date', 'Not provided')}
Preferred time: {entry.get('preferred_time', 'Not provided')}
Message: {entry.get('message', 'No message')}
Time submitted: {entry['timestamp']}
""")

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(EMAIL_USER, EMAIL_PASSWORD)
            smtp.send_message(message)
        return True
    except Exception as e:
        app.logger.error('Failed to send appointment email: %s', e)
        return False

@app.route('/api/health')
def health():
    return jsonify({'status':'ok'})

@app.route('/api/appointments', methods=['POST'])
def create_appointment():
    payload = request.get_json() or {}
    name = payload.get('name')
    phone = payload.get('phone')
    message = payload.get('message', '')
    preferred_date = payload.get('preferred_date', '')
    preferred_time = payload.get('preferred_time', '')

    if not name or not phone:
        return jsonify({'error': 'Missing name or phone'}), 400

    entry = {
        'name': name,
        'phone': phone,
        'message': message,
        'preferred_date': preferred_date,
        'preferred_time': preferred_time,
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    }

    try:
        save_one(entry)
        email_sent = send_email(entry)
        result = {'status':'saved', 'entry': entry}
        if not email_sent:
            result['warning'] = 'Appointment saved but email delivery failed. Check MAIL settings.'
        return jsonify(result), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/summary', methods=['GET'])
def summary():
    try:
        data = load_all()
        return jsonify({
            'total_appointments': len(data),
            'latest_appointments': data[-3:]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/appointments', methods=['GET'])
def list_appointments():
    try:
        data = load_all()
        return jsonify({'appointments': data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/')
def index():
    return send_from_directory(os.path.dirname(__file__), 'doctor.html')

if __name__ == '__main__':
    app.run(port=6000, debug=True)
