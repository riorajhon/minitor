import React, { useState, useEffect } from 'react';
import { getActiveProcesses, cancelProcess, createProcessStream } from '../services/statsService';
import './ProcessMonitor.css';

const ProcessMonitor = ({ isOpen, onClose }) => {
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [streams, setStreams] = useState(new Map());

  useEffect(() => {
    if (isOpen) {
      fetchProcesses();
      const interval = setInterval(fetchProcesses, 2000); // Refresh every 2 seconds
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  useEffect(() => {
    // Clean up streams when component unmounts
    return () => {
      streams.forEach(stream => stream.close());
    };
  }, [streams]);

  const fetchProcesses = async () => {
    try {
      setLoading(true);
      const response = await getActiveProcesses();
      setProcesses(response.data);
    } catch (error) {
      console.error('Error fetching processes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelProcess = async (processId) => {
    if (!window.confirm('Are you sure you want to cancel this process?')) {
      return;
    }

    try {
      await cancelProcess(processId);
      // Close stream if exists
      const stream = streams.get(processId);
      if (stream) {
        stream.close();
        setStreams(prev => {
          const newStreams = new Map(prev);
          newStreams.delete(processId);
          return newStreams;
        });
      }
      fetchProcesses();
    } catch (error) {
      console.error('Error cancelling process:', error);
      alert('Failed to cancel process');
    }
  };

  const toggleProcessStream = (processId) => {
    const existingStream = streams.get(processId);
    
    if (existingStream) {
      // Close existing stream
      existingStream.close();
      setStreams(prev => {
        const newStreams = new Map(prev);
        newStreams.delete(processId);
        return newStreams;
      });
    } else {
      // Create new stream
      const stream = createProcessStream(processId);
      
      stream.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        setProcesses(prev => prev.map(process => {
          if (process.processId === processId) {
            if (data.type === 'output') {
              return {
                ...process,
                output: (process.output || '') + data.data,
                lastUpdate: new Date()
              };
            } else if (data.type === 'complete') {
              return {
                ...process,
                status: data.exitCode === 0 ? 'completed' : 'failed',
                exitCode: data.exitCode
              };
            }
          }
          return process;
        }));
      };

      stream.onerror = (error) => {
        console.error('Stream error:', error);
        stream.close();
        setStreams(prev => {
          const newStreams = new Map(prev);
          newStreams.delete(processId);
          return newStreams;
        });
      };

      setStreams(prev => new Map(prev).set(processId, stream));
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return '#007bff';
      case 'completed': return '#28a745';
      case 'failed': return '#dc3545';
      case 'cancelled': return '#6c757d';
      case 'error': return '#fd7e14';
      default: return '#6c757d';
    }
  };

  const formatDuration = (startTime, endTime) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const duration = Math.floor((end - start) / 1000);
    
    if (duration < 60) return `${duration}s`;
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`;
    return `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`;
  };

  if (!isOpen) return null;

  return (
    <div className="process-monitor-overlay">
      <div className="process-monitor-modal">
        <div className="process-monitor-header">
          <h2>Process Monitor</h2>
          <div className="header-controls">
            <button onClick={fetchProcesses} className="refresh-btn" disabled={loading}>
              {loading ? '🔄' : '↻'} Refresh
            </button>
            <button onClick={onClose} className="close-btn">×</button>
          </div>
        </div>

        <div className="process-monitor-content">
          {processes.length === 0 ? (
            <div className="no-processes">
              <p>No active processes</p>
            </div>
          ) : (
            <div className="processes-list">
              {processes.map((process) => (
                <div key={process.processId} className="process-item">
                  <div className="process-header">
                    <div className="process-info">
                      <span className="country-info">
                        <strong>{process.countryName} ({process.countryCode})</strong>
                      </span>
                      <span className="process-details">
                        Count: {process.count} | Duration: {formatDuration(process.startTime, process.endTime)}
                      </span>
                    </div>
                    <div className="process-controls">
                      <span 
                        className="status-badge" 
                        style={{ backgroundColor: getStatusColor(process.status) }}
                      >
                        {process.status.toUpperCase()}
                      </span>
                      <button
                        onClick={() => toggleProcessStream(process.processId)}
                        className="stream-btn"
                        title={streams.has(process.processId) ? 'Hide output' : 'Show live output'}
                      >
                        {streams.has(process.processId) ? '👁️‍🗨️' : '👁️'} 
                      </button>
                      {process.status === 'running' && (
                        <button
                          onClick={() => handleCancelProcess(process.processId)}
                          className="cancel-btn"
                          title="Cancel process"
                        >
                          ❌ Cancel
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {streams.has(process.processId) && (
                    <div className="process-output">
                      <div className="output-header">Live Output:</div>
                      <pre className="output-content">
                        {process.output || 'Waiting for output...'}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProcessMonitor;