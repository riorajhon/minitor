import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchCombinedCountryData,
  updateCountryStatusAsync,
  deleteCountryStatusAsync,

  setSortConfig,
  setFilterStatus,
  setSearchTerm,
  clearError,
  updateCountryStatusLocal,
  updateReasonLocal,
  selectCountryData,
  selectCountryLoading,
  selectCountryError,
  selectUpdating,
  selectDeleting,

  selectLastFetched,
  selectSortConfig,
  selectFilterStatus,
  selectSearchTerm,
  selectFilteredAndSortedCountries,
} from '../store/slices/countrySlice';
import { runAddressGenerator } from '../services/statsService';
import GeneratorModal from './GeneratorModal';
import ProcessMonitor from './ProcessMonitor';
import './CombinedCountryTable.css';

const CombinedCountryTable = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  // Redux state
  const data = useSelector(selectCountryData);
  const loading = useSelector(selectCountryLoading);
  const error = useSelector(selectCountryError);
  const updating = useSelector(selectUpdating);
  const deleting = useSelector(selectDeleting);
  const lastFetched = useSelector(selectLastFetched);
  const sortConfig = useSelector(selectSortConfig);
  const filterStatus = useSelector(selectFilterStatus);
  const searchTerm = useSelector(selectSearchTerm);
  const sortedCountries = useSelector(selectFilteredAndSortedCountries);
  
  // Local state for non-persistent UI
  const [generatingCountries, setGeneratingCountries] = useState(new Set());
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  const [showProcessMonitor, setShowProcessMonitor] = useState(false);

  useEffect(() => {
    // Only fetch if data is not available or if it's been more than 5 minutes
    const shouldFetch = !data || !lastFetched || (Date.now() - lastFetched > 5 * 60 * 1000);
    if (shouldFetch) {
      dispatch(fetchCombinedCountryData());
    }
  }, [dispatch, data, lastFetched]);

  const fetchData = () => {
    dispatch(fetchCombinedCountryData());
  };

  const handleStatusChange = async (countryCode, newStatus, workerId = null) => {
    try {
      // Optimistic update
      dispatch(updateCountryStatusLocal({ countryCode, status: newStatus, workerId }));
      
      // Async update
      const result = await dispatch(updateCountryStatusAsync({ countryCode, status: newStatus, workerId }));
      
      if (updateCountryStatusAsync.rejected.match(result)) {
        // Revert optimistic update on failure
        const country = data.countries.find(c => c.country_code === countryCode);
        if (country) {
          dispatch(updateCountryStatusLocal({ 
            countryCode, 
            status: country.status, 
            workerId: country.worker_id 
          }));
        }
        alert('Failed to update status. Please try again.');
      }
      
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status. Please try again.');
    }
  };

  const handleReasonChange = async (countryCode, newReason) => {
    try {
      const country = data.countries.find(c => c.country_code === countryCode);
      if (!country) return;

      // Optimistic update
      dispatch(updateReasonLocal({ countryCode, reason: newReason }));

      // Async update
      const result = await dispatch(updateCountryStatusAsync({ 
        countryCode, 
        status: country.status, 
        workerId: country.worker_id, 
        reason: newReason 
      }));
      
      if (updateCountryStatusAsync.rejected.match(result)) {
        // Revert optimistic update on failure
        dispatch(updateReasonLocal({ countryCode, reason: country.reason }));
        alert('Failed to update reason. Please try again.');
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
      const result = await dispatch(deleteCountryStatusAsync({ countryCode }));
      
      if (deleteCountryStatusAsync.fulfilled.match(result)) {
        // Country deleted successfully - no alert needed
      } else {
        alert(`Failed to delete country status: ${result.payload || 'Unknown error'}`);
      }
      
    } catch (err) {
      console.error('Error deleting country status:', err);
      alert(`Failed to delete country status: ${err.message}`);
    }
  };



  const handleGenerateAddresses = async (countryCode, event) => {
    event.stopPropagation();
    
    if (generatingCountries.has(countryCode)) {
      return;
    }

    const countInput = prompt(`Enter the number of addresses to generate for ${countryCode}:`, '1000');
    
    if (countInput === null) {
      return;
    }

    const count = parseInt(countInput);
    if (isNaN(count) || count <= 0) {
      alert('Please enter a valid number greater than 0');
      return;
    }

    try {
      setGeneratingCountries(prev => new Set([...prev, countryCode]));
      
      const result = await runAddressGenerator(countryCode, count);
      
      if (result.success) {
        alert(`Address generation started for ${result.data.countryName} (${countryCode})!\n\nProcess ID: ${result.data.processId}\nCount: ${result.data.count}\n\nOpen Process Monitor to see real-time progress.`);
        setShowProcessMonitor(true);
      } else {
        alert(`Failed to start address generation for ${countryCode}:\n${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Generator error:', error);
      alert(`Error generating addresses for ${countryCode}:\n${error.response?.data?.message || error.message}`);
    } finally {
      setGeneratingCountries(prev => {
        const newSet = new Set(prev);
        newSet.delete(countryCode);
        return newSet;
      });
    }
  };

  const handleRowClick = (stat, event) => {
    if (event.target.closest('.generator-btn') || event.target.closest('.actions-container')) {
      return;
    }
    
    const identifier = stat.country_name || stat.country_code;
    
    if (!identifier || identifier.trim() === '') {
      alert(`Cannot view details: No country identifier available`);
      return;
    }
    
    navigate(`/country/${encodeURIComponent(identifier)}`);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    dispatch(setSortConfig({ key, direction }));
  };

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return '↕️';
    }
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  // Clear error when component mounts
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        dispatch(clearError());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, dispatch]);

  if (loading) {
    return (
      <div className="combined-loading">
        <div className="loading-spinner"></div>
        <p>Loading country data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="combined-error">
        <p>{error}</p>
        <button onClick={fetchData} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="combined-loading">
        <div className="loading-spinner"></div>
        <p>Initializing...</p>
      </div>
    );
  }

  return (
    <div className="combined-container">
      {/* Header with Summary */}
      <div className="combined-header">
        <div className="header-left">
          <h1>Country Management Dashboard</h1>
          {data && (
            <div className="header-summary">
              <span className="summary-item completed">
                COMPLETED <strong>{data.summary.completed || 0}</strong>
              </span>
              <span className="summary-item skipped">
                SKIPPED <strong>{data.summary.skipped || 0}</strong>
              </span>
              <span className="summary-item processing">
                PROCESSING <strong>{data.summary.processing || 0}</strong>
              </span>
              <span className="summary-item retry">
                RETRY <strong>{data.summary.retry || 0}</strong>
              </span>
              <span className="summary-item checking">
                CHECKING <strong>{data.summary.checking || 0}</strong>
              </span>
              <span className="summary-item checked">
                CHECKED <strong>{data.summary.checked || 0}</strong>
              </span>
              <span className="summary-item total">
                TOTAL <strong>{data.total || 0}</strong>
              </span>
            </div>
          )}
        </div>
        <div className="header-controls">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search by country name or code..."
              value={searchTerm}
              onChange={(e) => dispatch(setSearchTerm(e.target.value))}
              className="search-input"
            />
            {searchTerm && (
              <button 
                onClick={() => dispatch(setSearchTerm(''))}
                className="clear-search-btn"
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>
          <select
            value={filterStatus}
            onChange={(e) => dispatch(setFilterStatus(e.target.value))}
            className="status-filter"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="skipped">Skipped</option>
            <option value="processing">Processing</option>
            <option value="retry">Retry</option>
            <option value="checking">Checking</option>
            <option value="checked">Checked</option>
          </select>

          <button onClick={() => setShowGeneratorModal(true)} className="generator-modal-btn">
            🏗️ New Generator
          </button>
          <button onClick={() => setShowProcessMonitor(true)} className="process-monitor-btn">
            📊 Processes
          </button>
          <button onClick={() => navigate('/errors')} className="error-management-btn">
            ⚠️ Errors
          </button>
          <button onClick={fetchData} className="refresh-btn">
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="combined-table-wrapper">
        <table className="combined-table">
          <thead>
            <tr>
              <th>No.</th>
              <th className="sortable-header" onClick={() => handleSort('country_code')}>
                Country Code {getSortIcon('country_code')}
              </th>
              <th className="sortable-header" onClick={() => handleSort('country_name')}>
                Country Name {getSortIcon('country_name')}
              </th>
              <th className="sortable-header" onClick={() => handleSort('status')}>
                Status {getSortIcon('status')}
              </th>
              <th className="sortable-header" onClick={() => handleSort('inactiveCount')}>
                Inactive Count {getSortIcon('inactiveCount')}
              </th>
              <th className="sortable-header" onClick={() => handleSort('totalCount')}>
                Address Count {getSortIcon('totalCount')}
              </th>
              <th>Reason</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedCountries.length === 0 ? (
              <tr>
                <td colSpan="8" className="no-data">
                  {searchTerm || filterStatus !== 'all' ? 'No countries match the current filters' : 'No countries found'}
                </td>
              </tr>
            ) : (
              sortedCountries.map((country, index) => (
                <tr 
                  key={country.country_code}
                  onClick={(e) => handleRowClick(country, e)}
                  className="clickable-row"
                >
                  <td className="row-number">{index + 1}</td>
                  <td className="country-code">{country.country_code}</td>
                  <td className="country-name">{country.country_name || 'N/A'}</td>
                  <td>
                    <span className={`status-badge status-${country.status}`}>
                      {country.status?.toUpperCase() || 'UNKNOWN'}
                    </span>
                  </td>
                  <td className="inactive-count">{country.inactiveCount.toLocaleString()}</td>
                  <td className="address-count">
                    <div className="count-breakdown">
                      <span className="total">{country.totalCount.toLocaleString()}</span>
                      <small>({country.activeCount} active, {country.inactiveCount} inactive)</small>
                    </div>
                  </td>
                  <td className="reason-cell">
                    <select
                      value={country.reason || ''}
                      onChange={(e) => handleReasonChange(country.country_code, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="reason-select"
                    >
                      <option value="">Select reason...</option>
                      <option value="file_too_large">File Too Large</option>
                      <option value="no_geofabrik_url">No Geofabrik URL</option>
                      <option value="download_failed">Download Failed</option>
                    </select>
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
                        <option value="checking">Checking</option>
                        <option value="checked">Checked</option>
                      </select>
                      {updating[country.country_code] && (
                        <div className="updating-spinner"></div>
                      )}
                      <button
                        onClick={(e) => handleGenerateAddresses(country.country_code, e)}
                        disabled={generatingCountries.has(country.country_code)}
                        className="generator-btn"
                        title={`Generate addresses for ${country.country_name || country.country_code}`}
                      >
                        {generatingCountries.has(country.country_code) ? (
                          <>
                            <span className="btn-spinner"></span>
                            Generating...
                          </>
                        ) : (
                          <>
                            🏗️ Generate
                          </>
                        )}
                      </button>
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

      {/* Footer */}
      {data && (
        <div className="combined-footer">
          <p>
            Showing {sortedCountries.length} of {data.total} countries
            {(searchTerm || filterStatus !== 'all') && ` (filtered)`}
          </p>
          <p className="click-hint">💡 Click on any country row to view detailed addresses</p>
        </div>
      )}

      {/* Modals */}
      <GeneratorModal
        isOpen={showGeneratorModal}
        onClose={() => setShowGeneratorModal(false)}
        onSuccess={() => setShowProcessMonitor(true)}
      />

      <ProcessMonitor 
        isOpen={showProcessMonitor} 
        onClose={() => setShowProcessMonitor(false)} 
      />
    </div>
  );
};

export default CombinedCountryTable;