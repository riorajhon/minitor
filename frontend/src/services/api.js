import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(`Making ${config.method?.toUpperCase()} request to ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Address API functions
export const addressAPI = {
  // Get all addresses with pagination and filters
  getAll: async (params = {}) => {
    const response = await api.get('/addresses', { params });
    return response.data;
  },

  // Get single address by ID
  getById: async (id) => {
    const response = await api.get(`/addresses/${id}`);
    return response.data;
  },

  // Create new address
  create: async (addressData) => {
    const response = await api.post('/addresses', addressData);
    return response.data;
  },

  // Update address
  update: async (id, addressData) => {
    const response = await api.put(`/addresses/${id}`, addressData);
    return response.data;
  },

  // Delete address
  delete: async (id) => {
    const response = await api.delete(`/addresses/${id}`);
    return response.data;
  },

  // Bulk create addresses
  bulkCreate: async (addresses) => {
    const response = await api.post('/addresses/bulk', { addresses });
    return response.data;
  },

  // Health check
  healthCheck: async () => {
    const response = await api.get('/health');
    return response.data;
  }
};

export default api;