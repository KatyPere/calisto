const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// HUD
const powerSlider = document.getElementById('power');
const angleSlider = document.getElementById('angle');
const powerVal = document.getElementById('powerVal');
const angleVal = document.getElementById('angleVal');
const launchBtn = document.getElementById('launchBtn');
const shootBtn = document.getElementById('shootBtn');
const timeEl = document.getElementById('time');
const speedEl = document.getElementById('speed');
const deltaVEl = document.getElementById('delta-v');
const fuelEl = document.getElementById('fuel');
const scoreEl = document.getElementById('score');
const gameOverEl = document.getElementById('game-over');
const resultTitle = document.getElementById('result-title');
const resultText = document.getElementById('result-text');
const finalScoreEl = document.getElementById('final-score');
const restartBtn = document.getElementById('restartBtn');
const shieldEl = document.getElementById('shield');
const shieldToggleBtn = document.getElementById('shieldToggleBtn');
const livesEl = document.getElementById('lives'); // Элемент жизней

// Пазл
const puzzleOverlay = document.getElementById('puzzle-overlay');
const puzzleTargetEl = document.getElementById('puzzle-target');
const puzzleInputEl = document.getElementById('puzzle-input');
const puzzleBtns = document.querySelectorAll('.puzzle-btn');

// Состояние
let gameState = 'setup';
let time = 0, totalDeltaV = 0, fuel = 100, score = 0, shield = 1, lives = 3;
let shieldActive = true;
let stars = [], projectiles = [], asteroids = [], crystals = [], enemies = [], enemyBullets = [], particles = [], boosts = [];
let boss = null; 

// --- НЕУЯЗВИМОСТЬ (после попадания) ---
let invulnerableTimer = 0; 

const TIME_SCALE = 0.003; 
const CAMERA_ZOOM = 1.5;  

// Карта
const earth = { x: 100, y: 300, r: 40 };
const jupiter = { x: 1200, y: 300, r: 100 };
const callisto = { x: 2200, y: 300, r: 35 };

let moons = [
    { name: 'Ио', dist: 160, angle: 0, speed: 0.002, r: 12, color: '#f0e68c' },
    { name: 'Европа', dist: 220, angle: Math.PI, speed: 0.0015, r: 15, color: '#e0e0ff' },
    { name: 'Ганимед', dist: 280, angle: Math.PI / 2, speed: 0.001, r: 18, color: '#b0b0b0' }
];

let ship = { x: 0, y: 0, vx: 0, vy: 0, r: 6, active: false, boostTimer: 0 };
let cameraOffset = { x: 0, y: 0 };
const bounds = { xMin: -300, xMax: 2600, yMin: -300, yMax: 900 };

let puzzleTarget = [];
let puzzleProgress = [];

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    cameraOffset.x = canvas.width / 2 - earth.x * CAMERA_ZOOM;
    cameraOffset.y = canvas.height / 2 - earth.y * CAMERA_ZOOM;
    stars = [];
    for (let i = 0; i < 350; i++) {
        stars.push({ x: Math.random() * canvas.width * 10 - canvas.width, y: Math.random() * canvas.height * 6 - canvas.height, size: Math.random() * 1.5, alpha: Math.random() * 0.8 + 0.2 });
    }
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

powerSlider.addEventListener('input', () => powerVal.textContent = powerSlider.value);
angleSlider.addEventListener('input', () => angleVal.textContent = angleSlider.value);

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); shoot(); }
    if (e.code === 'Enter' && gameState !== 'puzzle') { startGame(); }
});

if (shieldToggleBtn) {
    shieldToggleBtn.addEventListener('click', () => {
        if (shield > 0 && !shieldActive) {
            shieldActive = true;
            shieldToggleBtn.textContent = 'Щит: ВКЛ';
            shieldToggleBtn.style.background = '#00bcd4';
        } else if (shieldActive) {
            shieldActive = false;
            shieldToggleBtn.textContent = 'Щит: ВЫКЛ';
            shieldToggleBtn.style.background = '#555';
        }
    });
}

