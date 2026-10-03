
import express from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import db from './db.js';

const COOKIE = 'sid';
const SESSION_DAYS = 30;

const insertUser = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
const findUserByEmail = db.prepare('SELECT * FROM users WHERE email = ?');
const findUserById = db.prepare('SELECT id, email, created_at FROM users WHERE id = ?');
const insertSession = db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)');
const findSession = db.prepare("SELECT * FROM sessions WHERE id = ? AND expires_at > datetime('now')");
const deleteSession = db.prepare('DELETE FROM sessions WHERE id = ?');

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(
    header.split(';').map((p) => p.trim().split('=')).filter((p) => p[0]),
  );
}

function startSession(res, userId) {
  const id = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  insertSession.run(id, userId, expires.toISOString().replace('T', ' ').slice(0, 19));
  res.cookie(COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DAYS * 864e5,
    path: '/',
  });
}

// 로그인한 사용자를 req.user에 실어 준다. 비로그인은 null.
export function withUser(req, _res, next) {
  req.user = null;
  const sid = parseCookies(req)[COOKIE];
  if (sid) {
    const session = findSession.get(sid);
    if (session) req.user = findUserById.get(session.user_id);
  }
  next();
}

// 보호가 필요한 라우트에 붙인다.
export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '로그인이 필요해요.' });
  next();
}

const router = express.Router();

router.post('/signup', (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: '이메일과 비밀번호를 모두 입력해 주세요.' });
  }
  if (findUserByEmail.get(email)) {
    return res.status(409).json({ error: '이미 가입된 이메일이에요.' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const info = insertUser.run(email, hash);
  startSession(res, info.lastInsertRowid);
  res.status(201).json({ user: { id: info.lastInsertRowid, email } });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: '이메일과 비밀번호를 모두 입력해 주세요.' });
  }
  const user = findUserByEmail.get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않아요.' });
  }
  startSession(res, user.id);
  res.json({ user: { id: user.id, email: user.email } });
});

router.post('/logout', (req, res) => {
  const sid = parseCookies(req)[COOKIE];
  if (sid) deleteSession.run(sid);
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  res.json({ user: req.user });
});

export default router;
