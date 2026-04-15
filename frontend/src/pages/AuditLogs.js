import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [timestampFromDate, setTimestampFromDate] = useState("");
  const [timestampFromTime, setTimestampFromTime] = useState("");
  const [timestampToDate, setTimestampToDate] = useState("");
  const [timestampToTime, setTimestampToTime] = useState("");
  const [sortBy, setSortBy] = useState("timestamp");
  const [sortDirection, setSortDirection] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAuditLogs = async () => {
      setIsLoading(true);
      setError("");
      try {
        const { data } = await API.get("/audit-logs");
        setLogs(Array.isArray(data) ? data : []);
      } catch (err) {
        const message =
          err.response?.data?.message ||
          err.response?.data?.error ||
          "Unable to load audit logs.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAuditLogs();
  }, []);

  const parseDateTime = (date, time, endOfDay = false) => {
    if (!date) return null;
    const normalizedTime = time || (endOfDay ? "23:59" : "00:00");
    return new Date(`${date}T${normalizedTime}:00`);
  };

  const renderDetails = (details) => {
    if (!details) return "—";
    if (typeof details === "string") return details;

    const parts = [];
    if (details.email) parts.push(`Email: ${details.email}`);
    if (details.mobile) parts.push(`Mobile: ${details.mobile}`);

    const otherKeys = Object.keys(details).filter(
      (key) => key !== "email" && key !== "mobile"
    );
    otherKeys.forEach((key) => {
      const value = details[key];
      if (value !== undefined && value !== null && value !== "") {
        parts.push(`${key.replace(/_/g, " ")}: ${value}`);
      }
    });

    return parts.length ? parts.join(" | ") : "—";
  };

  const getSortValue = useCallback((log, key) => {
    switch (key) {
      case "action":
        return (log.action || "").toLowerCase();
      case "performed_by":
        return (log.performed_by || "").toLowerCase();
      case "performed_by_id":
        return (log.performed_by_id || "").toString();
      case "details":
        return renderDetails(log.details).toLowerCase();
      case "timestamp":
      default:
        return new Date(log.timestamp).getTime() || 0;
    }
  }, []);

  const filteredSortedLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    const fromDate = parseDateTime(timestampFromDate, timestampFromTime, false);
    const toDate = parseDateTime(timestampToDate, timestampToTime, true);

    const filtered = logs.filter((log) => {
      const action = (log.action || "").toLowerCase();
      const performedBy = (log.performed_by || "").toLowerCase();
      const performedById = (log.performed_by_id || "").toString().toLowerCase();
      const detailsText = renderDetails(log.details).toLowerCase();
      const timestampValue = new Date(log.timestamp);

      if (term) {
        const matchesSearch =
          action.includes(term) ||
          performedBy.includes(term) ||
          performedById.includes(term) ||
          detailsText.includes(term);
        if (!matchesSearch) return false;
      }

      if (fromDate && timestampValue < fromDate) {
        return false;
      }
      if (toDate && timestampValue > toDate) {
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
  }, [logs, search, timestampFromDate, timestampFromTime, timestampToDate, timestampToTime, sortBy, sortDirection,getSortValue]);

  const totalPages = Math.max(1, Math.ceil(filteredSortedLogs.length / rowsPerPage));

  useEffect(() => {
    setCurrentPage(1);
  }, [search, timestampFromDate, timestampFromTime, timestampToDate, timestampToTime, rowsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const currentLogs = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredSortedLogs.slice(start, start + rowsPerPage);
  }, [filteredSortedLogs, currentPage, rowsPerPage]);

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
    setTimestampFromDate("");
    setTimestampFromTime("");
    setTimestampToDate("");
    setTimestampToTime("");
    setCurrentPage(1);
  };

  return (
    <div className="bg-light min-vh-100 py-5">
      <div className="container">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
          <div>
            <h1 className="h3 mb-1">Audit logs</h1>
            <p className="text-muted mb-0">
              Admin-only view of signups, logins, booking requests, and approval actions.
            </p>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-outline-primary" onClick={() => navigate("/dashboard")}>Dashboard</button>
            <button className="btn btn-outline-secondary" onClick={() => navigate("/admin")}>Admin panel</button>
          </div>
        </div>

        <div className="card shadow-sm border-0">
          <div className="card-body p-4">
            {error && (
              <div className="alert alert-danger" role="alert">
                {error}
              </div>
            )}

            {isLoading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status"></div>
                <p className="mt-3 text-muted">Loading audit logs...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <h3 className="h6 mb-1">No audit records yet</h3>
                <p className="small">Actions will appear here after user and admin activity.</p>
              </div>
            ) : (
              <>
                <div className="row g-3 mb-4">
                  <div className="col-12 col-md-4">
                    <label htmlFor="auditSearch" className="form-label">Search</label>
                    <input
                      id="auditSearch"
                      type="search"
                      className="form-control"
                      placeholder="Action, performed by, actor ID, details"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  <div className="col-6 col-md-2">
                    <label htmlFor="timestampFromDate" className="form-label">From date</label>
                    <input
                      id="timestampFromDate"
                      type="date"
                      className="form-control"
                      value={timestampFromDate}
                      onChange={(e) => setTimestampFromDate(e.target.value)}
                    />
                  </div>
                  <div className="col-6 col-md-2">
                    <label htmlFor="timestampFromTime" className="form-label">Time</label>
                    <input
                      id="timestampFromTime"
                      type="time"
                      className="form-control"
                      value={timestampFromTime}
                      onChange={(e) => setTimestampFromTime(e.target.value)}
                    />
                  </div>

                  <div className="col-6 col-md-2">
                    <label htmlFor="timestampToDate" className="form-label">To date</label>
                    <input
                      id="timestampToDate"
                      type="date"
                      className="form-control"
                      value={timestampToDate}
                      onChange={(e) => setTimestampToDate(e.target.value)}
                    />
                  </div>
                  <div className="col-6 col-md-2">
                    <label htmlFor="timestampToTime" className="form-label">Time</label>
                    <input
                      id="timestampToTime"
                      type="time"
                      className="form-control"
                      value={timestampToTime}
                      onChange={(e) => setTimestampToTime(e.target.value)}
                    />
                  </div>
                </div>

                <div className="d-flex flex-wrap gap-2 mb-4">
                  <button className="btn btn-sm btn-outline-secondary" onClick={clearFilters}>
                    Clear filters
                  </button>
                </div>

                {filteredSortedLogs.length === 0 ? (
                  <div className="text-center py-5 text-muted">
                    <h3 className="h6 mb-1">No matching audit logs</h3>
                    <p className="small">Try a broader search or adjust the timestamp range.</p>
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
                                onClick={() => toggleSort("timestamp")}
                              >
                                Timestamp{renderSortIndicator("timestamp")}
                              </button>
                            </th>
                            <th scope="col" className="fw-bold">
                              <button
                                type="button"
                                className="btn btn-link p-0 text-decoration-none text-reset fw-bold"
                                onClick={() => toggleSort("action")}
                              >
                                Action{renderSortIndicator("action")}
                              </button>
                            </th>
                            <th scope="col" className="fw-bold">
                              <button
                                type="button"
                                className="btn btn-link p-0 text-decoration-none text-reset fw-bold"
                                onClick={() => toggleSort("performed_by")}
                              >
                                Performed by{renderSortIndicator("performed_by")}
                              </button>
                            </th>
                            <th scope="col" className="text-center fw-bold">
                              <button
                                type="button"
                                className="btn btn-link p-0 text-decoration-none text-reset fw-bold"
                                onClick={() => toggleSort("performed_by_id")}
                              >
                                Actor ID{renderSortIndicator("performed_by_id")}
                              </button>
                            </th>
                            <th scope="col" className="fw-bold">Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentLogs.map((log) => (
                            <tr key={log.id}>
                              <td>{new Date(log.timestamp).toLocaleString()}</td>
                              <td>{log.action}</td>
                              <td>{log.performed_by || "System"}</td>
                              <td className="text-center">{log.performed_by_id || "—"}</td>
                              <td className="text-break">{renderDetails(log.details)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-center gap-3 mt-3">
                      <div className="text-muted small">
                        Showing {Math.min((currentPage - 1) * rowsPerPage + 1, filteredSortedLogs.length)} to {Math.min(currentPage * rowsPerPage, filteredSortedLogs.length)} of {filteredSortedLogs.length} entries
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
