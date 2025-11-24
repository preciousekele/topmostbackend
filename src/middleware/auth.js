const { verifyToken } = require('../utils/generateToken');
const prisma = require('../config/database');

// @desc    Protect routes - verify JWT token
const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    else if (req.body && req.body.token) {
      token = req.body.token;
    }

    if (!token || token === 'none') {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route. Please login.'
      });
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token. Please login again.'
      });
    }

    // Include branch information
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        branchId: true,
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            isActive: true
          }
        },
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists. Please login again.'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account is inactive. Contact administrator.'
      });
    }

    // Check if branch is active
    if (!user.branch.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your branch is inactive. Contact administrator.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again.'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
};

// @desc    Authorize specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route. Required roles: ${roles.join(', ')}`
      });
    }
    
    next();
  };
};

// @desc    Filter data by user's branch
const filterByBranch = (req, res, next) => {
  // Attach branch filter to request
  if (!req.user || !req.user.branchId) {
    return res.status(401).json({
      success: false,
      message: 'Branch information not found'
    });
  }
  
  req.branchFilter = { branchId: req.user.branchId };
  next();
};

module.exports = { protect, authorize, filterByBranch };