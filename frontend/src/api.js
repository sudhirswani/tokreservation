import axios from "axios";

const API = axios.create({
  baseURL: "https://your-backend.onrender.com", // 🔁 replace later
});

export default API;