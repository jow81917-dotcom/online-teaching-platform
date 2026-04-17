const router = require('express').Router();
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const c = require('../controllers/leaveController');

router.get('/', auth, c.getAll);
router.post('/', auth, c.create);
router.put('/:id/status', auth, rbac('admin'), c.approve);

module.exports = router;
