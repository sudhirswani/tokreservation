import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";

function Admin() {
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState({ type: "", text: "" });
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
  const [confirmData, setConfirmData] = useState({
    show: false,
    bookingId: null,
    status: "",
    actionType: "",
    purpose: "",
    booking_date: "",
    start_time: "",
    end_time: "",
  });
  const navigate = useNavigate();

  const statusConfig = useMemo(
    () => ({
      approved: { label: "Approved", badge: "success" },
      pending: { label: "Pending", badge: "warning" },
      rejected: { label: "Rejected", badge: "danger" },
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
      const { data } = await API.get("/all-bookings");
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Unable to load booking data.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    setActionMessage({ type: "", text: "" });
    try {
      const { data } = await API.put(`/update-booking/${id}`, { status });
      setActionMessage({ type: "success", text: data.message || "Booking updated." });
      fetchBookings();
    } catch (err) {
      const message = err.response?.data?.error || "Unable to update booking.";
      setActionMessage({ type: "danger", text: message });
    }
  };

  const cancelBooking = async (id) => {
    setActionMessage({ type: "", text: "" });
    try {
      const { data } = await API.put(`/cancel-booking/${id}`);
      setActionMessage({ type: "success", text: data.message || "Booking canceled." });
      fetchBookings();
    } catch (err) {
      const message = err.response?.data?.error || "Unable to cancel booking.";
      setActionMessage({ type: "danger", text: message });
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

  const formatTime = (value) => {
    if (!value) return "—";
    return value.slice(0, 5);
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

  const parseScheduleDateTime = (date, time, endOfDay = false) => {
    if (!date) return null;
    const normalizedTime = time || (endOfDay ? "23:59" : "00:00");
    return new Date(`${date}T${normalizedTime}:00`);
  };

  const getBookingStart = (booking) => {
    if (!booking.booking_date) return null;
    const time = booking.start_time ? booking.start_time.slice(0, 5) : "00:00";
    return new Date(`${booking.booking_date}T${time}:00`);
  };

  const getSortValue = useCallback((booking, key) => {
  switch (key) {
    case "user_name":
      return (booking.user_name || booking.email || "").toLowerCase();
    case "purpose":
      return (booking.purpose || "").toLowerCase();
    case "status":
      return (booking.status || "").toLowerCase();
    case "created_at":
      return new Date(booking.createDate || booking.created_at || 0).getTime();
    case "booking_date":
    default:
      return getBookingStart(booking)?.getTime() || 0;
  }
}, []);

  const filteredSortedBookings = useMemo(() => {
    const term = search.trim().toLowerCase();
    const fromDate = parseScheduleDateTime(scheduleFromDate, scheduleFromTime, false);
    const toDate = parseScheduleDateTime(scheduleToDate, scheduleToTime, true);

    const filtered = bookings.filter((booking) => {
      const requester = `${booking.user_name || ""} ${booking.email || ""}`.toLowerCase();
      const purpose = (booking.purpose || "").toLowerCase();
      const schedule = `${booking.booking_date || ""} ${booking.start_time || ""} ${booking.end_time || ""}`.toLowerCase();
      const status = (booking.status || "").toLowerCase();
      const bookingStart = getBookingStart(booking);

      if (term) {
        const matchesSearch =
          requester.includes(term) ||
          purpose.includes(term) ||
          schedule.includes(term) ||
          status.includes(term);
        if (!matchesSearch) return false;
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

    const sorted = filtered.slice().sort((a, b) => {
      const aValue = getSortValue(a, sortBy);
      const bValue = getSortValue(b, sortBy);
      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [bookings, search, statusFilter, scheduleFromDate, scheduleFromTime, scheduleToDate, scheduleToTime, sortBy, sortDirection,getSortValue]);

  const totalPages = Math.max(1, Math.ceil(filteredSortedBookings.length / rowsPerPage));

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, scheduleFromDate, scheduleFromTime, scheduleToDate, scheduleToTime, sortBy, sortDirection, rowsPerPage]);

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

  /*const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setScheduleFromDate("");
    setScheduleFromTime("");
    setScheduleToDate("");
    setScheduleToTime("");
  };*/

  const openConfirmModal = (booking, actionType) => {
    setConfirmData({
      show: true,
      bookingId: booking.id,
      status: actionType === "cancel" ? "rejected" : actionType,
      actionType,
      purpose: booking.purpose,
      booking_date: booking.booking_date,
      start_time: booking.start_time,
      end_time: booking.end_time,
    });
  };

  const closeConfirmModal = () => {
    setConfirmData({
      show: false,
      bookingId: null,
      status: "",
      purpose: "",
      booking_date: "",
      start_time: "",
      end_time: "",
    });
  };

  const handleConfirmAction = () => {
    if (!confirmData.bookingId) return;
    if (confirmData.actionType === "cancel") {
      cancelBooking(confirmData.bookingId);
    } else {
      updateStatus(confirmData.bookingId, confirmData.status);
    }
    closeConfirmModal();
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const renderSortIndicator = (column) => {
    if (sortBy !== column) return null;
    return sortDirection === "asc" ? " ▲" : " ▼";
  };

  return (
    <>
    <div className="bg-light min-vh-100 py-5">
      <div className="container">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
          <div>
            <h1 className="h3 mb-1">Admin panel</h1>
            <p className="text-muted mb-0">
              Review, approve, or reject meditation hall booking requests.
            </p>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-outline-primary" onClick={() => navigate("/dashboard")}>
              User view
            </button>
            <button className="btn btn-outline-danger" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>

        <div className="card shadow-sm border-0">
          <div className="card-body p-4">
                {/* ✅ ADD HERE */}
            {error && (
              <div className="alert alert-danger">{error}</div>
            )}

            {actionMessage.text && (
              <div className={`alert alert-${actionMessage.type}`}>
                {actionMessage.text}
              </div>
            )}
            <div className="d-flex justify-content-between flex-wrap gap-3 align-items-center mb-4">
              <div>
                <h2 className="h5 mb-1">All booking requests</h2>
                <p className="text-muted small mb-0">
                  Approve carefully—approved slots can't overlap with existing approved bookings.
                </p>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-sm btn-outline-secondary" onClick={fetchBookings} disabled={isLoading}>
                  {isLoading ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>

            <div className="row g-3 mb-4">
              <div className="col-12 col-md-4">
                <label htmlFor="adminSearch" className="form-label">Search requester or purpose</label>
                <input
                  id="adminSearch"
                  type="search"
                  className="form-control"
                  placeholder="Requester, purpose, schedule, status"
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
                  <div className="col-12 col-md-3">
                    <label htmlFor="scheduleFromDate" className="form-label">Schedule from</label>
                    <input
                      id="scheduleFromDate"
                      type="date"
                      className="form-control"
                      value={scheduleFromDate}
                      onChange={(e) => setScheduleFromDate(e.target.value)}
                    />
                  </div>
                  <div className="col-12 col-md-3">
                    <label htmlFor="scheduleFromTime" className="form-label">Time</label>
                    <input
                      id="scheduleFromTime"
                      type="time"
                      className="form-control"
                      value={scheduleFromTime}
                      onChange={(e) => setScheduleFromTime(e.target.value)}
                    />
                  </div>
                  <div className="col-12 col-md-3">
                    <label htmlFor="scheduleToDate" className="form-label">Schedule to</label>
                    <input
                      id="scheduleToDate"
                      type="date"
                      className="form-control"
                      value={scheduleToDate}
                      onChange={(e) => setScheduleToDate(e.target.value)}
                    />
                  </div>
                  <div className="col-12 col-md-3">
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

            {isLoading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status"></div>
                <p className="mt-3 text-muted">Loading booking requests...</p>
              </div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <h3 className="h6 mb-1">No booking requests yet</h3>
                <p className="small">New requests will appear here automatically.</p>
              </div>
            ) : filteredSortedBookings.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <h3 className="h6 mb-1">No matching results</h3>
                <p className="small">Try a broader search term or adjust the schedule filters.</p>
              </div>
            ) : (
              <>
                <div className="table-responsive">
                  <table className="table align-middle table-hover">
                    <thead>
                      <tr>
                        <th scope="col" className="fw-bold">
                          <button
                            type="button"
                            className="btn btn-link p-0 text-decoration-none text-reset fw-bold"
                            onClick={() => toggleSort("user_name")}
                          >
                            Requester{renderSortIndicator("user_name")}
                          </button>
                        </th>
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
                        <th scope="col" className="text-center fw-bold">
                          <button
                            type="button"
                            className="btn btn-link p-0 text-decoration-none text-reset fw-bold"
                            onClick={() => toggleSort("created_at")}
                          >
                            Requested{renderSortIndicator("created_at")}
                          </button>
                        </th>
                        <th scope="col" className="text-end fw-bold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentBookings.map((booking) => {
                        const statusKey = booking.status?.toLowerCase();
                        const config = statusConfig[statusKey] || {
                          label: booking.status || "Unknown",
                          badge: "secondary",
                        };
                        return (
                          <tr key={booking.id}>
                            <td>
                              <p className="mb-0">{booking.user_name || "User"}</p>
                              <p className="text-muted small mb-0">{booking.email || "—"}</p>
                            </td>
                            <td>
                              <p className="mb-0">{booking.purpose}</p>
                              <p className="text-muted small mb-0">
                                Requested: {formatDateTime(booking.createDate || booking.created_at)}
                              </p>
                            </td>
                            <td>
                              <div>{formatDate(booking.booking_date)}</div>
                              <div className="text-muted small">
                                {formatTime(booking.start_time)} to {formatTime(booking.end_time)}
                              </div>
                            </td>
                            <td className="text-center">{booking.attendees}</td>
                            <td className="text-center">
                              <span className={`badge text-bg-${config.badge} px-3 py-2 text-uppercase`}>
                                {config.label}
                              </span>
                            </td>
                            <td className="text-center text-muted small">
                              {formatDateTime(booking.createDate || booking.created_at)}
                            </td>
                            <td className="text-end">
                              {booking.status === "pending" ? (
                                <div className="d-flex justify-content-end gap-2">
                                  <button
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => openConfirmModal(booking, "rejected")}
                                  >
                                    Reject
                                  </button>
                                  <button
                                    className="btn btn-sm btn-success"
                                    onClick={() => openConfirmModal(booking, "approved")}
                                  >
                                    Approve
                                  </button>
                                </div>
                              ) : booking.status === "approved" ? (
                                <div className="d-flex justify-content-end gap-2">
                                  <button
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => openConfirmModal(booking, "cancel")}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <span className="text-muted small">No action available</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="d-flex flex-column flex-md-row justify-content-between align-items-center gap-3 mt-3">
                  <div className="text-muted small">
                    Showing {Math.min((currentPage - 1) * rowsPerPage + 1, filteredSortedBookings.length)} to {Math.min(currentPage * rowsPerPage, filteredSortedBookings.length)} of {filteredSortedBookings.length} bookings
                  </div>
                  <div className="d-flex flex-wrap gap-2 align-items-center">
                    <div className="input-group input-group-sm" style={{ width: "150px" }}>
                      <span className="input-group-text">Rows</span>
                      <select
                        className="form-select"
                        value={rowsPerPage}
                        onChange={(e) => setRowsPerPage(Number(e.target.value))}
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                      </select>
                    </div>
                    <div className="btn-group" role="group" aria-label="Pagination">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      >
                        Previous
                      </button>
                      <button type="button" className="btn btn-sm btn-outline-secondary" disabled>
                        {currentPage} / {totalPages}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>

      {confirmData.show && (
        <>
          <div className="modal fade show d-block" tabIndex="-1" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {confirmData.actionType === "approved"
                      ? "Approve booking"
                      : confirmData.actionType === "cancel"
                      ? "Cancel booking"
                      : "Reject booking"}
                  </h5>
                  <button type="button" className="btn-close" aria-label="Close" onClick={closeConfirmModal}></button>
                </div>
                <div className="modal-body">
                  <p>
                    Are you sure you want to {confirmData.actionType === "approved" ? "approve" : confirmData.actionType === "cancel" ? "cancel" : "reject"} this booking?
                  </p>
                  {confirmData.purpose && (
                    <div className="bg-light rounded p-3">
                      <p className="fw-semibold mb-1">{confirmData.purpose}</p>
                      <p className="text-muted small mb-0">
                        {formatDate(confirmData.booking_date)} {formatTime(confirmData.start_time)} to {formatTime(confirmData.end_time)}
                      </p>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={closeConfirmModal}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={`btn ${confirmData.actionType === "approved" ? "btn-success" : "btn-danger"}`}
                    onClick={handleConfirmAction}
                  >
                    {confirmData.actionType === "approved"
                      ? "Approve booking"
                      : confirmData.actionType === "cancel"
                      ? "Cancel booking"
                      : "Reject booking"}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show"></div>
        </>
      )}
    </>
  );
}

export default Admin;