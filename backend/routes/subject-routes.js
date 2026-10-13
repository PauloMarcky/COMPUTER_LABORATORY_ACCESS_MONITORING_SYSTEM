const express = require('express');
const c = require('../controllers/subject-controller');
const { authenticate, authorize } = require('../middleware/user-auth');
const { asyncHandler: a } = require('../middleware/error-handler');

const router = express.Router();

router.get('/', authenticate, a(c.listSubjects));
router.get('/:id/usage', authenticate, authorize('ADMIN'), a(c.getSubjectUsage));
router.post('/', authenticate, authorize('ADMIN'), a(c.createSubject));
router.patch('/:id', authenticate, authorize('ADMIN'), a(c.updateSubject));

router.delete('/:id', authenticate, authorize('ADMIN'), a(c.deleteSubject));

module.exports = router;