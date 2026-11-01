import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

test('legacy SQLite schema migrates session refresh columns before index creation', () => {
  const temp = mkdtempSync(join(tmpdir(), 'riftbound-legacy-migration-'));
  const databasePath = join(temp, 'legacy.sqlite');
  try {
    const legacy = new Database(databasePath);
    legacy.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, created_at TEXT NOT NULL);
      INSERT INTO users VALUES ('u1','legacy-user','hash','2026-01-01T00:00:00.000Z');
      INSERT INTO sessions VALUES ('access-hash','u1',4102444800000,'2026-01-01T00:00:00.000Z');
    `);
    legacy.close();

    const script = `import('./db.js').then(({db})=>{const cols=db.pragma('table_info(sessions)').map(c=>c.name);const indexes=db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='sessions_refresh_hash_idx'").all();const row=db.prepare('SELECT token_hash,client_type FROM sessions WHERE token_hash=?').get('access-hash');if(!cols.includes('refresh_hash')||!cols.includes('refresh_expires_at')||!cols.includes('device_name')||!cols.includes('client_type'))process.exit(2);if(indexes.length!==1||row?.token_hash!=='access-hash'||row?.client_type!=='web')process.exit(3);db.close();}).catch(e=>{console.error(e);process.exit(1)});`;
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: repoRoot,
      env: { ...process.env, DB_PATH: databasePath },
      encoding: 'utf8',
    });
    assert.equal(child.status, 0, `${child.stdout}\n${child.stderr}`);

    const migrated = new Database(databasePath, { readonly: true });
    const session = migrated.prepare('SELECT token_hash,client_type,refresh_hash FROM sessions WHERE token_hash=?').get('access-hash');
    assert.deepEqual(session, { token_hash: 'access-hash', client_type: 'web', refresh_hash: null });
    migrated.close();
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
