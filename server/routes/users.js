const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDb } = require('../utils/database');
const { getUserFromToken } = require('../middleware/auth');

const router = express.Router();

// Get all users (for discovery)
router.get('/', getUserFromToken, (req, res) => {
  const db = getDb();
  const { search, category, limit = 20, offset = 0 } = req.query;
  
  let query = `
    SELECT u.id, u.username, u.full_name, u.bio, u.avatar_url, u.location, u.created_at
    FROM users u
    WHERE u.id != ?
  `;
  let params = [req.user.id];

  if (search) {
    query += ` AND (u.username LIKE ? OR u.full_name LIKE ? OR u.bio LIKE ?)`;
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  query += ` ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));

  db.all(query, params, (err, users) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ users });
  });
});

// Get user profile by ID
router.get('/:id', getUserFromToken, (req, res) => {
  const db = getDb();
  const userId = req.params.id;

  // Get user basic info
  db.get(`
    SELECT id, username, full_name, bio, avatar_url, location, timezone, created_at
    FROM users WHERE id = ?
  `, [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's teaching skills
    db.all(`
      SELECT s.id, s.name, s.category, s.description, uts.proficiency_level, uts.experience_years
      FROM user_teach_skills uts
      JOIN skills s ON uts.skill_id = s.id
      WHERE uts.user_id = ?
    `, [userId], (err, teachSkills) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      // Get user's learning skills
      db.all(`
        SELECT s.id, s.name, s.category, s.description, uls.priority_level
        FROM user_learn_skills uls
        JOIN skills s ON uls.skill_id = s.id
        WHERE uls.user_id = ?
      `, [userId], (err, learnSkills) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        // Get average rating
        db.get(`
          SELECT AVG(rating) as avg_rating, COUNT(*) as total_ratings
          FROM ratings WHERE rated_user_id = ?
        `, [userId], (err, ratingData) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          res.json({
            user: {
              ...user,
              teachSkills,
              learnSkills,
              rating: ratingData.avg_rating || 0,
              totalRatings: ratingData.total_ratings || 0
            }
          });
        });
      });
    });
  });
});

// Update user profile
router.put('/:id', [
  getUserFromToken,
  body('fullName').optional().isLength({ min: 1 }).withMessage('Full name cannot be empty'),
  body('bio').optional().isLength({ max: 500 }).withMessage('Bio must be less than 500 characters'),
  body('location').optional().isLength({ max: 100 }).withMessage('Location must be less than 100 characters'),
  body('timezone').optional().isLength({ max: 50 }).withMessage('Timezone must be less than 50 characters')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const userId = req.params.id;
  if (parseInt(userId) !== req.user.id) {
    return res.status(403).json({ error: 'Can only update your own profile' });
  }

  const { fullName, bio, location, timezone } = req.body;
  const db = getDb();

  const updateFields = [];
  const params = [];

  if (fullName !== undefined) {
    updateFields.push('full_name = ?');
    params.push(fullName);
  }
  if (bio !== undefined) {
    updateFields.push('bio = ?');
    params.push(bio);
  }
  if (location !== undefined) {
    updateFields.push('location = ?');
    params.push(location);
  }
  if (timezone !== undefined) {
    updateFields.push('timezone = ?');
    params.push(timezone);
  }

  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  params.push(userId);

  const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;

  db.run(query, params, function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Profile updated successfully' });
  });
});

// Add teaching skill
router.post('/:id/teach-skills', [
  getUserFromToken,
  body('skillId').isInt().withMessage('Valid skill ID required'),
  body('proficiencyLevel').optional().isIn(['beginner', 'intermediate', 'advanced', 'expert']).withMessage('Invalid proficiency level'),
  body('experienceYears').optional().isInt({ min: 0, max: 50 }).withMessage('Experience years must be between 0 and 50')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const userId = req.params.id;
  if (parseInt(userId) !== req.user.id) {
    return res.status(403).json({ error: 'Can only update your own skills' });
  }

  const { skillId, proficiencyLevel = 'intermediate', experienceYears = 1 } = req.body;
  const db = getDb();

  db.run(`
    INSERT OR REPLACE INTO user_teach_skills (user_id, skill_id, proficiency_level, experience_years)
    VALUES (?, ?, ?, ?)
  `, [userId, skillId, proficiencyLevel, experienceYears], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to add teaching skill' });
    }

    res.json({ message: 'Teaching skill added successfully' });
  });
});

// Remove teaching skill
router.delete('/:id/teach-skills/:skillId', getUserFromToken, (req, res) => {
  const userId = req.params.id;
  const skillId = req.params.skillId;

  if (parseInt(userId) !== req.user.id) {
    return res.status(403).json({ error: 'Can only remove your own skills' });
  }

  const db = getDb();

  db.run('DELETE FROM user_teach_skills WHERE user_id = ? AND skill_id = ?', [userId, skillId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to remove teaching skill' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Teaching skill not found' });
    }

    res.json({ message: 'Teaching skill removed successfully' });
  });
});

// Add learning skill
router.post('/:id/learn-skills', [
  getUserFromToken,
  body('skillId').isInt().withMessage('Valid skill ID required'),
  body('priorityLevel').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority level')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const userId = req.params.id;
  if (parseInt(userId) !== req.user.id) {
    return res.status(403).json({ error: 'Can only update your own skills' });
  }

  const { skillId, priorityLevel = 'medium' } = req.body;
  const db = getDb();

  db.run(`
    INSERT OR REPLACE INTO user_learn_skills (user_id, skill_id, priority_level)
    VALUES (?, ?, ?)
  `, [userId, skillId, priorityLevel], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to add learning skill' });
    }

    res.json({ message: 'Learning skill added successfully' });
  });
});

// Remove learning skill
router.delete('/:id/learn-skills/:skillId', getUserFromToken, (req, res) => {
  const userId = req.params.id;
  const skillId = req.params.skillId;

  if (parseInt(userId) !== req.user.id) {
    return res.status(403).json({ error: 'Can only remove your own skills' });
  }

  const db = getDb();

  db.run('DELETE FROM user_learn_skills WHERE user_id = ? AND skill_id = ?', [userId, skillId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to remove learning skill' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Learning skill not found' });
    }

    res.json({ message: 'Learning skill removed successfully' });
  });
});

// Get available skills
router.get('/skills/available', (req, res) => {
  const db = getDb();
  const { category } = req.query;

  let query = 'SELECT * FROM skills';
  let params = [];

  if (category) {
    query += ' WHERE category = ?';
    params.push(category);
  }

  query += ' ORDER BY category, name';

  db.all(query, params, (err, skills) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ skills });
  });
});

module.exports = router; 