export const authFetch = async (url, options = {}) => {
  const token = localStorage.getItem("token");
  console.log("TOKEN:", token); // 👈 ADD THIS
  const res = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  console.log("STATUS:", res.status); // 👈 ADD THIS
  if (res.status === 401) {
    //localStorage.removeItem("token");
    //window.location.href = "/login";
  }

  return res;
};