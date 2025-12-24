const mongoose = require('mongoose');

// Schema for the error collection
const errorSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    trim: true
  },
  seed: {
    type: String,
    required: true,
    trim: true
  },
  reason: {
    type: String,
    required: true,
    trim: true
  },
  country: {
    type: String,
    trim: true
  },
  worker_id: {
    type: Number
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'error', // Explicitly specify the collection name
  timestamps: false // Using custom timestamp field
});

// Index for better query performance
errorSchema.index({ type: 1 });
errorSchema.index({ country: 1 });
errorSchema.index({ timestamp: -1 });
errorSchema.index({ worker_id: 1 });

module.exports = mongoose.model('Error', errorSchema);