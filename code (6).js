const express = require('express');
const Message = require('../models/Message');
const Group = require('../models/Group');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get chat history between two users
router.get('/history/:otherVelvetId', authMiddleware, async (req, res) => {
  try {
    const myId = req.user.velvetId;
    const otherId = req.params.otherVelvetId;
    const page = parseInt(req.query.page) || 1;
    const limit = 50;

    const messages = await Message.find({
      $or: [
        { sender: myId, receiver: otherId },
        { sender: otherId, receiver: myId }
      ]
    })
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ messages: messages.reverse() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create group
router.post('/group', authMiddleware, async (req, res) => {
  try {
    const { name, description, members } = req.body;
    const group = new Group({
      name,
      description,
      creator: req.user.velvetId,
      admins: [req.user.velvetId],
      members: [req.user.velvetId, ...members]
    });
    await group.save();

    // Add group to all members
    for (const memberId of group.members) {
      const user = await User.findOne({ velvetId: memberId });
      if (user) {
        user.groups.push(group._id);
        await user.save();
      }
    }

    res.json({ success: true, group });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get group messages
router.get('/group/:groupId/messages', authMiddleware, async (req, res) => {
  try {
    const messages = await Message.find({ group: req.params.groupId })
      .sort({ timestamp: -1 })
      .limit(50);
    res.json({ messages: messages.reverse() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user's groups
router.get('/groups', authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ velvetId: req.user.velvetId }).populate('groups');
    res.json({ groups: user.groups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
