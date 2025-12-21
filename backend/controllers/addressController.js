const Address = require('../models/Address');

// Get all addresses
const getAllAddresses = async (req, res) => {
  try {
    const { page = 1, limit = 10, city, country, state } = req.query;
    
    // Build filter object
    const filter = {};
    if (city) filter.city = new RegExp(city, 'i');
    if (country) filter.country = new RegExp(country, 'i');
    if (state !== undefined) filter.state = state === 'true';

    const addresses = await Address.find(filter)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Address.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: addresses,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching addresses',
      error: error.message
    });
  }
};

// Get single address
const getAddressById = async (req, res) => {
  try {
    const address = await Address.findById(req.params.id);
    
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    res.status(200).json({
      success: true,
      data: address
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching address',
      error: error.message
    });
  }
};

// Create new address
const createAddress = async (req, res) => {
  try {
    const { address, city, country, extra, state } = req.body;

    const newAddress = new Address({
      address,
      city,
      country,
      extra: extra || {},
      state: state || false
    });

    const savedAddress = await newAddress.save();

    res.status(201).json({
      success: true,
      message: 'Address created successfully',
      data: savedAddress
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `This ${field} already exists`,
        error: 'Duplicate address'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating address',
      error: error.message
    });
  }
};

// Update address
const updateAddress = async (req, res) => {
  try {
    const { address, city, country, extra, state } = req.body;

    const updatedAddress = await Address.findByIdAndUpdate(
      req.params.id,
      { address, city, country, extra, state },
      { new: true, runValidators: true }
    );

    if (!updatedAddress) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Address updated successfully',
      data: updatedAddress
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating address',
      error: error.message
    });
  }
};

// Delete address
const deleteAddress = async (req, res) => {
  try {
    const deletedAddress = await Address.findByIdAndDelete(req.params.id);

    if (!deletedAddress) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Address deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting address',
      error: error.message
    });
  }
};

// Bulk create addresses with duplicate handling
const bulkCreateAddresses = async (req, res) => {
  try {
    const { addresses } = req.body;

    if (!Array.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of addresses'
      });
    }

    const result = await Address.insertMany(addresses, { 
      ordered: false,
      rawResult: true 
    });

    res.status(201).json({
      success: true,
      message: `${result.insertedCount} addresses created successfully`,
      data: {
        insertedCount: result.insertedCount,
        totalProvided: addresses.length
      }
    });
  } catch (error) {
    // Handle bulk write errors (including duplicates)
    if (error.name === 'BulkWriteError') {
      const insertedCount = error.result.insertedCount || 0;
      const duplicateCount = error.writeErrors ? error.writeErrors.filter(e => e.code === 11000).length : 0;
      
      return res.status(207).json({
        success: true,
        message: `Bulk insert completed with some errors`,
        data: {
          insertedCount,
          duplicateCount,
          totalProvided: req.body.addresses.length,
          errors: duplicateCount
        }
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating addresses',
      error: error.message
    });
  }
};

// Create or update address (upsert)
const upsertAddress = async (req, res) => {
  try {
    const { address, city, country, extra, state } = req.body;

    const updatedAddress = await Address.findOneAndUpdate(
      { address }, // Find by address field
      { address, city, country, extra: extra || {}, state: state || 0 },
      { 
        new: true, 
        upsert: true, 
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    res.status(200).json({
      success: true,
      message: 'Address created or updated successfully',
      data: updatedAddress
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error upserting address',
      error: error.message
    });
  }
};

module.exports = {
  getAllAddresses,
  getAddressById,
  createAddress,
  updateAddress,
  deleteAddress,
  bulkCreateAddresses,
  upsertAddress
};