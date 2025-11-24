const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const {
  createCarWashRecord,
  getWasherDailySummary,
  getCompanyDailySummary,
  getAllWashersDailySummary,
  getCarWashRecords,
  getCarWashById,
  getCompanyDailySummaryAllBranches
} = require('../controllers/recordController');
const { validate } = require('../middleware/validate');
const { protect } = require('../middleware/auth');

// Validation rules for creating car wash record
const createCarWashValidation = [
  body('carNumber')
    .optional()
    .isString()
    .trim()
    .withMessage('Car number must be a string'),
  
  body('carModel')
    .optional()
    .isString()
    .trim()
    .withMessage('Car model must be a string'),
  
  body('customerName')
    .optional()
    .isString()
    .trim()
    .withMessage('Customer name must be a string'),
  
  body('customerPhone')
    .optional()
    .isString()
    .trim()
    .withMessage('Customer phone must be a string'),
  
  body('paymentMethod')
    .optional()
    .isString()
    .toLowerCase()
    .isIn(['cash', 'transfer'])
    .withMessage('Payment method must be either "cash" or "transfer"'),
  
  body('items')
    .isArray({ min: 1 })
    .withMessage('Items must be an array with at least one item'),
  
  body('items.*.washerName')
    .isString()
    .notEmpty()
    .withMessage('Washer name is required for each item'),
  
  body('items.*.serviceItemName')
    .isString()
    .notEmpty()
    .withMessage('Service item name is required for each item')
];

// All routes require authentication (protect middleware adds user with branch info)
router.use(protect);

/**
 * POST /api/records/car-wash
 * Create a new car wash record
 * Automatically scoped to authenticated user's branch
 * Body: { carNumber, carModel, customerName, customerPhone, paymentMethod, items: [{washerName, serviceItemName}] }
 */
router.post('/car-wash', createCarWashValidation, validate, createCarWashRecord);

/**
 * GET /api/records/car-wash
 * Get all car wash records for user's branch (optionally filtered by date and washerId)
 * Query params: ?date=2025-01-15&washerId=xxx
 */
router.get('/car-wash', getCarWashRecords);

/**
 * GET /api/records/car-wash/:id
 * Get a single car wash record by ID (only if in user's branch)
 */
router.get('/car-wash/:id', getCarWashById);

/**
 * GET /api/records/washer/:washerId/daily-summary
 * Get daily summary for a specific washer in user's branch
 * Query params: ?date=2025-01-15 (optional, defaults to today)
 */
router.get('/washer/:washerId/daily-summary', getWasherDailySummary);

/**
 * GET /api/records/washers/daily-summary
 * Get daily summaries for all washers in user's branch
 * Query params: ?date=2025-01-15 (optional, defaults to today)
 */
router.get('/washers/daily-summary', getAllWashersDailySummary);

/**
 * GET /api/records/company-summary
 * Get company daily summary for user's branch
 * Query params: ?date=2025-01-15 (optional, defaults to today)
 */
router.get('/company-summary', getCompanyDailySummary);

/**
 * GET /api/records/company-summary-all
 * Get company daily summary for ALL branches (no branch filter)
 * Query params: ?date=2025-01-15 (optional, defaults to today)
 */
router.get('/company-summary-all', getCompanyDailySummaryAllBranches);

module.exports = router;