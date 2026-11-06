const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3000;

const WORLD = { width: 900, height: 560 };
const CENTER = { x: WORLD.width / 2, y: WORLD.height / 2 };
const BAR_HALF_LENGTH = 205;
const BAR_WIDTH = 10;
const PLAYER_RADIUS = 16;
const MOVE_SPEED = 205;
const TICK_MS = 1000 / 30;
const LOBBY_SECONDS = 10;
const INTERMISSION_SECONDS = 7;
const MAX_ROUND_SECONDS = 90;

let players = new Map();
let round = {
  phase: 'waiting', // waiting, countdown, running, intermission
  number: 0,
  angle: 0,
  elapsed: 0,
  countdown: 0,
  intermission: 0,
  lastTick: Date.now()
};

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, game: 'LOKAS' }));

function safeName(value) {
  const name = String(value || 'Oyuncu').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 14);
  return name || 'Oyuncu';
}

function spawnPoint() {
  const margin = 58;
  const sides = [
    { x: margin + Math.random() * 120, y: margin + Math.random() * (WORLD.height - margin * 2) },
    { x: WORLD.width - margin - Math.random() * 120, y: margin + Math.random() * (WORLD.height - margin * 2) },
    { x: margin + Math.random() * (WORLD.width - margin * 2), y: margin + Math.random() * 75 },
    { x: margin + Math.random() * (WORLD.width - margin * 2), y: WORLD.height - margin - Math.random() * 75 }
  ];
  return sides[Math.floor(Math.random() * sides.length)];
}

function resetPlayer(p) {
  const pos = spawnPoint();
  p.x = pos.x;
  p.y = pos.y;
  p.alive = true;
  p.score = 0;
  p.input = { x: 0, y: 0 };
}

function startCountdown() {
  if (round.phase !== 'waiting') return;
  round.phase = 'countdown';
  round.countdown = LOBBY_SECONDS;
  round.lastTick = Date.now();
}

function startRound() {
  round.phase = 'running';
  round.number += 1;
  round.elapsed = 0;
  round.angle = Math.random() * Math.PI * 2;
  for (const p of players.values()) resetPlayer(p);
}

function finishRound() {
  round.phase = 'intermission';
  round.intermission = INTERMISSION_SECONDS;
  for (const p of players.values()) p.input = { x: 0, y: 0 };
}

function pointSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
  const sx = x1 + t * dx;
  const sy = y1 + t * dy;
  return Math.hypot(px - sx, py - sy);
}

function publicState() {
  const list = [...players.values()].map(p => ({
    id: p.id,
    name: p.name,
    x: p.x,
    y: p.y,
    alive: p.alive,
    score: p.score,
    color: p.color
  }));
  return {
    phase: round.phase,
    number: round.number,
    angle: round.angle,
    elapsed: round.elapsed,
    countdown: Math.ceil(round.countdown),
    intermission: Math.ceil(round.intermission),
    players: list,
    aliveCount: list.filter(p => p.alive).length,
    playerCount: list.length,
    world: WORLD,
    barHalfLength: BAR_HALF_LENGTH
  };
}

io.on('connection', socket => {
  socket.on('join-game', rawName => {
    if (players.has(socket.id)) return;
    const colors = ['#ffd166', '#7bdff2', '#f7aef8', '#b8f2a1', '#ff9f9f', '#c4b5fd', '#f6bd60'];
    const p = { id: socket.id, name: safeName(rawName), x: 0, y: 0, alive: false, score: 0, input: { x: 0, y: 0 }, color: colors[Math.floor(Math.random() * colors.length)] };
    resetPlayer(p);
    if (round.phase === 'running') p.alive = true;
    players.set(socket.id, p);
    if (round.phase === 'waiting') startCountdown();
    socket.emit('joined', { id: socket.id });
    io.emit('game-state', publicState());
  });

  socket.on('input', input => {
    const p = players.get(socket.id);
    if (!p || !p.alive || round.phase !== 'running') return;
    let x = Number(input && input.x) || 0;
    let y = Number(input && input.y) || 0;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    p.input = { x, y };
  });

  socket.on('disconnect', () => {
    players.delete(socket.id);
    if (players.size === 0 && round.phase !== 'running') {
      round.phase = 'waiting';
      round.countdown = 0;
      round.intermission = 0;
    }
    io.emit('game-state', publicState());
  });
});

setInterval(() => {
  const now = Date.now();
  const dt = Math.min(0.06, Math.max(0.001, (now - round.lastTick) / 1000));
  round.lastTick = now;

  if (round.phase === 'countdown') {
    round.countdown -= dt;
    if (round.countdown <= 0) startRound();
  } else if (round.phase === 'running') {
    round.elapsed += dt;
    const level = Math.floor(round.elapsed / 10);
    const angularSpeed = 1.45 + level * 0.38;
    round.angle += angularSpeed * dt;

    const cos = Math.cos(round.angle);
    const sin = Math.sin(round.angle);
    const x1 = CENTER.x - cos * BAR_HALF_LENGTH;
    const y1 = CENTER.y - sin * BAR_HALF_LENGTH;
    const x2 = CENTER.x + cos * BAR_HALF_LENGTH;
    const y2 = CENTER.y + sin * BAR_HALF_LENGTH;

    for (const p of players.values()) {
      if (!p.alive) continue;
      p.x += p.input.x * MOVE_SPEED * dt;
      p.y += p.input.y * MOVE_SPEED * dt;
      p.x = Math.max(PLAYER_RADIUS + 8, Math.min(WORLD.width - PLAYER_RADIUS - 8, p.x));
      p.y = Math.max(PLAYER_RADIUS + 8, Math.min(WORLD.height - PLAYER_RADIUS - 8, p.y));
      p.score = Math.floor(round.elapsed);
      if (pointSegmentDistance(p.x, p.y, x1, y1, x2, y2) < PLAYER_RADIUS + BAR_WIDTH / 2) {
        p.alive = false;
        p.input = { x: 0, y: 0 };
      }
    }

    const activePlayers = [...players.values()].filter(p => p.alive).length;
    if ((players.size > 0 && activePlayers === 0) || round.elapsed >= MAX_ROUND_SECONDS) finishRound();
  } else if (round.phase === 'intermission') {
    round.intermission -= dt;
    if (round.intermission <= 0) {
      if (players.size > 0) startRound();
      else round.phase = 'waiting';
    }
  }

  io.emit('game-state', publicState());
}, TICK_MS);

server.listen(PORT, () => {
  console.log(`LOKAS server running at http://localhost:${PORT}`);
});
