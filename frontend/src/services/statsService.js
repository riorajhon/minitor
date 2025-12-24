import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const getCountryStats = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/stats/countries`);
    return response.data;
  } catch (error) {
    console.error('Error fetching country stats:', error);
    throw error;
  }
};

export const getAddressesByCountry = async (countryIdentifier, page = 1, limit = 50, status = null) => {
  try {
    // URL encode the country identifier to handle spaces and special characters
    const encodedIdentifier = encodeURIComponent(countryIdentifier);
    let url = `${API_BASE_URL}/stats/countries/${encodedIdentifier}/addresses?page=${page}&limit=${limit}`;
    if (status !== null) {
      url += `&status=${status}`;
    }
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching addresses by country:', error);
    throw error;
  }
};

export const getCountryProcessingStatus = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/stats/processing-status`);
    return response.data;
  } catch (error) {
    console.error('Error fetching country processing status:', error);
    throw error;
  }
};

export const updateCountryStatus = async (countryCode, status, workerId = null, reason = null) => {
  try {
    const data = { status };
    if (workerId !== null) {
      data.worker_id = workerId;
    }
    if (reason !== null) {
      data.reason = reason;
    }
    const response = await axios.put(`${API_BASE_URL}/stats/processing-status/${countryCode}`, data);
    return response.data;
  } catch (error) {
    console.error('Error updating country status:', error);
    throw error;
  }
};

export const runAddressGenerator = async (countryCode, count) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/stats/generate/${countryCode}`, {
      count
    });
    return response.data;
  } catch (error) {
    console.error('Error running address generator:', error);
    throw error;
  }
};

export const getActiveProcesses = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/stats/processes`);
    return response.data;
  } catch (error) {
    console.error('Error fetching active processes:', error);
    throw error;
  }
};

export const cancelProcess = async (processId) => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/stats/processes/${processId}`);
    return response.data;
  } catch (error) {
    console.error('Error cancelling process:', error);
    throw error;
  }
};

export const createProcessStream = (processId) => {
  return new EventSource(`${API_BASE_URL}/stats/processes/${processId}/stream`);
};

export const deleteAddress = async (addressId) => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/stats/addresses/${addressId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting address:', error);
    throw error;
  }
};

export const deleteCountryStatus = async (countryCode) => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/stats/processing-status/${countryCode}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting country status:', error);
    throw error;
  }
};

export const deleteDuplicateAddresses = async () => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/stats/duplicates`);
    return response.data;
  } catch (error) {
    console.error('Error deleting duplicate addresses:', error);
    throw error;
  }
};

export const getCombinedCountryData = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/stats/combined`);
    return response.data;
  } catch (error) {
    console.error('Error fetching combined country data:', error);
    throw error;
  }
};

export const getErrors = async (page = 1, limit = 50, type = null, country = null) => {
  try {
    let url = `${API_BASE_URL}/stats/errors?page=${page}&limit=${limit}`;
    if (type) {
      url += `&type=${encodeURIComponent(type)}`;
    }
    if (country) {
      url += `&country=${encodeURIComponent(country)}`;
    }
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching errors:', error);
    throw error;
  }
};

export const deleteError = async (errorId) => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/stats/errors/${errorId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting error:', error);
    throw error;
  }
};

export const deleteErrorsByFilter = async (type = null, country = null) => {
  try {
    const data = {};
    if (type) data.type = type;
    if (country) data.country = country;
    
    const response = await axios.delete(`${API_BASE_URL}/stats/errors`, { data });
    return response.data;
  } catch (error) {
    console.error('Error deleting errors by filter:', error);
    throw error;
  }
};