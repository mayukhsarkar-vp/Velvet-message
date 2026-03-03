const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  receiver: { type: String },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
  content: { type: String },
  iv: { type: String },
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'audio', 'document', 'sticker', 'game'],
    default: 'text'
  },
  fileUrl: String,
  fileName: String,
  fileSize: Number,
  read: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});

messageSchema.index({ sender: 1, receiver: 1, timestamp: -1 });
messageSchema.index({ group: 1, timestamp: -1 });

module.exports = mongoose.model('Message', messageSchema);
