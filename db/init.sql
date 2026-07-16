CREATE TABLE rooms (
  room_code VARCHAR(8) PRIMARY KEY,
  host_id VARCHAR(255) NOT NULL,
  phase VARCHAR(50) DEFAULT 'lobby',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  settings JSONB DEFAULT '{"totalPlayers": 5, "mafiaCount": 1, "discussionSeconds": 120, "discussionUnlimited": false, "votingSeconds": 60, "votingUnlimited": false, "soundEnabled": true}'::jsonb,
  current_round INT DEFAULT 0,
  winner VARCHAR(50),
  discussion_ends_at TIMESTAMP,
  voting_ends_at TIMESTAMP
);

CREATE TABLE players (
  player_id VARCHAR(255) PRIMARY KEY,
  room_code VARCHAR(8) REFERENCES rooms(room_code) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  is_host BOOLEAN DEFAULT FALSE,
  role VARCHAR(50),
  is_alive BOOLEAN DEFAULT TRUE,
  has_voted BOOLEAN DEFAULT FALSE,
  voted_for VARCHAR(255),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE elimination_history (
  id SERIAL PRIMARY KEY,
  room_code VARCHAR(8) REFERENCES rooms(room_code) ON DELETE CASCADE,
  round INT NOT NULL,
  eliminated_player_id VARCHAR(255),
  eliminated_role VARCHAR(50),
  was_tie BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
