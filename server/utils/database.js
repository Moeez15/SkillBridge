const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'skillbridge.db');
const db = new sqlite3.Database(dbPath);

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          full_name TEXT NOT NULL,
          bio TEXT,
          avatar_url TEXT,
          location TEXT,
          timezone TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Skills table
      db.run(`
        CREATE TABLE IF NOT EXISTS skills (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          category TEXT NOT NULL,
          description TEXT
        )
      `);

      // User skills table (what users can teach)
      db.run(`
        CREATE TABLE IF NOT EXISTS user_teach_skills (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          skill_id INTEGER NOT NULL,
          proficiency_level TEXT DEFAULT 'intermediate',
          experience_years INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          FOREIGN KEY (skill_id) REFERENCES skills (id) ON DELETE CASCADE,
          UNIQUE(user_id, skill_id)
        )
      `);

      // User learning skills table (what users want to learn)
      db.run(`
        CREATE TABLE IF NOT EXISTS user_learn_skills (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          skill_id INTEGER NOT NULL,
          priority_level TEXT DEFAULT 'medium',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          FOREIGN KEY (skill_id) REFERENCES skills (id) ON DELETE CASCADE,
          UNIQUE(user_id, skill_id)
        )
      `);

      // Matches table
      db.run(`
        CREATE TABLE IF NOT EXISTS matches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user1_id INTEGER NOT NULL,
          user2_id INTEGER NOT NULL,
          match_score REAL DEFAULT 0,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user1_id) REFERENCES users (id) ON DELETE CASCADE,
          FOREIGN KEY (user2_id) REFERENCES users (id) ON DELETE CASCADE,
          UNIQUE(user1_id, user2_id)
        )
      `);

      // Messages table
      db.run(`
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sender_id INTEGER NOT NULL,
          recipient_id INTEGER NOT NULL,
          content TEXT NOT NULL,
          is_read BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE,
          FOREIGN KEY (recipient_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Ratings table
      db.run(`
        CREATE TABLE IF NOT EXISTS ratings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          rater_id INTEGER NOT NULL,
          rated_user_id INTEGER NOT NULL,
          skill_id INTEGER NOT NULL,
          rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
          review TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (rater_id) REFERENCES users (id) ON DELETE CASCADE,
          FOREIGN KEY (rated_user_id) REFERENCES users (id) ON DELETE CASCADE,
          FOREIGN KEY (skill_id) REFERENCES skills (id) ON DELETE CASCADE,
          UNIQUE(rater_id, rated_user_id, skill_id)
        )
      `);

      // Insert default skills
      const defaultSkills = [
        // Programming Languages
        { name: 'Python', category: 'Programming', description: 'General-purpose programming language' },
        { name: 'JavaScript', category: 'Programming', description: 'Web development language' },
        { name: 'Java', category: 'Programming', description: 'Object-oriented programming language' },
        { name: 'C++', category: 'Programming', description: 'System programming language' },
        { name: 'SQL', category: 'Programming', description: 'Database query language' },
        { name: 'React', category: 'Programming', description: 'Frontend JavaScript library' },
        { name: 'Node.js', category: 'Programming', description: 'Backend JavaScript runtime' },
        
        // Languages
        { name: 'English', category: 'Language', description: 'English language' },
        { name: 'Spanish', category: 'Language', description: 'Spanish language' },
        { name: 'French', category: 'Language', description: 'French language' },
        { name: 'German', category: 'Language', description: 'German language' },
        { name: 'Mandarin', category: 'Language', description: 'Mandarin Chinese' },
        
        // Creative Skills
        { name: 'Photography', category: 'Creative', description: 'Digital and film photography' },
        { name: 'Graphic Design', category: 'Creative', description: 'Visual design and branding' },
        { name: 'Video Editing', category: 'Creative', description: 'Video production and editing' },
        { name: 'Drawing', category: 'Creative', description: 'Art and illustration' },
        
        // Business Skills
        { name: 'Marketing', category: 'Business', description: 'Digital and traditional marketing' },
        { name: 'Project Management', category: 'Business', description: 'Project planning and execution' },
        { name: 'Public Speaking', category: 'Business', description: 'Presentation and communication' },
        { name: 'Sales', category: 'Business', description: 'Sales techniques and strategies' },
        
        // Music
        { name: 'Guitar', category: 'Music', description: 'Acoustic and electric guitar' },
        { name: 'Piano', category: 'Music', description: 'Piano and keyboard' },
        { name: 'Singing', category: 'Music', description: 'Vocal training and performance' },
        
        // Sports & Fitness
        { name: 'Yoga', category: 'Fitness', description: 'Yoga and meditation' },
        { name: 'Weight Training', category: 'Fitness', description: 'Strength training and fitness' },
        { name: 'Running', category: 'Fitness', description: 'Running and endurance training' },
        
        // Cooking
        { name: 'Cooking', category: 'Culinary', description: 'General cooking and recipes' },
        { name: 'Baking', category: 'Culinary', description: 'Baking and pastry making' },
        { name: 'Wine Tasting', category: 'Culinary', description: 'Wine appreciation and tasting' }
      ];

      const insertSkill = db.prepare('INSERT OR IGNORE INTO skills (name, category, description) VALUES (?, ?, ?)');
      defaultSkills.forEach(skill => {
        insertSkill.run(skill.name, skill.category, skill.description);
      });
      insertSkill.finalize();

      console.log('Database tables created successfully');
      resolve();
    });
  });
}

function getDb() {
  return db;
}

function closeDatabase() {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

module.exports = {
  initializeDatabase,
  getDb,
  closeDatabase
}; 