const express = require('express');
const router = express.Router();
const {
  getDailyPaymentSummary,
  getWasherPaymentSummary,
  getCompanyPaymentSummary
} = require('../controllers/paymentController');

/**
 * @route   GET /api/payments/daily-summary
 * @desc    Get daily payment summary for all washers
 * @query   date (optional) - Date in format YYYY-MM-DD, defaults to today
 * @access  Private
 */
router.get('/daily-summary', getDailyPaymentSummary);

/**
 * @route   GET /api/payments/washer/:washerId
 * @desc    Get payment summary for a specific washer
 * @param   washerId - The washer's ID
 * @query   date (optional) - Date in format YYYY-MM-DD, defaults to today
 * @access  Private
 */
router.get('/washer/:washerId', getWasherPaymentSummary);

/**
 * @route   GET /api/payments/company-summary
 * @desc    Get company payment summary for a date
 * @query   date (optional) - Date in format YYYY-MM-DD, defaults to today
 * @access  Private
 */
router.get('/company-summary', getCompanyPaymentSummary);

module.exports = router;