const mongoose = require('mongoose');

// Schema for the existing 'address' collection
const addressCollectionSchema = new mongoose.Schema({
  country: {
    type: String,
    required: true
  },
  country_name: {
    type: String,
    required: true
  },
  street_name: {
    type: String
  },
  city: {
    type: String,
    required: true
  },
  fulladdress: {
    type: String,
    required: true
  },
  status: {
    type: Number,
    default: 0
  },
  worker_id: {
    type: Number
  }
}, {
  collection: 'address', // Explicitly specify the collection name
  timestamps: false // Since the existing collection might not have timestamps
});

// Index for better query performance
addressCollectionSchema.index({ country: 1 });
addressCollectionSchema.index({ status: 1 });
addressCollectionSchema.index({ city: 1, country: 1 });

module.exports = mongoose.model('AddressCollection', addressCollectionSchema);