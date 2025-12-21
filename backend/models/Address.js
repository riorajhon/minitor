const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true
  },
  country: {
    type: String,
    required: [true, 'Country is required'],
    trim: true
  },
  state: {
    type: Number,
    default: 0
  },
  extra: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Index for better query performance
addressSchema.index({ address: 1 }, { unique: true });
addressSchema.index({ city: 1, country: 1 });
addressSchema.index({ state: 1 });

module.exports = mongoose.model('Address', addressSchema);