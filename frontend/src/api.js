import axios from "axios";

const API = axios.create({
  baseURL: "https://tokreservation.onrender.com", // 🔁 replace later
});

export default API;