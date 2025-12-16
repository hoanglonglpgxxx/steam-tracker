const express = require('express');
const reminderController = require('../controllers/reminderController');

const router = express.Router();

router
    .route('/:id')
    .get(reminderController.getReminder)
    .patch(
        reminderController.updateReminder
    );

// Allow confirmation via GET link: /api/v1/reminder/:id/confirm?isConfirmed=true
router.get('/:id/confirm', reminderController.confirmReminder);

module.exports = router;
