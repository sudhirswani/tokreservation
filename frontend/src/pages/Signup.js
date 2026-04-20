import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api";

export default function Signup() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    mobile: "",
    teacher_code: "",
    password: "",
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captcha, setCaptcha] = useState({ id: "", code: "" });
  const [captchaInput, setCaptchaInput] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const canSubmit =
    !isSubmitting &&
    form.name.trim() !== "" &&
    form.email.trim() !== "" &&
    form.mobile.trim() !== "" &&
    form.teacher_code.trim() !== "" &&
    form.password !== "" &&
    confirmPassword !== "" &&
    form.password === confirmPassword &&
    captchaInput.trim() !== "" &&
    captcha.id !== "";

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleConfirmPasswordChange = (event) => {
    setConfirmPassword(event.target.value);
  };

  const handleCaptchaInputChange = (event) => {
    setCaptchaInput(event.target.value);
  };

  const loadCaptcha = async () => {
    try {
      const response = await API.get("/captcha");
      setCaptcha({
        id: response.data.captcha_id,
        code: response.data.captcha_code,
      });
      setCaptchaInput("");
    } catch (err) {
      setStatus({
        type: "error",
        message: "Unable to load captcha. Please refresh the page.",
      });
    }
  };

  useEffect(() => {
    loadCaptcha();
  }, []);

  const handleSignup = async (event) => {
    event.preventDefault();
    setStatus({ type: "", message: "" });

    if (form.password !== confirmPassword) {
      setStatus({ type: "error", message: "Passwords do not match." });
      return;
    }

    if (!captcha.id || captchaInput.trim().toUpperCase() !== captcha.code.trim().toUpperCase()) {
      setStatus({ type: "error", message: "Captcha does not match. Please try again." });
      loadCaptcha();
      return;
    }

    setIsSubmitting(true);

    try {
      await API.post("/signup", {
        ...form,
        captcha_id: captcha.id,
        captcha_answer: captchaInput,
      });
      setStatus({ type: "success", message: "Account created! Redirecting to login..." });
      setTimeout(() => navigate("/login"), 800);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Signup failed. Please verify the form details and try again.";
      setStatus({ type: "error", message });
      loadCaptcha();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center bg-light py-5">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-sm-10 col-md-8 col-lg-6">
            <div className="card shadow-sm border-0">
              <div className="card-body p-4 p-md-5">
                <h1 className="h3 fw-bold mb-1 text-center">Create your account</h1>
                <p className="text-muted text-center mb-4">
                  Join the meditation community and reserve the hall in just a few clicks.
                </p>

                <form onSubmit={handleSignup}>
                  <div className="mb-3">
                    <label htmlFor="name" className="form-label">
                      Full name
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      className="form-control form-control-lg"
                      placeholder="Enter your full name"
                      value={form.name}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="email" className="form-label">
                      Email address
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      className="form-control form-control-lg"
                      placeholder="you@example.com"
                      value={form.email}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="mobile" className="form-label">
                      Mobile number
                    </label>
                    <input
                      id="mobile"
                      name="mobile"
                      type="tel"
                      className="form-control form-control-lg"
                      placeholder="e.g. +1 555 123 4567"
                      value={form.mobile}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="teacher_code" className="form-label">
                      Teacher Code
                    </label>
                    <input
                      id="teacher_code"
                      name="teacher_code"
                      type="text"
                      className="form-control form-control-lg"
                      placeholder="Enter your teacher code"
                      value={form.teacher_code}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="password" className="form-label">
                      Password
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      className="form-control form-control-lg"
                      placeholder="Create a secure password"
                      value={form.password}
                      onChange={handleChange}
                      minLength={6}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="confirmPassword" className="form-label">
                      Confirm password
                    </label>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      className={`form-control form-control-lg ${
                        confirmPassword && confirmPassword !== form.password
                          ? "is-invalid"
                          : ""
                      }`}
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={handleConfirmPasswordChange}
                      minLength={6}
                      required
                      aria-invalid={confirmPassword && confirmPassword !== form.password}
                    />
                    {confirmPassword && confirmPassword !== form.password && (
                      <div className="invalid-feedback">Passwords must match.</div>
                    )}
                  </div>

                  <div className="mb-4">
                    <label className="form-label">Captcha verification</label>
                    <div className="d-flex align-items-center mb-2">
                      <div
                        className="border rounded px-3 py-2 bg-white text-center"
                        style={{ letterSpacing: "0.25em", minWidth: "150px" }}
                      >
                        {captcha.code || "Loading..."}
                      </div>
                      <button
                        type="button"
                        className="btn btn-link btn-sm ms-2"
                        onClick={loadCaptcha}
                      >
                        Refresh
                      </button>
                    </div>
                    <input
                      id="captchaInput"
                      name="captchaInput"
                      type="text"
                      className="form-control form-control-lg"
                      placeholder="Type the code shown above"
                      value={captchaInput}
                      onChange={handleCaptchaInputChange}
                      required
                    />
                    <div className="form-text">
                      Please type the code exactly as shown to verify human input.
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-success w-100 btn-lg"
                    disabled={!canSubmit}
                  >
                    {isSubmitting ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        ></span>
                        Creating account...
                      </>
                    ) : (
                      "Create account"
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

                <p className="text-center text-muted mt-4 mb-0">
                  Already have an account?{" "}
                  <Link to="/login" className="text-decoration-none">
                    Sign in here
                  </Link>
                  .
                </p>
              </div>
            </div>

            <p className="text-center text-muted mt-3 mb-0 small">
              Your information is used only to manage hall reservations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}