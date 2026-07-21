const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let gameActive = false;
let isPaused = false;

// Game State & House Map Layout
const player = {
  x: 70, y: 380, width: 22, height: 22,
  speed: 2.8, isHidden: false,
  inventory: [] // Holds collected keys/items
};

const parent = {
  x: 650, y: 100, width: 26, height: 26,
  speed: 1.5, alertSpeed: 2.8,
  patrolPath: [{x: 650, y: 100}, {x: 450, y: 100}, {x: 450, y: 240}, {x: 650, y: 240}],
  pathIndex: 0,
  visionRange: 140,
  isAlerted: false,
  alertX: 0, alertY: 0
};

// Rooms and Walls (House Floor Plan)
const walls = [
  // Outer Border
  {x: 0, y: 0, w: 800, h: 10}, {x: 0, y: 440, w: 800, h: 10},
  {x: 0, y: 0, w: 10, h: 450}, {x: 790, y: 0, w: 10, h: 450},
  // Internal Dividers
  {x: 250, y: 0, w: 10, h: 280},  // Bedroom Wall
  {x: 0, y: 280, w: 380, h: 10},  // Hallway Wall
  {x: 520, y: 180, w: 10, h: 270}  // Living Room Wall
];

// Interactive Game Objects
const items = [
  { id: 'desk_key', x: 120, y: 80, w: 18, h: 18, label: 'Room Key', collected: false, color: '#facc15' },
  { id: 'exit_key', x: 720, y: 380, w: 18, h: 18, label: 'Front Key', collected: false, color: '#38bdf8' }
];

const hideouts = [
  { x: 40, y: 40, w: 50, h: 40, label: 'Bed (Hide)' },
  { x: 300, y: 50, w: 40, h: 60, label: 'Closet (Hide)' }
];

const doors = [
  { id: 'bedroom_door', x: 250, y: 280, w: 70, h: 10, locked: true, keyNeeded: 'Room Key', color: '#ef4444' },
  { id: 'exit_door', x: 790, y: 200, w: 10, h: 80, locked: true, keyNeeded: 'Front Key', color: '#ef4444' }
];

// Noise Distraction Marker
let noiseSpot = null;

// Controls State
const keys = { up: false, down: false, left: false, right: false };

window.addEventListener('keydown', (e) => {
  if (e.key === 'p' || e.key === 'P') { togglePause(); return; }
  if (!gameActive || isPaused) return;

  if (e.key === 'w' || e.key === 'ArrowUp') keys.up = true;
  if (e.key === 's' || e.key === 'ArrowDown') keys.down = true;
  if (e.key === 'a' || e.key === 'ArrowLeft') keys.left = true;
  if (e.key === 'd' || e.key === 'ArrowRight') keys.right = true;

  if (e.key === 'e' || e.key === 'E') handleInteract();
  if (e.key === ' ') makeNoise(player.x, player.y);
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'w' || e.key === 'ArrowUp') keys.up = false;
  if (e.key === 's' || e.key === 'ArrowDown') keys.down = false;
  if (e.key === 'a' || e.key === 'ArrowLeft') keys.left = false;
  if (e.key === 'd' || e.key === 'ArrowRight') keys.right = false;
});

// Mobile Controls
function bindTouch(id, onStart, onEnd) {
  const el = document.getElementById(id);
  el.addEventListener('touchstart', (e) => { e.preventDefault(); onStart(); });
  el.addEventListener('touchend', (e) => { e.preventDefault(); onEnd(); });
  el.addEventListener('mousedown', () => onStart());
  el.addEventListener('mouseup', () => onEnd());
}

bindTouch('btn-up', () => keys.up = true, () => keys.up = false);
bindTouch('btn-down', () => keys.down = true, () => keys.down = false);
bindTouch('btn-left', () => keys.left = true, () => keys.left = false);
bindTouch('btn-right', () => keys.right = true, () => keys.right = false);
bindTouch('btn-interact', () => handleInteract(), () => {});
bindTouch('btn-noise', () => makeNoise(player.x, player.y), () => {});

function startGame() {
  player.x = 70; player.y = 380;
  player.isHidden = false;
  player.inventory = [];
  items.forEach(i => i.collected = false);
  doors.forEach(d => d.locked = true);
  
  parent.x = 650; parent.y = 100;
  parent.isAlerted = false;
  noiseSpot = null;

  gameActive = true;
  isPaused = false;
  document.getElementById('overlay').style.display = 'none';
  updateUI();
  gameLoop();
}

function handleInteract() {
  // Check Hideouts
  if (player.isHidden) {
    player.isHidden = false;
    document.getElementById('status-text').innerText = 'SNEAKING';
    document.getElementById('status-text').style.color = '#22c55e';
    return;
  }

  for (let h of hideouts) {
    if (rectIntersect(player, h)) {
      player.isHidden = true;
      document.getElementById('status-text').innerText = 'HIDDEN 🙈';
      document.getElementById('status-text').style.color = '#38bdf8';
      return;
    }
  }

  // Check Pickups
  for (let item of items) {
    if (!item.collected && rectIntersect(player, item)) {
      item.collected = true;
      player.inventory.push(item.label);
      updateUI();
    }
  }

  // Check Doors
  for (let door of doors) {
    if (door.locked && rectIntersect(player, {x: door.x - 10, y: door.y - 10, w: door.w + 20, h: door.h + 20})) {
      if (player.inventory.includes(door.keyNeeded)) {
        door.locked = false;
        door.color = '#22c55e';
        updateUI();
      }
    }
  }
}

