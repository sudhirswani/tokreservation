from flask import Flask, request, jsonify
import psycopg2
import os

app = Flask(__name__)

conn = psycopg2.connect(os.getenv("DATABASE_URL"))

@app.route("/book", methods=["POST"])
def book():
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