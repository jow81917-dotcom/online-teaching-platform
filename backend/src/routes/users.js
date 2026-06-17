const router = require('express').Router();
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const c = require('../controllers/userController');

router.get('/stats', auth, rbac('admin', 'manager'), c.getStats);
router.get('/sub-admins', auth, rbac('admin'), c.getSubAdmins);
router.post('/sub-admins', auth, rbac('admin'), c.createSubAdmin);
router.get('/roles/:role/permissions', auth, rbac('admin', 'manager', 'supervisor'), c.getRolePermissions);
router.get('/', auth, rbac('admin', 'manager'), c.getAll);
router.get('/:id', auth, c.getOne);
router.put('/:id', auth, rbac('admin'), c.update);
router.post('/:id/reset-password', auth, rbac('admin'), c.resetPassword);
router.delete('/:id', auth, rbac('admin'), c.remove);

module.exports = router;
