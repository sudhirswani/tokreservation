from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
from psycopg2 import errors
from dotenv import load_dotenv
import os
import jwt
import uuid
import json
import random
import string
import datetime
from datetime import date, time, timedelta
from functools import wraps


load_dotenv()
app = Flask(__name__)
FRONTEND_URL = os.getenv("FRONTEND_URL", "")
#CORS(app, origins=[FRONTEND_URL] if FRONTEND_URL else "*")
#CORS(app, origins=["http://localhost:3000"])
CORS(app, origins=[
    "http://localhost:3000",
    "https://tokreservation.vercel.app"
], supports_credentials=True)
DATABASE_URL = os.getenv("DATABASE_URL")
#print("DATABASE_URL:", DATABASE_URL)
conn = psycopg2.connect(DATABASE_URL or "postgresql://postgres.aijoxnrsgaietqkhbopg:E1ryNPiQby2hTp39@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres")
#conn = psycopg2.connect(DATABASE_URL or "postgresql://postgres:jgd*13may@localhost:5432/tokreservation_local")
SECRET_KEY = os.getenv("SECRET_KEY", "your_secret_key")  # same as used in login

def get_db_connection():
    global conn
    try:
        if conn is None or conn.closed:
            conn = psycopg2.connect(DATABASE_URL or "postgresql://postgres.aijoxnrsgaietqkhbopg:E1ryNPiQby2hTp39@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres")
    except Exception:
        conn = psycopg2.connect(DATABASE_URL or "postgresql://postgres.aijoxnrsgaietqkhbopg:E1ryNPiQby2hTp39@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres")
    return conn

CAPTCHA_STORE = {}
CAPTCHA_TTL_MINUTES = 5


def cleanup_captcha_store():
    now = datetime.datetime.utcnow()
    expired_keys = [key for key, value in CAPTCHA_STORE.items() if value["expires_at"] <= now]
    for key in expired_keys:
        CAPTCHA_STORE.pop(key, None)


def generate_captcha_code(length=5):
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))


def get_user_info(user_id):
    cur = get_db_connection().cursor()
    cur.execute("SELECT name, email, mobile FROM users WHERE id = %s", (user_id,))
    row = cur.fetchone()
    if not row:
        return {}

    return {"name": row[0], "email": row[1], "mobile": row[2]}


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization")

        if not token:
            return jsonify({"message": "Token is missing"}), 401

        try:
            # Expecting: "Bearer <token>"
            token = token.split(" ")[1]

            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            user_id = data["user_id"]
            role = data.get("role")

        except Exception as e:
            return jsonify({"message": "Invalid or expired token"}), 401

        return f(user_id, role, *args, **kwargs)

    return decorated


def insert_audit_log(action, performed_by, performed_by_id=None, details=None):
    try:
        cur = get_db_connection().cursor()
        payload = None
        if details is not None:
            payload = json.dumps(details) if not isinstance(details, str) else details

        try:
            cur.execute(
                "INSERT INTO audit_logs (action, performed_by, performed_by_id, details) VALUES (%s, %s, %s, %s)",
                (action, performed_by, performed_by_id, payload),
            )
        except errors.UndefinedColumn:
            cur.execute(
                "INSERT INTO audit_logs (action, performed_by) VALUES (%s, %s)",
                (action, performed_by),
            )

        conn.commit()
    except Exception:
        conn.rollback()