function makeNoise(x, y) {
  noiseSpot = { x, y, timer: 120 };
  parent.isAlerted = true;
  parent.alertX = x;
  parent.alertY = y;
}

function togglePause() {
  if (!gameActive) return;
  isPaused = !isPaused;
  const overlay = document.getElementById('overlay');
  if (isPaused) {
    document.getElementById('overlay-title').innerText = '⏸️ GAME PAUSED';
    document.getElementById('start-btn').innerText = 'RESUME';
    overlay.style.display = 'flex';
  } else {
    overlay.style.display = 'none';
    requestAnimationFrame(gameLoop);
  }
}

function updateUI() {
  document.getElementById('inv-text').innerText = player.inventory.length ? player.inventory.join(', ') : 'Empty';
}

function rectIntersect(a, b) {
  return a.x < b.x + b.w && a.x + a.width > b.x &&
         a.y < b.y + b.h && a.y + a.height > b.y;
}

function checkWallCollision(newX, newY) {
  const pBox = { x: newX, y: newY, width: player.width, height: player.height };
  for (let w of walls) {
    if (rectIntersect(pBox, w)) return true;
  }
  for (let d of doors) {
    if (d.locked && rectIntersect(pBox, d)) return true;
  }
  return false;
}

function update() {
  if (!gameActive || isPaused) return;

  // Player Movement
  if (!player.isHidden) {
    let nextX = player.x;
    let nextY = player.y;

    if (keys.up) nextY -= player.speed;
    if (keys.down) nextY += player.speed;
    if (keys.left) nextX -= player.speed;
    if (keys.right) nextX += player.speed;

    if (!checkWallCollision(nextX, player.y)) player.x = nextX;
    if (!checkWallCollision(player.x, nextY)) player.y = nextY;
  }

  // Check Escape Condition
  if (player.x > 780 && !doors.find(d => d.id === 'exit_door').locked) {
    gameWin();
  }

  // Parent AI & Patrol Logic
  let targetX, targetY, currentSpeed;

  if (parent.isAlerted) {
    targetX = parent.alertX;
    targetY = parent.alertY;
    currentSpeed = parent.alertSpeed;

    // Arrived at distraction spot
    if (Math.hypot(parent.x - targetX, parent.y - targetY) < 10) {
      parent.isAlerted = false;
    }
  } else {
    const p = parent.patrolPath[parent.pathIndex];
    targetX = p.x;
    targetY = p.y;
    currentSpeed = parent.speed;

    if (Math.hypot(parent.x - targetX, parent.y - targetY) < 5) {
      parent.pathIndex = (parent.pathIndex + 1) % parent.patrolPath.length;
    }
  }

  // Move Parent towards Target
  const angle = Math.atan2(targetY - parent.y, targetX - parent.x);
  parent.x += Math.cos(angle) * currentSpeed;
  parent.y += Math.sin(angle) * currentSpeed;

  // Parent Line of Sight / Detection Check
  const distToPlayer = Math.hypot(parent.x - player.x, parent.y - player.y);
  if (!player.isHidden && distToPlayer < parent.visionRange) {
    // Parent sees player -> Instant Alert
    parent.isAlerted = true;
    parent.alertX = player.x;
    parent.alertY = player.y;

    if (distToPlayer < 25) {
      gameOver();
    }
  }

  if (noiseSpot) {
    noiseSpot.timer--;
    if (noiseSpot.timer <= 0) noiseSpot = null;
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw Rooms Floor Background
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw Hideouts
  ctx.fillStyle = '#334155';
  hideouts.forEach(h => {
    ctx.fillRect(h.x, h.y, h.w, h.h);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText(h.label, h.x + 2, h.y + 20);
    ctx.fillStyle = '#334155';
  });

  // Draw Walls
  ctx.fillStyle = '#475569';
  walls.forEach(w => ctx.fillRect(w.x, w.y, w.w, w.h));

  // Draw Doors
  doors.forEach(d => {
    ctx.fillStyle = d.color;
    ctx.fillRect(d.x, d.y, d.w, d.h);
  });

  // Draw Key Pickups
  items.forEach(item => {
    if (!item.collected) {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(item.x + 9, item.y + 9, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Draw Noise Marker Effect
  if (noiseSpot) {
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(noiseSpot.x, noiseSpot.y, (120 - noiseSpot.timer) % 40, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Draw Parent & Vision Cone
  ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
  ctx.beginPath();
  ctx.arc(parent.x + 13, parent.y + 13, parent.visionRange, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = parent.isAlerted ? '#ef4444' : '#f97316';
  ctx.fillRect(parent.x, parent.y, parent.width, parent.height);

  // Draw Player (if not hidden)
  if (!player.isHidden) {
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(player.x, player.y, player.width, player.height);
  }
}

function gameOver() {
  gameActive = false;
  document.getElementById('overlay-title').innerText = '🚨 CAUGHT!';
  document.getElementById('overlay-msg').innerText = 'Your parent caught you sneaking out. Back to studying!';
  document.getElementById('start-btn').innerText = 'TRY AGAIN';
  document.getElementById('overlay').style.display = 'flex';
}

function gameWin() {
  gameActive = false;
  document.getElementById('overlay-title').innerText = '🎉 FREEDOM!';
  document.getElementById('overlay-msg').innerText = 'You successfully escaped the house to meet your friends!';
  document.getElementById('start-btn').innerText = 'PLAY AGAIN';
  document.getElementById('overlay').style.display = 'flex';
}

function gameLoop() {
  if (!gameActive || isPaused) return;
  update();
  draw();
  requestAnimationFrame(gameLoop);
}
