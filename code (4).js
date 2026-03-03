const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'velvet_secret');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const adminMiddleware = (req, res, next) => {
  const adminCode = req.headers['x-admin-code'];
  if (adminCode !== (process.env.ADMIN_ACCESS_CODE || 'VELVETADMIN2024')) {
    return res.status(403).json({ error: 'Invalid admin code' });
  }
  next();
};

module.exports = { authMiddleware, adminMiddleware };
