const router = require('express').Router();
const auth = require('../middleware/auth');
const c = require('../controllers/notificationController');

router.get('/', auth, c.getAll);
router.put('/read-all', auth, c.markAllRead);
router.put('/:id/read', auth, c.markRead);

module.exports = router;
