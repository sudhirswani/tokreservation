import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();
    setStatus({ type: "", message: "" });
    setIsSubmitting(true);

    try {
      const res = await API.post("/login", { email, password });
      localStorage.setItem("token", res.data.token);
      setStatus({ type: "success", message: "Login successful. Redirecting..." });

      setTimeout(() => navigate("/dashboard"), 600);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Login failed. Please check your credentials and try again.";
      setStatus({ type: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center bg-light py-5">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-sm-10 col-md-8 col-lg-5">
            <div className="card shadow-sm border-0">
              <div className="card-body p-4 p-md-5">
                <h1 className="h3 mb-1 fw-bold text-center">Welcome back</h1>
                <p className="text-muted text-center mb-4">
                  Sign in to manage your meditation hall bookings.
                </p>

                <form onSubmit={handleLogin}>
                  <div className="mb-3">
                    <label htmlFor="email" className="form-label">
                      Email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      className="form-control form-control-lg"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-2">
                    <label htmlFor="password" className="form-label">
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      className="form-control form-control-lg"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <small className="text-muted">Use your registered email address.</small>
                    <Link to="/signup" className="small text-decoration-none">
                      Need an account?
                    </Link>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary w-100 btn-lg"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        ></span>
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </button>
                </form>

                {status.message && (
                  <div
                    className={`alert mt-4 mb-0 alert-${
                      status.type === "error" ? "danger" : "success"
                    }`}
                    role="alert"
                  >
                    {status.message}
                  </div>
                )}
              </div>
            </div>

            <p className="text-center text-muted mt-3 mb-0">
              By continuing you agree to the <span className="text-decoration-underline">usage policy</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}