@app.route("/book", methods=["POST"])
@token_required
def book(user_id, role):
    data = request.json or {}

    required_fields = ["purpose", "attendees", "booking_date", "start_time", "end_time"]
    if not all(field in data and data[field] for field in required_fields):
        return jsonify({"error": "Purpose, attendees, booking date, start time, and end time are required."}), 400

    try:
        booking_date = date.fromisoformat(data["booking_date"])
        start_tm = time.fromisoformat(data["start_time"])
        end_tm = time.fromisoformat(data["end_time"])
    except ValueError:
        return jsonify({"error": "Invalid date or time format. Use date (YYYY-MM-DD) and time (HH:MM)."}), 400

    if end_tm <= start_tm:
        return jsonify({"error": "End time must be later than start time."}), 400

    repeat_until_str = (data.get("repeat_until") or "").strip()
    repeat_weeks_raw = data.get("repeat_weeks")
    repeat_weeks = None

    if repeat_weeks_raw not in (None, ""):
        try:
            repeat_weeks = int(repeat_weeks_raw)
        except (TypeError, ValueError):
            return jsonify({"error": "Repeat weeks must be a whole number between 1 and 52."}), 400

        if repeat_weeks < 1 or repeat_weeks > 52:
            return jsonify({"error": "Repeat weeks must be between 1 and 52."}), 400

    if repeat_until_str and repeat_weeks is not None:
        return jsonify({"error": "Use either repeat_until or repeat_weeks, not both."}), 400

    try:
        if repeat_until_str:
            repeat_until_date = date.fromisoformat(repeat_until_str)
        else:
            repeat_until_date = booking_date
    except ValueError:
        return jsonify({"error": "Invalid repeat-until date."}), 400

    if repeat_until_date < booking_date:
        return jsonify({"error": "Repeat-until date cannot be before the booking date."}), 400

    booking_group_id = str(uuid.uuid4())

    try:
        user_info = get_user_info(user_id)
        user_name = user_info.get("name") or str(user_id)
        user_email = user_info.get("email")
        user_mobile = user_info.get("mobile")

        cur = get_db_connection().cursor()
        cur.execute("SELECT 1 FROM events WHERE event_name = %s LIMIT 1", (data["purpose"],))
        if cur.fetchone() is None:
            return jsonify({"error": "Selected purpose is not a valid event."}), 400

        if repeat_weeks is not None:
            occurrence_count = repeat_weeks
            for week_offset in range(repeat_weeks):
                day_date = booking_date + timedelta(weeks=week_offset)
                cur.execute(
                    """
                    INSERT INTO bookings (booking_group_id, user_id, purpose, attendees, booking_date, start_time, end_time, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending')
                    """,
                    (
                        booking_group_id,
                        user_id,
                        data["purpose"],
                        data["attendees"],
                        day_date,
                        start_tm,
                        end_tm,
                    )
                )
        else:
            total_days = (repeat_until_date - booking_date).days + 1
            occurrence_count = total_days
            for day_offset in range(total_days):
                day_date = booking_date + timedelta(days=day_offset)
                cur.execute(
                    """
                    INSERT INTO bookings (booking_group_id, user_id, purpose, attendees, booking_date, start_time, end_time, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending')
                    """,
                    (
                        booking_group_id,
                        user_id,
                        data["purpose"],
                        data["attendees"],
                        day_date,
                        start_tm,
                        end_tm,
                    )
                )

        conn.commit()

        repeat_desc = (
            f"repeat weekly for {repeat_weeks} weeks"
            if repeat_weeks is not None
            else f"repeat until {repeat_until_date}"
        )

        insert_audit_log(
            f"Booking request created by {user_name} for {booking_date} {start_tm}-{end_tm} ({repeat_desc})",
            user_name,
            performed_by_id=user_id,
            details={
                "email": user_email,
                "mobile": user_mobile,
                "booking_group_id": booking_group_id,
                "purpose": data.get("purpose"),
                "attendees": data.get("attendees"),
                "repeat_weeks": repeat_weeks,
                "repeat_until": str(repeat_until_date) if repeat_until_str else None,
            },
        )

        if repeat_weeks is not None:
            return jsonify({"message": f"Booking request submitted for {occurrence_count} weekly occurrence(s)."})

        return jsonify({"message": f"Booking request submitted for {occurrence_count} day(s)."})

    except Exception as e:
        conn.rollback()
        error_text = str(e)
        if "exclusion constraint" in error_text:
            return jsonify({"error": "Time slot already booked for one of the selected days."}), 400
        return jsonify({"error": error_text}), 500

@app.route('/event-names', methods=['GET'])
@token_required
def event_names(user_id, role):
    try:
        cur = get_db_connection().cursor()
        cur.execute("SELECT DISTINCT event_name FROM events WHERE event_name IS NOT NULL ORDER BY event_name")
        event_names = [row[0] for row in cur.fetchall()]
        return jsonify(event_names)
    except errors.UndefinedTable:
        return jsonify([])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/captcha", methods=["GET"])
def captcha():
    cleanup_captcha_store()
    captcha_id = str(uuid.uuid4())
    captcha_code = generate_captcha_code()
    expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=CAPTCHA_TTL_MINUTES)
    CAPTCHA_STORE[captcha_id] = {"code": captcha_code, "expires_at": expires_at}
    return jsonify({"captcha_id": captcha_id, "captcha_code": captcha_code})


