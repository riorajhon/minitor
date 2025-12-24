const mongoose = require('mongoose');
const AddressCollection = require('../models/AddressCollection');
const Error = require('../models/Error');
const { spawn } = require('child_process');
const path = require('path');

// Store active processes
const activeProcesses = new Map();

// Get country statistics from 'address' collection
const getCountryStats = async (req, res) => {
  try {
    const stats = await AddressCollection.aggregate([
      {
        $group: {
          _id: '$country',
          country_name: { $first: '$country_name' },
          inactiveCount: {
            $sum: { $cond: [{ $eq: ['$status', 0] }, 1, 0] }
          },
          activeCount: {
            $sum: { $cond: [{ $ne: ['$status', 0] }, 1, 0] }
          },
          totalCount: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          country: '$_id',
          country_name: 1,
          inactiveCount: 1,
          activeCount: 1,
          totalCount: 1
        }
      },
      {
        $sort: { country: 1 }
      }
    ]);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching country stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching country statistics',
      error: error.message
    });
  }
};

// Get addresses by country (using country name or code)
const getAddressesByCountry = async (req, res) => {
  try {
    const { countryIdentifier } = req.params;
    const { page = 1, limit = 50, status } = req.query;
    
    const skip = (page - 1) * limit;
    
    // Try to find by country code first, then by country name
    let filter = {};
    
    // Check if it looks like a country code (2 characters, uppercase)
    if (countryIdentifier.length === 2 && countryIdentifier === countryIdentifier.toUpperCase()) {
      filter = { country: countryIdentifier };
    } else {
      // Search by country name (case insensitive)
      filter = { country_name: { $regex: new RegExp(`^${countryIdentifier}$`, 'i') } };
    }
    
    if (status !== undefined) {
      filter.status = parseInt(status);
    }

    // Get addresses with pagination
    const addresses = await AddressCollection.find(filter)
      .sort({ city: 1, fulladdress: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalCount = await AddressCollection.countDocuments(filter);
    
    // Get country info
    const countryInfo = await AddressCollection.findOne(
      countryIdentifier.length === 2 && countryIdentifier === countryIdentifier.toUpperCase()
        ? { country: countryIdentifier }
        : { country_name: { $regex: new RegExp(`^${countryIdentifier}$`, 'i') } }
    );

    if (totalCount === 0) {
      return res.status(404).json({
        success: false,
        message: `No addresses found for "${countryIdentifier}"`
      });
    }

    res.json({
      success: true,
      data: {
        addresses,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          limit: parseInt(limit)
        },
        country: {
          code: countryInfo?.country || 'N/A',
          name: countryInfo?.country_name || countryIdentifier
        }
      }
    });
  } catch (error) {
    console.error('Error fetching addresses by country:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching addresses',
      error: error.message
    });
  }
};

// Get country processing status
const getCountryProcessingStatus = async (req, res) => {
  try {
    // Access the country_status collection directly
    const db = mongoose.connection.db;
    const countryStatusCollection = db.collection('country_status');

    const statusData = await countryStatusCollection.find({})
      .sort({ country_code: 1 })
      .toArray();

    // Group by status for summary
    const summary = statusData.reduce((acc, country) => {
      const status = country.status || 'unknown';
      if (!acc[status]) {
        acc[status] = 0;
      }
      acc[status]++;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        countries: statusData,
        summary: summary,
        total: statusData.length
      }
    });
  } catch (error) {
    console.error('Error fetching country processing status:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching country processing status',
      error: error.message
    });
  }
};

