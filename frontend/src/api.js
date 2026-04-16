import axios from "axios";

const API = axios.create({
  //baseURL: "https://tokreservation.onrender.com", // 🔁 replace later
  baseURL: process.env.REACT_APP_API_URL || "http://127.0.0.1:5000",
});

// ✅ Attach token automatically
API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");

  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }

  return req;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default API;