import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";

export default function Dashboard() {
  const [form, setForm] = useState({
    purpose: "",
    attendees: "",
    booking_date: "",
    start_time: "",
    end_time: "",
    repeat_until: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [userRole, setUserRole] = useState("");
  const [calendarView, setCalendarView] = useState("month");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [calendarError, setCalendarError] = useState("");
  const [eventOptions, setEventOptions] = useState([]);
  const [eventOptionsError, setEventOptionsError] = useState("");

  const navigate = useNavigate();

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleBooking = async (event) => {
    event.preventDefault();
    setStatus({ type: "", message: "" });
    setIsSubmitting(true);

    try {
      const { data } = await API.post("/book", form);
      setStatus({
        type: "success",
        message: data?.message || "Booking request submitted! You'll be notified after review.",
      });
      setForm({ purpose: "", attendees: "", booking_date: "", start_time: "", end_time: "", repeat_until: "" });
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Booking failed. Please verify the form and try again.";
      setStatus({ type: "error", message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const loadCalendarEvents = async (role) => {
    setCalendarLoading(true);
    setCalendarError("");
    const endpoint = role === "admin" ? "/all-bookings" : "/my-bookings";

    try {
      const { data } = await API.get(endpoint);
      setCalendarEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Unable to load calendar events.";
      setCalendarError(message);
    } finally {
      setCalendarLoading(false);
    }
  };

  const loadEventOptions = async () => {
    setEventOptionsError("");

    try {
      const { data } = await API.get("/event-names");
      setEventOptions(Array.isArray(data) ? data : []);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Unable to load event options.";
      setEventOptionsError(message);
    }
  };

  const formatLabel = (date, options) => {
    return new Intl.DateTimeFormat(undefined, options).format(date);
  };

  const getWeekStart = (date) => {
    const day = date.getDay();
    const start = new Date(date);
    start.setDate(date.getDate() - day);
    start.setHours(0, 0, 0, 0);
    return start;
  };

  const isValidDate = (date) => date instanceof Date && !Number.isNaN(date.getTime());

  const dateKey = (date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const normalizeTime = (time) => {
    if (!time) return null;
    const parts = time.split(":");
    if (parts.length >= 2) {
      return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
    }
    return null;
  };

  const getStatusStyles = (status) => {
    const normalized = (status || "").toLowerCase();
    switch (normalized) {
      case "approved":
        return { bg: "bg-success-subtle", text: "text-success" };
      case "pending":
        return { bg: "bg-warning-subtle", text: "text-warning" };
      case "rejected":
        return { bg: "bg-danger-subtle", text: "text-danger" };
      default:
        return { bg: "bg-secondary-subtle", text: "text-secondary" };
    }
  };

  const normalizedEvents = useMemo(() => {
    return calendarEvents
      .map((booking) => {
        const dateString = booking.booking_date;
        const cleanedStart = normalizeTime(booking.start_time);
        const cleanedEnd = normalizeTime(booking.end_time);
        const start = cleanedStart && dateString ? `${dateString}T${cleanedStart}:00` : null;
        const end = cleanedEnd && dateString ? `${dateString}T${cleanedEnd}:00` : null;

        const startDate = start ? new Date(start) : null;
        const endDate = end ? new Date(end) : null;

        return {
          ...booking,
          start_time: cleanedStart || booking.start_time,
          end_time: cleanedEnd || booking.end_time,
          startDate: isValidDate(startDate) ? startDate : null,
          endDate: isValidDate(endDate) ? endDate : null,
        };
      })
      .filter((booking) => isValidDate(booking.startDate));
  }, [calendarEvents]);

  const eventsByDay = useMemo(() => {
    const grouped = {};
    normalizedEvents.forEach((event) => {
      if (!isValidDate(event.startDate)) return;
      const key = dateKey(event.startDate);
      grouped[key] = grouped[key] || [];
      grouped[key].push(event);
    });
    Object.values(grouped).forEach((events) => {
      events.sort((a, b) => a.startDate - b.startDate);
    });
    return grouped;
  }, [normalizedEvents]);

  const monthDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const start = new Date(firstOfMonth);
    start.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());
    start.setHours(0, 0, 0, 0);

    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [calendarDate]);

  const weekDays = useMemo(() => {
    const start = getWeekStart(calendarDate);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [calendarDate]);

  const currentDayEvents = useMemo(() => {
    const key = dateKey(calendarDate);
    return eventsByDay[key] || [];
  }, [calendarDate, eventsByDay]);

  const calendarTitle = useMemo(() => {
    if (calendarView === "week") {
      const start = getWeekStart(calendarDate);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${formatLabel(start, { month: "short", day: "numeric" })} – ${formatLabel(end, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`;
    }

    if (calendarView === "day") {
      return formatLabel(calendarDate, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }

    return formatLabel(calendarDate, { month: "long", year: "numeric" });
  }, [calendarDate, calendarView]);

  const changeView = (view) => {
    setCalendarView(view);
  };

  const changeCalendarDate = (offset) => {
    const next = new Date(calendarDate);
    if (calendarView === "month") {
      next.setMonth(next.getMonth() + offset);
    } else if (calendarView === "week") {
      next.setDate(next.getDate() + offset * 7);
    } else {
      next.setDate(next.getDate() + offset);
    }
    setCalendarDate(next);
  };

  const handleToday = () => {
    setCalendarDate(new Date());
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const [, payload] = token.split(".");
      if (payload) {
        const decoded = JSON.parse(atob(payload));
        const role = decoded.role || "";
        setUserRole(role);
        loadCalendarEvents(role);
        loadEventOptions();
      }
    } catch (error) {
      console.error("Unable to decode token", error);
    }
  }, [navigate]);

  return (
    <div className="bg-light min-vh-100 py-5">
      <div className="container">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
          <div>
            <h1 className="h3 mb-1">Meditation Hall Booking</h1>
            <p className="text-muted mb-0">
              Reserve a peaceful time slot for your group meditation or practice.
            </p>
          </div>
          <div className="d-flex flex-wrap gap-2">
            {userRole === "admin" && (
              <>
                <button className="btn btn-outline-primary" onClick={() => navigate("/admin")}> 
                  View pending requests
                </button>
                <button className="btn btn-outline-info" onClick={() => navigate("/audit-logs")}> 
                  View audit logs
                </button>
              </>
            )}
            <button className="btn btn-outline-secondary" onClick={() => navigate("/my-bookings")}>
              My bookings
            </button>
            <button className="btn btn-outline-danger" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        <div className="card shadow-sm border-0 mb-4">
          <div className="card-body p-4">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-3">
              <div>
                <h2 className="h5 mb-1">Booking calendar</h2>
                <p className="text-muted small mb-0">
                  See hall bookings by month, week, or day. Each entry shows purpose and time.
                </p>
              </div>
              <div className="btn-group" role="group" aria-label="Calendar view selector">
                <button
                  type="button"
                  className={`btn btn-sm ${calendarView === "month" ? "btn-primary" : "btn-outline-primary"}`}
                  onClick={() => changeView("month")}
                >
                  Month
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${calendarView === "week" ? "btn-primary" : "btn-outline-primary"}`}
                  onClick={() => changeView("week")}
                >
                  Week
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${calendarView === "day" ? "btn-primary" : "btn-outline-primary"}`}
                  onClick={() => changeView("day")}
                >
                  Day
                </button>
              </div>
            </div>

            <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
              <button className="btn btn-sm btn-outline-secondary" onClick={() => changeCalendarDate(-1)}>
                Previous
              </button>
              <button className="btn btn-sm btn-outline-secondary" onClick={handleToday}>
                Today
              </button>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => changeCalendarDate(1)}>
                Next
              </button>
              <div className="ms-auto fw-semibold">{calendarTitle}</div>
            </div>

            {calendarLoading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status"></div>
                <p className="mt-3 text-muted">Loading calendar...</p>
              </div>
            ) : calendarError ? (
              <div className="alert alert-danger" role="alert">
                {calendarError}
              </div>
            ) : (
              <>
                {calendarView === "month" && (
                  <div className="table-responsive rounded-3 border border-1 border-secondary-subtle">
                    <table className="table table-bordered calendar-table mb-0 rounded-3" style={{ borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                            <th key={day} className="text-center small text-uppercase bg-secondary-subtle text-dark border-end border-secondary border-1">
                              {day}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: 6 }, (_, weekIndex) => (
                          <tr key={weekIndex}>
                            {monthDays.slice(weekIndex * 7, weekIndex * 7 + 7).map((day) => {
                              const dayKey = dateKey(day);
                              const events = eventsByDay[dayKey] || [];
                              const isCurrentMonth = day.getMonth() === calendarDate.getMonth();
                              const todayKey = dateKey(new Date());
                              const isToday = dayKey === todayKey;

                              return (
                                <td
                                  key={dayKey}
                                  className={`align-top ${isCurrentMonth ? "" : "bg-light text-muted"} ${isToday ? "bg-primary bg-opacity-15" : ""}`}
                                  style={{ minHeight: 140, verticalAlign: 'top' }}
                                >
                                  <div className="d-flex justify-content-between align-items-center mb-2">
                                    <span className={isCurrentMonth ? "fw-semibold" : "text-muted"}>
                                      {day.getDate()}
                                    </span>
                                  </div>
                                  {events.length === 0 ? (
                                    <div className="small text-muted">No bookings</div>
                                  ) : (
                                    events.map((event) => {
                                      const statusStyles = getStatusStyles(event.status);
                                      return (
                                        <div key={event.id} className={`mb-2 p-2 rounded border border-1 ${statusStyles.bg} ${statusStyles.text}`}>
                                          <div className="small fw-semibold">{event.purpose}</div>
                                          <div className="small">{event.start_time}</div>
                                        </div>
                                      );
                                    })
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {calendarView === "week" && (
                  <div className="table-responsive rounded-3 border border-1 border-secondary-subtle">
                    <table className="table table-bordered calendar-table mb-0 rounded-3" style={{ borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {weekDays.map((day) => {
                            const dayKey = dateKey(day);
                            return (
                              <th key={dayKey} className="text-center small text-uppercase bg-secondary-subtle text-dark border-end border-secondary border-1">
                                <div>{formatLabel(day, { weekday: 'short' })}</div>
                                <div className="fw-semibold">{formatLabel(day, { month: 'short', day: 'numeric' })}</div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {weekDays.map((day) => {
                            const dayKey = dateKey(day);
                            const events = eventsByDay[dayKey] || [];
                            const todayKey = dateKey(new Date());
                            const isToday = dayKey === todayKey;
                            return (
                              <td
                                key={dayKey}
                                style={{ minHeight: 170, verticalAlign: 'top' }}
                                className={isToday ? "bg-primary bg-opacity-15" : ""}
                              >
                                {events.length === 0 ? (
                                  <div className="text-muted small">No bookings</div>
                                ) : (
                                  events.map((event) => {
                                    const statusStyles = getStatusStyles(event.status);
                                    return (
                                      <div key={event.id} className={`mb-2 p-2 rounded border border-1 ${statusStyles.bg} ${statusStyles.text}`}>
                                        <div className="small fw-semibold">{event.purpose}</div>
                                        <div className="small">{event.start_time}</div>
                                      </div>
                                    );
                                  })
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {calendarView === "day" && (
                  <div>
                    <div className="mb-3">
                      <div className="fw-semibold">{calendarTitle}</div>
                      <div className="text-muted small">{currentDayEvents.length} booking(s)</div>
                    </div>
                    {currentDayEvents.length === 0 ? (
                      <div className="text-center py-5 text-muted">No bookings for this day.</div>
                    ) : (
                      <div className="list-group">
                        {currentDayEvents.map((event) => {
                          const statusStyles = getStatusStyles(event.status);
                          const now = new Date();
                          const eventBegin = event.startDate;
                          const diffMin = eventBegin ? (eventBegin - now) / 60000 : null;
                          const isUpcoming = diffMin !== null && diffMin >= 0 && diffMin < 15;
                          return (
                            <div
                              key={event.id}
                              className={`list-group-item rounded mb-2 border ${statusStyles.bg} ${statusStyles.text} ${isUpcoming ? "border border-info border-2" : "border-secondary-subtle"}`}
                            >
                              <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
                                <div className="fw-semibold">{event.purpose}</div>
                                <span className={`badge text-uppercase small ${statusStyles.text} ${statusStyles.bg}`}> {event.status || 'Unknown'} </span>
                              </div>
                              <div className="small">{event.start_time}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="row g-4">
          <div className="col-12 col-lg-7">
            <div className="card shadow-sm border-0">
              <div className="card-body p-4">
                <h2 className="h5 mb-3">Request a new booking</h2>
                <p className="text-muted small mb-4">
                  Fill in the details below. Admins review each request and ensure there are no schedule conflicts.
                </p>

                <form onSubmit={handleBooking}>
                  <div className="mb-3">
                    <label htmlFor="purpose" className="form-label">
                      Purpose / Event title
                    </label>
                    <select
                      id="purpose"
                      name="purpose"
                      className="form-select"
                      value={form.purpose}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="" disabled>
                        Select event purpose
                      </option>
                      {eventOptions.map((eventName) => (
                        <option key={eventName} value={eventName}>
                          {eventName}
                        </option>
                      ))}
                    </select>
                    {eventOptionsError && (
                      <div className="form-text text-danger">{eventOptionsError}</div>
                    )}
                    {!eventOptionsError && eventOptions.length === 0 && (
                      <div className="form-text text-muted">No event values available yet.</div>
                    )}
                  </div>

                  <div className="mb-3">
                    <label htmlFor="attendees" className="form-label">
                      Number of attendees
                    </label>
                    <input
                      id="attendees"
                      name="attendees"
                      type="number"
                      min="1"
                      className="form-control"
                      placeholder="e.g. 15"
                      value={form.attendees}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="row g-3">
                    <div className="col-md-4">
                      <label htmlFor="booking_date" className="form-label">
                        Booking date
                      </label>
                      <input
                        id="booking_date"
                        name="booking_date"
                        type="date"
                        className="form-control"
                        value={form.booking_date}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="col-md-4">
                      <label htmlFor="start_time" className="form-label">
                        Start time
                      </label>
                      <input
                        id="start_time"
                        name="start_time"
                        type="time"
                        className="form-control"
                        value={form.start_time}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="col-md-4">
                      <label htmlFor="end_time" className="form-label">
                        End time
                      </label>
                      <input
                        id="end_time"
                        name="end_time"
                        type="time"
                        className="form-control"
                        value={form.end_time}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="repeat_until" className="form-label">
                      Repeat daily until (optional)
                    </label>
                    <input
                      id="repeat_until"
                      name="repeat_until"
                      type="date"
                      className="form-control"
                      value={form.repeat_until}
                      onChange={handleInputChange}
                        min={form.booking_date || undefined}
                    />
                    <div className="form-text">
                      Leave blank to request a single day. When filled, the same time slot will be booked each day through the selected date.
                    </div>
                  </div>

                  <div className="d-grid mt-4">
                    <button
                      type="submit"
                      className="btn btn-primary btn-lg"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <span
                            className="spinner-border spinner-border-sm me-2"
                            role="status"
                            aria-hidden="true"
                          ></span>
                          Submitting request...
                        </>
                      ) : (
                        "Submit booking request"
                      )}
                    </button>
                  </div>
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
          </div>

          <div className="col-12 col-lg-5">
            <div className="card shadow-sm border-0 h-100">
              <div className="card-body p-4 d-flex flex-column">
                <h2 className="h5 mb-3">Tips for a smooth booking</h2>
                <ul className="list-unstyled flex-grow-1 mb-4">
                  <li className="d-flex gap-3 mb-3">
                    <span className="badge bg-primary-subtle text-primary">1</span>
                    <div>
                      <h6 className="mb-1">Plan ahead</h6>
                      <p className="mb-0 small text-muted">
                        Submit your request at least a day before the session to give admins enough time to review.
                      </p>
                    </div>
                  </li>
                  <li className="d-flex gap-3 mb-3">
                    <span className="badge bg-primary-subtle text-primary">2</span>
                    <div>
                      <h6 className="mb-1">Multi-day slots</h6>
                      <p className="mb-0 small text-muted">
                        Use the "Repeat until" field to request the same time window across consecutive days in a single submission.
                      </p>
                    </div>
                  </li>
                  <li className="d-flex gap-3">
                    <span className="badge bg-primary-subtle text-primary">3</span>
                    <div>
                      <h6 className="mb-1">Keep it serene</h6>
                      <p className="mb-0 small text-muted">
                        Respect the shared space by maintaining silence and leaving the hall clean for the next group.
                      </p>
                    </div>
                  </li>
                </ul>
                <div className="bg-primary-subtle rounded-3 p-3 small text-primary">
                  Need help? Reach out to the admin team to update or cancel an existing booking.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}