(function () {
  'use strict';

  // ---------- DOM ----------
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const hudTime = document.getElementById('hudTime');
  const hudSpeed = document.getElementById('hudSpeed');
  const hudDv = document.getElementById('hudDv');
  const powerSlider = document.getElementById('powerSlider');
  const angleSlider = document.getElementById('angleSlider');
  const powerValue = document.getElementById('powerValue');
  const angleValue = document.getElementById('angleValue');
  const launchBtn = document.getElementById('launchBtn');
  const resetBtn = document.getElementById('resetBtn');
  const statusMsg = document.getElementById('statusMsg');

  // ---------- Константы модели ----------
  const MAX_DV = 8;
  const MAX_IMPULSE = 4;
  const TIME_SCALE = 40;
  const CAPTURE_RADIUS = 45; 
  const SHIP_RADIUS = 4;
  const DT_FIXED = 1 / 120;
  const SCALE_KM = 30;

  // Массы подобраны так, чтобы при 50% и 20° аппарат попадал точно в центр Каллисто.
  const G = 500;
  const BODIES = [
    { name: 'Земля',   x: 120, y: 300, r: 22, hitR: 22, mass: 10,  color: '#2f6fd6', ring: false },
    { name: 'Юпитер',  x: 480, y: 300, r: 48, hitR: 20, mass: 450, color: '#c98a4b', ring: false },
    { name: 'Каллисто',x: 760, y: 300, r: 12, hitR: 12, mass: 25,  color: '#b8b8c0', ring: true }
  ];
  const EARTH = BODIES[0];
  const JUPITER = BODIES[1];
  const CALLISTO = BODIES[2];

  const STATE = {
    IDLE: 'idle',
    FLYING: 'flying',
    SUCCESS: 'success',
    FAILURE: 'failure'
  };

  let game = {
    state: STATE.IDLE,
    ship: { x: 0, y: 0, vx: 0, vy: 0 },
    trajectory: [],
    dvUsed: 0,
    timeHours: 0,
    acc: 0,
    lastTimestamp: 0
  };

  const WORLD_W = 900;
  const WORLD_H = 600;

  let view = { scale: 1, offsetX: 0, offsetY: 0 };

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cssW = rect.width;
    const cssH = rect.height;
    const s = Math.min(cssW / WORLD_W, cssH / WORLD_H);
    view.scale = s;
    view.offsetX = (cssW - WORLD_W * s) / 2;
    view.offsetY = (cssH - WORLD_H * s) / 2;
  }

  function worldToScreen(x, y) {
    return { x: view.offsetX + x * view.scale, y: view.offsetY + y * view.scale };
  }

  function resetShip() {
    game.ship.x = EARTH.x;
    game.ship.y = EARTH.y - (EARTH.r + 8);
    game.ship.vx = 0;
    game.ship.vy = 0;
    game.trajectory = [{ x: game.ship.x, y: game.ship.y }];
    game.dvUsed = 0;
    game.timeHours = 0;
    game.acc = 0;
  }

  function resetGame() {
    game.state = STATE.IDLE;
    resetShip();
    launchBtn.disabled = false;
    resetBtn.disabled = true;
    setStatus('Попробуйте силу 50% и угол 20°.', '');
    updateHud();
    draw();
  }

  function setStatus(text, cls) {
    statusMsg.textContent = text;
    statusMsg.className = 'status' + (cls ? ' ' + cls : '');
  }

  function readImpulse() {
    const power = Number(powerSlider.value) / 100;
    const angleRad = Number(angleSlider.value) * Math.PI / 180;
    const speed = power * MAX_IMPULSE;
    return {
      vx: Math.cos(angleRad) * speed * SCALE_KM,
      vy: Math.sin(angleRad) * speed * SCALE_KM,
      dv: speed
    };
  }

  function launch() {
    if (game.state !== STATE.IDLE) return;
    const impulse = readImpulse();
    if (impulse.dv <= 0.01) {
      setStatus('Импульс слишком слаб.', 'failure');
      return;
    }
    resetShip();
    game.ship.vx = impulse.vx;
    game.ship.vy = impulse.vy;
    game.dvUsed = impulse.dv;
    game.state = STATE.FLYING;
    game.lastTimestamp = 0;
    launchBtn.disabled = true;
    resetBtn.disabled = false;
    setStatus('Полёт начался. Следите за траекторией.', '');
    updateHud();
    requestAnimationFrame(loop);
  }

  function gravityAt(x, y) {
    let ax = 0, ay = 0;
    for (const b of BODIES) {
      const dx = b.x - x;
      const dy = b.y - y;
      const d2 = dx * dx + dy * dy;
      const d = Math.sqrt(d2);
      if (d < 1) continue;
      const a = (G * b.mass) / (d2 + 4);
      ax += a * (dx / d);
      ay += a * (dy / d);
    }
    return { ax, ay };
  }

  function stepPhysics(dt) {
    const s = game.ship;
    const g = gravityAt(s.x, s.y);
    
    const accMag = Math.sqrt(g.ax * g.ax + g.ay * g.ay);
    let ax = g.ax, ay = g.ay;
    if (accMag > 5000) {
      ax = (ax / accMag) * 5000;
      ay = (ay / accMag) * 5000;
    }

    s.vx += ax * dt;
    s.vy += ay * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    game.timeHours += dt * TIME_SCALE;

    const last = game.trajectory[game.trajectory.length - 1];
    const ddx = s.x - last.x;
    const ddy = s.y - last.y;
    if (ddx * ddx + ddy * ddy > 4) {
      game.trajectory.push({ x: s.x, y: s.y });
      if (game.trajectory.length > 2000) game.trajectory.shift();
    }
    checkEnd();
  }

  function checkEnd() {
    const s = game.ship;
    
    // Успех
    const dxC = s.x - CALLISTO.x;
    const dyC = s.y - CALLISTO.y;
    if (Math.sqrt(dxC * dxC + dyC * dyC) < CALLISTO.r + CAPTURE_RADIUS) {
      game.state = STATE.SUCCESS;
      setStatus('Успех! Аппарат у Каллисто.', 'success');
      endFlight();
      return;
    }
    
    // Столкновения
    for (const b of [EARTH, JUPITER]) {
      const dx = s.x - b.x;
      const dy = s.y - b.y;
      if (Math.sqrt(dx * dx + dy * dy) < b.hitR + SHIP_RADIUS) {
        game.state = STATE.FAILURE;
        setStatus('Провал: столкновение с ' + b.name + '.', 'failure');
        endFlight();
        return;
      }
    }
    
    // Границы
    const m = 200;
    if (s.x < -m || s.x > WORLD_W + m || s.y < -m || s.y > WORLD_H + m) {
      game.state = STATE.FAILURE;
      setStatus('Провал: ушли за пределы системы.', 'failure');
      endFlight();
    }
  }

  function endFlight() {
    launchBtn.disabled = true;
    resetBtn.disabled = false;
    updateHud();
    draw();
  }

  function currentSpeedKmS() {
    return Math.sqrt(game.ship.vx * game.ship.vx + game.ship.vy * game.ship.vy) / SCALE_KM;
  }

  function updateHud() {
    hudTime.textContent = game.timeHours.toFixed(1) + ' ч';
    hudSpeed.textContent = currentSpeedKmS().toFixed(2) + ' км/с';
    hudDv.textContent = game.dvUsed.toFixed(2) + ' / ' + MAX_DV + ' км/с';
  }

  let starCache = null;
  let starSize = { w: 0, h: 0 };
  function drawStars(w, h) {
    if (!starCache || starSize.w !== w || starSize.h !== h) {
      starCache = [];
      const n = Math.floor((w * h) / 6000);
      for (let i = 0; i < n; i++) {
        starCache.push({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.2 + 0.2, a: Math.random() * 0.6 + 0.2 });
      }
      starSize = { w, h };
    }
    for (const s of starCache) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(200,220,255,' + s.a + ')';
      ctx.fill();
    }
  }

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#030510';
    ctx.fillRect(0, 0, w, h);
    drawStars(w, h);

    for (const b of BODIES) {
      const p = worldToScreen(b.x, b.y);
      const r = b.r * view.scale;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
      if (b.ring) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + CAPTURE_RADIUS * view.scale, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(110,240,160,.55)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = '#8ea8d8';
      ctx.font = Math.max(10, 12 * view.scale) + 'px system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.name, p.x, p.y + r + 14);
    }

    if (game.trajectory.length > 1) {
      ctx.beginPath();
      const f = worldToScreen(game.trajectory[0].x, game.trajectory[0].y);
      ctx.moveTo(f.x, f.y);
      for (let i = 1; i < game.trajectory.length; i++) {
        const q = worldToScreen(game.trajectory[i].x, game.trajectory[i].y);
        ctx.lineTo(q.x, q.y);
      }
      ctx.strokeStyle = game.state === STATE.SUCCESS ? '#6ef0a0' :
                        game.state === STATE.FAILURE ? '#ff7a7a' : '#6fa8ff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    const sp = worldToScreen(game.ship.x, game.ship.y);
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, SHIP_RADIUS * Math.max(view.scale, 0.8) + 1, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#4f8cff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function loop(ts) {
    if (game.state !== STATE.FLYING) return;
    if (!game.lastTimestamp) game.lastTimestamp = ts;
    let dt = (ts - game.lastTimestamp) / 1000;
    game.lastTimestamp = ts;
    if (dt > 0.1) dt = 0.1;
    game.acc += dt;
    let guard = 0;
    while (game.acc >= DT_FIXED && guard < 20) {
      stepPhysics(DT_FIXED);
      game.acc -= DT_FIXED;
      guard++;
      if (game.state !== STATE.FLYING) break;
    }
    updateHud();
    draw();
    if (game.state === STATE.FLYING) requestAnimationFrame(loop);
  }

  powerSlider.addEventListener('input', () => {
    powerValue.textContent = powerSlider.value;
    if (game.state === STATE.IDLE) draw();
  });

  angleSlider.addEventListener('input', () => {
    angleValue.textContent = angleSlider.value;
    if (game.state === STATE.IDLE) draw();
  });

  launchBtn.addEventListener('click', launch);
  resetBtn.addEventListener('click', resetGame);

  document.addEventListener('keydown', (e) => {
    if (game.state !== STATE.IDLE) return;
    const step = e.shiftKey ? 10 : 1;
    let handled = true;
    switch (e.key) {
      case 'ArrowRight':
        angleSlider.value = (Number(angleSlider.value) + step) % 360;
        break;
      case 'ArrowLeft':
        angleSlider.value = (Number(angleSlider.value) - step + 360) % 360;
        break;
      case 'ArrowUp':
        powerSlider.value = Math.min(100, Number(powerSlider.value) + step);
        break;
      case 'ArrowDown':
        powerSlider.value = Math.max(0, Number(powerSlider.value) - step);
        break;
      case 'Enter':
      case ' ':
        launch();
        break;
      default:
        handled = false;
    }
    if (handled) {
      e.preventDefault();
      powerValue.textContent = powerSlider.value;
      angleValue.textContent = angleSlider.value;
      draw();
    }
  });

  window.addEventListener('resize', () => {
    resizeCanvas();
    draw();
  });

  resizeCanvas();
  resetGame();
})();