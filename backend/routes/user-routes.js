const express = require('express');
const userController = require('../controllers/user-controller');
const { authenticate, authorize } = require('../middleware/user-auth');
const { asyncHandler } = require('../middleware/error-handler');

const router = express.Router();

router.post('/login', asyncHandler(userController.login));
router.use(authenticate);
router.get('/', authorize('ADMIN'), asyncHandler(userController.listUsers));
router.post('/import/students', authorize('ADMIN'), asyncHandler(userController.importStudents));
router.post('/', authorize('ADMIN'), asyncHandler(userController.createUser));
router.delete('/:id', authorize('ADMIN'), asyncHandler(userController.deleteUser));
router.post('/bulk-delete', authorize('ADMIN'), asyncHandler(userController.deleteUsers));
router.patch('/:id/password', authorize('ADMIN'), asyncHandler(userController.updatePassword));
router.patch('/:id/name', authorize('ADMIN'), asyncHandler(userController.updateUserName));
router.patch('/:id/school-id', authorize('ADMIN'), asyncHandler(userController.updateSchoolId));

module.exports = router;
