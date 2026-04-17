const router = require('express').Router();
const auth = require('../middleware/auth');
const { login, register, me } = require('../controllers/authController');

router.post('/login', login);
router.post('/register', register);
router.get('/me', auth, me);

module.exports = router;
