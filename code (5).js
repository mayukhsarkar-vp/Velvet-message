const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

function generateVelvetId() {
  const len = Math.floor(Math.random() * 3) + 5; // 5-7 digits
  let id = '';
  for (let i = 0; i < len; i++) {
    id += Math.floor(Math.random() * 10);
  }
  return id;
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { velvetName, displayName, password, pet } = req.body;

    // Generate unique Velvet ID
    let velvetId;
    let exists = true;
    while (exists) {
      velvetId = generateVelvetId();
      exists = await User.findOne({ velvetId });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = new User({
      velvetId,
      velvetName,
      displayName: displayName || velvetName,
      password: hashedPassword,
      pet: {
        type: pet || 'cat',
        name: ''
      }
    });

    await user.save();

    const token = jwt.sign(
      { velvetId, userId: user._id },
      process.env.JWT_SECRET || 'velvet_secret',
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      velvetId,
      token,
      user: {
        velvetId: user.velvetId,
        velvetName: user.velvetName,
        displayName: user.displayName,
        pet: user.pet,
        profilePicture: user.profilePicture,
        status: user.status
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { velvetId, password } = req.body;
    const user = await User.findOne({ velvetId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid password' });

    user.lastSeen = new Date();
    await user.save();

    const token = jwt.sign(
      { velvetId, userId: user._id },
      process.env.JWT_SECRET || 'velvet_secret',
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      user: {
        velvetId: user.velvetId,
        velvetName: user.velvetName,
        displayName: user.displayName,
        hideRealName: user.hideRealName,
        pet: user.pet,
        profilePicture: user.profilePicture,
        status: user.status,
        background: user.background,
        font: user.font,
        pendingRequests: user.pendingRequests
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { displayName, velvetName, hideRealName, pet, status, background, font, profilePicture } = req.body;
    const user = await User.findOne({ velvetId: req.user.velvetId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (displayName !== undefined) user.displayName = displayName;
    if (velvetName !== undefined) user.velvetName = velvetName;
    if (hideRealName !== undefined) user.hideRealName = hideRealName;
    if (pet !== undefined) user.pet = pet;
    if (status !== undefined) user.status = status;
    if (background !== undefined) user.background = background;
    if (font !== undefined) user.font = font;
    if (profilePicture !== undefined) user.profilePicture = profilePicture;

    await user.save();
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get contacts
router.get('/contacts', authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ velvetId: req.user.velvetId }).populate('contacts');
    res.json({ contacts: user.contacts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
