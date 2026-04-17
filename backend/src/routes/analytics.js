const router = require('express').Router();
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const c = require('../controllers/analyticsController');

router.get('/admin/stats', auth, rbac('admin'), c.adminStats);
router.get('/admin/recent-activities', auth, rbac('admin'), c.recentActivities);

module.exports = router;