@app.route("/signup", methods=["POST"])
def signup():
    try:
        data = request.json

        captcha_id = data.get("captcha_id")
        captcha_answer = (data.get("captcha_answer") or "").strip().upper()

        if not captcha_id or not captcha_answer:
            return jsonify({"error": "Captcha verification is required."}), 400

        cleanup_captcha_store()
        captcha_entry = CAPTCHA_STORE.pop(captcha_id, None)

        if not captcha_entry or captcha_entry.get("code", "").upper() != captcha_answer:
            return jsonify({"error": "Captcha verification failed."}), 400

        cur = get_db_connection().cursor()

        cur.execute("""
            INSERT INTO users (name, email, mobile, teacher_code, password)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
        """, (
            data["name"],
            data["email"],
            data["mobile"],
            data["teacher_code"],
            data["password"]
        ))

        user_id = cur.fetchone()[0]
        conn.commit()
        insert_audit_log(
            f"Signup successful for {data.get('name')}",
            data.get('name') or data.get('email') or str(user_id),
            performed_by_id=user_id,
            details={
                "email": data.get("email"),
                "mobile": data.get("mobile"),
                "teacher_code": data.get("teacher_code"),
            },
        )

        return jsonify({"message": "Signup successful", "user_id": str(user_id)})

    except Exception as e:
        conn.rollback()
        error_message = str(e).lower()
        
        # Check for duplicate email constraint violation
        if "users_email_key" in error_message or ("duplicate key" in error_message and "email" in error_message):
            return jsonify({"error": "User with this email already exists. Please use a different email or sign in."}), 400
        
        # Check for duplicate mobile or teacher_code constraints if they exist
        if "duplicate key" in error_message:
            return jsonify({"error": "This information is already registered. Please use different details."}), 400
        
        return jsonify({"error": str(e)}), 500
    
@app.route("/login", methods=["POST"])
def login():
    try:
        data = request.json
        cur = get_db_connection().cursor()

        cur.execute("""
            SELECT id, password, role, name, mobile FROM users WHERE email = %s
        """, (data["email"],))

        user = cur.fetchone()

        if not user:
            return jsonify({"error": "User not found"}), 404

        db_user_id, db_password, role, user_name, user_mobile = user

        if db_password != data["password"]:
            return jsonify({"error": "Invalid password"}), 401

        # ✅ CREATE JWT TOKEN
        token = jwt.encode({
            "user_id": str(db_user_id),
            "role": role,  # ✅ add role
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=2)
        }, SECRET_KEY, algorithm="HS256")

        insert_audit_log(
            f"User login successful for {user_name}",
            user_name,
            performed_by_id=db_user_id,
            details={"email": data.get("email"), "mobile": user_mobile},
        )
        return jsonify({
            "message": "Login successful",
            "token": token
        })

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    
def get_bookings_by_user(user_id):
    cur = get_db_connection().cursor()

    query = """
        SELECT id, purpose, attendees, booking_date, start_time, end_time, status, created_at
        FROM bookings
        WHERE user_id = %s
        ORDER BY booking_date DESC, start_time DESC
    """

    try:
        cur.execute(query, (user_id,))
    except errors.UndefinedColumn:
        query = """
            SELECT id, purpose, attendees, booking_date, start_time, end_time, status
            FROM bookings
            WHERE user_id = %s
            ORDER BY booking_date DESC, start_time DESC
        """
        cur.execute(query, (user_id,))

    rows = cur.fetchall()

    bookings = []
    for row in rows:
        booking = {
            "id": str(row[0]),
            "purpose": row[1],
            "attendees": row[2],
            "booking_date": str(row[3]),
            "start_time": str(row[4]),
            "end_time": str(row[5]),
            "status": row[6]
        }
        if len(row) > 6:
            booking["created_at"] = str(row[6])
        bookings.append(booking)

    return bookings
    
@app.route('/my-bookings', methods=['GET'])
@token_required
def my_bookings(user_id,role):
    try:
        bookings = get_bookings_by_user(user_id)
        return jsonify(bookings)
    except Exception as e:
        return jsonify({"message": str(e)}), 500

