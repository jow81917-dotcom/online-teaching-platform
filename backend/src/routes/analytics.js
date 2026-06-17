const router = require('express').Router();
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const c = require('../controllers/analyticsController');

router.get('/admin/stats', auth, rbac('admin', 'manager', 'supervisor'), c.adminStats);
router.get('/manager/stats', auth, rbac('admin', 'manager'), c.adminStats);
router.get('/admin/recent-activities', auth, rbac('admin', 'manager'), c.recentActivities);

module.exports = router;
