const router = require('express').Router();
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const c = require('../controllers/sessionController');

router.get('/my/live', auth, c.getLiveSession);
router.get('/classroom/join/:sessionId', auth, c.getClassroomJoin);
router.get('/admin/calendar', auth, rbac('admin', 'manager', 'supervisor'), c.getAdminCalendar);
router.get('/admin/day/:date', auth, rbac('admin', 'manager', 'supervisor'), c.getAdminDaySessions);
router.get('/admin/stats', auth, rbac('admin', 'manager', 'supervisor'), c.getAdminStats);
router.get('/', auth, c.getAll);
router.get('/:id', auth, c.getOne);
router.post('/', auth, rbac('admin', 'manager', 'teacher'), c.create);
router.put('/:id', auth, rbac('admin', 'manager', 'teacher'), c.update);

module.exports = router;
