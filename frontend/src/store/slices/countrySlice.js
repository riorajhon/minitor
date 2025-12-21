import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getCombinedCountryData, updateCountryStatus, deleteCountryStatus } from '../../services/statsService';

// Async thunks
export const fetchCombinedCountryData = createAsyncThunk(
  'country/fetchCombinedCountryData',
  async (_, { rejectWithValue }) => {
    try {
      const response = await getCombinedCountryData();
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const updateCountryStatusAsync = createAsyncThunk(
  'country/updateCountryStatus',
  async ({ countryCode, status, workerId, reason }, { rejectWithValue }) => {
    try {
      const response = await updateCountryStatus(countryCode, status, workerId, reason);
      return { countryCode, status, workerId, reason, response: response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const deleteCountryStatusAsync = createAsyncThunk(
  'country/deleteCountryStatus',
  async ({ countryCode }, { rejectWithValue }) => {
    try {
      const response = await deleteCountryStatus(countryCode);
      return { countryCode, response: response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);



const initialState = {
  data: null,
  loading: false,
  error: null,
  updating: {},
  deleting: {},
  lastFetched: null,
  // UI state
  sortConfig: { key: 'country_code', direction: 'asc' },
  filterStatus: 'all',
  filterReason: 'all',
  searchTerm: '',
};

const countrySlice = createSlice({
  name: 'country',
  initialState,
  reducers: {
    // UI state actions
    setSortConfig: (state, action) => {
      state.sortConfig = action.payload;
    },
    setFilterStatus: (state, action) => {
      state.filterStatus = action.payload;
    },
    setSearchTerm: (state, action) => {
      state.searchTerm = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    // Local state updates for optimistic UI
    updateCountryStatusLocal: (state, action) => {
      const { countryCode, status, workerId, reason } = action.payload;
      if (state.data && state.data.countries) {
        const countryIndex = state.data.countries.findIndex(c => c.country_code === countryCode);
        if (countryIndex !== -1) {
          state.data.countries[countryIndex] = {
            ...state.data.countries[countryIndex],
            status,
            worker_id: workerId || state.data.countries[countryIndex].worker_id,
            reason: reason !== undefined ? reason : state.data.countries[countryIndex].reason
          };
          
          // Update summary
          const summary = state.data.countries.reduce((acc, country) => {
            const countryStatus = country.status || 'unknown';
            acc[countryStatus] = (acc[countryStatus] || 0) + 1;
            return acc;
          }, {});
          state.data.summary = summary;
        }
      }
    },
    updateReasonLocal: (state, action) => {
      const { countryCode, reason } = action.payload;
      if (state.data && state.data.countries) {
        const countryIndex = state.data.countries.findIndex(c => c.country_code === countryCode);
        if (countryIndex !== -1) {
          state.data.countries[countryIndex].reason = reason;
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch combined country data
      .addCase(fetchCombinedCountryData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCombinedCountryData.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
        state.lastFetched = Date.now();
        state.error = null;
      })
      .addCase(fetchCombinedCountryData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to fetch country data';
      })
      
      // Update country status
      .addCase(updateCountryStatusAsync.pending, (state, action) => {
        const { countryCode } = action.meta.arg;
        state.updating[countryCode] = true;
      })
      .addCase(updateCountryStatusAsync.fulfilled, (state, action) => {
        const { countryCode } = action.payload;
        state.updating[countryCode] = false;
        // Data is already updated via local action for optimistic UI
      })
      .addCase(updateCountryStatusAsync.rejected, (state, action) => {
        const { countryCode } = action.meta.arg;
        state.updating[countryCode] = false;
        state.error = action.payload || 'Failed to update status';
      })
      
      // Delete country status
      .addCase(deleteCountryStatusAsync.pending, (state, action) => {
        const { countryCode } = action.meta.arg;
        state.deleting[countryCode] = true;
      })
      .addCase(deleteCountryStatusAsync.fulfilled, (state, action) => {
        const { countryCode } = action.payload;
        state.deleting[countryCode] = false;
        
        if (state.data && state.data.countries) {
          // Remove the deleted country
          state.data.countries = state.data.countries.filter(c => c.country_code !== countryCode);
          
          // Update summary and total
          const summary = state.data.countries.reduce((acc, country) => {
            const status = country.status || 'unknown';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
          }, {});
          state.data.summary = summary;
          state.data.total = state.data.countries.length;
        }
      })
      .addCase(deleteCountryStatusAsync.rejected, (state, action) => {
        const { countryCode } = action.meta.arg;
        state.deleting[countryCode] = false;
        state.error = action.payload || 'Failed to delete country status';
      });
  },
});

export const {
  setSortConfig,
  setFilterStatus,
  setSearchTerm,
  clearError,
  updateCountryStatusLocal,
  updateReasonLocal,
} = countrySlice.actions;

export default countrySlice.reducer;

// Selectors
export const selectCountryData = (state) => state.country.data;
export const selectCountryLoading = (state) => state.country.loading;
export const selectCountryError = (state) => state.country.error;
export const selectUpdating = (state) => state.country.updating;
export const selectDeleting = (state) => state.country.deleting;
export const selectLastFetched = (state) => state.country.lastFetched;
export const selectSortConfig = (state) => state.country.sortConfig;
export const selectFilterStatus = (state) => state.country.filterStatus;
export const selectSearchTerm = (state) => state.country.searchTerm;

// Computed selectors
export const selectFilteredAndSortedCountries = (state) => {
  const data = selectCountryData(state);
  const sortConfig = selectSortConfig(state);
  const filterStatus = selectFilterStatus(state);
  const searchTerm = selectSearchTerm(state);

  if (!data || !data.countries) return [];

  // Filter countries
  const filteredCountries = data.countries.filter(country => {
    const matchesStatus = filterStatus === 'all' || country.status === filterStatus;
    const matchesSearch = !searchTerm || 
      (country.country_name && country.country_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (country.country_code && country.country_code.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  // Sort countries
  const sortedCountries = [...filteredCountries].sort((a, b) => {
    let aValue = a[sortConfig.key];
    let bValue = b[sortConfig.key];

    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }

    if (sortConfig.direction === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  return sortedCountries;
};