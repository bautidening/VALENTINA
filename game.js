const $ = (selector) => document.querySelector(selector);
const enhancementStyles = document.createElement('link');
enhancementStyles.rel = 'stylesheet';
enhancementStyles.href = 'enhancements.css';
document.head.append(enhancementStyles);
const screens = {
  start: $('#start'),
  game: $('#game'),
  levelup: $('#levelup'),
  end: $('#end'),
  celebration: $('#celebration')
};
const stage = $('#stage');
const lanesEl = $('#lanes');
const player = $('#player');
const music = new Audio('assets/corazon-vacio-8bit.mp3');
music.preload = 'auto';
music.loop = true;
music.playsInline = true;
music.volume = .72;

let level = 1;
let score = 0;
let lives = 3;
let lane = 1;
let combo = 1;
let progress = 0;
let running = false;
let muted = false;
let last = 0;
let fallbackSpawnClock = 0;
let nextBeatAt = 0;
let items = [];
let touchX = 0;
let selectedLook = 0;
let unlocked = 1;

const configs = [
  { lanes: 3, speed: 145, beatSec: 0.978, bad: 0, goal: 12, title: 'ATRAPÁ LAS NOTAS' },
  { lanes: 4, speed: 165, beatSec: 0.815, bad: .17, goal: 15, title: '¡CUIDADO CON LAS VÍBORAS!' },
  { lanes: 5, speed: 185, beatSec: 0.652, bad: .25, goal: 18, title: 'ESQUIVÁ LOS OBSTÁCULOS' },
  { lanes: 5, speed: 215, beatSec: 0.489, bad: .30, goal: 21, title: '¡SUBE EL RITMO!' },
  { lanes: 5, speed: 245, beatSec: 0.326, bad: .34, goal: 25, title: 'GRAN SHOW FINAL' }
];
const outfits = ['LOOK ORIGINAL', 'DULCE POP', 'STREET NEGRO', 'VESTIDO CHIC', 'ROCKSTAR'];

function show(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove('active'));
  screens[name].classList.add('active');
}

function setLook(element, number) {
  element.className = element.className.replace(/look-\d/g, '').trim() + ` look-${number}`;
}

function lanesForLevel() {
  return configs[level - 1].lanes;
}

function buildLanes() {
  const count = lanesForLevel();
  document.documentElement.style.setProperty('--lanes', count);
  lanesEl.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const element = document.createElement('div');
    element.className = 'lane';
    lanesEl.append(element);
  }
  lane = Math.min(lane, count - 1);
  movePlayer(lane);
  setLook(player, selectedLook);
}

function movePlayer(number) {
  lane = Math.max(0, Math.min(lanesForLevel() - 1, number));
  player.style.left = `${lane * 100 / lanesForLevel()}%`;
}

function updateHud() {
  $('#level').textContent = `${level}/5`;
  $('#score').textContent = String(score).padStart(6, '0');
  $('#lives').textContent = Array(lives).fill('♥').join(' ');
  $('#progress').style.width = `${Math.min(100, progress / configs[level - 1].goal * 100)}%`;
  $('#combo').textContent = `x${combo}`;
  $('#mission').textContent = configs[level - 1].title;
}

function toast(text) {
  const element = $('#toast');
  element.textContent = text;
  element.classList.remove('show');
  void element.offsetWidth;
  element.classList.add('show');
}

function alignNextBeat() {
  const interval = configs[level - 1].beatSec;
  nextBeatAt = (Math.floor(music.currentTime / interval) + 1) * interval;
  fallbackSpawnClock = 0;
}

function playMusic() {
  if (muted) return;
  music.muted = false;
  const promise = music.play();
  if (promise) promise.then(() => {
    alignNextBeat();
    $('#sound').textContent = '♫';
  }).catch(() => {
    $('#sound').textContent = '▶';
    toast('TOCÁ ▶ PARA ACTIVAR');
  });
}

