const express = require('express');
const { getUserFromToken } = require('../middleware/auth');
const { getDb } = require('../utils/database');

const router = express.Router();

// Get user matches
router.get('/', getUserFromToken, (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  const { limit = 10, offset = 0 } = req.query;

  // Complex query to find users with complementary skills
  const query = `
    WITH user_teach_skills AS (
      SELECT skill_id FROM user_teach_skills WHERE user_id = ?
    ),
    user_learn_skills AS (
      SELECT skill_id FROM user_learn_skills WHERE user_id = ?
    ),
    potential_matches AS (
      SELECT DISTINCT
        u.id,
        u.username,
        u.full_name,
        u.bio,
        u.avatar_url,
        u.location,
        u.created_at,
        COUNT(DISTINCT CASE WHEN uts.skill_id IN (SELECT skill_id FROM user_learn_skills) THEN uts.skill_id END) as teach_match_count,
        COUNT(DISTINCT CASE WHEN uls.skill_id IN (SELECT skill_id FROM user_teach_skills) THEN uls.skill_id END) as learn_match_count,
        (
          COUNT(DISTINCT CASE WHEN uts.skill_id IN (SELECT skill_id FROM user_learn_skills) THEN uts.skill_id END) +
          COUNT(DISTINCT CASE WHEN uls.skill_id IN (SELECT skill_id FROM user_teach_skills) THEN uls.skill_id END)
        ) as total_match_score
      FROM users u
      LEFT JOIN user_teach_skills uts ON u.id = uts.user_id
      LEFT JOIN user_learn_skills uls ON u.id = uls.user_id
      WHERE u.id != ?
      GROUP BY u.id, u.username, u.full_name, u.bio, u.avatar_url, u.location, u.created_at
      HAVING total_match_score > 0
    )
    SELECT 
      pm.*,
      COALESCE(avg_rating.avg_rating, 0) as avg_rating,
      COALESCE(avg_rating.total_ratings, 0) as total_ratings
    FROM potential_matches pm
    LEFT JOIN (
      SELECT 
        rated_user_id,
        AVG(rating) as avg_rating,
        COUNT(*) as total_ratings
      FROM ratings 
      GROUP BY rated_user_id
    ) avg_rating ON pm.id = avg_rating.rated_user_id
    ORDER BY total_match_score DESC, avg_rating DESC
    LIMIT ? OFFSET ?
  `;

  db.all(query, [userId, userId, userId, parseInt(limit), parseInt(offset)], (err, matches) => {
    if (err) {
      console.error('Match query error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    // Get detailed skill information for each match
    const matchesWithSkills = matches.map(match => {
      return new Promise((resolve) => {
        // Get what this user can teach (that current user wants to learn)
        db.all(`
          SELECT s.id, s.name, s.category, s.description, uts.proficiency_level, uts.experience_years
          FROM user_teach_skills uts
          JOIN skills s ON uts.skill_id = s.id
          WHERE uts.user_id = ? AND uts.skill_id IN (SELECT skill_id FROM user_learn_skills WHERE user_id = ?)
        `, [match.id, userId], (err, teachSkills) => {
          if (err) {
            resolve({ ...match, teachSkills: [], learnSkills: [] });
            return;
          }

          // Get what this user wants to learn (that current user can teach)
          db.all(`
            SELECT s.id, s.name, s.category, s.description, uls.priority_level
            FROM user_learn_skills uls
            JOIN skills s ON uls.skill_id = s.id
            WHERE uls.user_id = ? AND uls.skill_id IN (SELECT skill_id FROM user_teach_skills WHERE user_id = ?)
          `, [match.id, userId], (err, learnSkills) => {
            if (err) {
              resolve({ ...match, teachSkills, learnSkills: [] });
              return;
            }

            resolve({
              ...match,
              teachSkills,
              learnSkills
            });
          });
        });
      });
    });

    Promise.all(matchesWithSkills).then(results => {
      res.json({ matches: results });
    });
  });
});

// Create a match (when user accepts a match)
router.post('/', getUserFromToken, (req, res) => {
  const db = getDb();
  const { targetUserId } = req.body;
  const userId = req.user.id;

  if (!targetUserId) {
    return res.status(400).json({ error: 'Target user ID is required' });
  }

  if (parseInt(targetUserId) === userId) {
    return res.status(400).json({ error: 'Cannot match with yourself' });
  }

  // Check if match already exists
  db.get(`
    SELECT * FROM matches 
    WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
  `, [userId, targetUserId, targetUserId, userId], (err, existingMatch) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (existingMatch) {
      return res.status(400).json({ error: 'Match already exists' });
    }

    // Calculate match score
    db.get(`
      WITH user_teach_skills AS (
        SELECT skill_id FROM user_teach_skills WHERE user_id = ?
      ),
      user_learn_skills AS (
        SELECT skill_id FROM user_learn_skills WHERE user_id = ?
      )
      SELECT 
        COUNT(DISTINCT CASE WHEN uts.skill_id IN (SELECT skill_id FROM user_learn_skills) THEN uts.skill_id END) +
        COUNT(DISTINCT CASE WHEN uls.skill_id IN (SELECT skill_id FROM user_teach_skills) THEN uls.skill_id END) as match_score
      FROM user_teach_skills uts
      FULL OUTER JOIN user_learn_skills uls ON 1=1
      WHERE uts.user_id = ? OR uls.user_id = ?
    `, [userId, userId, targetUserId, targetUserId], (err, scoreResult) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to calculate match score' });
      }

      const matchScore = scoreResult ? scoreResult.match_score : 0;

      // Create the match
      db.run(`
        INSERT INTO matches (user1_id, user2_id, match_score, status)
        VALUES (?, ?, ?, 'active')
      `, [userId, targetUserId, matchScore], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to create match' });
        }

        res.status(201).json({ 
          message: 'Match created successfully',
          matchId: this.lastID,
          matchScore
        });
      });
    });
  });
});

