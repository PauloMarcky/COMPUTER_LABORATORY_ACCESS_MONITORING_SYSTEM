const express = require('express');
const c = require('../controllers/lab-room-controller');
const { authenticate, authorize } = require('../middleware/user-auth');
const { asyncHandler: a } = require('../middleware/error-handler');

const router = express.Router();
router.use(authenticate);

router.get('/', a(c.listLabRooms));
router.get('/status', a(c.getLabRoomStatus)); // ← must be before /:id
router.patch('/pcs/:pcId', authorize('ADMIN', 'CUSTODIAN'), a(c.updatePc));
router.get('/:id', a(c.getLabRoom));
router.get('/:id/pcs', a(c.getPcs));
router.post('/', authorize('ADMIN', 'CUSTODIAN'), a(c.createLabRoom));
router.patch('/:id', authorize('ADMIN', 'CUSTODIAN'), a(c.updateLabRoom));
router.delete('/:id', authorize('ADMIN', 'CUSTODIAN'), a(c.deleteLabRoom));

module.exports = router;