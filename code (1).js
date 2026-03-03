const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  velvetId: {
    type: String,
    required: true,
    unique: true,
    minlength: 5,
    maxlength: 7
  },
  velvetName: {
    type: String,
    required: true,
    trim: true
  },
  displayName: {
    type: String,
    trim: true
  },
  hideRealName: {
    type: Boolean,
    default: false
  },
  password: {
    type: String,
    required: true
  },
  profilePicture: {
    type: String,
    default: ''
  },
  pet: {
    type: {
      type: String,
      enum: [
        'dog', 'cat', 'parrot', 'rabbit', 'hamster', 'fish', 'owl',
        'penguin', 'fox', 'deer', 'butterfly', 'dove', 'eagle',
        'dolphin', 'panda', 'koala', 'wolf', 'lion', 'tiger',
        'flamingo', 'peacock', 'chameleon', 'turtle', 'hedgehog'
      ],
      default: 'cat'
    },
    name: { type: String, default: '' }
  },
  background: {
    type: {
      type: String,
      enum: ['default', 'image', 'solid', 'gradient'],
      default: 'default'
    },
    value: { type: String, default: '' }
  },
  contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  pendingRequests: [{
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fromVelvetId: String,
    fromName: String,
    timestamp: { type: Date, default: Date.now }
  }],
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
  publicKey: String,
  status: {
    type: String,
    default: 'Hey there! I use Velvet ✦'
  },
  font: {
    type: String,
    default: 'default'
  },
  createdAt: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
