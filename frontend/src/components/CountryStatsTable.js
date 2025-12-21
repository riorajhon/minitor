import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCountryStats, runAddressGenerator } from '../services/statsService';
import ProcessMonitor from './ProcessMonitor';
import GeneratorModal from './GeneratorModal';
import './CountryStatsTable.css';

const CountryStatsTable = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState([]);
  const [sortedStats, setSortedStats] = useState([]);
  const [filteredStats, setFilteredStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [generatingCountries, setGeneratingCountries] = useState(new Set());
  const [showProcessMonitor, setShowProcessMonitor] = useState(false);
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  // Filter stats based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredStats(stats);
      setSortedStats(stats);
    } else {
      const filtered = stats.filter(stat => 
        (stat.country_name && stat.country_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (stat.country && stat.country.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredStats(filtered);
      setSortedStats(filtered);
    }
    // Reset sort config when filtering
    setSortConfig({ key: null, direction: 'asc' });
  }, [searchTerm, stats]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await getCountryStats();
      setStats(response.data);
      setSortedStats(response.data);
      setFilteredStats(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch country statistics');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }

    const sorted = [...filteredStats].sort((a, b) => {
      let aValue = a[key];
      let bValue = b[key];

      // Handle string sorting (case insensitive)
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (direction === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    setSortedStats(sorted);
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return '↕️';
    }
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const handleRowClick = (stat, event) => {
    // Don't navigate if clicking on the generator button
    if (event.target.closest('.generator-btn')) {
      return;
    }
    
    // Use country name if available, otherwise use country code
    const identifier = stat.country_name || stat.country;
    
    if (!identifier || identifier.trim() === '') {
      alert(`Cannot view details: No country identifier available`);
      return;
    }
    
    navigate(`/country/${encodeURIComponent(identifier)}`);
  };

  const handleGenerateAddresses = async (countryCode, event) => {
    event.stopPropagation(); // Prevent row click
    
    if (generatingCountries.has(countryCode)) {
      return; // Already generating
    }

    // Get count from user input
    const countInput = prompt(`Enter the number of addresses to generate for ${countryCode}:`, '1000');
    
    if (countInput === null) {
      return; // User cancelled
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
        // Optionally open process monitor
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

  if (loading) {
    return (
      <div className="stats-loading">
        <div className="loading-spinner"></div>
        <p>Loading country statistics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stats-error">
        <p>{error}</p>
        <button onClick={fetchStats} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="country-stats-container">
      <div className="stats-header">
        <h2>Country Address Statistics</h2>
        <div className="header-controls">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search by country name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="clear-search-btn"
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>
          {sortConfig.key && (
            <span className="sort-indicator">
              Sorted by: {sortConfig.key === 'country' ? 'Country Code' : 
                         sortConfig.key === 'country_name' ? 'Country Name' :
                         sortConfig.key === 'inactiveCount' ? 'Inactive Count' :
                         sortConfig.key === 'activeCount' ? 'Active Count' :
                         sortConfig.key === 'totalCount' ? 'Total Count' : sortConfig.key} 
              ({sortConfig.direction === 'asc' ? 'A-Z' : 'Z-A'})
            </span>
          )}
          <button onClick={() => setShowGeneratorModal(true)} className="generator-modal-btn">
            🏗️ New Generator
          </button>
          <button onClick={() => setShowProcessMonitor(true)} className="process-monitor-btn">
            📊 Processes
          </button>
          <button onClick={fetchStats} className="refresh-btn">
            Refresh
          </button>
        </div>
      </div>
      
      <div className="stats-table-wrapper">
        <table className="stats-table">
          <thead>
            <tr>
              <th>No.</th>
              <th 
                className="sortable-header" 
                onClick={() => handleSort('country')}
              >
                Country Code {getSortIcon('country')}
              </th>
              <th 
                className="sortable-header" 
                onClick={() => handleSort('country_name')}
              >
                Country Name {getSortIcon('country_name')}
              </th>
              <th 
                className="sortable-header" 
                onClick={() => handleSort('inactiveCount')}
              >
                Inactive Count (Status = 0) {getSortIcon('inactiveCount')}
              </th>
              <th 
                className="sortable-header" 
                onClick={() => handleSort('activeCount')}
              >
                Active Count (Status ≠ 0) {getSortIcon('activeCount')}
              </th>
              <th 
                className="sortable-header" 
                onClick={() => handleSort('totalCount')}
              >
                Total Count {getSortIcon('totalCount')}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedStats.length === 0 ? (
              <tr>
                <td colSpan="7" className="no-data">
                  {searchTerm ? `No countries found matching "${searchTerm}"` : 'No data available'}
                </td>
              </tr>
            ) : (
              sortedStats.map((stat, index) => (
                <tr 
                  key={`${stat.country}-${index}`}
                  onClick={(e) => handleRowClick(stat, e)}
                  className="clickable-row"
                >
                  <td className="row-number">{index + 1}</td>
                  <td className={`country-code ${!stat.country || stat.country.trim() === '' ? 'missing-code' : ''}`}>
                    {stat.country || 'N/A'}
                  </td>
                  <td className="country-name">{stat.country_name || 'N/A'}</td>
                  <td className="inactive-count">{stat.inactiveCount.toLocaleString()}</td>
                  <td className="active-count">{stat.activeCount.toLocaleString()}</td>
                  <td className="total-count">{stat.totalCount.toLocaleString()}</td>
                  <td className="actions-cell">
                    <button
                      onClick={(e) => handleGenerateAddresses(stat.country, e)}
                      disabled={generatingCountries.has(stat.country)}
                      className="generator-btn"
                      title={`Generate addresses for ${stat.country_name || stat.country}`}
                    >
                      {generatingCountries.has(stat.country) ? (
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
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {stats.length > 0 && (
        <div className="stats-summary">
          <p>
            {searchTerm ? `Showing ${sortedStats.length} of ${stats.length} countries` : `Total Countries: ${sortedStats.length}`} | 
            Total Addresses: {sortedStats.reduce((sum, stat) => sum + stat.totalCount, 0).toLocaleString()}
            {searchTerm && ` (filtered)`}
          </p>
          <p className="click-hint">💡 Click on any country row to view detailed addresses • Works with both country codes and names</p>
        </div>
      )}

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

export default CountryStatsTable;