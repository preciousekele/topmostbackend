const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const {
  createWasher,
  getAllWashers,
  getWasherById,
  updateWasher,
  deleteWasher,
  createServiceItem,
  getAllServiceItems,
  getServiceItemById,
  updateServiceItem,
  deleteServiceItem
} = require('../controllers/helperController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

// All routes require authentication
router.use(protect);

// ============ WASHER ROUTES ============

const createWasherValidation = [
  body('name')
    .notEmpty()
    .withMessage('Washer name is required')
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  
  body('phone')
    .optional()
    .isString()
    .trim()
    .matches(/^[0-9+\-\s()]+$/)
    .withMessage('Invalid phone number format')
];

const updateWasherValidation = [
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  
  body('phone')
    .optional()
    .isString()
    .trim()
    .matches(/^[0-9+\-\s()]+$/)
    .withMessage('Invalid phone number format'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

/**
 * POST /api/washers
 * Create a new washer
 */
router.post('/washers', createWasherValidation, validate, createWasher);

/**
 * GET /api/washers
 * Get all washers
 * Query: ?isActive=true
 */
router.get('/washers', getAllWashers);

/**
 * GET /api/washers/:id
 * Get washer by ID
 */
router.get('/washers/:id', getWasherById);

/**
 * PUT /api/washers/:id
 * Update washer
 */
router.put('/washers/:id', updateWasherValidation, validate, updateWasher);

/**
 * DELETE /api/washers/:id
 * Soft delete washer (sets isActive to false)
 */
router.delete('/washers/:id', deleteWasher);

// ============ SERVICE ITEM ROUTES ============

const createServiceItemValidation = [
  body('name')
    .notEmpty()
    .withMessage('Service item name is required')
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Description must not exceed 200 characters'),
  
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number')
];

const updateServiceItemValidation = [
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Description must not exceed 200 characters'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

/**
 * POST /api/service-items
 * Create a new service item
 */
router.post('/service-items', createServiceItemValidation, validate, createServiceItem);

/**
 * GET /api/service-items
 * Get all service items
 * Query: ?isActive=true
 */
router.get('/service-items', getAllServiceItems);

/**
 * GET /api/service-items/:id
 * Get service item by ID
 */
router.get('/service-items/:id', getServiceItemById);

/**
 * PUT /api/service-items/:id
 * Update service item
 */
router.put('/service-items/:id', updateServiceItemValidation, validate, updateServiceItem);

/**
 * DELETE /api/service-items/:id
 * Soft delete service item (sets isActive to false)
 */
router.delete('/service-items/:id', deleteServiceItem);

module.exports = router;