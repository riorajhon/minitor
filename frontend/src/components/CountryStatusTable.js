import React, { useState, useEffect } from 'react';
import { getCountryProcessingStatus, updateCountryStatus, deleteCountryStatus } from '../services/statsService';
import './CountryStatusTable.css';

const CountryStatusTable = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState({});
  const [deleting, setDeleting] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'country_code', direction: 'asc' });
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await getCountryProcessingStatus();
      setData(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch country processing status');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (countryCode, newStatus, workerId = null) => {
    try {
      setUpdating(prev => ({ ...prev, [countryCode]: true }));
      
      // Update backend
      const response = await updateCountryStatus(countryCode, newStatus, workerId);
      
      // Update local state instead of refetching all data
      if (response.success) {
        setData(prevData => {
          const updatedCountries = prevData.countries.map(country => {
            if (country.country_code === countryCode) {
              return {
                ...country,
                status: newStatus,
                worker_id: workerId || country.worker_id,
                // Update timestamps based on status
                started_at: newStatus === 'processing' ? new Date().toISOString() : country.started_at,
                completed_at: newStatus === 'completed' ? new Date().toISOString() : country.completed_at,
                retry_at: newStatus === 'retry' ? new Date().toISOString() : country.retry_at
              };
            }
            return country;
          });

          // Recalculate summary
          const summary = updatedCountries.reduce((acc, country) => {
            const status = country.status || 'unknown';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          }, {});

          return {
            ...prevData,
            countries: updatedCountries,
            summary: summary
          };
        });
      }
      
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status. Please try again.');
    } finally {
      setUpdating(prev => ({ ...prev, [countryCode]: false }));
    }
  };

  const handleReasonChange = async (countryCode, newReason) => {
    try {
      const country = data.countries.find(c => c.country_code === countryCode);
      if (!country) return;

      // Update backend
      const response = await updateCountryStatus(countryCode, country.status, country.worker_id, newReason);
      
      // Update local state
      if (response.success) {
        setData(prevData => {
          const updatedCountries = prevData.countries.map(c => {
            if (c.country_code === countryCode) {
              return { ...c, reason: newReason };
            }
            return c;
          });

          return {
            ...prevData,
            countries: updatedCountries
          };
        });
      }
      
    } catch (err) {
      console.error('Error updating reason:', err);
      alert('Failed to update reason. Please try again.');
    }
  };

  const handleDeleteCountry = async (countryCode, countryName) => {
    if (!window.confirm(`Are you sure you want to delete the processing status for "${countryName || countryCode}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      setDeleting(prev => ({ ...prev, [countryCode]: true }));
      
      const response = await deleteCountryStatus(countryCode);
      
      if (response.success) {
        // Remove from local state
        setData(prevData => {
          const updatedCountries = prevData.countries.filter(country => country.country_code !== countryCode);
          
          // Recalculate summary
          const summary = updatedCountries.reduce((acc, country) => {
            const status = country.status || 'unknown';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          }, {});

          return {
            ...prevData,
            countries: updatedCountries,
            summary: summary,
            total: updatedCountries.length
          };
        });
        
        alert('Country status deleted successfully!');
      }
      
    } catch (err) {
      console.error('Error deleting country status:', err);
      alert(`Failed to delete country status: ${err.response?.data?.message || err.message}`);
    } finally {
      setDeleting(prev => ({ ...prev, [countryCode]: false }));
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return '↕️';
    }
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'completed': return 'status-completed';
      case 'skipped': return 'status-skipped';
      case 'processing': return 'status-processing';
      case 'retry': return 'status-retry';
      default: return 'status-unknown';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return 'Invalid Date';
    }
  };

  if (loading) {
    return (
      <div className="status-loading">
        <div className="loading-spinner"></div>
        <p>Loading country processing status...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="status-error">
        <p>{error}</p>
        <button onClick={fetchData} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return <div>No data available</div>;
  }

  // Filter and sort countries
  let filteredCountries = data.countries;
  if (filterStatus !== 'all') {
    filteredCountries = filteredCountries.filter(country => country.status === filterStatus);
  }

  const sortedCountries = [...filteredCountries].sort((a, b) => {
    let aValue = a[sortConfig.key];
    let bValue = b[sortConfig.key];

    // Handle string sorting (case insensitive)
    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }

    // Handle date sorting
    if (sortConfig.key.includes('_at')) {
      aValue = aValue ? new Date(aValue) : new Date(0);
      bValue = bValue ? new Date(bValue) : new Date(0);
    }

    if (sortConfig.direction === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  return (
    <div className="country-status-container">
      <div className="status-header">
        <h2>Country Processing Status</h2>
        <div className="header-controls">
          <button onClick={fetchData} className="refresh-btn">
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="status-summary-cards">
        {Object.entries(data.summary).map(([status, count]) => (
          <div key={status} className={`summary-card ${getStatusBadgeClass(status)}`}>
            <div className="card-title">{status.charAt(0).toUpperCase() + status.slice(1)}</div>
            <div className="card-count">{count}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label htmlFor="status-filter">Filter by Status:</label>
          <select 
            id="status-filter" 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="status-filter"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="skipped">Skipped</option>
            <option value="processing">Processing</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="status-table-wrapper">
        <table className="status-table">
          <thead>
            <tr>
              <th>No.</th>
              <th 
                className="sortable-header" 
                onClick={() => handleSort('country_code')}
              >
                Country Code {getSortIcon('country_code')}
              </th>
              <th 
                className="sortable-header" 
                onClick={() => handleSort('country_name')}
              >
                Country Name {getSortIcon('country_name')}
              </th>
              <th 
                className="sortable-header" 
                onClick={() => handleSort('status')}
              >
                Status {getSortIcon('status')}
              </th>
              <th 
                className="sortable-header" 
                onClick={() => handleSort('worker_id')}
              >
                Worker ID {getSortIcon('worker_id')}
              </th>
              <th 
                className="sortable-header" 
                onClick={() => handleSort('started_at')}
              >
                Started At {getSortIcon('started_at')}
              </th>
              <th 
                className="sortable-header" 
                onClick={() => handleSort('completed_at')}
              >
                Completed At {getSortIcon('completed_at')}
              </th>
              <th 
                className="sortable-header" 
                onClick={() => handleSort('reason')}
              >
                Reason {getSortIcon('reason')}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedCountries.length === 0 ? (
              <tr>
                <td colSpan="10" className="no-data">
                  No countries found
                </td>
              </tr>
            ) : (
              sortedCountries.map((country, index) => (
                <tr key={country._id}>
                  <td className="row-number">{index + 1}</td>
                  <td className="country-code">{country.country_code}</td>
                  <td className="country-name">{country.country_name || 'N/A'}</td>
                  <td>
                    <span className={`status-badge ${getStatusBadgeClass(country.status)}`}>
                      {country.status}
                    </span>
                  </td>
                  <td className="worker-id">{country.worker_id || 'N/A'}</td>
                  <td className="date-cell">{formatDate(country.started_at)}</td>
                  <td className="date-cell">{formatDate(country.completed_at)}</td>
                  <td className="reason-cell">
                    <input
                      type="text"
                      value={country.reason || ''}
                      onChange={(e) => handleReasonChange(country.country_code, e.target.value)}
                      placeholder="Enter reason..."
                      className="reason-input"
                    />
                  </td>
                  <td className="actions-cell">
                    <div className="actions-container">
                      <select
                        value={country.status}
                        onChange={(e) => handleStatusChange(country.country_code, e.target.value, country.worker_id)}
                        disabled={updating[country.country_code]}
                        className="status-select"
                      >
                        <option value="completed">Completed</option>
                        <option value="skipped">Skipped</option>
                        <option value="processing">Processing</option>
                        <option value="retry">Retry</option>
                      </select>
                      {updating[country.country_code] && (
                        <div className="updating-spinner"></div>
                      )}
                      <button
                        onClick={() => handleDeleteCountry(country.country_code, country.country_name)}
                        disabled={deleting[country.country_code]}
                        className="delete-btn"
                        title="Delete this country status"
                      >
                        {deleting[country.country_code] ? (
                          <>
                            <span className="btn-spinner"></span>
                            Deleting...
                          </>
                        ) : (
                          <>
                            🗑️ Delete
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Summary */}
      <div className="status-footer">
        <p>
          Showing {sortedCountries.length} of {data.total} countries
          {filterStatus !== 'all' && ` (filtered by ${filterStatus})`}
        </p>
      </div>
    </div>
  );
};

export default CountryStatusTable;