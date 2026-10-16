const express = require('express');
const c = require('../controllers/pc-issue-controller');
const { authenticate, authorize } = require('../middleware/user-auth');
const { asyncHandler: a } = require('../middleware/error-handler');
const { handleImagesUpload } = require('../middleware/upload');

const router = express.Router();
router.use(authenticate);

router.post('/', authorize('STUDENT'), handleImagesUpload, a(c.reportIssue));
router.get('/me', authorize('STUDENT'), a(c.listMyIssues));
router.get('/', authorize('ADMIN', 'CUSTODIAN', 'INSTRUCTOR'), a(c.listIssues));
router.get('/:id', authorize('ADMIN', 'CUSTODIAN', 'INSTRUCTOR'), a(c.getIssue));
router.patch('/:id', authorize('ADMIN', 'CUSTODIAN'), a(c.updateIssue));

module.exports = router;
