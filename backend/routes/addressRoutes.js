const express = require('express');
const router = express.Router();
const {
  getAllAddresses,
  getAddressById,
  createAddress,
  updateAddress,
  deleteAddress,
  bulkCreateAddresses
} = require('../controllers/addressController');

// GET /api/addresses - Get all addresses with pagination and filtering
router.get('/', getAllAddresses);

// GET /api/addresses/:id - Get single address
router.get('/:id', getAddressById);

// POST /api/addresses - Create new address
router.post('/', createAddress);

// POST /api/addresses/bulk - Bulk create addresses
router.post('/bulk', bulkCreateAddresses);

// PUT /api/addresses/:id - Update address
router.put('/:id', updateAddress);

// DELETE /api/addresses/:id - Delete address
router.delete('/:id', deleteAddress);

module.exports = router;