import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAddressesByCountry, deleteAddress } from '../services/statsService';
import './CountryDetail.css';

const CountryDetail = () => {
  const { countryIdentifier } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [deletingAddresses, setDeletingAddresses] = useState(new Set());

  useEffect(() => {
    fetchAddresses();
  }, [countryIdentifier, currentPage, statusFilter]);

  const fetchAddresses = async () => {
    try {
      setLoading(true);
      const status = statusFilter === 'all' ? null : parseInt(statusFilter);
      const response = await getAddressesByCountry(countryIdentifier, currentPage, 50, status);
      setData(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch addresses');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const getStatusText = (status) => {
    return status === 0 ? 'Inactive' : 'Active';
  };

  const getStatusClass = (status) => {
    return status === 0 ? 'status-inactive' : 'status-active';
  };

  const handleDeleteAddress = async (addressId, fullAddress) => {
    if (!window.confirm(`Are you sure you want to delete this address?\n\n"${fullAddress}"\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingAddresses(prev => new Set([...prev, addressId]));
      
      const result = await deleteAddress(addressId);
      
      if (result.success) {
        // Refresh the addresses list
        fetchAddresses();
        alert('Address deleted successfully!');
      } else {
        alert(`Failed to delete address: ${result.message}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert(`Error deleting address: ${error.response?.data?.message || error.message}`);
    } finally {
      setDeletingAddresses(prev => {
        const newSet = new Set(prev);
        newSet.delete(addressId);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <div className="country-detail-loading">
        <div className="loading-spinner"></div>
        <p>Loading addresses...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="country-detail-error">
        <p>{error}</p>
        <button onClick={fetchAddresses} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return <div>No data available</div>;
  }

  const { addresses, pagination, country } = data;

  return (
    <div className="country-detail-container">
      <div className="detail-header">
        <h2>{country.name} ({country.code}) - {pagination.totalCount.toLocaleString()} addresses</h2>
        <div className="header-controls">
          <div className="filter-group">
            <label htmlFor="status-filter">Filter:</label>
            <select 
              id="status-filter" 
              value={statusFilter} 
              onChange={handleStatusFilterChange}
              className="status-filter"
            >
              <option value="all">All</option>
              <option value="0">Inactive</option>
              <option value="1">Active</option>
            </select>
          </div>
          <button onClick={() => navigate('/')} className="back-btn">
            Back
          </button>
        </div>
      </div>

      <div className="addresses-table-wrapper">
        <table className="addresses-table">
          <thead>
            <tr>
              <th>No.</th>
              <th>Full Address</th>
              <th>City</th>
              <th>Street Name</th>
              <th>Status</th>
              <th>Worker ID</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {addresses.length === 0 ? (
              <tr>
                <td colSpan="7" className="no-data">
                  No addresses found
                </td>
              </tr>
            ) : (
              addresses.map((address, index) => (
                <tr key={address._id}>
                  <td className="row-number">
                    {(currentPage - 1) * 50 + index + 1}
                  </td>
                  <td className="full-address">{address.fulladdress}</td>
                  <td className="city">{address.city}</td>
                  <td className="street-name">{address.street_name || 'N/A'}</td>
                  <td>
                    <span className={`status-badge ${getStatusClass(address.status)}`}>
                      {getStatusText(address.status)}
                    </span>
                  </td>
                  <td className="worker-id">{address.worker_id || 'N/A'}</td>
                  <td className="actions-cell">
                    <button
                      onClick={() => handleDeleteAddress(address._id, address.fulladdress)}
                      disabled={deletingAddresses.has(address._id)}
                      className="delete-btn"
                      title="Delete this address"
                    >
                      {deletingAddresses.has(address._id) ? (
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
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="pagination-btn"
          >
            Previous
          </button>
          
          <span className="pagination-info">
            Page {currentPage} of {pagination.totalPages}
          </span>
          
          <button 
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === pagination.totalPages}
            className="pagination-btn"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default CountryDetail;