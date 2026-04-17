const router = require('express').Router();
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const c = require('../controllers/reportController');

router.get('/summary', auth, rbac('admin'), c.summary);

module.exports = router;