// --- ЛОГИКА ПАЗЛА ---
puzzleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        if (gameState !== 'puzzle') return;
        const val = parseInt(btn.dataset.val);
        puzzleProgress.push(val);
        puzzleInputEl.textContent += val + ' ';
        
        let isCorrect = true;
        for (let i = 0; i < puzzleProgress.length; i++) {
            if (puzzleProgress[i] !== puzzleTarget[i]) {
                isCorrect = false; break;
            }
        }
        
        if (!isCorrect) {
            puzzleProgress = [];
            puzzleInputEl.textContent = 'ОШИБКА! ';
            setTimeout(() => { puzzleInputEl.textContent = ''; }, 800);
        } else if (puzzleProgress.length === puzzleTarget.length) {
            puzzleOverlay.classList.add('hidden');
            gameState = 'flying';
            score += 500; scoreEl.textContent = score;
            createExplosion(ship.x, ship.y, 20, '#00ffff');
        }
    });
});

function startPuzzle() {
    gameState = 'puzzle';
    puzzleTarget = [];
    puzzleProgress = [];
    puzzleInputEl.textContent = '';
    
    for (let i = 0; i < 4; i++) {
        puzzleTarget.push(Math.floor(Math.random() * 6) + 1);
    }
    puzzleTargetEl.textContent = puzzleTarget.join(' ');
    puzzleOverlay.classList.remove('hidden');
}

function startGame() {
    gameState = 'flying';
    ship.x = earth.x + earth.r + 10;
    ship.y = earth.y;
    ship.boostTimer = 0;
    
    const power = powerSlider.value / 25; 
    const angleRad = angleSlider.value * (Math.PI / 180); 
    ship.vx = power * Math.cos(angleRad) + 1.0; 
    ship.vy = -power * Math.sin(angleRad); 
    
    ship.active = true;
    time = 0; totalDeltaV = 0; fuel = 100; score = 0; shield = 1;
    lives = 3; // Сброс жизней
    invulnerableTimer = 0; // Сброс неуязвимости
    shieldActive = true;
    if (shieldToggleBtn) { shieldToggleBtn.textContent = 'Щит: ВКЛ'; shieldToggleBtn.style.background = '#00bcd4'; }
    if (shieldEl) shieldEl.textContent = '1';
    if (livesEl) livesEl.textContent = '3';
    projectiles = []; asteroids = []; crystals = []; enemies = []; enemyBullets = []; particles = []; boosts = [];
    launchBtn.disabled = true;
    fuelEl.textContent = '100'; scoreEl.textContent = '0';

    // Астероиды
    for (let i = 0; i < 80; i++) {
        asteroids.push({ 
            x: 200 + Math.random() * 2200, 
            y: 0 + Math.random() * 600, 
            r: 8 + Math.random() * 12, 
            vx: (Math.random() - 0.5) * 0.8, 
            vy: (Math.random() - 0.5) * 0.8, 
            active: true,
            isBlue: Math.random() < 0.15
        });
    }

    for (let i = 0; i < 15; i++) crystals.push({ x: 200 + Math.random() * 2200, y: 0 + Math.random() * 600, r: 6, active: true, phase: Math.random() * 6, type: 'fuel' });
    for (let i = 0; i < 8; i++) crystals.push({ x: 200 + Math.random() * 2200, y: 0 + Math.random() * 600, r: 6, active: true, phase: Math.random() * 6, type: 'shield' });
    for (let i = 0; i < 4; i++) boosts.push({ x: 600 + Math.random() * 1600, y: 50 + Math.random() * 500, r: 12, active: true, phase: Math.random() * 6 });

    // Босс
    boss = { 
        x: callisto.x - 120, 
        y: callisto.y, 
        r: 40, 
        hp: 3, 
        active: true, 
        shootTimer: 0,
        orbitAngle: 0, 
        orbitRadius: 120,
        hitTimer: 0 
    };
}

launchBtn.addEventListener('click', startGame);

