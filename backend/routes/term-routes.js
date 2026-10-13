const express = require('express');
const c = require('../controllers/term-controller');
const { authenticate, authorize } = require('../middleware/user-auth');
const { asyncHandler: a } = require('../middleware/error-handler');

const router = express.Router();
router.get('/', authenticate, a(c.listTerms));
router.post('/', authenticate, authorize('ADMIN'), a(c.createTerm));
router.patch('/:id/activate', authenticate, authorize('ADMIN'), a(c.activateTerm));

module.exports = router;