const router = require('express').Router();
const auth = require('../middleware/auth');
const rbac = require('../middleware/rbac');
const c = require('../controllers/videoController');

router.get('/my', auth, rbac('student'), c.getMyVideos);
router.post('/', auth, rbac('admin', 'teacher'), c.assign);
router.put('/:id/grant', auth, rbac('admin'), c.grantAccess);

module.exports = router;
