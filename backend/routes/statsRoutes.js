const express = require('express');
const router = express.Router();
const { getCountryStats, getAddressesByCountry, getCountryProcessingStatus, updateCountryStatus, runAddressGenerator, streamProcessOutput, getActiveProcesses, cancelProcess, deleteAddress, deleteCountryStatus, deleteDuplicateAddresses, getCombinedCountryData, getErrors, deleteError, deleteErrorsByFilter } = require('../controllers/statsController');

// GET /api/stats/countries - Get country statistics
router.get('/countries', getCountryStats);

// GET /api/stats/countries/:countryIdentifier/addresses - Get addresses by country (code or name)
router.get('/countries/:countryIdentifier/addresses', getAddressesByCountry);

// GET /api/stats/processing-status - Get country processing status
router.get('/processing-status', getCountryProcessingStatus);

// PUT /api/stats/processing-status/:countryCode - Update country status
router.put('/processing-status/:countryCode', updateCountryStatus);

// POST /api/stats/generate/:countryCode - Run address generator for country
router.post('/generate/:countryCode', runAddressGenerator);

// GET /api/stats/processes - Get all active processes
router.get('/processes', getActiveProcesses);

// GET /api/stats/processes/:processId/stream - Stream process output (SSE)
router.get('/processes/:processId/stream', streamProcessOutput);

// DELETE /api/stats/processes/:processId - Cancel a running process
router.delete('/processes/:processId', cancelProcess);

// DELETE /api/stats/addresses/:addressId - Delete an address
router.delete('/addresses/:addressId', deleteAddress);

// DELETE /api/stats/processing-status/:countryCode - Delete country status
router.delete('/processing-status/:countryCode', deleteCountryStatus);

// DELETE /api/stats/duplicates - Delete duplicate addresses
router.delete('/duplicates', deleteDuplicateAddresses);

// GET /api/stats/combined - Get combined country data (status + address counts)
router.get('/combined', getCombinedCountryData);

// GET /api/stats/errors - Get all errors with pagination and filtering
router.get('/errors', getErrors);

// DELETE /api/stats/errors/:errorId - Delete a specific error
router.delete('/errors/:errorId', deleteError);

// DELETE /api/stats/errors - Delete multiple errors by filter
router.delete('/errors', deleteErrorsByFilter);

module.exports = router;