from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
import os

app = Flask(__name__)
CORS(app)

conn = psycopg2.connect(os.getenv("DATABASE_URL"))

@app.route("/book", methods=["POST"])
def book():
    try:
        data = request.json
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO bookings (user_id, purpose, attendees, start_time, end_time, status)
            VALUES (%s, %s, %s, %s, %s, 'pending')
        """, (
            data["user_id"],
            data["purpose"],
            data["attendees"],
            data["start_time"],
            data["end_time"]
        ))

        conn.commit()
        return jsonify({"message": "Booking request submitted"})

    except Exception as e:
        conn.rollback()   # 🔥 VERY IMPORTANT
        return jsonify({"error": str(e)}), 500
    
@app.route("/signup", methods=["POST"])
def signup():
    try:
        data = request.json
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO users (name, email, mobile, password)
            VALUES (%s, %s, %s, %s)
            RETURNING id
        """, (
            data["name"],
            data["email"],
            data["mobile"],
            data["password"]
        ))

        user_id = cur.fetchone()[0]
        conn.commit()

        return jsonify({"message": "Signup successful", "user_id": str(user_id)})

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    
@app.route("/login", methods=["POST"])
def login():
    try:
        data = request.json
        cur = conn.cursor()

        cur.execute("""
            SELECT id, password FROM users WHERE email = %s
        """, (data["email"],))

        user = cur.fetchone()

        if not user:
            return jsonify({"error": "User not found"}), 404

        db_user_id, db_password = user

        if db_password != data["password"]:
            return jsonify({"error": "Invalid password"}), 401

        return jsonify({
            "message": "Login successful",
            "user_id": str(db_user_id)
        })

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500