@app.route('/all-bookings', methods=['GET'])
@token_required
def all_bookings(user_id, role):
    if role != "admin":
        return jsonify({"error": "Unauthorized"}), 403
    try:
        cur = get_db_connection().cursor()

        cur.execute("""
            SELECT b.id, b.purpose, b.attendees, b.booking_date, b.start_time, b.end_time, b.status,
                   u.name AS user_name, u.email AS email, b.created_at
            FROM bookings b
            JOIN users u ON b.user_id = u.id
            ORDER BY b.booking_date DESC, b.start_time DESC
        """)

        rows = cur.fetchall()

        bookings = []
        for row in rows:
            booking = {
                "id": str(row[0]),
                "purpose": row[1],
                "attendees": row[2],
                "booking_date": str(row[3]),
                "start_time": str(row[4]),
                "end_time": str(row[5]),
                "status": row[6],
                "user_name": row[7],
                "email": row[8]
            }
            if len(row) > 9:
                booking["created_at"] = str(row[9])
            bookings.append(booking)

        return jsonify(bookings)
    except errors.UndefinedColumn:
        cur = get_db_connection().cursor()
        cur.execute("""
            SELECT b.id, b.purpose, b.attendees, b.booking_date, b.start_time, b.end_time, b.status,
                   u.name AS user_name, u.email AS email
            FROM bookings b
            JOIN users u ON b.user_id = u.id
            ORDER BY b.booking_date DESC, b.start_time DESC
        """)

        rows = cur.fetchall()

        bookings = []
        for row in rows:
            bookings.append({
                "id": str(row[0]),
                "purpose": row[1],
                "attendees": row[2],
                "booking_date": str(row[3]),
                "start_time": str(row[4]),
                "end_time": str(row[5]),
                "status": row[6],
                "user_name": row[7],
                "email": row[8]
            })

        return jsonify(bookings)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/update-booking/<booking_id>', methods=['PUT'])
@token_required
def update_booking(user_id, role, booking_id):
    if role != "admin":
        return jsonify({"error": "Unauthorized"}), 403
    try:
        data = request.json
        status = data.get("status")

        cur = get_db_connection().cursor()

        cur.execute("""
            UPDATE bookings
            SET status = %s
            WHERE id = %s
        """, (status, booking_id))

        insert_audit_log(
            f"Booking {booking_id} updated to {status} by admin {user_id}",
            user_id,
            performed_by_id=user_id,
            details={"booking_id": booking_id, "status": status},
        )

        return jsonify({"message": f"Booking {status}"})

    except Exception as e:
        conn.rollback()

        error_msg = str(e)

        # ✅ Handle overlap constraint nicely
        if "exclusion constraint" in error_msg:
            return jsonify({
                "error": "Time slot already booked. Cannot approve this request."
            }), 400

        return jsonify({"error": error_msg}), 500

@app.route('/cancel-booking/<booking_id>', methods=['PUT'])
@token_required
def cancel_booking(user_id, role, booking_id):
    if role != "admin":
        return jsonify({"error": "Unauthorized"}), 403

    try:
        cur = get_db_connection().cursor()
        cur.execute(
            "SELECT booking_group_id FROM bookings WHERE id = %s",
            (booking_id,)
        )
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Booking not found"}), 404

        booking_group_id = row[0]
        cur.execute(
            "UPDATE bookings SET status = 'rejected' WHERE booking_group_id = %s",
            (booking_group_id,)
        )
        insert_audit_log(
            f"Booking group {booking_group_id} canceled by admin {user_id}",
            user_id,
            performed_by_id=user_id,
            details={"booking_group_id": booking_group_id},
        )

        return jsonify({"message": "Booking canceled"})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/audit-logs', methods=['GET'])
@token_required
def audit_logs(user_id, role):
    if role != "admin":
        return jsonify({"error": "Unauthorized"}), 403

    try:
        cur = get_db_connection().cursor()
        try:
            cur.execute(
                "SELECT id, action, performed_by, performed_by_id, details, timestamp FROM audit_logs ORDER BY timestamp DESC"
            )
        except errors.UndefinedColumn:
            cur.execute(
                "SELECT id, action, performed_by, timestamp FROM audit_logs ORDER BY timestamp DESC"
            )

        rows = cur.fetchall()

        logs = []
        for row in rows:
            if len(row) == 6:
                details = row[4]
                try:
                    details = json.loads(details) if isinstance(details, str) else details
                except Exception:
                    details = row[4]
                logs.append({
                    "id": str(row[0]),
                    "action": row[1],
                    "performed_by": row[2],
                    "performed_by_id": str(row[3]) if row[3] else None,
                    "details": details,
                    "timestamp": str(row[5])
                })
            else:
                logs.append({
                    "id": str(row[0]),
                    "action": row[1],
                    "performed_by": row[2],
                    "timestamp": str(row[3])
                })

        return jsonify(logs)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
