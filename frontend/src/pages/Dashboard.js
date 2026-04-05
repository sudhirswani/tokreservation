import { useState } from "react";
import API from "../api";

export default function Dashboard() {
  const [form, setForm] = useState({
    purpose: "",
    attendees: "",
    start_time: "",
    end_time: "",
    user_id: localStorage.getItem("user_id")
  });

  const handleBooking = async () => {
    try {
      await API.post("/book", form);
      alert("Booking request submitted");
    } catch (err) {
      alert("Booking failed");
    }
  };

  return (
    <div>
      <h2>Book Meditation Hall</h2>

      <input
        placeholder="Purpose"
        onChange={(e) => setForm({ ...form, purpose: e.target.value })}
      />

      <input
        placeholder="Attendees"
        type="number"
        onChange={(e) => setForm({ ...form, attendees: e.target.value })}
      />

      <input
        type="datetime-local"
        onChange={(e) => setForm({ ...form, start_time: e.target.value })}
      />

      <input
        type="datetime-local"
        onChange={(e) => setForm({ ...form, end_time: e.target.value })}
      />

      <button onClick={handleBooking}>Submit Booking</button>
    </div>
  );
}