function shoot() {
    if (gameState !== 'flying' || !ship.active || fuel <= 0) return;
    const speed = Math.sqrt(ship.vx**2 + ship.vy**2);
    let dirX = speed > 0 ? ship.vx / speed : 1;
    let dirY = speed > 0 ? ship.vy / speed : 0;
    projectiles.push({ x: ship.x, y: ship.y, vx: dirX * 10, vy: dirY * 10, r: 5, life: 80 });
    fuel -= 1; if (fuel < 0) fuel = 0; fuelEl.textContent = Math.round(fuel);
}
shootBtn.addEventListener('click', shoot);

function update() {
    if (gameState === 'flying') {
        time += TIME_SCALE;
        moons.forEach(m => m.angle += m.speed);
        
        if (invulnerableTimer > 0) invulnerableTimer--; // Тикает неуязвимость

        asteroids.forEach(a => { 
            if (a.active) { 
                a.x += a.vx; a.y += a.vy; 
                if (a.x < 0) { a.x = 0; a.vx *= -1; }
                if (a.x > 2500) { a.x = 2500; a.vx *= -1; }
                if (a.y < -100) { a.y = -100; a.vy *= -1; }
                if (a.y > 700) { a.y = 700; a.vy *= -1; }
            } 
        });
        
        crystals.forEach(c => { c.phase += 0.05; });
        boosts.forEach(b => b.phase += 0.1);
        
        if (Math.random() < 0.008 && enemies.length < 5) {
            let spawnX = (Math.random() > 0.5) ? 600 + Math.random() * 600 : 1700 + Math.random() * 400;
            enemies.push({ x: spawnX, y: 100 + Math.random() * 400, r: 12, vx: 0, vy: 0, hp: 2, shootTimer: 0 });
        }

        if (ship.active) {
            if (ship.boostTimer > 0) ship.boostTimer--;
            
            fuel -= shieldActive ? 0.015 : 0.005;
            if (fuel <= 0) { fuel = 0; gameOver('Нет топлива!', 'Вы дрейфуете.'); }

            // Гравитация
            const dxJ = jupiter.x - ship.x; const dyJ = jupiter.y - ship.y;
            const distSqJ = dxJ*dxJ + dyJ*dyJ; const distJ = Math.sqrt(distSqJ);
            if (distJ < 1000 && distJ > 0) {
                const force = 1000 / distSqJ; 
                ship.vx += (dxJ / distJ) * force; 
                ship.vy += (dyJ / distJ) * force;
            }

            const dxC = callisto.x - ship.x; const dyC = callisto.y - ship.y;
            const distSqC = dxC*dxC + dyC*dyC; const distC = Math.sqrt(distSqC);
            if (distC < 600 && distC > 0) {
                const force = 800 / distSqC; 
                ship.vx += (dxC / distC) * force; 
                ship.vy += (dyC / distC) * force;
            }

            ship.x += ship.vx * 0.6; 
            ship.y += ship.vy * 0.6;
            
            cameraOffset.x += (canvas.width / 2 - ship.x * CAMERA_ZOOM - cameraOffset.x) * 0.05;
            cameraOffset.y += (canvas.height / 2 - ship.y * CAMERA_ZOOM - cameraOffset.y) * 0.05;

            const speed = Math.sqrt(ship.vx**2 + ship.vy**2);
            speedEl.textContent = speed.toFixed(2);
            deltaVEl.textContent = (totalDeltaV + speed).toFixed(1);
            fuelEl.textContent = Math.round(fuel);

            if (ship.x < bounds.xMin || ship.x > bounds.xMax || ship.y < bounds.yMin || ship.y > bounds.yMax) {
                gameOver('Потерян в космосе!', 'Вы вышли за пределы сектора.');
            }

            // Кристаллы
            crystals.forEach(c => {
                if (c.active && distTo(ship, c) < c.r + ship.r + 15) {
                    c.active = false; 
                    if (c.type === 'shield') { 
                        shield = 1; 
                        if (shieldEl) shieldEl.textContent = shield;
                        createExplosion(c.x, c.y, 5, '#00ff00'); 
                    }
                    else { fuel = Math.min(100, fuel + 15); createExplosion(c.x, c.y, 5, '#00ffff'); }
                    score += 50; scoreEl.textContent = score;
                }
            });

            // Бусты
            boosts.forEach(b => {
                if (b.active && distTo(ship, b) < b.r + ship.r + 10) {
                    b.active = false;
                    ship.vx *= 1.5; ship.vy *= 1.5;
                    ship.boostTimer = 60;
                    fuel = Math.min(100, fuel + 30);
                    score += 100; scoreEl.textContent = score;
                    createExplosion(b.x, b.y, 10, '#ffeb3b');
                }
            });

            // Смерти от планет (мгновенная смерть, жизни не спасают)
            if (distTo(ship, earth) < earth.r + ship.r) gameOver('Столкновение с Землей!', 'Вы разбились.');
            if (distTo(ship, jupiter) < jupiter.r + ship.r) gameOver('Столкновение с Юпитером!', 'Вас затянуло.');
            
            if (boss && boss.active && distTo(ship, boss) < boss.r + ship.r) {
                takeDamage('Столкновение с боссом!');
            }
            
            if (distTo(ship, callisto) < callisto.r + ship.r + 15) { 
                score += 500; 
                gameOver('ПОБЕДА!', 'Вы успешно достигли Каллисто!', true); 
            }
        }

        // Враги
        enemies.forEach(e => {
            if (!e.active) return;
            const dx = ship.x - e.x; const dy = ship.y - e.y; const dist = Math.sqrt(dx*dx+dy*dy);
            if (dist > 0) { e.vx = (dx / dist) * 0.8; e.vy = (dy / dist) * 0.8; }
            e.x += e.vx; e.y += e.vy;
            e.shootTimer++;
            if (e.shootTimer > 80) { e.shootTimer = 0; enemyBullets.push({ x: e.x, y: e.y, vx: (dx/dist)*3, vy: (dy/dist)*3, r: 3 }); }
            if (distTo(ship, e) < e.r + ship.r) takeDamage('Столкновение с дроном!');
        });

        // БОСС
        if (boss && boss.active) {
            if (boss.hitTimer > 0) boss.hitTimer--;

            boss.orbitAngle += 0.01;
            let targetX = callisto.x + Math.cos(boss.orbitAngle) * boss.orbitRadius;
            let targetY = callisto.y + Math.sin(boss.orbitAngle) * boss.orbitRadius;

            if (distTo(ship, callisto) < 400) {
                const dx = ship.x - boss.x; const dy = ship.y - boss.y; const dist = Math.sqrt(dx*dx+dy*dy);
                if (dist > 0) {
                    targetX = boss.x + (dx / dist) * 100;
                    targetY = boss.y + (dy / dist) * 100;
                }
            }

            const dx = targetX - boss.x; const dy = targetY - boss.y; const dist = Math.sqrt(dx*dx+dy*dy);
            if (dist > 0) {
                boss.x += (dx / dist) * 1.5; 
                boss.y += (dy / dist) * 1.5;
            }

            const distToCallisto = distTo(boss, callisto);
            if (distToCallisto > 250) {
                const dx = callisto.x - boss.x; const dy = callisto.y - boss.y; const dist = Math.sqrt(dx*dx+dy*dy);
                boss.x += (dx / dist) * 2;
                boss.y += (dy / dist) * 2;
            }

            boss.shootTimer++;
            if (boss.shootTimer > 80) { 
                boss.shootTimer = 0; 
                const dx = ship.x - boss.x; const dy = ship.y - boss.y; const dist = Math.sqrt(dx*dx+dy*dy); 
                enemyBullets.push({ x: boss.x, y: boss.y, vx: (dx/dist)*3, vy: (dy/dist)*3, r: 5 }); 
            }
        }

        // Пули
        projectiles.forEach(p => {
            p.x += p.vx; p.y += p.vy; p.life--;
            asteroids.forEach(a => { 
                if (a.active && distTo(p, a) < a.r + p.r) { 
                    a.active = false; p.life = 0; 
                    score += a.isBlue ? 100 : 10; scoreEl.textContent = score; 
                    createExplosion(a.x, a.y, a.r, a.isBlue ? '#00ffff' : null); 
                    if (a.isBlue && gameState === 'flying') startPuzzle();
                } 
            });
            enemies.forEach(e => { if (e.active && distTo(p, e) < e.r + p.r) { e.hp--; p.life = 0; if(e.hp <= 0) { e.active = false; score += 100; scoreEl.textContent = score; createExplosion(e.x, e.y, e.r); } } });
            if (boss && boss.active && distTo(p, boss) < boss.r + p.r) { 
                boss.hp--; boss.hitTimer = 10; p.life = 0; 
                createExplosion(p.x, p.y, 5, '#ff0000');
                if(boss.hp <= 0) { boss.active = false; score += 300; scoreEl.textContent = score; createExplosion(boss.x, boss.y, boss.r); } 
            }
        });
        projectiles = projectiles.filter(p => p.life > 0);

        enemyBullets.forEach(b => {
            b.x += b.vx; b.y += b.vy;
            if (ship.active && distTo(ship, b) < ship.r + b.r) {
                b.life = 0; 
                takeDamage('Попадание пули!');
            }
        });
        enemyBullets = enemyBullets.filter(b => b.life !== 0 && Math.abs(b.x - jupiter.x) < 2000);

        particles.forEach(pt => { pt.x += pt.vx; pt.y += pt.vy; pt.life--; });
        particles = particles.filter(pt => pt.life > 0);
        timeEl.textContent = time.toFixed(1);
    }
    draw();
    requestAnimationFrame(update);
}

// --- ФУНКЦИЯ ПОЛУЧЕНИЯ УРОНА ---
function takeDamage(reason) {
    if (invulnerableTimer > 0) return; // Если уже неуязвим, пропускаем урон

    if (shieldActive && shield > 0) {
        // Щит поглощает урон
        shield -= 1; 
        shieldActive = false;
        if (shieldEl) shieldEl.textContent = '0';
        if (shieldToggleBtn) { shieldToggleBtn.textContent = 'Щит: ВЫКЛ'; shieldToggleBtn.style.background = '#555'; }
        createExplosion(ship.x, ship.y, 10, '#00ccff');
        invulnerableTimer = 60; // 1 секунда неуязвимости (60 кадров при 60fps)
    } else {
        // Щита нет, отнимаем жизнь
        lives -= 1;
        if (livesEl) livesEl.textContent = lives;
        createExplosion(ship.x, ship.y, 15, '#ff0000');
        invulnerableTimer = 60; // Временная неуязвимость после урона

        if (lives <= 0) {
            gameOver('Корабль уничтожен!', reason);
        }
    }
}

function distTo(a, b) { return Math.sqrt((a.x - b.x)**2 + (a.y - b.y)**2); }
function createExplosion(x, y, r, color = null) { for (let i = 0; i < 15; i++) { particles.push({ x: x, y: y, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5, life: 30 + Math.random() * 20, color: color || (Math.random() > 0.5 ? '#ffa500' : '#ff0000') }); } }
function gameOver(title, text, isWin = false) { gameState = 'gameover'; ship.active = false; resultTitle.textContent = title; resultTitle.style.color = isWin ? '#4CAF50' : '#f44336'; resultText.textContent = text; finalScoreEl.textContent = score; gameOverEl.classList.remove('hidden'); }

function draw() {
    ctx.fillStyle = '#050510'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    stars.forEach(s => { ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`; ctx.beginPath(); ctx.arc(s.x + cameraOffset.x * 0.05, s.y + cameraOffset.y * 0.05, s.size, 0, Math.PI * 2); ctx.fill(); });
    
    ctx.save();
    ctx.translate(cameraOffset.x, cameraOffset.y);
    ctx.scale(CAMERA_ZOOM, CAMERA_ZOOM);
    
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)'; ctx.lineWidth = 4; ctx.setLineDash([15, 15]);
    ctx.strokeRect(bounds.xMin, bounds.yMin, bounds.xMax - bounds.xMin, bounds.yMax - bounds.yMin); ctx.setLineDash([]);

    if (gameState === 'setup') {
        const power = powerSlider.value / 25;
        const angleRad = angleSlider.value * (Math.PI / 180); 
        let tx = earth.x + earth.r + 10, ty = earth.y;
        let tvx = power * Math.cos(angleRad) + 1.0;
        let tvy = -power * Math.sin(angleRad);
        
        ctx.beginPath(); ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 2; ctx.moveTo(tx, ty);
        for (let i = 0; i < 300; i++) {
            tx += tvx * 0.6; ty += tvy * 0.6;
            const dxJ = jupiter.x - tx; const dyJ = jupiter.y - ty; const distSqJ = dxJ*dxJ + dyJ*dyJ; const distJ = Math.sqrt(distSqJ);
            if (distJ < 1000 && distJ > 0) { const force = 1000 / distSqJ; tvx += (dxJ / distJ) * force; tvy += (dyJ / distJ) * force; }
            const dxC = callisto.x - tx; const dyC = callisto.y - ty; const distSqC = dxC*dxC + dyC*dyC; const distC = Math.sqrt(distSqC);
            if (distC < 600 && distC > 0) { const force = 800 / distSqC; tvx += (dxC / distC) * force; tvy += (dyC / distC) * force; }
            ctx.lineTo(tx, ty);
        }
        ctx.stroke(); ctx.setLineDash([]);
    }
    
    const jGrad = ctx.createRadialGradient(jupiter.x - 30, jupiter.y - 30, 10, jupiter.x, jupiter.y, jupiter.r);
    jGrad.addColorStop(0, '#ffcc99'); jGrad.addColorStop(1, '#8b4513');
    ctx.fillStyle = jGrad; ctx.beginPath(); ctx.arc(jupiter.x, jupiter.y, jupiter.r, 0, Math.PI * 2); ctx.fill();
    
    moons.forEach(m => {
        const mx = jupiter.x + Math.cos(m.angle) * m.dist;
        const my = jupiter.y + Math.sin(m.angle) * m.dist;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.beginPath(); ctx.arc(jupiter.x, jupiter.y, m.dist, 0, Math.PI * 2); ctx.stroke();
        const mGrad = ctx.createRadialGradient(mx - 5, my - 5, 2, mx, my, m.r);
        mGrad.addColorStop(0, m.color); mGrad.addColorStop(1, '#333');
        ctx.fillStyle = mGrad; ctx.beginPath(); ctx.arc(mx, my, m.r, 0, Math.PI * 2); ctx.fill();
    });
    
    const eGrad = ctx.createRadialGradient(earth.x - 15, earth.y - 15, 5, earth.x, earth.y, earth.r);
    eGrad.addColorStop(0, '#4a90e2'); eGrad.addColorStop(1, '#0a2a5e');
    ctx.fillStyle = eGrad; ctx.beginPath(); ctx.arc(earth.x, earth.y, earth.r, 0, Math.PI * 2); ctx.fill();
    
    const cGrad = ctx.createRadialGradient(callisto.x - 10, callisto.y - 10, 2, callisto.x, callisto.y, callisto.r);
    cGrad.addColorStop(0, '#d3d3d3'); cGrad.addColorStop(1, '#555');
    ctx.fillStyle = cGrad; ctx.beginPath(); ctx.arc(callisto.x, callisto.y, callisto.r, 0, Math.PI * 2); ctx.fill();
    
    asteroids.forEach(a => { 
        if (!a.active) return; 
        ctx.fillStyle = a.isBlue ? '#00bfff' : '#888'; 
        if (a.isBlue) { ctx.shadowBlur = 15; ctx.shadowColor = '#00bfff'; }
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill(); 
        ctx.shadowBlur = 0;
    });

    crystals.forEach(c => {
        if (!c.active) return;
        const pulse = Math.sin(c.phase) * 2;
        ctx.fillStyle = c.type === 'shield' ? '#00ff00' : '#00ffff'; 
        ctx.shadowBlur = 15; ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r + pulse, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    });

    boosts.forEach(b => {
        if (!b.active) return;
        ctx.fillStyle = '#ffeb3b'; ctx.shadowBlur = 20; ctx.shadowColor = '#ffeb3b';
        ctx.beginPath(); ctx.moveTo(b.x, b.y - b.r); ctx.lineTo(b.x + b.r, b.y + b.r); ctx.lineTo(b.x, b.y + b.r/2); ctx.lineTo(b.x - b.r, b.y + b.r); ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
    });

    enemies.forEach(e => { if (!e.active) return; ctx.fillStyle = '#ff3333'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill(); });
    
    if (boss && boss.active) {
        ctx.fillStyle = boss.hitTimer > 0 ? '#fff' : '#8a2be2'; 
        ctx.shadowBlur = 20; ctx.shadowColor = '#8a2be2';
        ctx.beginPath(); ctx.arc(boss.x, boss.y, boss.r, 0, Math.PI * 2); ctx.fill(); 
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#555'; ctx.fillRect(boss.x - 30, boss.y - 50, 60, 6);
        ctx.fillStyle = '#ff0000'; ctx.fillRect(boss.x - 30, boss.y - 50, 60 * (boss.hp / 3), 6);
    }

    if (ship.active) {
        // --- ВИЗУАЛЬНЫЙ ЭФФЕКТ НЕУЯЗВИМОСТИ (мигание) ---
        if (invulnerableTimer > 0 && Math.floor(invulnerableTimer / 5) % 2 === 0) {
            // Пропускаем отрисовку (корабль мигает)
        } else {
            const speed = Math.sqrt(ship.vx**2 + ship.vy**2);
            let angle = Math.atan2(ship.vy, ship.vx); 
            ctx.save(); ctx.translate(ship.x, ship.y); ctx.rotate(angle);
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, ship.r, 0, Math.PI * 2); ctx.fill();
            if (shieldActive && shield > 0) {
                ctx.strokeStyle = `rgba(0, 255, 204, 0.8)`; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(0, 0, ship.r + 5, 0, Math.PI * 2); ctx.stroke();
            }
            if (speed > 0.2 || ship.boostTimer > 0) { 
                ctx.fillStyle = ship.boostTimer > 0 ? '#ffeb3b' : '#ff9900'; 
                ctx.beginPath(); ctx.moveTo(-ship.r, 0); ctx.lineTo(-ship.r - 12, -5); ctx.lineTo(-ship.r - 12, 5); ctx.fill(); 
            }
            ctx.restore();
        }
    }

    projectiles.forEach(p => { ctx.fillStyle = '#ffeb3b'; ctx.shadowBlur = 10; ctx.shadowColor = '#ffeb3b'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; });
    enemyBullets.forEach(b => { ctx.fillStyle = '#ff0000'; ctx.shadowBlur = 10; ctx.shadowColor = '#ff0000'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; });
    particles.forEach(pt => { ctx.fillStyle = pt.color; ctx.globalAlpha = pt.life / 50; ctx.beginPath(); ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; });
    
    ctx.restore();
}

restartBtn.addEventListener('click', () => {
    gameOverEl.classList.add('hidden'); gameState = 'setup'; ship.active = false;
    time = 0; totalDeltaV = 0; fuel = 100; score = 0; shield = 1; lives = 3;
    invulnerableTimer = 0;
    projectiles = []; asteroids = []; crystals = []; enemies = []; enemyBullets = []; particles = []; boosts = []; boss = null;
    launchBtn.disabled = false;
    speedEl.textContent = '0'; deltaVEl.textContent = '0'; timeEl.textContent = '0'; fuelEl.textContent = '100'; scoreEl.textContent = '0';
    if (shieldEl) shieldEl.textContent = '1';
    if (livesEl) livesEl.textContent = '3';
    if (shieldToggleBtn) { shieldToggleBtn.textContent = 'Щит: ВКЛ'; shieldToggleBtn.style.background = '#00bcd4'; }
    cameraOffset.x = canvas.width / 2 - earth.x * CAMERA_ZOOM; cameraOffset.y = canvas.height / 2 - earth.y * CAMERA_ZOOM;
});

update();