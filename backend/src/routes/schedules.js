// backend/src/routes/schedules.js
const router = require('express').Router();
const auth   = require('../middleware/auth');
const rbac   = require('../middleware/rbac');
const c      = require('../controllers/scheduleController');

router.get('/',                    auth, rbac('admin'),           c.getAll);
router.post('/',                   auth, rbac('admin'),           c.create);
router.get('/:id',                 auth, rbac('admin'),           c.getOne);
router.delete('/:id',              auth, rbac('admin'),           c.remove);
router.get('/:id/conflicts',       auth, rbac('admin'),           c.getConflicts);

module.exports = router;
