import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getErrors, deleteError, deleteErrorsByFilter } from '../services/statsService';
import './ErrorManagement.css';

const ErrorManagement = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [deletingErrors, setDeletingErrors] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchErrors();
  }, [currentPage, typeFilter]);

  const fetchErrors = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const type = typeFilter || null;
      const response = await getErrors(currentPage, 50, type, null);
      setData(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch errors');
      console.error('Error:', err);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const handleRefresh = () => {
    fetchErrors(true);
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handleTypeFilterChange = (e) => {
    setTypeFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleDeleteError = async (errorId, errorInfo) => {
    if (!window.confirm(`Are you sure you want to delete this error?\n\nType: ${errorInfo.type}\nSeed: ${errorInfo.seed}\nReason: ${errorInfo.reason}\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingErrors(prev => new Set([...prev, errorId]));
      
      const result = await deleteError(errorId);
      
      if (result.success) {
        // Update the local state instead of refetching
        setData(prevData => ({
          ...prevData,
          errors: prevData.errors.filter(err => err._id !== errorId),
          pagination: {
            ...prevData.pagination,
            totalCount: prevData.pagination.totalCount - 1
          }
        }));
      } else {
        alert(`Failed to delete error: ${result.message}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert(`Error deleting error: ${error.response?.data?.message || error.message}`);
    } finally {
      setDeletingErrors(prev => {
        const newSet = new Set(prev);
        newSet.delete(errorId);
        return newSet;
      });
    }
  };

  const handleBulkDelete = async () => {
    const filters = [];
    if (typeFilter) filters.push(`Type: ${typeFilter}`);
    
    const filterText = filters.length > 0 ? `\n\nFilters: ${filters.join(', ')}` : '';
    
    if (!window.confirm(`Are you sure you want to delete ALL errors matching the current filters?${filterText}\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      setBulkDeleting(true);
      
      const result = await deleteErrorsByFilter(typeFilter || null, null);
      
      if (result.success) {
        alert(`Successfully deleted ${result.data.deletedCount} error records`);
        handleRefresh(); // Use refresh instead of fetchErrors
      } else {
        alert(`Failed to delete errors: ${result.message}`);
      }
    } catch (error) {
      console.error('Bulk delete error:', error);
      alert(`Error deleting errors: ${error.response?.data?.message || error.message}`);
    } finally {
      setBulkDeleting(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <div className="error-management-loading">
        <div className="loading-spinner"></div>
        <p>Loading errors...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-management-error">
        <p>{error}</p>
        <button onClick={fetchErrors} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return <div>No data available</div>;
  }

  const { errors, pagination, summary } = data;

  return (
    <div className="error-management-container">
      <div className="error-header">
        <h2>Error Management - {pagination.totalCount.toLocaleString()} errors</h2>
        <div className="header-controls">
          <div className="filter-group">
            <label htmlFor="type-filter">Type:</label>
            <select 
              id="type-filter" 
              value={typeFilter} 
              onChange={handleTypeFilterChange}
              className="type-filter"
            >
              <option value="">All Types</option>
              {summary.types.map(type => (
                <option key={type._id} value={type._id}>
                  {type._id} ({type.count})
                </option>
              ))}
            </select>
          </div>
          <button 
            onClick={handleBulkDelete} 
            className="bulk-delete-btn"
            disabled={bulkDeleting || pagination.totalCount === 0}
          >
            {bulkDeleting ? (
              <>
                <span className="btn-spinner"></span>
                Deleting...
              </>
            ) : (
              <>
                🗑️ Delete All Filtered
              </>
            )}
          </button>
          <button 
            onClick={handleRefresh} 
            className="refresh-btn"
            disabled={refreshing}
            title="Refresh errors"
          >
            {refreshing ? '🔄' : '↻'} Refresh
          </button>
          <button onClick={() => navigate('/')} className="back-btn">
            Back
          </button>
        </div>
      </div>

      <div className="errors-table-wrapper">
        <table className="errors-table">
          <thead>
            <tr>
              <th>No.</th>
              <th>Type</th>
              <th>Seed</th>
              <th>Reason</th>
              <th>Timestamp</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {errors.length === 0 ? (
              <tr>
                <td colSpan="6" className="no-data">
                  No errors found
                </td>
              </tr>
            ) : (
              errors.map((errorItem, index) => (
                <tr key={errorItem._id}>
                  <td className="row-number">
                    {(currentPage - 1) * 50 + index + 1}
                  </td>
                  <td className="error-type">{errorItem.type}</td>
                  <td className="error-seed">{errorItem.seed}</td>
                  <td className="error-reason">{errorItem.reason}</td>
                  <td className="timestamp">{formatTimestamp(errorItem.timestamp)}</td>
                  <td className="actions-cell">
                    <button
                      onClick={() => handleDeleteError(errorItem._id, errorItem)}
                      disabled={deletingErrors.has(errorItem._id)}
                      className="delete-btn"
                      title="Delete this error"
                    >
                      {deletingErrors.has(errorItem._id) ? (
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
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button 
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
            className="pagination-btn"
            title="First page"
          >
            ⏮️ First
          </button>
          
          <button 
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="pagination-btn"
            title="Previous page"
          >
            ⬅️ Previous
          </button>
          
          <div className="pagination-pages">
            {(() => {
              const pages = [];
              const startPage = Math.max(1, currentPage - 2);
              const endPage = Math.min(pagination.totalPages, currentPage + 2);
              
              for (let i = startPage; i <= endPage; i++) {
                pages.push(
                  <button
                    key={i}
                    onClick={() => handlePageChange(i)}
                    className={`pagination-page ${i === currentPage ? 'active' : ''}`}
                    title={`Go to page ${i}`}
                  >
                    {i}
                  </button>
                );
              }
              return pages;
            })()}
          </div>
          
          <span className="pagination-info">
            Page {currentPage} of {pagination.totalPages} ({pagination.totalCount.toLocaleString()} total errors)
          </span>
          
          <button 
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === pagination.totalPages}
            className="pagination-btn"
            title="Next page"
          >
            Next ➡️
          </button>
          
          <button 
            onClick={() => handlePageChange(pagination.totalPages)}
            disabled={currentPage === pagination.totalPages}
            className="pagination-btn"
            title="Last page"
          >
            Last ⏭️
          </button>
        </div>
      )}
      
      {pagination.totalPages <= 1 && pagination.totalCount > 0 && (
        <div className="pagination">
          <span className="pagination-info">
            Showing all {pagination.totalCount.toLocaleString()} errors
          </span>
        </div>
      )}
    </div>
  );
};

export default ErrorManagement;