// Update country status
const updateCountryStatus = async (req, res) => {
  try {
    const { countryCode } = req.params;
    const { status, worker_id, reason } = req.body;

    // Validate status
    const validStatuses = ['completed', 'skipped', 'processing', 'retry'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Access the country_status collection directly
    const db = mongoose.connection.db;
    const countryStatusCollection = db.collection('country_status');

    // Prepare update data
    const updateData = { status };
    
    if (worker_id !== undefined) {
      updateData.worker_id = parseInt(worker_id);
    }

    if (reason !== undefined) {
      updateData.reason = reason;
    }

    // Add timestamps based on status
    if (status === 'processing') {
      updateData.started_at = new Date();
    } else if (status === 'completed') {
      updateData.completed_at = new Date();
    } else if (status === 'retry') {
      updateData.retry_at = new Date();
    }

    // Update the document
    const result = await countryStatusCollection.updateOne(
      { country_code: countryCode },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Country with code '${countryCode}' not found`
      });
    }

    // Get the updated document
    const updatedDoc = await countryStatusCollection.findOne({ country_code: countryCode });

    res.json({
      success: true,
      message: `Country ${countryCode} status updated to '${status}'`,
      data: updatedDoc
    });

  } catch (error) {
    console.error('Error updating country status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating country status',
      error: error.message
    });
  }
};

// Run address generator for a specific country
const runAddressGenerator = async (req, res) => {
  try {
    const { countryCode } = req.params;
    const { count } = req.body;

    if (!countryCode || countryCode.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'Invalid country code. Must be 2 characters (e.g., US, GB, DE)'
      });
    }

    if (!count || count <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Count is required and must be greater than 0'
      });
    }

    // Get country name from the database
    const countryInfo = await AddressCollection.findOne({ country: countryCode });
    const countryName = countryInfo?.country_name || countryCode;

    // Generate unique process ID
    const processId = `${countryCode}_${Date.now()}`;

    // Path to the Python script
    const scriptPath = path.join(__dirname, '../../address/index.py');
    
    // Set up the Python process
    const pythonProcess = spawn('python', [
      scriptPath,
      countryName,
      count.toString()
    ], {
      cwd: path.join(__dirname, '../../address'),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Store process info
    activeProcesses.set(processId, {
      process: pythonProcess,
      countryCode: countryCode.toUpperCase(),
      countryName,
      count,
      startTime: new Date(),
      output: [],
      status: 'running'
    });

    // Handle process completion
    pythonProcess.on('close', (code, signal) => {
      const processInfo = activeProcesses.get(processId);
      if (processInfo) {
        // Don't override status if already set to 'cancelled'
        if (processInfo.status !== 'cancelled') {
          processInfo.status = code === 0 ? 'completed' : 'failed';
        }
        processInfo.exitCode = code;
        processInfo.signal = signal;
        processInfo.endTime = new Date();
      }
    });

    // Handle process errors
    pythonProcess.on('error', (error) => {
      const processInfo = activeProcesses.get(processId);
      if (processInfo) {
        processInfo.status = 'error';
        processInfo.error = error.message;
      }
    });

    // Return immediately with process ID
    res.json({
      success: true,
      message: `Address generation started for ${countryName} (${countryCode})`,
      data: {
        processId,
        countryCode: countryCode.toUpperCase(),
        countryName,
        count,
        status: 'started'
      }
    });

  } catch (error) {
    console.error('Error starting address generator:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting address generator',
      error: error.message
    });
  }
};

// Stream process output (Server-Sent Events)
const streamProcessOutput = (req, res) => {
  const { processId } = req.params;
  
  const processInfo = activeProcesses.get(processId);
  if (!processInfo) {
    return res.status(404).json({
      success: false,
      message: 'Process not found'
    });
  }

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send initial status
  res.write(`data: ${JSON.stringify({ type: 'status', status: processInfo.status })}\n\n`);

  // Stream stdout
  processInfo.process.stdout.on('data', (data) => {
    const output = data.toString();
    processInfo.output.push(output);
    res.write(`data: ${JSON.stringify({ type: 'output', data: output })}\n\n`);
  });

  // Stream stderr
  processInfo.process.stderr.on('data', (data) => {
    const error = data.toString();
    res.write(`data: ${JSON.stringify({ type: 'error', data: error })}\n\n`);
  });

  // Handle completion
  processInfo.process.on('close', (code) => {
    res.write(`data: ${JSON.stringify({ type: 'complete', exitCode: code })}\n\n`);
    res.end();
  });

  // Clean up on client disconnect
  req.on('close', () => {
    res.end();
  });
};

// Get all active processes
const getActiveProcesses = (req, res) => {
  const processes = Array.from(activeProcesses.entries()).map(([id, info]) => ({
    processId: id,
    countryCode: info.countryCode,
    countryName: info.countryName,
    count: info.count,
    status: info.status,
    startTime: info.startTime,
    endTime: info.endTime,
    output: info.output.join('')
  }));

  res.json({
    success: true,
    data: processes
  });
};

// Cancel a running process
const cancelProcess = (req, res) => {
  const { processId } = req.params;
  
  const processInfo = activeProcesses.get(processId);
  if (!processInfo) {
    return res.status(404).json({
      success: false,
      message: 'Process not found'
    });
  }

  if (processInfo.status !== 'running') {
    return res.status(400).json({
      success: false,
      message: `Process is already ${processInfo.status}`
    });
  }

  // Kill the process gracefully first, then forcefully if needed
  try {
    processInfo.process.kill('SIGTERM'); // Graceful termination
    
    // If process doesn't terminate in 2 seconds, force kill
    setTimeout(() => {
      if (!processInfo.process.killed) {
        processInfo.process.kill('SIGKILL'); // Force kill
      }
    }, 2000);
    
  } catch (error) {
    console.error('Error killing process:', error);
    // Try force kill as fallback
    processInfo.process.kill('SIGKILL');
  }
  
  processInfo.status = 'cancelled';
  processInfo.endTime = new Date();

  res.json({
    success: true,
    message: 'Process cancelled successfully',
    data: {
      processId,
      status: 'cancelled'
    }
  });
};

// Delete an address by ID
const deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid address ID format'
      });
    }

    // Find and delete the address
    const deletedAddress = await AddressCollection.findByIdAndDelete(addressId);

    if (!deletedAddress) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      });
    }

    res.json({
      success: true,
      message: 'Address deleted successfully',
      data: {
        deletedAddress: {
          id: deletedAddress._id,
          fulladdress: deletedAddress.fulladdress,
          city: deletedAddress.city,
          country: deletedAddress.country,
          country_name: deletedAddress.country_name
        }
      }
    });

  } catch (error) {
    console.error('Error deleting address:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting address',
      error: error.message
    });
  }
};

// Delete country status by country code
const deleteCountryStatus = async (req, res) => {
  try {
    const { countryCode } = req.params;

    // Access the country_status collection directly
    const db = mongoose.connection.db;
    const countryStatusCollection = db.collection('country_status');

    // Find and delete the country status
    const result = await countryStatusCollection.deleteOne({ country_code: countryCode });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: `Country status for '${countryCode}' not found`
      });
    }

    res.json({
      success: true,
      message: `Country status for '${countryCode}' deleted successfully`,
      data: {
        countryCode,
        deletedCount: result.deletedCount
      }
    });

  } catch (error) {
    console.error('Error deleting country status:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting country status',
      error: error.message
    });
  }
};

// Delete duplicate addresses
const deleteDuplicateAddresses = async (req, res) => {
  try {
    // Find duplicates based on fulladdress field
    const duplicates = await AddressCollection.aggregate([
      {
        $group: {
          _id: '$fulladdress',
          ids: { $push: '$_id' },
          count: { $sum: 1 }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]);

    let totalDeleted = 0;
    
    // Delete duplicates, keeping only the first occurrence
    for (const duplicate of duplicates) {
      // Keep the first document, delete the rest
      const idsToDelete = duplicate.ids.slice(1);
      const result = await AddressCollection.deleteMany({ 
        _id: { $in: idsToDelete } 
      });
      totalDeleted += result.deletedCount;
    }

    res.json({
      success: true,
      message: `Deleted ${totalDeleted} duplicate addresses`,
      data: {
        duplicateGroups: duplicates.length,
        totalDeleted
      }
    });

  } catch (error) {
    console.error('Error deleting duplicate addresses:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting duplicate addresses',
      error: error.message
    });
  }
};

// Get combined country data (status + address counts)
const getCombinedCountryData = async (req, res) => {
  try {
    // Get country processing status
    const db = mongoose.connection.db;
    const countryStatusCollection = db.collection('country_status');
    
    const statusData = await countryStatusCollection.find({})
      .sort({ country_code: 1 })
      .toArray();

    // Get address counts for each country
    const addressCounts = await AddressCollection.aggregate([
      {
        $match: {
          country: { $exists: true, $ne: null, $ne: "" }
        }
      },
      {
        $group: {
          _id: '$country',
          country_name: { $first: '$country_name' },
          inactiveCount: {
            $sum: { $cond: [{ $eq: ['$status', 0] }, 1, 0] }
          },
          activeCount: {
            $sum: { $cond: [{ $ne: ['$status', 0] }, 1, 0] }
          },
          totalCount: { $sum: 1 }
        }
      }
    ]);

    // Create a map for quick lookup
    const addressCountMap = {};
    addressCounts.forEach(item => {
      addressCountMap[item._id] = {
        country_name: item.country_name,
        inactiveCount: item.inactiveCount,
        activeCount: item.activeCount,
        totalCount: item.totalCount
      };
    });

    // Combine status data with address counts
    const combinedData = statusData.map(country => {
      const addressData = addressCountMap[country.country_code] || {
        country_name: country.country_name || 'N/A',
        inactiveCount: 0,
        activeCount: 0,
        totalCount: 0
      };

      return {
        country_code: country.country_code,
        country_name: country.country_name || addressData.country_name,
        status: country.status,
        worker_id: country.worker_id,
        reason: country.reason,
        inactiveCount: addressData.inactiveCount,
        activeCount: addressData.activeCount,
        totalCount: addressData.totalCount
      };
    });

    // Group by status for summary
    const summary = combinedData.reduce((acc, country) => {
      const status = country.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        countries: combinedData,
        summary: summary,
        total: combinedData.length
      }
    });

  } catch (error) {
    console.error('Error fetching combined country data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching combined country data',
      error: error.message
    });
  }
};

// Get all errors with pagination and filtering
const getErrors = async (req, res) => {
  try {
    const { page = 1, limit = 50, type, country } = req.query;
    const skip = (page - 1) * limit;
    
    // Build filter
    let filter = {};
    if (type) {
      filter.type = type;
    }
    if (country) {
      filter.country = country;
    }

    // Get errors with pagination
    const errors = await Error.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalCount = await Error.countDocuments(filter);
    
    // Get error type summary
    const typeSummary = await Error.aggregate([
      ...(Object.keys(filter).length > 0 ? [{ $match: filter }] : []),
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        errors,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          limit: parseInt(limit)
        },
        summary: {
          types: typeSummary,
          total: totalCount
        }
      }
    });
  } catch (error) {
    console.error('Error fetching errors:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching errors',
      error: error.message
    });
  }
};

// Delete an error by ID
const deleteError = async (req, res) => {
  try {
    const { errorId } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(errorId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid error ID format'
      });
    }

    // Find and delete the error
    const deletedError = await Error.findByIdAndDelete(errorId);

    if (!deletedError) {
      return res.status(404).json({
        success: false,
        message: 'Error not found'
      });
    }

    res.json({
      success: true,
      message: 'Error deleted successfully',
      data: {
        deletedError: {
          id: deletedError._id,
          type: deletedError.type,
          seed: deletedError.seed,
          reason: deletedError.reason
        }
      }
    });

  } catch (error) {
    console.error('Error deleting error record:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting error record',
      error: error.message
    });
  }
};

// Delete multiple errors by filter
const deleteErrorsByFilter = async (req, res) => {
  try {
    const { type, country } = req.body;
    
    // Build filter
    let filter = {};
    if (type) {
      filter.type = type;
    }
    if (country) {
      filter.country = country;
    }

    if (Object.keys(filter).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one filter (type or country) is required'
      });
    }

    // Delete errors matching the filter
    const result = await Error.deleteMany(filter);

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} error records`,
      data: {
        deletedCount: result.deletedCount,
        filter
      }
    });

  } catch (error) {
    console.error('Error deleting error records:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting error records',
      error: error.message
    });
  }
};

module.exports = {
  getCountryStats,
  getAddressesByCountry,
  getCountryProcessingStatus,
  updateCountryStatus,
  runAddressGenerator,
  streamProcessOutput,
  getActiveProcesses,
  cancelProcess,
  deleteAddress,
  deleteCountryStatus,
  deleteDuplicateAddresses,
  getCombinedCountryData,
  getErrors,
  deleteError,
  deleteErrorsByFilter
};
