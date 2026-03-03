require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const adminRoutes = require('./routes/admin');
const uploadRoutes = require('./routes/upload');

const User = require('./models/User');
const Message = require('./models/Message');
const Group = require('./models/Group');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 50 * 1024 * 1024
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);

// Serve admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Socket.IO Real-Time Layer ───────────────────────────────────
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('register', (velvetId) => {
    onlineUsers.set(velvetId, socket.id);
    socket.velvetId = velvetId;
    io.emit('user-status', { velvetId, online: true });
  });

  // Send contact request
  socket.on('send-request', async ({ from, to }) => {
    try {
      const sender = await User.findOne({ velvetId: from });
      const receiver = await User.findOne({ velvetId: to });
      if (!receiver) {
        socket.emit('request-error', { message: 'User not found' });
        return;
      }
      if (receiver.contacts.includes(sender._id)) {
        socket.emit('request-error', { message: 'Already connected' });
        return;
      }

      // Add pending request
      receiver.pendingRequests.push({
        from: sender._id,
        fromVelvetId: from,
        fromName: sender.displayName || sender.velvetName,
        timestamp: new Date()
      });
      await receiver.save();

      const receiverSocket = onlineUsers.get(to);
      if (receiverSocket) {
        io.to(receiverSocket).emit('incoming-request', {
          from: from,
          name: sender.displayName || sender.velvetName,
          pet: sender.pet,
          profilePic: sender.profilePicture
        });
      }
      socket.emit('request-sent', { to });
    } catch (err) {
      socket.emit('request-error', { message: 'Failed to send request' });
    }
  });

  // Accept request
  socket.on('accept-request', async ({ myId, theirId }) => {
    try {
      const me = await User.findOne({ velvetId: myId });
      const them = await User.findOne({ velvetId: theirId });
      if (!me || !them) return;

      // Add each other as contacts
      if (!me.contacts.includes(them._id)) me.contacts.push(them._id);
      if (!them.contacts.includes(me._id)) them.contacts.push(me._id);

      // Remove pending request
      me.pendingRequests = me.pendingRequests.filter(
        (r) => r.fromVelvetId !== theirId
      );

      await me.save();
      await them.save();

      socket.emit('request-accepted', { velvetId: theirId });
      const theirSocket = onlineUsers.get(theirId);
      if (theirSocket) {
        io.to(theirSocket).emit('request-accepted', { velvetId: myId });
      }
    } catch (err) {
      console.error(err);
    }
  });

  // Decline request
  socket.on('decline-request', async ({ myId, theirId }) => {
    try {
      const me = await User.findOne({ velvetId: myId });
      if (!me) return;
      me.pendingRequests = me.pendingRequests.filter(
        (r) => r.fromVelvetId !== theirId
      );
      await me.save();
    } catch (err) {
      console.error(err);
    }
  });

  // Private message
  socket.on('private-message', async (data) => {
    try {
      const { from, to, content, type, encryptedContent, iv, fileUrl, fileName, fileSize } = data;

      const msg = new Message({
        sender: from,
        receiver: to,
        content: encryptedContent || content,
        iv: iv,
        type: type || 'text',
        fileUrl,
        fileName,
        fileSize,
        timestamp: new Date()
      });
      await msg.save();

      const receiverSocket = onlineUsers.get(to);
      const payload = {
        _id: msg._id,
        from,
        to,
        content,
        type: msg.type,
        fileUrl,
        fileName,
        fileSize,
        timestamp: msg.timestamp
      };

      if (receiverSocket) {
        io.to(receiverSocket).emit('private-message', payload);
      }
      socket.emit('message-sent', payload);
    } catch (err) {
      console.error(err);
    }
  });

  // Group message
  socket.on('group-message', async (data) => {
    try {
      const { groupId, from, content, type, fileUrl, fileName, fileSize } = data;
      const group = await Group.findById(groupId);
      if (!group) return;

      const msg = new Message({
        sender: from,
        group: groupId,
        content,
        type: type || 'text',
        fileUrl,
        fileName,
        fileSize,
        timestamp: new Date()
      });
      await msg.save();

      group.members.forEach((memberId) => {
        const memberSocket = onlineUsers.get(memberId);
        if (memberSocket && memberId !== from) {
          io.to(memberSocket).emit('group-message', {
            _id: msg._id,
            groupId,
            from,
            content,
            type: msg.type,
            fileUrl,
            fileName,
            fileSize,
            timestamp: msg.timestamp
          });
        }
      });
      socket.emit('message-sent', { _id: msg._id, groupId });
    } catch (err) {
      console.error(err);
    }
  });

  // Typing indicators
  socket.on('typing', ({ from, to }) => {
    const receiverSocket = onlineUsers.get(to);
    if (receiverSocket) {
      io.to(receiverSocket).emit('typing', { from });
    }
  });

  socket.on('stop-typing', ({ from, to }) => {
    const receiverSocket = onlineUsers.get(to);
    if (receiverSocket) {
      io.to(receiverSocket).emit('stop-typing', { from });
    }
  });

  // Game invitations
  socket.on('game-invite', ({ from, to, game }) => {
    const receiverSocket = onlineUsers.get(to);
    if (receiverSocket) {
      io.to(receiverSocket).emit('game-invite', { from, game });
    }
  });

  socket.on('game-move', ({ from, to, game, move }) => {
    const receiverSocket = onlineUsers.get(to);
    if (receiverSocket) {
      io.to(receiverSocket).emit('game-move', { from, game, move });
    }
  });

  socket.on('game-accept', ({ from, to, game }) => {
    const receiverSocket = onlineUsers.get(to);
    if (receiverSocket) {
      io.to(receiverSocket).emit('game-start', { from, game });
    }
    socket.emit('game-start', { from: to, game });
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (socket.velvetId) {
      onlineUsers.delete(socket.velvetId);
      io.emit('user-status', { velvetId: socket.velvetId, online: false });
    }
  });
});

// ─── Database & Start ────────────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/velvet')
  .then(() => {
    console.log('MongoDB connected');
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`✦ Velvet running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    // Run without DB for demo
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`✦ Velvet running on port ${PORT} (no DB)`);
    });
  });

module.exports = { app, io };
