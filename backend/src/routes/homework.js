const router = require('express').Router();
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const c = require('../controllers/homeworkController');

router.get('/', auth, c.getAll);
router.get('/:id', auth, c.getOne);
router.post('/', auth, rbac('teacher'), c.create);
router.get('/:id/submissions', auth, rbac('teacher','admin'), c.getSubmissions);
router.post('/:id/submit', auth, rbac('student'), c.submit);
router.put('/:id/submissions/:submissionId/grade', auth, rbac('teacher'), c.grade);

module.exports = router;
