import React, { useState } from 'react';
import { runAddressGenerator } from '../services/statsService';
import './GeneratorModal.css';

const GeneratorModal = ({ isOpen, onClose, onSuccess }) => {
  const [countryName, setCountryName] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [count, setCount] = useState('1000');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!countryName.trim()) {
      alert('Please enter a country name');
      return;
    }

    if (!countryCode.trim() || countryCode.length !== 2) {
      alert('Please enter a valid 2-character country code (e.g., US, GB, DE)');
      return;
    }

    const countValue = parseInt(count);
    if (isNaN(countValue) || countValue <= 0) {
      alert('Please enter a valid count greater than 0');
      return;
    }

    try {
      setLoading(true);
      const result = await runAddressGenerator(countryCode.toUpperCase(), countValue);
      
      if (result.success) {
        alert(`Address generation started for ${result.data.countryName} (${result.data.countryCode})!\n\nProcess ID: ${result.data.processId}\nCount: ${result.data.count}\n\nOpen Process Monitor to see real-time progress.`);
        onSuccess && onSuccess(result.data);
        handleClose();
      } else {
        alert(`Failed to start address generation:\n${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Generator error:', error);
      alert(`Error starting address generation:\n${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCountryName('');
    setCountryCode('');
    setCount('1000');
    setLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="generator-modal-overlay">
      <div className="generator-modal">
        <div className="generator-modal-header">
          <h2>🏗️ Address Generator</h2>
          <button onClick={handleClose} className="close-btn" disabled={loading}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="generator-form">
          <div className="form-group">
            <label htmlFor="countryName">Country Name:</label>
            <input
              type="text"
              id="countryName"
              value={countryName}
              onChange={(e) => setCountryName(e.target.value)}
              placeholder="e.g., United States, Germany, Japan"
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="countryCode">Country Code:</label>
            <input
              type="text"
              id="countryCode"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
              placeholder="e.g., US, DE, JP"
              maxLength="2"
              disabled={loading}
              required
            />
            <small className="form-hint">2-character ISO country code</small>
          </div>

          <div className="form-group">
            <label htmlFor="count">Address Count:</label>
            <input
              type="number"
              id="count"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              placeholder="1000"
              min="1"
              max="100000"
              disabled={loading}
              required
            />
            <small className="form-hint">Number of addresses to generate (1-100,000)</small>
          </div>

          <div className="form-actions">
            <button 
              type="button" 
              onClick={handleClose} 
              className="cancel-btn"
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="generate-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="btn-spinner"></span>
                  Starting...
                </>
              ) : (
                <>
                  🏗️ Start Generation
                </>
              )}
            </button>
          </div>
        </form>

        <div className="generator-info">
          <h3>ℹ️ Information</h3>
          <ul>
            <li>The generator will run in the background</li>
            <li>Use the Process Monitor to track progress</li>
            <li>You can run multiple generations simultaneously</li>
            <li>Processes can be cancelled if needed</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default GeneratorModal;