// Get user's active matches
router.get('/active', getUserFromToken, (req, res) => {
  const db = getDb();
  const userId = req.user.id;

  db.all(`
    SELECT 
      m.id as match_id,
      m.match_score,
      m.created_at as matched_at,
      u.id,
      u.username,
      u.full_name,
      u.bio,
      u.avatar_url,
      u.location
    FROM matches m
    JOIN users u ON (m.user1_id = u.id OR m.user2_id = u.id)
    WHERE (m.user1_id = ? OR m.user2_id = ?) 
    AND m.status = 'active'
    AND u.id != ?
    ORDER BY m.created_at DESC
  `, [userId, userId, userId], (err, matches) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    res.json({ matches });
  });
});

// Update match status
router.put('/:matchId', getUserFromToken, (req, res) => {
  const db = getDb();
  const { matchId } = req.params;
  const { status } = req.body;
  const userId = req.user.id;

  if (!['active', 'paused', 'ended'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  db.run(`
    UPDATE matches 
    SET status = ? 
    WHERE id = ? AND (user1_id = ? OR user2_id = ?)
  `, [status, matchId, userId, userId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to update match' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    res.json({ message: 'Match status updated successfully' });
  });
});

// Get match suggestions (users with high potential match scores)
router.get('/suggestions', getUserFromToken, (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  const { limit = 5 } = req.query;

  // Similar to matches but with higher threshold and different ordering
  const query = `
    WITH user_teach_skills AS (
      SELECT skill_id FROM user_teach_skills WHERE user_id = ?
    ),
    user_learn_skills AS (
      SELECT skill_id FROM user_learn_skills WHERE user_id = ?
    ),
    potential_suggestions AS (
      SELECT DISTINCT
        u.id,
        u.username,
        u.full_name,
        u.bio,
        u.avatar_url,
        u.location,
        u.created_at,
        COUNT(DISTINCT CASE WHEN uts.skill_id IN (SELECT skill_id FROM user_learn_skills) THEN uts.skill_id END) as teach_match_count,
        COUNT(DISTINCT CASE WHEN uls.skill_id IN (SELECT skill_id FROM user_teach_skills) THEN uls.skill_id END) as learn_match_count,
        (
          COUNT(DISTINCT CASE WHEN uts.skill_id IN (SELECT skill_id FROM user_learn_skills) THEN uts.skill_id END) +
          COUNT(DISTINCT CASE WHEN uls.skill_id IN (SELECT skill_id FROM user_teach_skills) THEN uls.skill_id END)
        ) as total_match_score
      FROM users u
      LEFT JOIN user_teach_skills uts ON u.id = uts.user_id
      LEFT JOIN user_learn_skills uls ON u.id = uls.user_id
      WHERE u.id != ?
      GROUP BY u.id, u.username, u.full_name, u.bio, u.avatar_url, u.location, u.created_at
      HAVING total_match_score >= 2
    )
    SELECT 
      ps.*,
      COALESCE(avg_rating.avg_rating, 0) as avg_rating,
      COALESCE(avg_rating.total_ratings, 0) as total_ratings
    FROM potential_suggestions ps
    LEFT JOIN (
      SELECT 
        rated_user_id,
        AVG(rating) as avg_rating,
        COUNT(*) as total_ratings
      FROM ratings 
      GROUP BY rated_user_id
    ) avg_rating ON ps.id = avg_rating.rated_user_id
    ORDER BY total_match_score DESC, avg_rating DESC, ps.created_at DESC
    LIMIT ?
  `;

  db.all(query, [userId, userId, userId, parseInt(limit)], (err, suggestions) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    res.json({ suggestions });
  });
});

module.exports = router; 