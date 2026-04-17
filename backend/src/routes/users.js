const router = require('express').Router();
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const c = require('../controllers/userController');

router.get('/', auth, rbac('admin'), c.getAll);
router.get('/:id', auth, c.getOne);
router.put('/:id', auth, rbac('admin'), c.update);
router.delete('/:id', auth, rbac('admin'), c.remove);

module.exports = router;