function pauseMusic() {
  music.pause();
}

function startGame() {
  level = 1;
  score = 0;
  lives = 3;
  combo = 1;
  progress = 0;
  selectedLook = 0;
  unlocked = 1;
  music.currentTime = 0;
  clearItems();
  show('game');
  buildLanes();
  updateHud();
  running = true;
  last = performance.now();
  alignNextBeat();
  playMusic();
  requestAnimationFrame(loop);
}

function beginLevel() {
  clearItems();
  progress = 0;
  lives = 3;
  combo = 1;
  show('game');
  buildLanes();
  updateHud();
  running = true;
  last = performance.now();
  alignNextBeat();
  playMusic();
  requestAnimationFrame(loop);
}

function clearItems() {
  items.forEach((item) => item.el.remove());
  items = [];
}

function spawn() {
  const config = configs[level - 1];
  const bad = Math.random() < config.bad;
  const itemLane = Math.floor(Math.random() * config.lanes);
  const element = document.createElement('div');
  element.className = `item ${bad ? 'bad' : 'note'}`;
  element.textContent = bad ? (Math.random() < .55 ? '🐍' : '💔') : (Math.random() < .22 ? '★' : '♪');
  stage.append(element);
  items.push({ el: element, l: itemLane, y: -55, bad });
  element.style.left = `${itemLane * 100 / config.lanes}%`;
  stage.classList.remove('beat');
  void stage.offsetWidth;
  stage.classList.add('beat');
}

function removeItem(item) {
  item.el.remove();
  items.splice(items.indexOf(item), 1);
}

function hit(item) {
  if (item.bad) {
    lives -= 1;
    score = Math.max(0, score - 250);
    combo = 1;
    toast('-1 VIDA  -250');
    navigator.vibrate?.(90);
  } else {
    progress += 1;
    score += 100 * combo;
    combo += 1;
    toast(combo > 4 ? `COMBO x${combo}` : '¡GENIAL!');
  }
  removeItem(item);
  updateHud();
  if (lives <= 0) {
    running = false;
    clearItems();
    setTimeout(() => {
      lives = 3;
      combo = 1;
      progress = Math.max(0, progress - 3);
      toast('¡SEGUIMOS!');
      updateHud();
      running = true;
      last = performance.now();
      alignNextBeat();
      requestAnimationFrame(loop);
    }, 900);
  } else if (progress >= configs[level - 1].goal) {
    completeLevel();
  }
}

function miss(item) {
  score = Math.max(0, score - 50);
  combo = 1;
  removeItem(item);
  toast('NOTA PERDIDA  -50');
  updateHud();
}

function renderMini() {
  const box = $('#collection-mini');
  box.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const item = document.createElement('div');
    item.className = `mini-look sprite look-${i} ${i < unlocked ? 'won' : 'locked'}`;
    box.append(item);
  }
}

function completeLevel() {
  running = false;
  clearItems();
  pauseMusic();
  score += 1000;
  unlocked = Math.min(5, level + 1);
  selectedLook = Math.min(4, level);
  if (level === 5) {
    $('#final-score').textContent = String(score).padStart(6, '0');
    selectedLook = 4;
    renderWardrobe();
    setLook($('#final-character'), selectedLook);
    $('#selected-name').textContent = outfits[selectedLook];
    setTimeout(() => show('end'), 350);
  } else {
    setLook($('#unlock-char'), selectedLook);
    $('#outfit-name').textContent = outfits[selectedLook];
    renderMini();
    setTimeout(() => show('levelup'), 300);
  }
}

function renderWardrobe() {
  const box = $('#wardrobe');
  box.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const button = document.createElement('button');
    button.className = `look-choice ${i === selectedLook ? 'selected' : ''}`;
    button.innerHTML = `<span class="sprite look-${i}"></span><small>${i + 1}</small>`;
    button.setAttribute('aria-label', outfits[i]);
    button.onclick = () => selectFinalLook(i);
    box.append(button);
  }
}

