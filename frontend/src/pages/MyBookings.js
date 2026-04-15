import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";

function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [scheduleFromDate, setScheduleFromDate] = useState("");
  const [scheduleFromTime, setScheduleFromTime] = useState("");
  const [scheduleToDate, setScheduleToDate] = useState("");
  const [scheduleToTime, setScheduleToTime] = useState("");
  const [sortBy, setSortBy] = useState("booking_date");
  const [sortDirection, setSortDirection] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const navigate = useNavigate();

  const statusStyles = useMemo(
    () => ({
      approved: { label: "Approved", variant: "success" },
      pending: { label: "Pending", variant: "warning" },
      rejected: { label: "Rejected", variant: "danger" },
    }),
    []
  );

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setIsLoading(true);
    setError("");
    try {
      const { data } = await API.get("/my-bookings");
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Unable to load your bookings at the moment.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
    }).format(date);
  };

  const formatDateTime = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const formatTime = (value) => {
    if (!value) return "—";
    return value.slice(0, 5);
  };

  const getRequestedOn = (booking) => {
    const requestedAt = booking.created_at || booking.createDate;
    if (!requestedAt) return null;
    const date = new Date(requestedAt);
    return Number.isNaN(date.getTime()) ? null : formatDateTime(requestedAt);
  };

  const parseDateTime = (date, time, endOfDay = false) => {
    if (!date) return null;
    const normalizedTime = time || (endOfDay ? "23:59" : "00:00");
    return new Date(`${date}T${normalizedTime}:00`);
  };

  const getBookingStart = (booking) => {
    if (!booking.booking_date) return null;
    const time = booking.start_time ? booking.start_time.slice(0, 5) : "00:00";
    return new Date(`${booking.booking_date}T${time}:00`);
  };

  const getSortValue = (booking, key) => {
    switch (key) {
      case "purpose":
        return (booking.purpose || "").toLowerCase();
      case "status":
        return (booking.status || "").toLowerCase();
      case "requested":
        return new Date(booking.createDate || booking.created_at || 0).getTime();
      case "booking_date":
      default:
        return getBookingStart(booking)?.getTime() || 0;
    }
  };

  const filteredSortedBookings = useMemo(() => {
    const term = search.trim().toLowerCase();
    const fromDate = parseDateTime(scheduleFromDate, scheduleFromTime, false);
    const toDate = parseDateTime(scheduleToDate, scheduleToTime, true);

    const filtered = bookings.filter((booking) => {
      const purpose = (booking.purpose || "").toLowerCase();
      const status = (booking.status || "").toLowerCase();
      const bookingStart = getBookingStart(booking);

      if (term && !purpose.includes(term) && !status.includes(term)) {
        return false;
      }

      if (statusFilter && status !== statusFilter.toLowerCase()) {
        return false;
      }

      if (fromDate && bookingStart && bookingStart < fromDate) {
        return false;
      }
      if (toDate && bookingStart && bookingStart > toDate) {
        return false;
      }

      return true;
    });

    return filtered.slice().sort((a, b) => {
      const aValue = getSortValue(a, sortBy);
      const bValue = getSortValue(b, sortBy);
      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [bookings, search, statusFilter, scheduleFromDate, scheduleFromTime, scheduleToDate, scheduleToTime, sortBy, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredSortedBookings.length / rowsPerPage));

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, scheduleFromDate, scheduleFromTime, scheduleToDate, scheduleToTime, rowsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const currentBookings = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredSortedBookings.slice(start, start + rowsPerPage);
  }, [filteredSortedBookings, currentPage, rowsPerPage]);

  const toggleSort = (column) => {
    if (sortBy === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDirection("asc");
    }
  };

  const renderSortIndicator = (column) => {
    if (sortBy !== column) return null;
    return sortDirection === "asc" ? " ▲" : " ▼";
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setScheduleFromDate("");
    setScheduleFromTime("");
    setScheduleToDate("");
    setScheduleToTime("");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="bg-light min-vh-100 py-5">
      <div className="container">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
          <div>
            <h1 className="h3 mb-1">My bookings</h1>
            <p className="text-muted mb-0">
              Track every request you have made for the meditation hall.
            </p>
          </div>

          <div className="d-flex gap-2">
            <button className="btn btn-outline-primary" onClick={() => navigate("/dashboard")}>
              New booking
            </button>
            <button className="btn btn-outline-danger" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        <div className="card shadow-sm border-0">
          <div className="card-body p-4">
            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
              <div>
                <h2 className="h5 mb-1">Booking history</h2>
                <p className="text-muted small mb-0">
                  Status updates appear in real time once an admin reviews your request.
                </p>
              </div>
              <button className="btn btn-sm btn-outline-secondary" onClick={fetchBookings} disabled={isLoading}>
                {isLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div className="row g-3 mb-4">
              <div className="col-12 col-md-4">
                <label htmlFor="bookingSearch" className="form-label">Search</label>
                <input
                  id="bookingSearch"
                  type="search"
                  className="form-control"
                  placeholder="Purpose or status"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="col-12 col-md-2">
                <label htmlFor="statusFilter" className="form-label">Status</label>
                <select
                  id="statusFilter"
                  className="form-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="col-12">
                <div className="row g-3">
                  <div className="col-6 col-md-2">
                    <label htmlFor="scheduleFromDate" className="form-label">From date</label>
                    <input
                      id="scheduleFromDate"
                      type="date"
                      className="form-control"
                      value={scheduleFromDate}
                      onChange={(e) => setScheduleFromDate(e.target.value)}
                    />
                  </div>
              <div className="col-6 col-md-2">
                <label htmlFor="scheduleFromTime" className="form-label">Time</label>
                <input
                  id="scheduleFromTime"
                  type="time"
                  className="form-control"
                  value={scheduleFromTime}
                  onChange={(e) => setScheduleFromTime(e.target.value)}
                />
              </div>
                  <div className="col-6 col-md-2">
                    <label htmlFor="scheduleToDate" className="form-label">To date</label>
                    <input
                      id="scheduleToDate"
                      type="date"
                      className="form-control"
                      value={scheduleToDate}
                      onChange={(e) => setScheduleToDate(e.target.value)}
                    />
                  </div>
                  <div className="col-6 col-md-2">
                    <label htmlFor="scheduleToTime" className="form-label">Time</label>
                    <input
                      id="scheduleToTime"
                      type="time"
                      className="form-control"
                      value={scheduleToTime}
                      onChange={(e) => setScheduleToTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="d-flex flex-wrap gap-2 mb-4">
              <button className="btn btn-sm btn-outline-secondary" onClick={clearFilters}>
                Clear filters
              </button>
            </div>

            {error && (
              <div className="alert alert-danger" role="alert">
                {error}
              </div>
            )}

            {isLoading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status"></div>
                <p className="mt-3 text-muted">Loading your bookings...</p>
              </div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-5">
                <h3 className="h6 text-muted">No bookings yet</h3>
                <p className="text-muted small mb-4">
                  Reserve the meditation hall to see your requests listed here.
                </p>
                <button className="btn btn-primary" onClick={() => navigate("/dashboard")}>
                  Create your first booking
                </button>
              </div>
            ) : filteredSortedBookings.length === 0 ? (
              <div className="text-center py-5">
                <h3 className="h6 text-muted">No matching bookings</h3>
                <p className="text-muted small mb-4">
                  Try a broader search or adjust the schedule range.
                </p>
              </div>
            ) : (
              <>
                <div className="table-responsive">
                  <table className="table table-hover align-middle">
                    <thead>
                      <tr>
                        <th scope="col" className="fw-bold">
                          <button
                            type="button"
                            className="btn btn-link p-0 text-decoration-none text-reset fw-bold"
                            onClick={() => toggleSort("purpose")}
                          >
                            Purpose{renderSortIndicator("purpose")}
                          </button>
                        </th>
                        <th scope="col" className="fw-bold">
                          <button
                            type="button"
                            className="btn btn-link p-0 text-decoration-none text-reset fw-bold"
                            onClick={() => toggleSort("booking_date")}
                          >
                            Schedule{renderSortIndicator("booking_date")}
                          </button>
                        </th>
                        <th scope="col" className="text-center fw-bold">Attendees</th>
                        <th scope="col" className="text-center fw-bold">
                          <button
                            type="button"
                            className="btn btn-link p-0 text-decoration-none text-reset fw-bold"
                            onClick={() => toggleSort("status")}
                          >
                            Status{renderSortIndicator("status")}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentBookings.map((booking) => {
                      const statusKey = booking.status?.toLowerCase();
                      const style = statusStyles[statusKey] || {
                        label: booking.status || "Unknown",
                        variant: "secondary",
                      };
                      return (
                        <tr key={booking.id}>
                          <td>
                            <p className="mb-1">{booking.purpose}</p>
                            {getRequestedOn(booking) ? (
                              <p className="text-muted small mb-0">
                                Requested on {getRequestedOn(booking)}
                              </p>
                            ) : null}
                          </td>
                          <td>
                            <div>{formatDate(booking.booking_date)}</div>
                            <div className="text-muted small">
                              {formatTime(booking.start_time)} to {formatTime(booking.end_time)}
                            </div>
                          </td>
                          <td className="text-center">{booking.attendees}</td>
                          <td className="text-center">
                            <span className={`badge text-bg-${style.variant} px-3 py-2 text-uppercase fw-semibold`}>
                              {style.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="d-flex flex-column flex-md-row flex-nowrap justify-content-between align-items-center gap-3 mt-3">
                <div className="text-muted small">
                  Showing {currentBookings.length} of {filteredSortedBookings.length} matching bookings
                </div>
                <div className="d-flex align-items-center gap-2 flex-nowrap ms-md-auto">
                  <label htmlFor="rowsPerPage" className="form-label mb-0 text-nowrap">Rows per page</label>
                  <select
                    id="rowsPerPage"
                    className="form-select form-select-sm"
                    value={rowsPerPage}
                    onChange={(e) => setRowsPerPage(Number(e.target.value))}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>
                </div>
                <nav aria-label="Booking pagination">
                  <ul className="pagination mb-0">
                    <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                      <button className="page-link" type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>
                        Previous
                      </button>
                    </li>
                    {Array.from({ length: totalPages }, (_, index) => (
                      <li key={index} className={`page-item ${currentPage === index + 1 ? "active" : ""}`}>
                        <button className="page-link" type="button" onClick={() => setCurrentPage(index + 1)}>
                          {index + 1}
                        </button>
                      </li>
                    ))}
                    <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
                      <button className="page-link" type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>
                        Next
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MyBookings;