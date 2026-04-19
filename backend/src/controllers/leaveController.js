// backend/src/controllers/leaveController.js
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const { role, id } = req.user;
    const isAdmin = role === 'admin';
    const [rows] = await sequelize.query(
      isAdmin ? 'SELECT * FROM leave_requests ORDER BY created_at DESC'
               : 'SELECT * FROM leave_requests WHERE user_id=$1 ORDER BY created_at DESC',
      { bind: isAdmin ? [] : [id] }
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.create = async (req, res) => {
  const { session_id, leave_date, start_time, end_time, reason } = req.body;
  try {
    const id = uuidv4();
    await sequelize.query(
      'INSERT INTO leave_requests (id,user_id,user_role,session_id,leave_date,start_time,end_time,reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      { bind: [id, req.user.id, req.user.role, session_id||null, leave_date, start_time, end_time, reason||null] }
    );
    res.status(201).json({ message: 'Leave request submitted', id });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.approve = async (req, res) => {
  const { status } = req.body;
  try {
    await sequelize.query(
      'UPDATE leave_requests SET status=$1, approved_by=$2, approved_at=NOW() WHERE id=$3',
      { bind: [status, req.user.id, req.params.id] }
    );
    res.json({ message: `Leave ${status}` });
  } catch (e) { res.status(500).json({ message: e.message }); }
};
