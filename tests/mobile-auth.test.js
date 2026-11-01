import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

let proc, base, temp;
async function port() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const value = server.address().port;
      server.close(() => resolve(value));
    });
  });
}
async function call(path, options = {}) {
  const response = await fetch(base + path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch {}
  return { response, data };
}
before(async () => {
  temp = mkdtempSync(join(tmpdir(), 'riftbound-mobile-auth-'));
  const p = await port();
  base = `http://127.0.0.1:${p}`;
  proc = spawn(process.execPath, ['server.js'], {
    cwd: dirname(dirname(fileURLToPath(import.meta.url))),
    env: { ...process.env, PORT: String(p), PUBLIC_BASE_URL: 'https://mobile.test', DB_PATH: join(temp, 'mobile.sqlite'), NODE_ENV: 'production' },
    stdio: 'ignore',
  });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base + '/api/health')).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw Error('isolated test server failed to start');
});
after(async () => {
  if (proc) { proc.kill(); await new Promise(resolve => proc.once('exit', resolve)); }
  if (temp) rmSync(temp, { recursive: true, force: true });
});

test('native registration returns bearer and rotating refresh tokens without Origin', async () => {
  const registration = await call('/api/auth/mobile/register', { method: 'POST', body: JSON.stringify({ username: 'mobile_user', password: 'correct-horse-battery', deviceName: 'Pixel test' }) });
  assert.equal(registration.response.status, 201);
  assert.equal(registration.data.tokenType, 'Bearer');
  assert.ok(registration.data.accessToken);
  assert.ok(registration.data.refreshToken);
  const me = await call('/api/me', { headers: { Authorization: `Bearer ${registration.data.accessToken}` } });
  assert.equal(me.response.status, 200);
  assert.equal(me.data.user.username, 'mobile_user');
  const rotated = await call('/api/auth/mobile/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: registration.data.refreshToken }) });
  assert.equal(rotated.response.status, 200);
  assert.notEqual(rotated.data.refreshToken, registration.data.refreshToken);
  const replay = await call('/api/auth/mobile/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: registration.data.refreshToken }) });
  assert.equal(replay.response.status, 401);
  const me2 = await call('/api/me', { headers: { Authorization: `Bearer ${rotated.data.accessToken}` } });
  assert.equal(me2.response.status, 200);
});

test('web cookie session remains usable alongside native sessions', async () => {
  const web = await call('/api/auth/register', { method: 'POST', headers: { Origin: 'https://mobile.test' }, body: JSON.stringify({ username: 'web_user', password: 'correct-horse-battery' }) });
  assert.equal(web.response.status, 201);
  const cookie = web.response.headers.get('set-cookie').split(';')[0];
  const mobile = await call('/api/auth/mobile/login', { method: 'POST', body: JSON.stringify({ username: 'web_user', password: 'correct-horse-battery', deviceName: 'Android' }) });
  assert.equal(mobile.response.status, 200);
  const oldCookie = await call('/api/me', { headers: { Cookie: cookie } });
  assert.equal(oldCookie.response.status, 200);
  const mobileMe = await call('/api/me', { headers: { Authorization: `Bearer ${mobile.data.accessToken}` } });
  assert.equal(mobileMe.response.status, 200);
});

test('originless native mutation requires valid bearer', async () => {
  const denied = await call('/api/avatars', { method: 'POST', headers: { Authorization: 'Bearer invalid-access-token-value-1234567890' }, body: JSON.stringify({ name: 'No Token', role: 'vanguard' }) });
  assert.equal(denied.response.status, 403);
  const account = await call('/api/auth/mobile/register', { method: 'POST', body: JSON.stringify({ username: 'mobile_mutator', password: 'correct-horse-battery' }) });
  const allowed = await call('/api/avatars', { method: 'POST', headers: { Authorization: `Bearer ${account.data.accessToken}` }, body: JSON.stringify({ name: 'Mobile Guardian', role: 'vanguard' }) });
  assert.equal(allowed.response.status, 201);
});

test('mobile logout revokes only that device refresh token', async () => {
  const a = await call('/api/auth/mobile/register', { method: 'POST', body: JSON.stringify({ username: 'multi_device', password: 'correct-horse-battery', deviceName: 'device one' }) });
  const b = await call('/api/auth/mobile/login', { method: 'POST', body: JSON.stringify({ username: 'multi_device', password: 'correct-horse-battery', deviceName: 'device two' }) });
  assert.equal(a.response.status, 201);
  assert.equal(b.response.status, 200);
  const sessions = await call('/api/auth/mobile/sessions', { headers: { Authorization: `Bearer ${a.data.accessToken}` } });
  assert.equal(sessions.data.sessions.length, 2);
  const logout = await call('/api/auth/mobile/logout', { method: 'POST', headers: { Authorization: `Bearer ${a.data.accessToken}` }, body: JSON.stringify({ refreshToken: a.data.refreshToken }) });
  assert.equal(logout.response.status, 200);
  assert.equal((await call('/api/auth/mobile/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: a.data.refreshToken }) })).response.status, 401);
  assert.equal((await call('/api/me', { headers: { Authorization: `Bearer ${b.data.accessToken}` } })).response.status, 200);
});