function selectFinalLook(number) {
  selectedLook = number;
  setLook($('#final-character'), number);
  $('#selected-name').textContent = outfits[number];
  renderWardrobe();
}

function loop(now) {
  if (!running) return;
  const delta = Math.min(.035, (now - last) / 1000);
  last = now;
  const config = configs[level - 1];
  fallbackSpawnClock += delta;
  if (!music.paused && music.currentTime >= nextBeatAt) {
    spawn();
    nextBeatAt += config.beatSec;
    fallbackSpawnClock = 0;
  } else if (music.paused && fallbackSpawnClock >= config.beatSec) {
    spawn();
    fallbackSpawnClock = 0;
  }
  const height = stage.clientHeight;
  for (const item of [...items]) {
    item.y += config.speed * delta;
    item.el.style.transform = `translateY(${item.y}px)`;
    if (item.y > height - 180 && item.y < height - 65 && item.l === lane) {
      hit(item);
      if (!running) break;
    } else if (item.y > height) {
      if (item.bad) removeItem(item);
      else miss(item);
    }
  }
  if (running) requestAnimationFrame(loop);
}

stage.addEventListener('pointerdown', (event) => {
  touchX = event.clientX;
  const rect = stage.getBoundingClientRect();
  movePlayer(Math.floor((event.clientX - rect.left) / rect.width * lanesForLevel()));
});
stage.addEventListener('pointerup', (event) => {
  const distance = event.clientX - touchX;
  if (Math.abs(distance) > 35) movePlayer(lane + (distance > 0 ? 1 : -1));
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') movePlayer(lane - 1);
  if (event.key === 'ArrowRight') movePlayer(lane + 1);
});

const download = document.createElement('button');
download.className = 'pixel-button download-button';
download.type = 'button';
download.textContent = 'GUARDAR WALLPAPER';
screens.celebration.insertBefore(download, $('#celebrate-again'));

async function saveWallpaper() {
  const url = 'assets/wallpaper-valentina-v2.png';
  const filename = 'Mis-8-anos-Valentina-Wallpaper.png';
  download.disabled = true;
  download.textContent = 'PREPARANDO...';
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('wallpaper');
    const blob = await response.blob();
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Mis 8 años, Valentina' });
    } else {
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    }
    download.textContent = '¡WALLPAPER LISTO!';
  } catch (error) {
    if (error?.name !== 'AbortError') {
      window.open(url, '_blank');
      download.textContent = 'MANTENÉ APRETADO PARA GUARDAR';
    } else {
      download.textContent = 'GUARDAR WALLPAPER';
    }
  } finally {
    download.disabled = false;
  }
}

download.addEventListener('click', saveWallpaper);

let lastTouchEnd = 0;
document.addEventListener('touchend', (event) => {
  const now = Date.now();
  if (now - lastTouchEnd < 320) event.preventDefault();
  lastTouchEnd = now;
}, { passive: false });
document.addEventListener('gesturestart', (event) => event.preventDefault(), { passive: false });
document.addEventListener('gesturechange', (event) => event.preventDefault(), { passive: false });

$('#play').onclick = startGame;
$('#again').onclick = startGame;
$('#celebrate-again').onclick = startGame;
$('#next').onclick = () => { level += 1; beginLevel(); };
$('#finish').onclick = () => { setLook($('#celebration-character'), selectedLook); show('celebration'); };
$('#how').onclick = () => $('#instructions').showModal();
$('#close-how').onclick = () => $('#instructions').close();
$('#sound').onclick = () => {
  muted = !muted;
  if (muted) {
    music.muted = true;
    pauseMusic();
  } else if (running) {
    playMusic();
  }
  $('#sound').textContent = muted ? '×' : '♫';
};

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (!music.paused) music.pause();
  } else if (running && !muted) {
    playMusic();
  }
});
