import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { addressAPI, validationAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Save, ArrowLeft, Upload, X, CheckCircle, AlertCircle, Zap } from 'lucide-react';

const AddressForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState({
    address: '',
    city: '',
    country: '',
    extra: {},
    state: false
  });
  const [extraJson, setExtraJson] = useState('{}');
  const [loading, setLoading] = useState(false);
  const [bulkData, setBulkData] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);

  useEffect(() => {
    if (isEditing) {
      fetchAddress();
    }
  }, [id, isEditing]);

  const fetchAddress = async () => {
    try {
      setLoading(true);
      const response = await addressAPI.getById(id);
      const address = response.data;
      setFormData(address);
      setExtraJson(JSON.stringify(address.extra || {}, null, 2));
    } catch (error) {
      toast.error('Failed to fetch address');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleExtraChange = (e) => {
    const value = e.target.value;
    setExtraJson(value);
    
    try {
      const parsed = JSON.parse(value);
      setFormData(prev => ({
        ...prev,
        extra: parsed
      }));
    } catch (error) {
      // Invalid JSON, don't update formData.extra
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate JSON
    try {
      JSON.parse(extraJson);
    } catch (error) {
      toast.error('Invalid JSON in extra field');
      return;
    }

    try {
      setLoading(true);
      
      if (isEditing) {
        await addressAPI.update(id, formData);
        toast.success('Address updated successfully');
      } else {
        await addressAPI.create(formData);
        toast.success('Address created successfully');
      }
      
      navigate('/');
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to save address';
      toast.error(errorMessage);
      
      if (error.response?.data?.errors) {
        error.response.data.errors.forEach(err => toast.error(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBulkImport = async () => {
    try {
      const addresses = JSON.parse(bulkData);
      
      if (!Array.isArray(addresses)) {
        toast.error('Bulk data must be an array of addresses');
        return;
      }

      setLoading(true);
      const response = await addressAPI.bulkCreate(addresses);
      toast.success(response.message);
      setBulkData('');
      setShowBulkImport(false);
      navigate('/');
    } catch (error) {
      if (error instanceof SyntaxError) {
        toast.error('Invalid JSON format');
      } else {
        const errorMessage = error.response?.data?.message || 'Failed to import addresses';
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const sampleBulkData = [
    {
      address: "123 Main St",
      city: "New York",
      country: "USA",
      extra: { zipCode: "10001", district: "Manhattan" },
      state: true
    },
    {
      address: "456 Oak Ave",
      city: "Los Angeles",
      country: "USA",
      extra: { zipCode: "90210", district: "Beverly Hills" },
      state: false
    }
  ];

  if (loading && isEditing) {
    return (
      <div className="loading">
        <p>Loading address...</p>
      </div>
    );
  }

  return (
    <div className="form-layout">
      <div className="form-header">
        <h2>{isEditing ? 'Edit Address' : 'Add New Address'}</h2>
        <div className="form-actions">
          {!isEditing && (
            <button
              type="button"
              onClick={() => setShowBulkImport(!showBulkImport)}
              className="btn-header"
              title="Bulk Import"
            >
              <Upload size={16} />
              Bulk Import
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="btn-header"
            title="Back to List"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        </div>
      </div>

      {showBulkImport && (
        <div className="bulk-import-section">
          <div className="bulk-header">
            <h3>Bulk Import Addresses</h3>
            <button 
              type="button" 
              onClick={() => setShowBulkImport(false)}
              className="close-btn"
            >
              <X size={16} />
            </button>
          </div>
          <p className="bulk-description">
            Import multiple addresses at once using JSON format:
          </p>
          
          <div className="form-group-compact">
            <label>JSON Data</label>
            <textarea
              className="form-control-compact"
              rows="8"
              value={bulkData}
              onChange={(e) => setBulkData(e.target.value)}
              placeholder={JSON.stringify(sampleBulkData, null, 2)}
            />
          </div>
          
          <div className="bulk-actions">
            <button
              type="button"
              onClick={handleBulkImport}
              disabled={loading || !bulkData.trim()}
              className="btn btn-primary btn-sm"
            >
              {loading ? 'Importing...' : 'Import'}
            </button>
            <button
              type="button"
              onClick={() => setBulkData(JSON.stringify(sampleBulkData, null, 2))}
              className="btn btn-secondary btn-sm"
            >
              Sample Data
            </button>
          </div>
        </div>
      )}

      <div className="form-content">
        <form onSubmit={handleSubmit} className="address-form">
          <div className="form-row">
            <div className="form-group-compact">
              <label htmlFor="address">Address *</label>
              <input
                type="text"
                id="address"
                name="address"
                className="form-control-compact"
                value={formData.address}
                onChange={handleInputChange}
                required
                placeholder="Enter full address"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group-compact">
              <label htmlFor="city">City *</label>
              <input
                type="text"
                id="city"
                name="city"
                className="form-control-compact"
                value={formData.city}
                onChange={handleInputChange}
                required
                placeholder="Enter city name"
              />
            </div>

            <div className="form-group-compact">
              <label htmlFor="country">Country *</label>
              <input
                type="text"
                id="country"
                name="country"
                className="form-control-compact"
                value={formData.country}
                onChange={handleInputChange}
                required
                placeholder="Enter country name"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group-compact">
              <label htmlFor="extra">Extra Information (JSON)</label>
              <textarea
                id="extra"
                name="extra"
                className="form-control-compact"
                rows="3"
                value={extraJson}
                onChange={handleExtraChange}
                placeholder='{"zipCode": "12345", "district": "Downtown"}'
              />
              <small className="form-hint">
                Enter additional information as JSON object
              </small>
            </div>

            <div className="form-group-compact">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="state"
                  checked={formData.state}
                  onChange={handleInputChange}
                />
                <span className="checkbox-text">Active Status</span>
              </label>
              <small className="form-hint">
                Check if the address is currently active
              </small>
            </div>
          </div>

          <div className="form-footer">
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              <Save size={16} />
              {loading ? 'Saving...' : (isEditing ? 'Update' : 'Create')}
            </button>
            
            <button
              type="button"
              onClick={() => navigate('/')}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddressForm;