(() => {
  const $ = id => document.getElementById(id);
  const home = $('homeScreen');
  const gameScreen = $('gameScreen');
  const canvas = $('arena');
  const ctx = canvas.getContext('2d');
  const overlay = $('overlay');
  const keys = new Set();
  const touchKeys = new Set();
  let mode = 'none';
  let socket = null;
  let onlineState = null;
  let myId = null;
  let inputTimer = null;
  let solo = null;
  let lastFrame = performance.now();

  const W = 900, H = 560, CX = W / 2, CY = H / 2, ARENA_RADIUS = 220, HALF = ARENA_RADIUS, PLAYER_LIMIT = ARENA_RADIUS - 27;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  function clampToArena(x, y) {
    const dx = x - CX, dy = y - CY;
    const distance = Math.hypot(dx, dy);
    if (distance <= PLAYER_LIMIT || distance === 0) return { x, y };
    const scale = PLAYER_LIMIT / distance;
    return { x: CX + dx * scale, y: CY + dy * scale };
  }

  function showOverlay(title, message) {
    overlay.innerHTML = `<div class="overlay-card"><h2>${title}</h2><p>${message}</p></div>`;
    overlay.classList.remove('hidden');
  }
  function hideOverlay() { overlay.classList.add('hidden'); }
  function setMode(next) {
    mode = next;
    home.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    $('modeTitle').textContent = next === 'online' ? 'LOKAS / ÇEVRİM İÇİ RAUND' : 'LOKAS / TEK OYUNCULU';
    $('hintText').textContent = 'Hareket: WASD veya yön tuşları · Sopaya değme!';
    $('headerStatus').textContent = next === 'online' ? 'ÇEVRİM İÇİ MOD' : 'TEK OYUNCULU MOD';
  }
  function returnHome() {
    if (socket) { socket.disconnect(); socket = null; }
    if (inputTimer) { clearInterval(inputTimer); inputTimer = null; }
    onlineState = null; solo = null; myId = null; mode = 'none';
    gameScreen.classList.add('hidden'); home.classList.remove('hidden');
    $('headerStatus').textContent = 'KAÇIŞ ARENASI';
    keys.clear(); touchKeys.clear();
  }
  function randomSpawn() {
    const angle = Math.random() * Math.PI * 2;
    const radius = 155 + Math.random() * 35;
    return { x: CX + Math.cos(angle) * radius, y: CY + Math.sin(angle) * radius };
  }
  function beginSoloRound() {
    const pos = randomSpawn();
    solo = { phase: 'running', round: (solo?.round || 0) + 1, angle: Math.random()*Math.PI*2, elapsed: 0, x: pos.x, y: pos.y, alive: true, score: 0, best: Number(localStorage.getItem('lokasBest') || 0) };
    hideOverlay();
  }
  function startSolo() {
    setMode('solo');
    beginSoloRound();
  }
  function startOnline() {
    setMode('online');
    showOverlay('Bağlanıyor…', 'LOKAS sunucusuna bağlanılıyor.');
    if (typeof io !== 'function') {
      showOverlay('Sunucu bulunamadı', 'Çevrim içi mod için LOKAS sunucusunun internette yayınlanması gerekiyor. Tek oyunculu mod şu an oynanabilir.');
      return;
    }
    socket = io({ transports: ['websocket', 'polling'] });
    socket.on('connect', () => {
      socket.emit('join-game', $('playerName').value || 'Oyuncu');
      $('headerStatus').textContent = 'SUNUCUYA BAĞLI';
    });
    socket.on('joined', data => { myId = data.id; });
    socket.on('game-state', state => {
      onlineState = state;
      updateStats(state.number, state.elapsed, `${state.aliveCount}/${state.playerCount}`);
      if (state.phase === 'waiting') showOverlay('Oyuncular bekleniyor', 'Bağlantı kuruldu. Raund başlayınca herkes aynı anda oynayacak.');
      else if (state.phase === 'countdown') showOverlay(`RAUND ${state.number + 1}`, `Başlamasına ${state.countdown} saniye kaldı. Oyuncular hazırlanıyor…`);
      else if (state.phase === 'intermission') showOverlay('Raund bitti!', `Yeni raund ${state.intermission} saniye içinde başlayacak.`);
      else {
        const mine = state.players.find(p => p.id === myId);
        if (mine && !mine.alive) showOverlay('Yakalandın!', `Bu raund ${mine.score} saniye dayandın. Diğer oyuncuları izliyorsun.`);
        else hideOverlay();
      }
    });
    socket.on('disconnect', () => {
      $('headerStatus').textContent = 'BAĞLANTI KOPTU';
      showOverlay('Bağlantı kesildi', 'Sunucuya yeniden bağlanmayı dene veya tek oyunculu modu seç.');
    });
    socket.on('connect_error', () => showOverlay('Sunucuya ulaşılamıyor', 'Çevrim içi oyun sunucusu henüz yayınlanmamış olabilir. Tek oyunculu modu oynayabilirsin.'));
    inputTimer = setInterval(() => {
      if (!socket || !socket.connected || mode !== 'online') return;
      const input = readInput();
      socket.emit('input', input);
    }, 33);
  }
  function readInput() {
    let x = 0, y = 0;
    if (keys.has('ArrowLeft') || keys.has('a') || touchKeys.has('left')) x -= 1;
    if (keys.has('ArrowRight') || keys.has('d') || touchKeys.has('right')) x += 1;
    if (keys.has('ArrowUp') || keys.has('w') || touchKeys.has('up')) y -= 1;
    if (keys.has('ArrowDown') || keys.has('s') || touchKeys.has('down')) y += 1;
    const len = Math.hypot(x, y) || 1;
    return { x: x / len, y: y / len };
  }
  function updateStats(round, time, alive) {
    $('roundStat').textContent = round || '—';
    $('timeStat').textContent = `${Math.floor(time || 0)} sn`;
    $('aliveStat').textContent = alive;
  }
  function pointSegmentDistance(px, py, x1, y1, x2, y2) {
    const dx=x2-x1, dy=y2-y1, l=dx*dx+dy*dy;
    const t=l ? clamp(((px-x1)*dx+(py-y1)*dy)/l,0,1) : 0;
    return Math.hypot(px-(x1+t*dx), py-(y1+t*dy));
  }

  function drawGarden() {
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#92c65e'); g.addColorStop(.35,'#78ad49'); g.addColorStop(1,'#4f873a');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    // Grass texture
    for (let i=0;i<150;i++) {
      const x=(i*137+31)%W, y=(i*83+19)%H;
      ctx.strokeStyle=i%2?'#c1df7b55':'#315f2d44'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+((i%3)-1)*4,y-5-(i%5)); ctx.stroke();
    }
    // Garden fence
    ctx.fillStyle='#d6bd85'; ctx.fillRect(0,18,W,12); ctx.fillRect(0,18,12,H-36); ctx.fillRect(W-12,18,12,H-36); ctx.fillRect(0,H-30,W,12);
    ctx.fillStyle='#9a754a';
    for(let x=18;x<W-10;x+=48) { ctx.fillRect(x,8,7,34); ctx.fillRect(x,H-38,7,34); }
    for(let y=40;y<H-30;y+=48) { ctx.fillRect(3,y,17,7); ctx.fillRect(W-20,y,17,7); }
    // Bushes and trees at edges
    const trees=[[75,82,1],[820,90,.9],[70,475,.82],[826,470,.95],[450,55,.55]];
    for(const [x,y,s] of trees) {
      ctx.fillStyle='#704d2e'; ctx.fillRect(x-7*s,y,14*s,38*s);
      ctx.fillStyle='#28643b'; ctx.beginPath(); ctx.arc(x,y,28*s,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#3c8444'; ctx.beginPath(); ctx.arc(x-12*s,y-9*s,17*s,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#579b4d'; ctx.beginPath(); ctx.arc(x+11*s,y-12*s,15*s,0,Math.PI*2); ctx.fill();
    }
    // Flower patches
    for(let i=0;i<24;i++) {
      const x=30+(i*181)%840, y=55+(i*97)%445;
      if(Math.hypot(x-CX,y-CY)<245) continue;
      ctx.fillStyle=['#fff0a6','#f6a8b6','#ffffff'][i%3];
      for(let k=0;k<5;k++){const a=k*Math.PI*2/5;ctx.beginPath();ctx.arc(x+Math.cos(a)*4,y+Math.sin(a)*4,3,0,Math.PI*2);ctx.fill();}
      ctx.fillStyle='#e4b948';ctx.beginPath();ctx.arc(x,y,2.5,0,Math.PI*2);ctx.fill();
    }
    // Dairesel oyun alanı: oyuncular bu çemberin dışına çıkamaz.
    ctx.save();
    ctx.beginPath(); ctx.arc(CX,CY,ARENA_RADIUS,0,Math.PI*2); ctx.clip();
    ctx.fillStyle='#b8df7a22'; ctx.fillRect(CX-ARENA_RADIUS,CY-ARENA_RADIUS,ARENA_RADIUS*2,ARENA_RADIUS*2);
    ctx.restore();
    ctx.strokeStyle='#efffc9'; ctx.lineWidth=5;
    ctx.beginPath();ctx.arc(CX,CY,ARENA_RADIUS,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle='#315f2d'; ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(CX,CY,ARENA_RADIUS-4,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#ffffff17';ctx.beginPath();ctx.arc(CX,CY,28,0,Math.PI*2);ctx.fill();
  }

  function drawStickFigure(p, isMe=false) {
    if (!p.alive) return;
    const x=p.x,y=p.y;
    ctx.save();ctx.translate(x,y);
    // soft shadow
    ctx.fillStyle='#17231455';ctx.beginPath();ctx.ellipse(0,13,14,5,0,0,Math.PI*2);ctx.fill();
    // legs
    ctx.strokeStyle='#233c82';ctx.lineWidth=5;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(-4,5);ctx.lineTo(-8,14);ctx.moveTo(4,5);ctx.lineTo(9,13);ctx.stroke();
    // body
    ctx.fillStyle=p.color||'#5ab9f2';ctx.beginPath();ctx.roundRect(-9,-9,18,20,6);ctx.fill();
    ctx.strokeStyle='#17251b';ctx.lineWidth=2;ctx.stroke();
    // arms
    ctx.strokeStyle='#f0c69c';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-7,-4);ctx.lineTo(-14,3);ctx.moveTo(7,-4);ctx.lineTo(14,3);ctx.stroke();
    // head
    ctx.fillStyle='#f0c69c';ctx.beginPath();ctx.arc(0,-16,8,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#593f2c';ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle='#493529';ctx.beginPath();ctx.arc(-1,-22,7,Math.PI,Math.PI*2);ctx.fill();
    if(isMe){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,-4,19,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
    ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#20331f';ctx.strokeText(p.name||'Oyuncu',x,y-31);ctx.fillStyle='#fff';ctx.fillText(p.name||'Oyuncu',x,y-31);
  }

  function drawArena(angle, playersList, isOnline) {
    drawGarden();
    const dx=Math.cos(angle)*HALF, dy=Math.sin(angle)*HALF;
    ctx.save();ctx.translate(CX,CY);ctx.rotate(angle);
    ctx.shadowColor='#15201699';ctx.shadowBlur=12;ctx.shadowOffsetY=5;
    ctx.fillStyle='#111511';ctx.beginPath();ctx.roundRect(-HALF,-5,HALF*2,10,5);ctx.fill();
    ctx.fillStyle='#333a32';ctx.beginPath();ctx.arc(-HALF,0,6,0,Math.PI*2);ctx.arc(HALF,0,6,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    ctx.fillStyle='#141a14';ctx.beginPath();ctx.arc(0,0,13,0,Math.PI*2);ctx.fill();ctx.fillStyle='#a9b59f';ctx.beginPath();ctx.arc(0,0,4,0,Math.PI*2);ctx.fill();ctx.restore();
    for(const p of playersList) drawStickFigure(p, p.id === myId && isOnline);
  }

  function frame(now) {
    const dt=Math.min(.05,(now-lastFrame)/1000);lastFrame=now;
    if(mode==='online' && onlineState) {
      drawArena(onlineState.angle||0,onlineState.players||[],true);
      updateStats(onlineState.number,onlineState.elapsed,`${onlineState.aliveCount}/${onlineState.playerCount}`);
    } else if(mode==='solo' && solo) {
      if(solo.phase==='running' && solo.alive) {
        solo.elapsed += dt;
        solo.angle += (1.45+Math.floor(solo.elapsed/10)*.38)*dt;
        const inp=readInput();
        const bounded = clampToArena(solo.x + inp.x*205*dt, solo.y + inp.y*205*dt);
        solo.x = bounded.x;
        solo.y = bounded.y;
        const bx=Math.cos(solo.angle)*HALF, by=Math.sin(solo.angle)*HALF;
        if(pointSegmentDistance(solo.x,solo.y,CX-bx,CY-by,CX+bx,CY+by)<21) {
          solo.alive=false;solo.best=Math.max(solo.best,Math.floor(solo.elapsed));
          localStorage.setItem('lokasBest',String(solo.best));
          showOverlay('Yakalandın!', `${Math.floor(solo.elapsed)} saniye dayandın. Rekorun: ${solo.best} sn. Yeniden başlamak için tıkla.`);
          overlay.style.pointerEvents='auto';overlay.onclick=()=>{overlay.style.pointerEvents='none';overlay.onclick=null;beginSoloRound();};
        }
      }
      drawArena(solo.angle,[{id:'me',name:$('playerName').value||'Oyuncu',x:solo.x,y:solo.y,alive:solo.alive,color:'#48b8ed'}],false);
      updateStats(solo.round,solo.elapsed,solo.alive?'1/1':'0/1');
    }
    requestAnimationFrame(frame);
  }

  $('onlineBtn').addEventListener('click', startOnline);
  $('soloBtn').addEventListener('click', startSolo);
  $('backBtn').addEventListener('click', returnHome);
  window.addEventListener('keydown', e => { const k=e.key.length===1?e.key.toLowerCase():e.key; if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(k))e.preventDefault(); keys.add(k); });
  window.addEventListener('keyup', e => { const k=e.key.length===1?e.key.toLowerCase():e.key; keys.delete(k); });
  document.querySelectorAll('.touch-pad button').forEach(btn => {
    const dir=btn.dataset.dir;
    const down=e=>{e.preventDefault();touchKeys.add(dir);};
    const up=e=>{e.preventDefault();touchKeys.delete(dir);};
    btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointerleave',up);btn.addEventListener('pointercancel',up);
  });
  requestAnimationFrame(frame);
})();
