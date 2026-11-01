import Database from 'better-sqlite3';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
export const db = new Database(process.env.DB_PATH || join(root, 'data', 'card-quest.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  refresh_hash TEXT,
  refresh_expires_at INTEGER,
  device_name TEXT,
  client_type TEXT NOT NULL DEFAULT 'web'
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS avatars (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  gold INTEGER NOT NULL DEFAULT 0,
  hp INTEGER NOT NULL,
  max_hp INTEGER NOT NULL,
  stamina INTEGER NOT NULL,
  max_stamina INTEGER NOT NULL,
  attack INTEGER NOT NULL,
  defense INTEGER NOT NULL,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  inventory TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS avatars_owner_idx ON avatars(user_id);
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  public_token TEXT NOT NULL UNIQUE,
  claim_hash TEXT NOT NULL UNIQUE,
  claim_expires_at INTEGER NOT NULL,
  claim_attempts INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK(status IN ('issued','claimed','revoked')),
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  avatar_id TEXT UNIQUE REFERENCES avatars(id) ON DELETE SET NULL,
  batch_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  claimed_at TEXT,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS cards_owner_idx ON cards(owner_id);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  avatar_id TEXT NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  meta TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_avatar_idx ON events(avatar_id, created_at DESC);
CREATE TABLE IF NOT EXISTS game_actions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  avatar_id TEXT NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  action TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS encounters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  avatar_id TEXT NOT NULL REFERENCES avatars(id) ON DELETE CASCADE,
  enemy_id TEXT NOT NULL,
  enemy_hp INTEGER NOT NULL,
  enemy_max_hp INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active','won','lost','expired')),
  next_enemy_attack_at INTEGER NOT NULL,
  last_action_at INTEGER NOT NULL DEFAULT 0,
  skill_ready_at INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS encounters_user_idx ON encounters(user_id,status);
CREATE TABLE IF NOT EXISTS rest_cooldowns (
  avatar_id TEXT PRIMARY KEY REFERENCES avatars(id) ON DELETE CASCADE,
  ready_at INTEGER NOT NULL
);
`);

const sessionColumns = new Set(db.pragma('table_info(sessions)').map(column => column.name));
if (!sessionColumns.has('refresh_hash')) db.exec('ALTER TABLE sessions ADD COLUMN refresh_hash TEXT');
if (!sessionColumns.has('refresh_expires_at')) db.exec('ALTER TABLE sessions ADD COLUMN refresh_expires_at INTEGER');
if (!sessionColumns.has('device_name')) db.exec('ALTER TABLE sessions ADD COLUMN device_name TEXT');
if (!sessionColumns.has('client_type')) db.exec("ALTER TABLE sessions ADD COLUMN client_type TEXT NOT NULL DEFAULT 'web'");
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS sessions_refresh_hash_idx ON sessions(refresh_hash) WHERE refresh_hash IS NOT NULL');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS sessions_refresh_hash_idx ON sessions(refresh_hash) WHERE refresh_hash IS NOT NULL');
const cardColumns = new Set(db.pragma('table_info(cards)').map(column => column.name));
if (!cardColumns.has('claim_hash')) db.exec('ALTER TABLE cards ADD COLUMN claim_hash TEXT');
if (!cardColumns.has('claim_expires_at')) db.exec('ALTER TABLE cards ADD COLUMN claim_expires_at INTEGER NOT NULL DEFAULT 4102444800000');
if (!cardColumns.has('claim_attempts')) db.exec('ALTER TABLE cards ADD COLUMN claim_attempts INTEGER NOT NULL DEFAULT 0');
if (!cardColumns.has('owner_id')) db.exec('ALTER TABLE cards ADD COLUMN owner_id TEXT REFERENCES users(id) ON DELETE SET NULL');
if (!cardColumns.has('avatar_id')) db.exec('ALTER TABLE cards ADD COLUMN avatar_id TEXT UNIQUE REFERENCES avatars(id) ON DELETE SET NULL');
if (!cardColumns.has('claimed_at')) db.exec('ALTER TABLE cards ADD COLUMN claimed_at TEXT');
if (!cardColumns.has('revoked_at')) db.exec('ALTER TABLE cards ADD COLUMN revoked_at TEXT');
const encounterColumns = new Set(db.pragma('table_info(encounters)').map(column => column.name));
if (!encounterColumns.has('last_action_at')) db.exec('ALTER TABLE encounters ADD COLUMN last_action_at INTEGER NOT NULL DEFAULT 0');
if (!encounterColumns.has('skill_ready_at')) db.exec('ALTER TABLE encounters ADD COLUMN skill_ready_at INTEGER NOT NULL DEFAULT 0');

export const statements = {
  userByName: db.prepare('SELECT * FROM users WHERE username = ?'),
  userById: db.prepare('SELECT * FROM users WHERE id = ?'),
  insertUser: db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (@id,@username,@passwordHash,@createdAt)'),
  sessionUser: db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?'),
  sessionByAccessHash: db.prepare('SELECT * FROM sessions WHERE token_hash=? AND expires_at>?'),
  sessionByRefreshHash: db.prepare('SELECT * FROM sessions WHERE refresh_hash=? AND refresh_expires_at>?'),
  insertSession: db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at,created_at,refresh_hash,refresh_expires_at,device_name,client_type) VALUES (?,?,?,?,?,?,?,?)'),
  insertWebSession: db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at,created_at,client_type) VALUES (?,?,?,?,?)'),
  rotateSession: db.prepare('UPDATE sessions SET token_hash=?,expires_at=?,refresh_hash=?,refresh_expires_at=? WHERE token_hash=? AND refresh_hash=?'),
  sessionInfoByHash: db.prepare('SELECT token_hash,refresh_hash FROM sessions WHERE token_hash=? AND user_id=?'),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash=?'),
  deleteSessionByRefreshHash: db.prepare('DELETE FROM sessions WHERE refresh_hash=?'),
  sessionsByUser: db.prepare('SELECT token_hash,expires_at,created_at,device_name,client_type FROM sessions WHERE user_id=? ORDER BY created_at DESC'),
  pruneSessions: db.prepare('DELETE FROM sessions WHERE expires_at<=?'),
  deleteUserSessions: db.prepare('DELETE FROM sessions WHERE user_id=?'),
  insertAvatar: db.prepare(`INSERT INTO avatars (id,user_id,name,role,level,xp,gold,hp,max_hp,stamina,max_stamina,attack,defense,wins,losses,inventory,created_at,updated_at) VALUES (@id,@userId,@name,@role,@level,@xp,@gold,@hp,@maxHp,@stamina,@maxStamina,@attack,@defense,@wins,@losses,@inventory,@createdAt,@updatedAt)`),
  avatarById: db.prepare('SELECT * FROM avatars WHERE id=?'),
  ownedAvatar: db.prepare('SELECT * FROM avatars WHERE id=? AND user_id=?'),
  avatarsByOwner: db.prepare('SELECT * FROM avatars WHERE user_id=? ORDER BY created_at'),
  updateAvatar: db.prepare(`UPDATE avatars SET level=@level,xp=@xp,gold=@gold,hp=@hp,max_hp=@maxHp,stamina=@stamina,max_stamina=@maxStamina,attack=@attack,defense=@defense,wins=@wins,losses=@losses,inventory=@inventory,updated_at=@updatedAt WHERE id=@id`),
  cardByToken: db.prepare('SELECT * FROM cards WHERE public_token=?'),
  cardByClaimHash: db.prepare('SELECT * FROM cards WHERE claim_hash=?'),
  incrementClaimAttempt: db.prepare("UPDATE cards SET claim_attempts=claim_attempts+1 WHERE claim_hash=? AND status='issued'"),
  cardByAvatar: db.prepare("SELECT * FROM cards WHERE avatar_id=? AND status='claimed'"),
  insertCard: db.prepare('INSERT INTO cards (id,public_token,claim_hash,claim_expires_at,status,batch_id,created_at) VALUES (@id,@publicToken,@claimHash,@claimExpiresAt,@status,@batchId,@createdAt)'),
  claimedCard: db.prepare("SELECT id,public_token,owner_id,avatar_id,status,created_at,claimed_at FROM cards WHERE avatar_id=? AND status='claimed'"),
  claimCard: db.prepare("UPDATE cards SET status='claimed',owner_id=?,avatar_id=?,claimed_at=? WHERE id=? AND status='issued' AND claim_hash=? AND claim_expires_at>?"),
  revokeCard: db.prepare("UPDATE cards SET status='revoked',revoked_at=?,owner_id=NULL,avatar_id=NULL WHERE id=? AND owner_id=? AND status='claimed'"),
  transferCard: db.prepare("UPDATE cards SET owner_id=?,avatar_id=?,claimed_at=? WHERE id=? AND owner_id=? AND status='claimed'"),
  ownedCards: db.prepare('SELECT id,public_token,status,avatar_id,batch_id,created_at,claimed_at FROM cards WHERE owner_id=? ORDER BY created_at DESC'),
  allCardsWithDetails: db.prepare(`SELECT c.id, c.public_token, c.status, c.batch_id, c.created_at, c.claimed_at, u.username AS owner_username, a.name AS avatar_name, a.role AS avatar_role, a.level AS avatar_level, a.hp AS avatar_hp, a.max_hp AS avatar_max_hp, a.wins AS avatar_wins, a.gold AS avatar_gold FROM cards c LEFT JOIN users u ON u.id = c.owner_id LEFT JOIN avatars a ON a.id = c.avatar_id ORDER BY c.created_at DESC`),
  cardStats: db.prepare(`SELECT COUNT(*) AS total_cards, SUM(CASE WHEN status = 'claimed' THEN 1 ELSE 0 END) AS total_claimed, SUM(CASE WHEN status = 'issued' THEN 1 ELSE 0 END) AS total_issued, SUM(CASE WHEN status = 'revoked' THEN 1 ELSE 0 END) AS total_revoked FROM cards`),
  insertEvent: db.prepare('INSERT INTO events (id,avatar_id,kind,message,meta,created_at) VALUES (?,?,?,?,?,?)'),
  eventsByOwner: db.prepare('SELECT e.* FROM events e JOIN avatars a ON a.id=e.avatar_id WHERE a.user_id=? ORDER BY e.created_at DESC LIMIT 50'),
  insertAction: db.prepare('INSERT INTO game_actions (id,user_id,avatar_id,idempotency_key,action,response,created_at) VALUES (?,?,?,?,?,?,?)'),
  findAction: db.prepare('SELECT response FROM game_actions WHERE user_id=? AND idempotency_key=?'),
  recentAction: db.prepare('SELECT created_at FROM game_actions WHERE avatar_id=? ORDER BY created_at DESC LIMIT 1'),
  cardCount: db.prepare('SELECT COUNT(*) AS count FROM cards'),
  activeEncounter: db.prepare("SELECT * FROM encounters WHERE avatar_id=? AND user_id=? AND status='active'"),
  encounterById: db.prepare('SELECT * FROM encounters WHERE id=? AND user_id=?'),
  insertEncounter: db.prepare('INSERT INTO encounters (id,user_id,avatar_id,enemy_id,enemy_hp,enemy_max_hp,status,next_enemy_attack_at,created_at,updated_at) VALUES (@id,@userId,@avatarId,@enemyId,@enemyHp,@enemyMaxHp,@status,@nextEnemyAttackAt,@createdAt,@updatedAt)'),
  updateEncounter: db.prepare("UPDATE encounters SET enemy_hp=?,status=?,next_enemy_attack_at=?,last_action_at=?,skill_ready_at=?,updated_at=? WHERE id=? AND status='active'")
};

export function resetDatabase() {
  db.exec('DELETE FROM game_actions; DELETE FROM encounters; DELETE FROM events; DELETE FROM cards; DELETE FROM avatars; DELETE FROM sessions; DELETE FROM users;');
}
