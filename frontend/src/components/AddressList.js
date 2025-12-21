import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { addressAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Edit, Trash2, MapPin, Search, Filter, RefreshCw, X } from 'lucide-react';

const AddressList = () => {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({});
  const [filters, setFilters] = useState({
    page: 1,
    limit: 25,
    city: '',
    country: '',
    state: ''
  });
  const [deleteModal, setDeleteModal] = useState({ show: false, address: null });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAddresses();
  }, [filters]);

  const fetchAddresses = async () => {
    try {
      setLoading(true);
      const cleanFilters = Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value !== '')
      );
      
      const response = await addressAPI.getAll(cleanFilters);
      setAddresses(response.data);
      setPagination(response.pagination);
    } catch (error) {
      toast.error('Failed to fetch addresses');
      console.error('Error fetching addresses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (address) => {
    setDeleteModal({ show: true, address });
  };

  const handleDeleteConfirm = async () => {
    try {
      await addressAPI.delete(deleteModal.address._id);
      toast.success('Address deleted successfully');
      setDeleteModal({ show: false, address: null });
      fetchAddresses();
    } catch (error) {
      toast.error('Failed to delete address');
      console.error('Error deleting address:', error);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModal({ show: false, address: null });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAddresses();
    setTimeout(() => setRefreshing(false), 500); // Small delay for visual feedback
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
      page: 1 // Reset to first page when filtering
    }));
  };

  const handlePageChange = (newPage) => {
    setFilters(prev => ({
      ...prev,
      page: newPage
    }));
  };

  const clearFilters = () => {
    setFilters({
      page: 1,
      limit: 25,
      city: '',
      country: '',
      state: ''
    });
  };

  if (loading) {
    return (
      <div className="loading">
        <p>Loading addresses...</p>
      </div>
    );
  }

  return (
    <div className="compact-layout">
      {/* Header with Stats and Filters */}
      <div className="header-section">
        <div className="stats-compact">
          <div className="stat-item">
            <span className="stat-number">{pagination.total || 0}</span>
            <span className="stat-label">Total</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{addresses.filter(addr => addr.state).length}</span>
            <span className="stat-label">Active</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{new Set(addresses.map(addr => addr.city)).size}</span>
            <span className="stat-label">Cities</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{new Set(addresses.map(addr => addr.country)).size}</span>
            <span className="stat-label">Countries</span>
          </div>
        </div>
        
        <div className="filters-compact">
          <input
            type="text"
            className="filter-input"
            placeholder="City..."
            value={filters.city}
            onChange={(e) => handleFilterChange('city', e.target.value)}
          />
          <input
            type="text"
            className="filter-input"
            placeholder="Country..."
            value={filters.country}
            onChange={(e) => handleFilterChange('country', e.target.value)}
          />
          <select
            className="filter-select"
            value={filters.state}
            onChange={(e) => handleFilterChange('state', e.target.value)}
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <select
            className="filter-select"
            value={filters.limit}
            onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
          <button className="btn-clear" onClick={clearFilters}>Clear</button>
          <button 
            className={`btn-refresh ${refreshing ? 'refreshing' : ''}`} 
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh data"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Address Table */}
      <div className="table-section">

        {addresses.length === 0 ? (
          <div className="empty-state">
            <p>No addresses found.</p>
            <Link to="/add" className="btn btn-primary">Add First Address</Link>
          </div>
        ) : (
          <div className="table-container">
            <table className="address-table-compact">
              <thead>
                <tr>
                  <th>Address</th>
                  <th>City</th>
                  <th>Country</th>
                  <th>Extra</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {addresses.map((address) => (
                  <tr key={address._id}>
                    <td data-label="Address" className="address-cell">
                      {address.address}
                    </td>
                    <td data-label="City">{address.city}</td>
                    <td data-label="Country">{address.country}</td>
                    <td data-label="Extra" className="extra-cell">
                      {address.extra && Object.keys(address.extra).length > 0 ? (
                        <div className="extra-compact">
                          {Object.entries(address.extra).slice(0, 2).map(([key, value]) => (
                            <span key={key} className="extra-tag">
                              {key}: {String(value)}
                            </span>
                          ))}
                          {Object.keys(address.extra).length > 2 && (
                            <span className="extra-more">+{Object.keys(address.extra).length - 2}</span>
                          )}
                        </div>
                      ) : (
                        <span className="no-data">-</span>
                      )}
                    </td>
                    <td data-label="Status">
                      <span className={`status-dot ${address.state ? 'active' : 'inactive'}`}>
                        {address.state ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td data-label="Created" className="date-compact">
                      {new Date(address.createdAt).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: '2-digit'
                      })}
                    </td>
                    <td data-label="Actions">
                      <div className="actions-compact">
                        <Link to={`/edit/${address._id}`} className="action-btn edit" title="Edit">
                          <Edit size={12} />
                        </Link>
                        <button onClick={() => handleDeleteClick(address)} className="action-btn delete" title="Delete">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Compact Pagination */}
        {pagination.pages > 1 && (
          <div className="pagination-compact">
            <button
              onClick={() => handlePageChange(pagination.current - 1)}
              disabled={pagination.current <= 1}
              className="page-btn"
            >
              ‹
            </button>
            <span className="page-info">
              {pagination.current} of {pagination.pages}
            </span>
            <button
              onClick={() => handlePageChange(pagination.current + 1)}
              disabled={pagination.current >= pagination.pages}
              className="page-btn"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.show && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Confirm Delete</h3>
              <button className="modal-close" onClick={handleDeleteCancel}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this address?</p>
              <div className="address-preview">
                <strong>{deleteModal.address?.address}</strong>
                <br />
                {deleteModal.address?.city}, {deleteModal.address?.country}
              </div>
              <p className="warning-text">This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleDeleteCancel}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDeleteConfirm}>
                Delete Address
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddressList;