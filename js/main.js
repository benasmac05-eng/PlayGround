import * as THREE from '../vendor/three.module.min.js';
import {
  DEFAULT_BUILD, ENGINES, INDUCTION, BODY_KITS, WINGS, WHEEL_STYLES, FINISHES,
  PAINTS, ACCENTS, EXHAUSTS, DRIVETRAINS, AUDIO_PROFILES, PRESETS, CHALLENGES,
  computeStats, getAudioProfile, buildVariationCount, formatCount, randomiseBuild
} from './data.js';
import { createEnvironment, makeCanvasTexture } from './environment.js';
import { createShowroom } from './showroom.js';
import { createWorld } from './world.js';
import { createCar } from './car.js';
import { EngineAudio } from './audio.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const nf = new Intl.NumberFormat('en-US');
const STORAGE_KEY = 'beamforge.build.v1';
const TABS = [
  { id: 'engine', num: '01', label: 'ENGINE', sub: 'POWER' },
  { id: 'body', num: '02', label: 'BODY', sub: 'FORM' },
  { id: 'wheels', num: '03', label: 'WHEELS', sub: 'GRIP' },
  { id: 'paint', num: '04', label: 'PAINT', sub: 'SURFACE' },
  { id: 'audio', num: '05', label: 'AUDIO', sub: 'VOICE' },
  { id: 'tune', num: '06', label: 'TUNE', sub: 'FEEL' }
];
const GLOW_COLORS = [
  { name: 'ICE', hex: '#42f5ff' },
  { name: 'ACID', hex: '#c9ff2f' },
  { name: 'PINK', hex: '#ff2f8b' },
  { name: 'AMBER', hex: '#ff6a00' },
  { name: 'VIOLET', hex: '#6c45d9' }
];
const VISUAL_KEYS = new Set([
  'engine', 'induction', 'boost', 'exhaust', 'exhaustSize', 'drivetrain', 'bodyKit',
  'wing', 'wingSpan', 'wingAngle', 'paint', 'finish', 'accent', 'wheelStyle',
  'wheelSize', 'wheelWidth', 'wheelOffset', 'camber', 'rideHeight', 'bodyLength',
  'bodyWidth', 'bodyHeight', 'noseLength', 'cabinScale', 'cabinRake', 'fenderFlare',
  'tint', 'underglow', 'glowStrength', 'name'
]);

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function loadBuild() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BUILD };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_BUILD, ...parsed, name: String(parsed.name || DEFAULT_BUILD.name).slice(0, 24) };
  } catch {
    return { ...DEFAULT_BUILD };
  }
}

let build = loadBuild();
let stats = computeStats(build);
let currentTab = 'engine';
const combos = buildVariationCount();

/* ------------------------------------------------------------------ */
/* Renderer, scenes, cars                                              */
/* ------------------------------------------------------------------ */
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const isMobileViewport = () => window.innerWidth <= 820 || window.innerHeight <= 620;
let pixelRatio = Math.min(window.devicePixelRatio || 1, isMobileViewport() ? 1.3 : 1.7);
renderer.setPixelRatio(pixelRatio);

const envMap = createEnvironment(renderer);
const showroom = createShowroom(renderer, envMap);
const world = createWorld(renderer, envMap);
const driveCamera = new THREE.PerspectiveCamera(57, 1, 0.12, 800);
let showroomCar = null;
let worldCar = null;
let activeScene = showroom.scene;
let activeCamera = showroom.camera;
showroom.resize(window.innerWidth, window.innerHeight, isMobileViewport());
driveCamera.aspect = window.innerWidth / window.innerHeight;
driveCamera.updateProjectionMatrix();

const audio = new EngineAudio();
let soundOn = true;
let revStart = 0;
let revUntil = 0;

function buildShowroomCar() {
  const next = createCar(build);
  if (showroomCar) showroomCar.dispose();
  showroomCar = next;
  showroom.setCar(next);
}

function rebuildShowroomSoon(delay = 55) {
  clearTimeout(rebuildShowroomSoon.timer);
  rebuildShowroomSoon.timer = setTimeout(() => {
    buildShowroomCar();
    saveSoon();
  }, delay);
}

/* ------------------------------------------------------------------ */
/* Build UI                                                            */
/* ------------------------------------------------------------------ */
const buildTabsEl = $('#buildTabs');
const buildContentEl = $('#buildContent');

function rangeFill(input) {
  const value = Number(input.value);
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const pct = ((value - min) / (max - min)) * 100;
  input.style.setProperty('--fill', `${pct}%`);
}

function sliderRow(key, label, min, max, step, unit = '', options = {}) {
  const value = build[key];
  const disabled = options.disabled ? ' disabled' : '';
  return `<div class="slider-row">
    <div class="slider-meta">
      <label for="slider-${key}">${label}</label>
      <output data-output="${key}">${value}<span>${unit}</span></output>
    </div>
    <input id="slider-${key}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-key="${key}" data-unit="${unit}"${disabled} aria-label="${label}">
    <div class="slider-scale"><span>${min}${unit ? ' ' + unit : ''}</span><span>${max}${unit ? ' ' + unit : ''}</span></div>
  </div>`;
}

function optionButton(key, value, active, title, sub, meta = '') {
  return `<button class="option${active ? ' is-active' : ''}" data-choice="${key}" data-value="${value}" type="button">
    ${meta ? `<span class="badge">${meta}</span>` : ''}
    <span class="tag">${title}</span>
    ${sub ? `<small>${sub}</small>` : ''}
  </button>`;
}

function renderEngineTab() {
  const engine = ENGINES[build.engine];
  const induction = INDUCTION[build.induction];
  const exhaust = EXHAUSTS[build.exhaust];
  return `
    <div class="section-label"><h3>POWERTRAIN</h3><p>Six architectures. One very bad influence.</p></div>
    <div class="option-grid">
      ${Object.values(ENGINES).map(e => optionButton('engine', e.id, build.engine === e.id, e.short, e.name, `${e.power} HP`)).join('')}
    </div>
    <div class="section-label"><h3>INDUCTION</h3><p>${engine.note}</p></div>
    <div class="option-grid">
      ${Object.values(INDUCTION).map(i => optionButton('induction', i.id, build.induction === i.id, i.name, i.sub, i.id === 'na' ? 'NA' : '+' + i.hpPerPsi + ' HP/PSI')).join('')}
    </div>
    ${sliderRow('boost', induction.boostLabel, 0, 40, 1, 'PSI', { disabled: build.induction === 'na' })}
    <div class="section-label"><h3>EXHAUST</h3><p>Back pressure is a suggestion.</p></div>
    <div class="option-grid">
      ${Object.values(EXHAUSTS).map(e => optionButton('exhaust', e.id, build.exhaust === e.id, e.name, e.sub, e.gain > 1 ? '+' + Math.round((e.gain - 1) * 100) + '%' : 'QUIET')).join('')}
    </div>
    ${sliderRow('exhaustSize', 'TIP DIAMETER', 70, 135, 1, '%')}
    <div class="section-label"><h3>DRIVETRAIN</h3><p>Where the power meets the road.</p></div>
    <div class="option-grid">
      ${Object.values(DRIVETRAINS).map(d => optionButton('drivetrain', d.id, build.drivetrain === d.id, d.name, d.sub, d.id === 'awd' ? '+62 KG' : 'PURE')).join('')}
    </div>
    <div class="note-box"><b>${engine.name}</b> · ${exhaust.name} exhaust · ${induction.name}. The dyno reads <b>${stats.power} HP</b> at ${engine.redline} RPM.</div>
  `;
}

function renderBodyTab() {
  return `
    <div class="section-label"><h3>BODY KIT</h3><p>Box arches, big shoulders, zero apologies.</p></div>
    <div class="option-grid">
      ${Object.values(BODY_KITS).map(b => optionButton('bodyKit', b.id, build.bodyKit === b.id, b.name, b.sub, b.downforce ? '+' + b.downforce + ' DF' : '')).join('')}
    </div>
    <div class="section-label"><h3>RESIZE ANYTHING</h3><p>Stretch the chassis, pinch the nose, raise the cabin. The mesh rebuilds live.</p></div>
    ${sliderRow('bodyLength', 'BODY LENGTH', 85, 115, 1, '%')}
    ${sliderRow('bodyWidth', 'BODY WIDTH', 90, 112, 1, '%')}
    ${sliderRow('bodyHeight', 'BODY HEIGHT', 88, 114, 1, '%')}
    ${sliderRow('noseLength', 'NOSE LENGTH', 85, 118, 1, '%')}
    ${sliderRow('cabinScale', 'CABIN SCALE', 82, 118, 1, '%')}
    ${sliderRow('cabinRake', 'CABIN RAKE', 82, 118, 1, '%')}
    ${sliderRow('fenderFlare', 'FENDER FLARE', 80, 130, 1, '%')}
    <div class="section-label"><h3>REAR AERO</h3><p>Downforce you can see from the next postcode.</p></div>
    <div class="option-grid three">
      ${Object.values(WINGS).map(w => optionButton('wing', w.id, build.wing === w.id, w.name, w.sub)).join('')}
    </div>
    ${sliderRow('wingSpan', 'WING SPAN', 70, 140, 1, '%', { disabled: build.wing === 'none' || build.wing === 'duck' })}
    ${sliderRow('wingAngle', 'WING ANGLE', 0, 26, 1, '°', { disabled: build.wing === 'none' || build.wing === 'duck' })}
    <div class="note-box"><b>Live mesh deformation.</b> Body panel vertices are rebuilt from these dimensions before you drive, and crumple again on impact.</div>
  `;
}

function renderWheelsTab() {
  return `
    <div class="section-label"><h3>WHEEL DESIGN</h3><p>Five faces, from aero disc to beadlock.</p></div>
    <div class="option-grid three">
      ${Object.values(WHEEL_STYLES).map(w => optionButton('wheelStyle', w.id, build.wheelStyle === w.id, w.name, w.sub)).join('')}
    </div>
    <div class="section-label"><h3>FITMENT</h3><p>Stance is a language. Speak it loudly.</p></div>
    ${sliderRow('wheelSize', 'WHEEL SIZE', 18, 24, 1, 'IN')}
    ${sliderRow('wheelWidth', 'WHEEL WIDTH', 8, 16, 1, 'IN')}
    ${sliderRow('wheelOffset', 'OFFSET', 0, 25, 1, 'MM')}
    ${sliderRow('camber', 'CAMBER', -10, 2, 1, '°')}
    ${sliderRow('rideHeight', 'RIDE HEIGHT', 20, 90, 1, '%')}
    <div class="section-label"><h3>UNDERGLOW</h3><p>Because the ground deserves a little drama too.</p></div>
    <div class="swatch-grid" style="grid-template-columns:repeat(5,1fr)">
      ${GLOW_COLORS.map(c => `<button class="swatch${build.underglow === c.hex ? ' is-active' : ''}" data-colour="underglow" data-value="${c.hex}" style="background:${c.hex}" title="${c.name}" type="button"></button>`).join('')}
    </div>
    ${sliderRow('glowStrength', 'GLOW INTENSITY', 0, 60, 1, '%')}
    <div class="note-box"><b>${build.wheelSize} inch</b> · ${build.wheelWidth} inch wide · ${build.camber}° camber. Wheel arches resize with the flare slider in Body.</div>
  `;
}

function renderPaintTab() {
  return `
    <div class="section-label"><h3>PAINT</h3><p>Factory colours, mixed in the lab.</p></div>
    <div class="swatch-grid">
      ${PAINTS.map(p => `<button class="swatch${build.paint.toLowerCase() === p.hex.toLowerCase() ? ' is-active' : ''}" data-colour="paint" data-value="${p.hex}" style="background:${p.hex}" title="${p.name}" type="button"></button>`).join('')}
      <button class="swatch custom" style="background:${escapeHtml(build.paint)}" title="Custom colour" type="button">
        +
        <input type="color" data-key="paint" value="${escapeHtml(build.paint)}" aria-label="Custom paint colour">
      </button>
    </div>
    <div class="section-label"><h3>FINISH</h3><p>How the sunset sits on the surface.</p></div>
    <div class="finish-grid">
      ${Object.values(FINISHES).map(f => `<button class="finish${build.finish === f.id ? ' is-active' : ''}" data-choice="finish" data-value="${f.id}" type="button">${f.name}</button>`).join('')}
    </div>
    <div class="section-label"><h3>ACCENT</h3><p>Carbon, chrome or something louder.</p></div>
    <div class="swatch-grid">
      ${ACCENTS.map(a => `<button class="swatch${build.accent.toLowerCase() === a.hex.toLowerCase() ? ' is-active' : ''}" data-colour="accent" data-value="${a.hex}" style="background:${a.hex}" title="${a.name}" type="button"></button>`).join('')}
    </div>
    ${sliderRow('tint', 'GLASS TINT', 10, 80, 1, '%')}
    <div class="note-box"><b>${PAINTS.find(p => p.hex.toLowerCase() === build.paint.toLowerCase())?.name || 'CUSTOM MIX'}</b> · ${FINISHES[build.finish].name} finish. Paint is a real PBR material with clearcoat, flake and environment reflection.</div>
  `;
}

function renderAudioTab() {
  return `
    <div class="section-label"><h3>ENGINE VOICE</h3><p>Procedural synthesis. No samples, infinite tuning.</p></div>
    <div class="option-grid">
      ${Object.values(AUDIO_PROFILES).map(a => optionButton('audioProfile', a.id, build.audioProfile === a.id, a.name, `${a.pitch} PITCH / ${a.rasp} RASP`)).join('')}
    </div>
    <div class="audio-visual" id="audioBars" aria-hidden="true">
      ${Array.from({ length: 30 }, () => '<i></i>').join('')}
    </div>
    ${sliderRow('soundPitch', 'PITCH', 20, 95, 1, '%')}
    ${sliderRow('soundRumble', 'RUMBLE', 10, 100, 1, '%')}
    ${sliderRow('soundRasp', 'RASP', 5, 100, 1, '%')}
    ${sliderRow('soundTurbo', 'TURBO WHISTLE', 0, 100, 1, '%')}
    ${sliderRow('soundPops', 'OVERRUN POPS', 0, 100, 1, '%')}
    ${sliderRow('volume', 'MASTER VOLUME', 0, 100, 1, '%')}
    <button class="rev-button" id="revBtn" type="button">AUDITION POWERTRAIN <b>REV ↗</b></button>
    <div class="note-box"><b>Live oscillator stack.</b> Engine note follows RPM, throttle, boost and overrun. Lift off at high RPM for pops and turbo flutter.</div>
  `;
}

function renderTuneTab() {
  return `
    <div class="section-label"><h3>CHASSIS &amp; FEEL</h3><p>Numbers that change how the car actually drives.</p></div>
    ${sliderRow('suspension', 'SUSPENSION', 20, 90, 1, '%')}
    ${sliderRow('grip', 'TYRE GRIP', 35, 100, 1, '%')}
    ${sliderRow('downforce', 'DOWNFORCE', 0, 100, 1, '%')}
    ${sliderRow('gearing', 'GEARING', 20, 90, 1, '%')}
    ${sliderRow('brake', 'BRAKE POWER', 20, 100, 1, '%')}
    <div class="toggle-row">
      <label>STABILITY ASSIST</label>
      <button class="toggle${build.assist ? ' is-on' : ''}" data-toggle="assist" aria-label="Toggle stability assist" type="button"></button>
    </div>
    <div class="note-box"><b>Simulation live.</b> Grip changes lateral damping. Downforce adds high-speed stability. Gearing changes shift points. Brake power is real deceleration.</div>
    <div class="section-label"><h3>CURATED BUILDS</h3><p>Start here, then make it strange.</p></div>
    <div class="option-grid">
      ${PRESETS.map((p, i) => `<button class="option" data-preset="${i}" type="button"><span class="tag">${p.name}</span><small>${p.tags}</small></button>`).join('')}
    </div>
  `;
}

const tabRenderers = {
  engine: renderEngineTab,
  body: renderBodyTab,
  wheels: renderWheelsTab,
  paint: renderPaintTab,
  audio: renderAudioTab,
  tune: renderTuneTab
};

function renderTabs() {
  buildTabsEl.innerHTML = TABS.map(t => `<button class="tab${currentTab === t.id ? ' is-active' : ''}" data-tab="${t.id}" role="tab" aria-selected="${currentTab === t.id}" type="button"><small>${t.num}</small><span>${t.label}</span></button>`).join('');
}

function refreshRangeFills() {
  $$('#buildContent input[type=range]').forEach(rangeFill);
}

function renderBuildTab(tab = currentTab) {
  currentTab = tab;
  const scroll = buildContentEl.scrollTop;
  buildContentEl.innerHTML = tabRenderers[tab]();
  buildContentEl.scrollTop = scroll;
  refreshRangeFills();
  const active = TABS.find(t => t.id === tab);
  $('#tabIndex').textContent = active.num;
  renderTabs();
}

function updateStatsUI() {
  stats = computeStats(build);
  const integer = (n) => nf.format(n);
  $('#statHp').textContent = integer(stats.power);
  $('#statEngine').textContent = stats.engine.name;
  $('#statZero').innerHTML = `${stats.zeroTo100.toFixed(1)}<small>s</small>`;
  $('#statTop').innerHTML = `${stats.topSpeed}<small>km/h</small>`;
  $('#statWeight').innerHTML = `${integer(stats.weight)}<small>kg</small>`;
  $('#gripValue').textContent = stats.gripRating;
  $('#aeroValue').textContent = stats.aero;
  $('#brakeValue').textContent = stats.braking;
  $('#balanceValue').textContent = stats.balance;
  $('#gripBar').style.width = `${stats.gripRating}%`;
  $('#aeroBar').style.width = `${stats.aero}%`;
  $('#brakeBar').style.width = `${stats.braking}%`;
  $('#balanceBar').style.width = `${stats.balance}%`;
  $('#specInduction').textContent = stats.induction.name;
  $('#specBody').textContent = stats.body.name;
  $('#specWing').textContent = stats.wing.name;
  $('#specDrive').textContent = stats.drivetrain.name;
  $('#specAudio').textContent = AUDIO_PROFILES[build.audioProfile]?.name || 'CUSTOM';
  $('#hudHp').textContent = `${integer(stats.power)} HP`;
  $('#hudBuildName').textContent = build.name;
  $('#specAudio').textContent = AUDIO_PROFILES[build.audioProfile]?.name || 'CUSTOM';
}

function updateOutput(key, value, unit) {
  const out = buildContentEl.querySelector(`[data-output="${key}"]`);
  if (out) out.innerHTML = `${value}${unit ? `<span>${unit}</span>` : ''}`;
}

function saveSoon() {
  clearTimeout(saveSoon.timer);
  saveSoon.timer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(build)); } catch {}
    const tag = $('#savedTag');
    tag.classList.add('flash');
    setTimeout(() => tag.classList.remove('flash'), 500);
  }, 280);
}

function onBuildChange(key, value, { rerender = false } = {}) {
  build[key] = value;
  if (key === 'induction' && value === 'na') build.boost = 0;
  if (key === 'engine' && ENGINES[value]?.electric) {
    build.induction = 'na';
    build.boost = 0;
    build.exhaust = 'quiet';
    build.audioProfile = 'electric';
  }
  if ((key === 'wing' && (value === 'none' || value === 'duck')) || key === 'underglow') {
    // no special handling; the mesh builder simply ignores incompatible parts.
  }
  if (VISUAL_KEYS.has(key)) rebuildShowroomSoon();
  saveSoon();
  updateStatsUI();
  audio.setProfile(getAudioProfile(build));
  if (rerender) renderBuildTab();
}

buildTabsEl.addEventListener('click', (event) => {
  const tab = event.target.closest('[data-tab]');
  if (!tab) return;
  renderBuildTab(tab.dataset.tab);
});

buildContentEl.addEventListener('click', (event) => {
  const preset = event.target.closest('[data-preset]');
  if (preset) {
    const p = PRESETS[Number(preset.dataset.preset)];
    build = { ...build, ...p.patch, name: p.name };
    $('#buildNameInput').value = build.name;
    updateStatsUI();
    renderBuildTab(currentTab);
    rebuildShowroomSoon(0);
    saveSoon();
    audio.setProfile(getAudioProfile(build));
    toast(`Loaded <b>${p.name}</b>`);
    return;
  }
  const choice = event.target.closest('[data-choice]');
  if (choice) {
    onBuildChange(choice.dataset.choice, choice.dataset.value, { rerender: true });
    return;
  }
  const colour = event.target.closest('[data-colour]');
  if (colour) {
    onBuildChange(colour.dataset.colour, colour.dataset.value, { rerender: true });
    return;
  }
  const toggle = event.target.closest('[data-toggle]');
  if (toggle) {
    const key = toggle.dataset.toggle;
    build[key] = !build[key];
    toggle.classList.toggle('is-on', build[key]);
    saveSoon();
    updateStatsUI();
    return;
  }
  if (event.target.closest('#revBtn')) {
    ensureAudio();
    revStart = performance.now();
    revUntil = revStart + 1600;
    audio.rev(1.35);
  }
});

buildContentEl.addEventListener('input', (event) => {
  const input = event.target;
  if (input.matches('input[type=range]')) {
    const key = input.dataset.key;
    const value = Number(input.value);
    rangeFill(input);
    updateOutput(key, value, input.dataset.unit);
    onBuildChange(key, value);
    if (key === 'volume') audio.setVolume(value);
    if (key === 'soundPitch' || key === 'soundRumble' || key === 'soundRasp' || key === 'soundTurbo' || key === 'soundPops') {
      audio.setProfile(getAudioProfile(build));
    }
  } else if (input.matches('input[type=color]')) {
    const key = input.dataset.key;
    const value = input.value;
    onBuildChange(key, value, { rerender: true });
    input.closest('.swatch').style.background = value;
  }
});

buildContentEl.addEventListener('change', (event) => {
  if (event.target.matches('input[type=color]')) {
    renderBuildTab(currentTab);
  }
});

$('#randomizeBtn').addEventListener('click', randomize);
$('#resetBtn').addEventListener('click', resetBuild);
$('#buildNameInput').addEventListener('input', (event) => {
  build.name = event.target.value.slice(0, 24) || 'UNTITLED BUILD';
  updateStatsUI();
  rebuildShowroomSoon(180);
  saveSoon();
});
$('#buildNameInput').addEventListener('blur', () => {
  event.target.value = build.name;
});

function randomize() {
  ensureAudio();
  build = randomiseBuild(build);
  $('#buildNameInput').value = build.name;
  updateStatsUI();
  renderBuildTab(currentTab);
  rebuildShowroomSoon(0);
  saveSoon();
  audio.setProfile(getAudioProfile(build));
  toast(`Randomised to <b>${build.name}</b>`);
}

function resetBuild() {
  build = { ...DEFAULT_BUILD };
  $('#buildNameInput').value = build.name;
  updateStatsUI();
  renderBuildTab(currentTab);
  rebuildShowroomSoon(0);
  saveSoon();
  audio.setProfile(getAudioProfile(build));
  toast('Build reset to <b>VANTAGE // RS</b>');
}

function toast(message) {
  const el = $('#toast');
  el.innerHTML = message;
  el.classList.add('is-show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('is-show'), 2200);
}

/* ------------------------------------------------------------------ */
/* Audio bootstrap                                                     */
/* ------------------------------------------------------------------ */
async function ensureAudio() {
  if (!audio.ready) {
    await audio.init(getAudioProfile(build));
    audio.setVolume(build.volume);
    audio.setMuted(!soundOn);
  } else {
    await audio.ctx?.resume();
    audio.setProfile(getAudioProfile(build));
  }
}
$('#soundBtn').addEventListener('click', async () => {
  soundOn = !soundOn;
  $('#soundBtn').classList.toggle('is-muted', !soundOn);
  $('#soundLabel').textContent = soundOn ? 'AUDIO ON' : 'AUDIO OFF';
  if (soundOn) await ensureAudio();
  audio.setMuted(!soundOn);
});

/* ------------------------------------------------------------------ */
/* Showroom interaction                                                */
/* ------------------------------------------------------------------ */
let dragging = false;
let dragX = 0;
let dragY = 0;
let dragMode = 'showroom';

canvas.addEventListener('pointerdown', (event) => {
  dragging = true;
  dragX = event.clientX;
  dragY = event.clientY;
  dragMode = mode;
  canvas.setPointerCapture(event.pointerId);
  showroom.setDragging(true);
});
canvas.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  const dx = event.clientX - dragX;
  const dy = event.clientY - dragY;
  dragX = event.clientX;
  dragY = event.clientY;
  if (dragMode === 'garage') {
    showroom.pivot.rotation.y += dx * 0.007;
    showroom.setView({ pitch: clamp(showroom.view.pitch + dy * 0.002, 0.05, 0.48) });
  } else if (mode === 'drive' && cameraMode === 'orbit') {
    orbitYaw -= dx * 0.005;
    orbitPitch = clamp(orbitPitch + dy * 0.003, -0.05, 0.65);
  }
});
canvas.addEventListener('pointerup', () => {
  dragging = false;
  showroom.setDragging(false);
});
canvas.addEventListener('pointercancel', () => {
  dragging = false;
  showroom.setDragging(false);
});
canvas.addEventListener('wheel', (event) => {
  if (mode !== 'garage') return;
  event.preventDefault();
  showroom.setView({ distance: clamp(showroom.view.distance + event.deltaY * 0.006, 6.5, 15) });
}, { passive: false });

/* ------------------------------------------------------------------ */
/* Mode transitions                                                    */
/* ------------------------------------------------------------------ */
let mode = 'garage';
let paused = false;
let helpOpen = false;
let transitioning = false;
let cameraMode = build.camera || 'chase';
let orbitYaw = 0;
let orbitPitch = 0.2;
let orbitDistance = 8.5;
let introProgress = 0;
let cameraShake = 0;
let damageFlashTimer = 0;

$('#driveBtn').addEventListener('click', enterDrive);
$('#driveBtnMobile').addEventListener('click', enterDrive);
$('#pauseBtn').addEventListener('click', pauseGame);
$('#resumeBtn').addEventListener('click', resumeGame);
$('#pauseResetBtn').addEventListener('click', () => { resetCar(true); resumeGame(); });
$('#pauseGarageBtn').addEventListener('click', returnToGarage);
$('#repairBtn').addEventListener('click', () => resetCar(true));
$('#cameraBtn').addEventListener('click', cycleCamera);
$('#helpBtn').addEventListener('click', openHelp);
$('#closeHelpBtn').addEventListener('click', closeHelp);
$('#helpOverlay').addEventListener('click', (e) => { if (e.target === $('#helpOverlay')) closeHelp(); });
$('#pauseOverlay').addEventListener('click', (e) => { if (e.target === $('#pauseOverlay')) resumeGame(); });

async function enterDrive() {
  if (mode === 'drive' || transitioning) return;
  transitioning = true;
  await ensureAudio();
  audio.rev(0.8);
  $('#transitionWord').textContent = 'SECTOR 04';
  $('#transition').classList.add('is-active');
  setTimeout(() => {
    buildWorldCar();
    mode = 'drive';
    paused = false;
    document.body.dataset.mode = 'drive';
    activeScene = world.scene;
    activeCamera = driveCamera;
    $('#showroomUI').classList.add('is-hidden');
    $('#hud').classList.add('is-visible');
    $('#hud').setAttribute('aria-hidden', 'false');
    $('#showroomUI').setAttribute('aria-hidden', 'true');
    $('#pauseOverlay').classList.remove('is-visible');
    closeHelp();
    introProgress = 0;
    orbitYaw = physics.yaw;
    positionCameraImmediate();
    setTimeout(() => $('#transition').classList.remove('is-active'), 380);
    setTimeout(() => { transitioning = false; }, 700);
    showEvent('SEND IT', '+0', 'SECTOR 04');
  }, 340);
}

function returnToGarage() {
  if (mode === 'garage') return;
  paused = false;
  mode = 'garage';
  document.body.dataset.mode = 'garage';
  $('#pauseOverlay').classList.remove('is-visible');
  $('#pauseOverlay').setAttribute('aria-hidden', 'true');
  $('#hud').classList.remove('is-visible');
  $('#hud').setAttribute('aria-hidden', 'true');
  $('#showroomUI').classList.remove('is-hidden');
  $('#showroomUI').setAttribute('aria-hidden', 'false');
  activeScene = showroom.scene;
  activeCamera = showroom.camera;
  buildShowroomCar();
  showroom.pivot.rotation.y = -0.16;
  audio.setProfile(getAudioProfile(build));
  updateStatsUI();
}

function pauseGame() {
  if (mode !== 'drive' || paused) return;
  paused = true;
  $('#pauseOverlay').classList.add('is-visible');
  $('#pauseOverlay').setAttribute('aria-hidden', 'false');
  $('#pauseDamage').textContent = `${Math.round(worldCar ? worldCar.damage : 0)}%`;
  $('#pauseScore').textContent = nf.format(score);
  $('#pauseSpeed').textContent = `${Math.round(physics.maxSpeed)} KM/H`;
  clearInputs();
}

function resumeGame() {
  paused = false;
  $('#pauseOverlay').classList.remove('is-visible');
  $('#pauseOverlay').setAttribute('aria-hidden', 'true');
}

function openHelp() {
  helpOpen = true;
  $('#helpOverlay').classList.add('is-visible');
  $('#helpOverlay').setAttribute('aria-hidden', 'false');
}
function closeHelp() {
  helpOpen = false;
  $('#helpOverlay').classList.remove('is-visible');
  $('#helpOverlay').setAttribute('aria-hidden', 'true');
}

/* ------------------------------------------------------------------ */
/* Vehicle physics                                                     */
/* ------------------------------------------------------------------ */
const physics = {
  pos: new THREE.Vector3(),
  vel: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  roll: 0,
  yawRate: 0,
  pitchRate: 0,
  rollRate: 0,
  vy: 0,
  grounded: true,
  climbRate: 0,
  throttle: 0,
  brake: 0,
  steer: 0,
  handbrake: false,
  nitroInput: false,
  nitro: 100,
  rpm: 900,
  gear: 1,
  engineLoad: 0,
  speed: 0,
  lateral: 0,
  longSpeed: 0,
  airTime: 0,
  maxSpeed: 0,
  damage: 0,
  score: 0,
  distance: 0,
  boost: 0,
  limiter: false,
  driftDistance: 0
};
let score = 0;
let combo = 1;
let comboTimer = 0;
let lastShiftGear = 1;
let lastTireSmoke = 0;
let lastDamageSmoke = 0;
let lastNitroFlame = 0;
let damageFlash = 0;

const input = { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false };
const keys = Object.create(null);
const touch = Object.create(null);
let detachedDebris = [];

function clearInputs() {
  input.throttle = 0;
  input.brake = 0;
  input.steer = 0;
  input.handbrake = false;
  input.nitro = false;
  for (const k of Object.keys(keys)) keys[k] = false;
  for (const k of Object.keys(touch)) touch[k] = false;
  $$('.touch-controls button').forEach(b => b.classList.remove('is-down'));
}

function resetProps() {
  for (const s of world.smashables) {
    s.group.position.set(s.x, 0, s.z);
    s.group.rotation.set(0, 0, 0);
    s.group.visible = true;
    s.smashed = false;
    s.life = 0;
    s.vel = null;
    s.ang = null;
  }
  for (const d of detachedDebris) {
    d.parent?.remove(d);
    d.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
  detachedDebris = [];
}

function buildWorldCar() {
  if (worldCar) {
    world.scene.remove(worldCar.group);
    worldCar.dispose();
  }
  resetProps();
  worldCar = createCar(build);
  world.scene.add(worldCar.group);
  stats = worldCar.stats;
  resetCar(true);
}

function resetCar(repair = true) {
  if (!worldCar) return;
  if (repair) {
    world.scene.remove(worldCar.group);
    worldCar.dispose();
    worldCar = createCar(build);
    world.scene.add(worldCar.group);
    stats = worldCar.stats;
  }
  physics.pos.copy(world.spawn);
  physics.vel.set(0, 0, 0);
  physics.yaw = world.spawnYaw;
  physics.pitch = 0;
  physics.roll = 0;
  physics.yawRate = 0;
  physics.pitchRate = 0;
  physics.rollRate = 0;
  physics.vy = 0;
  physics.grounded = true;
  physics.climbRate = 0;
  physics.throttle = 0;
  physics.brake = 0;
  physics.steer = 0;
  physics.handbrake = false;
  physics.nitro = 100;
  physics.rpm = 900;
  physics.gear = 1;
  physics.engineLoad = 0;
  physics.speed = 0;
  physics.lateral = 0;
  physics.longSpeed = 0;
  physics.airTime = 0;
  physics.maxSpeed = 0;
  physics.damage = 0;
  physics.boost = 0;
  physics.limiter = false;
  physics.driftDistance = 0;
  worldCar.damage = 0;
  updateCarTransform();
  world.updateSun(physics.pos);
  resetProps();
  toast('Vehicle <b>repaired</b> and returned to sector 04');
}

function updateCarTransform() {
  if (!worldCar) return;
  worldCar.group.position.copy(physics.pos);
  worldCar.group.quaternion.setFromEuler(new THREE.Euler(physics.pitch, physics.yaw, physics.roll, 'YXZ'));
}

function readDrivingInput() {
  const gas = (keys.KeyW || keys.ArrowUp || touch.gas) ? 1 : 0;
  const brake = (keys.KeyS || keys.ArrowDown || touch.brake) ? 1 : 0;
  const left = (keys.KeyA || keys.ArrowLeft || touch.left) ? 1 : 0;
  const right = (keys.KeyD || keys.ArrowRight || touch.right) ? 1 : 0;
  input.throttle = gas;
  input.brake = brake;
  input.steer = right - left;
  input.handbrake = !!(keys.Space || touch.handbrake);
  input.nitro = !!(keys.ShiftLeft || keys.ShiftRight || touch.nitro);
}

const tmpF = new THREE.Vector3();
const tmpR = new THREE.Vector3();
const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();

function stepPhysics(dt) {
  if (!worldCar) return;
  const s = physics;
  const d = worldCar.dimensions;
  const st = worldCar.stats;
  readDrivingInput();

  s.throttle = damp(s.throttle, input.throttle, 9, dt);
  s.brake = damp(s.brake, input.brake, 14, dt);
  s.steer = damp(s.steer, input.steer, 10, dt);
  s.handbrake = input.handbrake;
  s.nitroInput = input.nitro;

  tmpF.set(Math.sin(s.yaw), 0, Math.cos(s.yaw));
  tmpR.set(Math.cos(s.yaw), 0, -Math.sin(s.yaw));
  let vLong = s.vel.dot(tmpF);
  let vLat = s.vel.dot(tmpR);
  s.longSpeed = vLong;
  s.lateral = vLat;

  const kmh = Math.abs(vLong) * 3.6;
  const damageFactor = 1 - clamp(worldCar.damage / 100, 0, 1) * 0.38;
  const powerFactor = (st.power / 720) * damageFactor;
  const topMs = st.topSpeed / 3.6;
  const awd = st.drivetrain.id === 'awd';
  let drive = 0;

  if (s.grounded) {
    if (s.throttle > 0.02) {
      const falloff = Math.max(0.06, 1 - Math.pow(clamp(Math.max(0, vLong) / topMs, 0, 1), 2.25));
      drive += s.throttle * (11.3 * powerFactor) * falloff * (awd ? 1.12 : 1);
    }
    // Brake / reverse.
    if (s.brake > 0.02) {
      if (vLong > 0.5) {
        const dec = s.brake * (12.5 + st.braking * 0.12);
        vLong = Math.max(0, vLong - dec * dt);
      } else if (vLong > -13) {
        vLong = Math.max(-13, vLong - s.brake * (4.3 * powerFactor) * dt);
      }
    }
    if (s.handbrake) {
      vLong -= Math.sign(vLong) * Math.min(Math.abs(vLong), 5.2 * dt);
    }
    if (s.nitroInput && s.nitro > 0 && s.throttle > 0.25) {
      drive *= 1.48;
      s.nitro = Math.max(0, s.nitro - 23 * dt);
    } else {
      s.nitro = Math.min(100, s.nitro + 3.5 * dt);
    }
    vLong += drive * dt;

    const latGrip = s.handbrake ? 1.2 : (5.4 + st.gripRating * 0.046) * (build.assist ? 1.08 : 0.9);
    vLat *= Math.exp(-latGrip * dt);

    const speedNow = Math.hypot(vLong, vLat);
    const drag = 0.32 + 0.00034 * speedNow * speedNow;
    if (Math.abs(vLong) > 0.02) vLong -= Math.sign(vLong) * Math.min(Math.abs(vLong), drag * dt);
  } else {
    vLat *= Math.exp(-0.18 * dt);
    s.nitro = Math.min(100, s.nitro + 1.5 * dt);
  }

  // Steering. Reverse inverts steering, just like a real car.
  const moveSign = vLong < -0.4 ? -1 : 1;
  const authority = clamp(Math.abs(vLong) / 5.5, 0, 1) * clamp(1.2 - Math.abs(vLong) / 78, 0.18, 1);
  const targetYawRate = s.steer * 0.94 * authority * moveSign * (s.handbrake ? 1.42 : 1) * (0.9 + st.gripRating / 600);
  s.yawRate = damp(s.yawRate, targetYawRate, s.grounded ? 7.5 : 1.5, dt);
  s.yaw += s.yawRate * dt;

  s.vel.copy(tmpF).multiplyScalar(vLong).addScaledVector(tmpR, vLat);
  s.pos.x += s.vel.x * dt;
  s.pos.z += s.vel.z * dt;
  s.distance += Math.hypot(s.vel.x, s.vel.z) * dt;

  // Vertical and ramp launching.
  const groundNow = world.getGroundHeight(s.pos.x, s.pos.z);
  if (s.grounded) {
    if (groundNow < s.pos.y - 0.15) {
      s.grounded = false;
      s.vy = clamp(s.climbRate, -2, 16);
      s.pitchRate = 0.09;
      s.rollRate = -s.steer * 0.24;
    } else {
      const climb = (groundNow - s.pos.y) / Math.max(dt, 0.0001);
      s.climbRate = clamp(climb, -24, 24);
      s.pos.y = groundNow;
      s.vy = 0;
    }
  }
  if (!s.grounded) {
    s.airTime += dt;
    s.vy -= 9.81 * dt;
    s.pos.y += s.vy * dt;
    s.yaw += s.yawRate * dt * 0.3;
    if (s.pos.y <= groundNow) {
      const landing = Math.abs(s.vy);
      s.pos.y = groundNow;
      s.vy = 0;
      s.grounded = true;
      s.climbRate = 0;
      if (landing > 3.2) handleLanding(landing);
      s.pitchRate = 0;
      s.rollRate = 0;
    }
  } else {
    s.airTime = 0;
  }

  // Body attitude from terrain + load transfer.
  if (s.grounded) {
    const wb = d.wheelBase;
    const track = d.track * 1.7;
    const hF = world.getGroundHeight(s.pos.x + tmpF.x * wb * 0.5, s.pos.z + tmpF.z * wb * 0.5);
    const hR = world.getGroundHeight(s.pos.x - tmpF.x * wb * 0.5, s.pos.z - tmpF.z * wb * 0.5);
    const hRt = world.getGroundHeight(s.pos.x + tmpR.x * track * 0.5, s.pos.z + tmpR.z * track * 0.5);
    const hL = world.getGroundHeight(s.pos.x - tmpR.x * track * 0.5, s.pos.z - tmpR.z * track * 0.5);
    const terrainPitch = -Math.atan2(hF - hR, wb);
    const terrainRoll = Math.atan2(hRt - hL, track);
    const loadPitch = clamp(-drive * 0.0055 + s.brake * 0.026, -0.055, 0.05);
    const loadRoll = clamp(-s.yawRate * Math.abs(vLong) * 0.012, -0.095, 0.095);
    s.pitch = damp(s.pitch, terrainPitch + loadPitch, 8, dt);
    s.roll = damp(s.roll, terrainRoll + loadRoll, 8, dt);
    s.pitchRate = 0;
    s.rollRate = 0;
  } else {
    s.pitch += s.pitchRate * dt;
    s.roll += s.rollRate * dt;
    s.pitch = clamp(s.pitch, -0.8, 0.8);
    s.roll = clamp(s.roll, -0.9, 0.9);
  }

  s.speed = Math.hypot(s.vel.x, s.vel.z) * 3.6;
  s.maxSpeed = Math.max(s.maxSpeed, s.speed);
  s.engineLoad = s.throttle;
  s.boost = (build.induction === 'na' ? 0 : build.boost) * s.throttle * clamp(0.3 + Math.abs(vLong) / 25, 0, 1);

  // Automatic gearbox model.
  const top = st.topSpeed;
  const spread = 0.92 + (100 - build.gearing) * 0.0022;
  const ratio = [0, 0.18, 0.31, 0.46, 0.63, 0.82, 1].map(v => v * top * spread);
  let gear = s.gear;
  while (gear < 6 && kmh > ratio[gear] * 0.99) gear++;
  while (gear > 1 && kmh < ratio[gear - 1] * 0.78) gear--;
  if (gear !== s.gear) {
    audio.shift(gear > s.gear);
    s.gear = gear;
  }
  const lo = ratio[s.gear - 1];
  const hi = ratio[s.gear];
  const frac = clamp((kmh - lo) / Math.max(1, hi - lo), 0, 1);
  const targetRpm = 900 + frac * (st.engine.redline - 900) * 0.95 + s.throttle * 160;
  s.rpm = damp(s.rpm, targetRpm, 9, dt);
  s.limiter = s.rpm > st.engine.redline * 0.965 && s.throttle > 0.2;

  updateCarTransform();
  worldCar.setSteer(s.steer * 0.95);
  if (s.grounded) worldCar.spinWheels(vLong * dt, dt);

  collideWorld();
  collideSmashables();
}

function handleLanding(impact) {
  cameraShake = Math.min(1.3, impact * 0.056);
  spawnDust(physics.pos, 8, 0.5);
  if (impact > 7) {
    const severity = clamp(impact / 18, 0.15, 1);
    if (worldCar) {
      worldCar.deform(new THREE.Vector3(0, 0.45, 0), severity * 0.75);
      physics.damage = worldCar.damage;
      audio.crash(severity * 0.7);
      damageFlash = 0.4;
      scoreEvent(impact * 14, 'HARD LANDING', 'TOUCHDOWN');
    }
  }
  if (physics.airTime > 0.45) {
    const air = physics.airTime;
    const points = Math.round(air * 850 + impact * 18);
    scoreEvent(points, air > 1.4 ? 'MASSIVE AIR' : 'AIRBORNE', air > 1.4 ? 'SEND IT' : 'STUNT');
    toast(`Air time <b>${air.toFixed(2)}s</b> · +${Math.round(points)}`);
  }
}

/* ------------------------------------------------------------------ */
/* Collisions                                                          */
/* ------------------------------------------------------------------ */
const _sensor = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _closest = new THREE.Vector3();
const _point = new THREE.Vector3();

function collideWorld() {
  if (!worldCar) return;
  const d = worldCar.dimensions;
  const sensors = [
    [-d.W * 0.44, 0.52, d.L * 0.47],
    [d.W * 0.44, 0.52, d.L * 0.47],
    [-d.W * 0.44, 0.52, -d.L * 0.47],
    [d.W * 0.44, 0.52, -d.L * 0.47],
    [0, 0.52, d.L * 0.5],
    [0, 0.52, -d.L * 0.5]
  ];
  let best = null;

  for (const collider of world.colliders) {
    const box = collider.box;
    if (box.distanceToPoint(_point.copy(physics.pos).setY(0.55)) > 5.3) continue;
    for (const s of sensors) {
      _sensor.set(...s).applyQuaternion(worldCar.group.quaternion).add(physics.pos);
      if (!box.containsPoint(_sensor)) continue;
      const dxMin = _sensor.x - box.min.x;
      const dxMax = box.max.x - _sensor.x;
      const dyMin = _sensor.y - box.min.y;
      const dyMax = box.max.y - _sensor.y;
      const dzMin = _sensor.z - box.min.z;
      const dzMax = box.max.z - _sensor.z;
      const min = Math.min(dxMin, dxMax, dzMin, dzMax);
      let nx = 0, nz = 0;
      if (min === dxMin) nx = -1;
      else if (min === dxMax) nx = 1;
      else if (min === dzMin) nz = -1;
      else nz = 1;
      if (!best || min > best.penetration) {
        best = { collider, penetration: min, nx, nz, point: _sensor.clone() };
      }
    }
  }
  if (!best) return;

  const n = _normal.set(best.nx, 0, best.nz).normalize();
  physics.pos.addScaledVector(n, best.penetration + 0.02);
  const vn = physics.vel.dot(n);
  if (vn < 0) {
    const impact = -vn * (best.collider.soft ? 0.45 : 1);
    physics.vel.addScaledVector(n, -(1 + 0.16) * vn);
    const leverX = best.point.x - physics.pos.x;
    const leverZ = best.point.z - physics.pos.z;
    const torque = (leverX * n.z - leverZ * n.x);
    physics.yawRate += clamp(torque * impact * 0.012, -0.6, 0.6);
    physics.vy += Math.min(2.2, impact * 0.06);
    if (impact > 4.2) {
      const now = performance.now();
      if (!best.collider.lastHit || now - best.collider.lastHit > 260) {
        best.collider.lastHit = now;
        handleCrash(best.point, n, impact, best.collider.kind);
      }
    }
  }
  updateCarTransform();
}

function collideSmashables() {
  if (!worldCar) return;
  const speed = physics.speed;
  if (speed < 9) return;
  for (const s of world.smashables) {
    if (s.smashed) continue;
    const dx = s.x - physics.pos.x;
    const dz = s.z - physics.pos.z;
    if (dx * dx + dz * dz > 15) continue;
    s.smashed = true;
    s.life = 3.2;
    const dir = new THREE.Vector3(dx, 0, dz).normalize();
    const force = clamp(speed * 0.19, 2.5, 18);
    s.vel = new THREE.Vector3(dir.x * force + physics.vel.x * 0.12, 4 + Math.random() * 4, dir.z * force + physics.vel.z * 0.12);
    s.ang = new THREE.Vector3((Math.random() - .5) * 8, (Math.random() - .5) * 7, (Math.random() - .5) * 8);
    physics.vel.multiplyScalar(s.kind === 'cone' ? 0.996 : 0.985);
    const points = s.points * combo;
    scoreEvent(s.points, s.kind === 'cone' ? 'CONE KILL' : s.kind === 'barrel' ? 'BARREL SMASH' : 'CRATE CRUNCH', 'PROP DESTROYED');
    physics.damage = Math.min(100, physics.damage + (s.kind === 'cone' ? 0 : 0.8));
    spawnDebrisBurst(new THREE.Vector3(s.x, 0.5, s.z), s.kind === 'barrel' ? '#df4a21' : s.kind === 'crate' ? '#8d6e47' : '#ff6a00');
    challenges.smash++;
    updateChallengeUI();
  }
}

function handleCrash(point, normal, impact, kind) {
  if (!worldCar) return;
  const severity = clamp(impact / 24, 0.08, 1.15);
  tmpQ.copy(worldCar.group.quaternion).invert();
  const local = point.clone().sub(worldCar.group.position).applyQuaternion(tmpQ);
  local.y = clamp(local.y, 0.15, 1.2);
  worldCar.deform(local, severity);
  physics.damage = worldCar.damage;
  audio.crash(severity);
  cameraShake = Math.min(1.55, cameraShake + 0.2 + severity * 0.9);
  damageFlash = 0.55;
  spawnSparks(point, normal, 12 + Math.round(severity * 26));
  spawnImpactSmoke(point, 3 + Math.round(severity * 5));
  if (severity > 0.7) {
    for (const part of worldCar.detached) {
      if (!detachedDebris.includes(part)) {
        const clone = part.clone(true);
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        part.getWorldPosition(worldPos);
        part.getWorldQuaternion(worldQuat);
        clone.position.copy(worldPos);
        clone.quaternion.copy(worldQuat);
        world.scene.add(clone);
        detachedDebris.push(clone);
        clone.userData.debrisVel = new THREE.Vector3(
          (Math.random() - .5) * 4, 3 + Math.random() * 4, (Math.random() - .5) * 4
        );
        clone.userData.debrisAng = new THREE.Vector3(Math.random() * 3, Math.random() * 2, Math.random() * 2);
      }
    }
  }
  const points = Math.round(impact * (kind === 'wall' ? 92 : 58) * combo);
  scoreEvent(points, severity > 0.8 ? 'BIG IMPACT' : 'CONTACT', kind === 'wall' ? 'IMPACT WALL' : 'CHASSIS DAMAGE');
  challenges.damage += impact * 105;
  updateChallengeUI();
  if (worldCar.damage > 96) toast('Chassis is <b>wrecked</b>. Press R to repair.');
}

/* ------------------------------------------------------------------ */
/* Particles                                                           */
/* ------------------------------------------------------------------ */
function particleTexture() {
  return makeCanvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(.28, 'rgba(255,255,255,.82)');
    g.addColorStop(.65, 'rgba(255,255,255,.2)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

class ParticlePool {
  constructor(scene, count, blending, scale = 320) {
    this.count = count;
    this.cursor = 0;
    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    this.sizes = new Float32Array(count);
    this.alphas = new Float32Array(count);
    this.vel = new Array(count).fill(null).map(() => new THREE.Vector3());
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count);
    this.gravity = new Float32Array(count);
    this.drag = new Float32Array(count);
    this.growth = new Float32Array(count);
    for (let i = 0; i < count; i++) this.positions[i * 3 + 1] = -100;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: particleTexture() }, uScale: { value: scale } },
      vertexShader: `
        attribute float size;
        attribute float alpha;
        attribute vec3 color;
        varying float vAlpha;
        varying vec3 vColor;
        uniform float uScale;
        void main() {
          vAlpha = alpha;
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(size * (uScale / max(0.1, -mv.z)), 1.0, 90.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          vec4 tex = texture2D(uMap, gl_PointCoord);
          float a = tex.a * vAlpha;
          if (a < 0.008) discard;
          gl_FragColor = vec4(vColor, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  spawn(pos, vel, life, size, color, gravity = 0, drag = 0.6, alpha = 0.5, growth = 0.4) {
    const i = this.cursor++ % this.count;
    this.positions[i * 3] = pos.x;
    this.positions[i * 3 + 1] = pos.y;
    this.positions[i * 3 + 2] = pos.z;
    this.vel[i].copy(vel);
    this.life[i] = life;
    this.maxLife[i] = life;
    this.sizes[i] = size;
    this.alphas[i] = alpha;
    this.gravity[i] = gravity;
    this.drag[i] = drag;
    this.growth[i] = growth;
    const c = new THREE.Color(color);
    this.colors[i * 3] = c.r;
    this.colors[i * 3 + 1] = c.g;
    this.colors[i * 3 + 2] = c.b;
  }
  update(dt) {
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.alphas[i] = 0;
        this.positions[i * 3 + 1] = -100;
        continue;
      }
      const drag = Math.exp(-this.drag[i] * dt);
      this.vel[i].multiplyScalar(drag);
      this.vel[i].y -= this.gravity[i] * dt;
      this.positions[i * 3] += this.vel[i].x * dt;
      this.positions[i * 3 + 1] += this.vel[i].y * dt;
      this.positions[i * 3 + 2] += this.vel[i].z * dt;
      if (this.positions[i * 3 + 1] < 0.03 && this.vel[i].y < 0) {
        this.positions[i * 3 + 1] = 0.03;
        this.vel[i].y *= -0.18;
        this.vel[i].x *= 0.55;
        this.vel[i].z *= 0.55;
      }
      this.sizes[i] += this.growth[i] * dt;
      this.alphas[i] = Math.max(0, (this.life[i] / this.maxLife[i]) * 0.75);
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    this.points.geometry.attributes.size.needsUpdate = true;
    this.points.geometry.attributes.alpha.needsUpdate = true;
  }
}
const smokeParticles = new ParticlePool(world.scene, 320, THREE.NormalBlending, 360);
const sparkParticles = new ParticlePool(world.scene, 380, THREE.AdditiveBlending, 300);
const flameParticles = new ParticlePool(world.scene, 180, THREE.AdditiveBlending, 290);

function spawnSparks(point, normal, count) {
  for (let i = 0; i < count; i++) {
    const vel = new THREE.Vector3(
      (Math.random() - .5) * 9 + normal.x * 4,
      Math.random() * 7 + 1.5,
      (Math.random() - .5) * 9 + normal.z * 4
    );
    sparkParticles.spawn(point, vel, 0.35 + Math.random() * .55, 0.035 + Math.random() * .05,
      Math.random() > .4 ? '#ffd278' : '#ff6a1d', 16, 0.4, 0.8, 0);
  }
}

function spawnImpactSmoke(point, count) {
  for (let i = 0; i < count; i++) {
    const vel = new THREE.Vector3((Math.random() - .5) * 2.6, 0.4 + Math.random() * 1.6, (Math.random() - .5) * 2.6);
    smokeParticles.spawn(point, vel, 1.1 + Math.random() * 1.5, .25 + Math.random() * .4,
      Math.random() > .6 ? '#c9c5b9' : '#7f7c73', -0.2, 0.8, 0.35, 0.55);
  }
}

function spawnTireSmoke(pos, strength = 1) {
  const vel = new THREE.Vector3((Math.random() - .5) * 1.6, .6 + Math.random(), (Math.random() - .5) * 1.6);
  smokeParticles.spawn(pos, vel, 1.0 + Math.random() * 1.25, .32 + Math.random() * .35,
    Math.random() > .3 ? '#b7b4a9' : '#8f8d86', -0.1, 0.9, 0.22 * strength, 0.5);
}

function spawnDust(pos, count, strength = 1) {
  for (let i = 0; i < count; i++) {
    const p = new THREE.Vector3(pos.x + (Math.random() - .5) * 2, .1 + Math.random() * .4, pos.z + (Math.random() - .5) * 2);
    const v = new THREE.Vector3((Math.random() - .5) * 3, .5 + Math.random() * 1.5, (Math.random() - .5) * 3);
    smokeParticles.spawn(p, v, 1.4 + Math.random(), .5 + Math.random() * .5, '#bd8b69', -0.05, .7, .25 * strength, .55);
  }
}

function spawnDebrisBurst(point, color) {
  for (let i = 0; i < 12; i++) {
    sparkParticles.spawn(point, new THREE.Vector3((Math.random() - .5) * 7, 2 + Math.random() * 6, (Math.random() - .5) * 7),
      0.4 + Math.random() * .7, .04 + Math.random() * .05, color, 15, .25, .9, 0);
  }
  spawnImpactSmoke(point, 2);
}

function spawnNitroFlame() {
  if (!worldCar) return;
  const d = worldCar.dimensions;
  for (const side of [-1, 1]) {
    const local = new THREE.Vector3(side * d.W * .2, .29, -d.L * .5 - .35);
    const p = worldCar.group.localToWorld(local);
    const v = new THREE.Vector3((Math.random() - .5) * 1.2, Math.random() * .5, -2 - Math.random() * 3).applyQuaternion(worldCar.group.quaternion);
    flameParticles.spawn(p, v, .18 + Math.random() * .15, .12 + Math.random() * .15, Math.random() > .35 ? '#6ce9ff' : '#ffb14e', 0, .8, .95, .6);
  }
}

function spawnEngineSmoke() {
  if (!worldCar) return;
  const local = new THREE.Vector3((Math.random() - .5) * .4, .9, worldCar.dimensions.L * .28);
  const p = worldCar.group.localToWorld(local);
  const v = new THREE.Vector3((Math.random() - .5) * .8, 1.4 + Math.random(), (Math.random() - .5) * .8);
  if (worldCar.damage > 86) {
    smokeParticles.spawn(p, v, 1.4, .7, '#3e3e3a', -0.1, .5, .45, .7);
    if (Math.random() > .55) flameParticles.spawn(p, v, .35, .4, '#ff5b19', 0, .5, .8, .4);
  } else {
    smokeParticles.spawn(p, v, 1.1, .32, '#585853', -.05, .6, .25, .45);
  }
}

function updateEffects(dt) {
  smokeParticles.update(dt);
  sparkParticles.update(dt);
  flameParticles.update(dt);

  if (!worldCar) return;
  const now = performance.now();
  const speed = physics.speed;
  const drifting = physics.grounded && Math.abs(physics.lateral) > 2.3 && Math.abs(physics.longSpeed) > 5;
  if (drifting && now - lastTireSmoke > 55) {
    lastTireSmoke = now;
    for (const w of worldCar.wheels) {
      if (w.front) continue;
      w.pivot.getWorldPosition(tmpV);
      spawnTireSmoke(tmpV, clamp(Math.abs(physics.lateral) / 8, 0.3, 1));
    }
    if (physics.grounded) {
      physics.driftDistance += Math.hypot(physics.vel.x, physics.vel.z) * dt;
      const status = $('#driftStatus');
      status.classList.add('is-on');
      status.innerHTML = `DRIFT <b>${Math.round(physics.driftDistance)} m</b>`;
    }
  } else if (physics.grounded) {
    $('#driftStatus').classList.remove('is-on');
    if (physics.driftDistance > 2) {
      const pts = Math.round(physics.driftDistance * 28 * combo);
      scoreEvent(pts, 'DRIFT', 'SLIDE');
      challenges.drift += physics.driftDistance;
      updateChallengeUI();
    }
    physics.driftDistance = 0;
  }

  if (physics.nitroInput && physics.nitro > 0 && physics.throttle > .25 && now - lastNitroFlame > 34) {
    lastNitroFlame = now;
    spawnNitroFlame();
  }
  if (worldCar.damage > 56 && now - lastDamageSmoke > (worldCar.damage > 85 ? 70 : 170)) {
    lastDamageSmoke = now;
    spawnEngineSmoke();
  }
  if (speed > 30 && Math.random() < dt * 0.9 && physics.grounded) {
    // a whisper of dust from the rear tyres on asphalt
    const w = worldCar.wheels.find(x => !x.front);
    if (w) {
      w.pivot.getWorldPosition(tmpV);
      spawnTireSmoke(tmpV, .18);
    }
  }
  updateDebris(dt);
}

function updateDebris(dt) {
  for (const s of world.smashables) {
    if (!s.smashed || !s.vel) continue;
    s.life -= dt;
    if (s.life <= 0) { s.group.visible = false; continue; }
    s.vel.y -= 9.81 * dt * 0.7;
    s.group.position.addScaledVector(s.vel, dt);
    if (s.group.position.y < 0.2) {
      s.group.position.y = 0.2;
      s.vel.y *= -0.28;
      s.vel.x *= 0.7;
      s.vel.z *= 0.7;
    }
    s.group.rotation.x += s.ang.x * dt;
    s.group.rotation.y += s.ang.y * dt;
    s.group.rotation.z += s.ang.z * dt;
  }
  for (const d of detachedDebris) {
    const v = d.userData.debrisVel;
    if (!v) continue;
    v.y -= 9.81 * dt;
    d.position.addScaledVector(v, dt);
    if (d.position.y < 0.15) { d.position.y = 0.15; v.y *= -.2; v.x *= .7; v.z *= .7; }
    const a = d.userData.debrisAng;
    d.rotation.x += a.x * dt;
    d.rotation.y += a.y * dt;
    d.rotation.z += a.z * dt;
  }
}

/* ------------------------------------------------------------------ */
/* Scoring, challenges, HUD                                            */
/* ------------------------------------------------------------------ */
const challenges = { speed: 0, air: 0, drift: 0, smash: 0, damage: 0 };
const challengeDone = new Set();

function renderChallenges() {
  $('#challengeList').innerHTML = CHALLENGES.map(c => `<li data-challenge="${c.id}">
    <div class="challenge-row"><span>${c.label}</span><b data-val="${c.id}">0</b></div>
    <div class="challenge-track"><i data-bar="${c.id}"></i></div>
  </li>`).join('');
}

function valueForChallenge(c) {
  if (c.id === 'speed') return challenges.speed;
  if (c.id === 'air') return challenges.air;
  if (c.id === 'drift') return challenges.drift;
  if (c.id === 'smash') return challenges.smash;
  if (c.id === 'damage') return challenges.damage;
  return 0;
}

function formatChallenge(c, value) {
  if (c.id === 'speed') return `${Math.round(value)} <small>KM/H</small>`;
  if (c.id === 'air') return `${value.toFixed(1)} <small>SEC</small>`;
  if (c.id === 'drift') return `${Math.round(value)} <small>M</small>`;
  if (c.id === 'smash') return `${value} <small>PCS</small>`;
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function updateChallengeUI() {
  let done = 0;
  for (const c of CHALLENGES) {
    const value = valueForChallenge(c);
    const ratio = clamp(value / c.target, 0, 1);
    const item = document.querySelector(`[data-challenge="${c.id}"]`);
    if (!item) continue;
    const bar = item.querySelector(`[data-bar="${c.id}"]`);
    const val = item.querySelector(`[data-val="${c.id}"]`);
    bar.style.width = `${ratio * 100}%`;
    val.innerHTML = formatChallenge(c, value);
    if (challengeDone.has(c.id)) {
      done++;
      item.classList.add('is-done');
    }
    if (value >= c.target && !challengeDone.has(c.id)) {
      challengeDone.add(c.id);
      done++;
      item.classList.add('is-done');
      score += c.reward;
      showEvent('CHALLENGE CLEARED', `+${c.reward}`, 'SECTOR 04');
      toast(`Challenge cleared: <b>${c.label}</b>`);
    }
  }
  $('#challengeDone').textContent = `${done} / ${CHALLENGES.length}`;
  const next = CHALLENGES.find(c => !challengeDone.has(c.id));
  $('#nextObjective').textContent = next ? next.label : 'ALL SECTOR CHALLENGES CLEARED';
  const note = next ? next.label.toLowerCase() : 'free send';
  const objective = $('#nextObjective').parentElement.querySelector('span:last-child');
  if (objective) objective.textContent = next ? `Reward $${next.reward.toLocaleString('en-US')} · keep sending.` : 'The grounds are yours.';
}

function scoreEvent(points, title, kicker = 'STUNT') {
  if (points <= 0) return;
  score += Math.round(points);
  combo = Math.min(9.9, combo + 0.12);
  comboTimer = 4.5;
  showEvent(title, `+${Math.round(points)}`, kicker);
}

let eventTimer = 0;
function showEvent(title, points, kicker = 'STUNT') {
  const el = $('#eventToast');
  $('#eventTitle').textContent = title;
  $('#eventPoints').textContent = points;
  el.querySelector('.event-kicker').textContent = kicker;
  el.classList.add('is-show');
  clearTimeout(eventTimer);
  eventTimer = setTimeout(() => el.classList.remove('is-show'), 1500);
}

function updateHud(dt) {
  if (!worldCar) return;
  const st = worldCar.stats;
  const speed = Math.round(physics.speed);
  $('#speedValue').textContent = speed;
  const maxGauge = Math.max(260, st.topSpeed + 20);
  const ratio = clamp(physics.speed / maxGauge, 0, 1);
  $('#speedArc').style.strokeDashoffset = String(433 * (1 - ratio));
  const gearText = physics.longSpeed < -0.6 && physics.speed > 1 ? 'R' : physics.speed < 1 ? 'N' : String(physics.gear);
  $('#gearValue').textContent = gearText;
  $('#rpmValue').textContent = Math.round(physics.rpm / 10) * 10;
  const segments = $('#rpmBar').children;
  const rpmRatio = clamp(physics.rpm / st.engine.redline, 0, 1);
  for (let i = 0; i < segments.length; i++) {
    const on = i / segments.length < rpmRatio;
    segments[i].classList.toggle('on', on);
    segments[i].classList.toggle('hot', on && i / segments.length > .84);
  }
  $('#boostValue').textContent = `BOOST ${physics.boost.toFixed(1)}`;
  $('#nitroBar').style.width = `${physics.nitro}%`;
  const integrity = Math.max(0, 100 - worldCar.damage);
  $('#damagePct').textContent = `${Math.round(integrity)}%`;
  $('#damageBar').style.width = `${integrity}%`;
  $('#damageBar').style.background = integrity < 35 ? '#ff4f2b' : integrity < 68 ? '#ffb02e' : 'var(--acid)';
  const damageState = integrity < 25 ? 'WRECKED' : integrity < 55 ? 'CRITICAL' : integrity < 85 ? 'STRESSED' : 'NOMINAL';
  $('#damageState').textContent = damageState;
  $('#scoreValue').textContent = String(score).padStart(6, '0');
  $('#comboValue').textContent = `x${combo.toFixed(1)}`;
  $('#comboBar').style.setProperty('--combo', `${(combo / 10) * 100}%`);
  $('#comboBar').style.width = '100%';
  const modeLabel = physics.grounded ? (Math.abs(physics.lateral) > 2.3 ? 'DRIFTING / SECTOR 04' : 'FREE ROAM / SECTOR 04') : 'AIRBORNE / SECTOR 04';
  $('#hudMode').textContent = modeLabel;
  challenges.speed = Math.max(challenges.speed, physics.speed);
  challenges.air = Math.max(challenges.air, physics.airTime);
  if (comboTimer > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) combo = 1;
  }
  if (damageFlash > 0) {
    damageFlash -= dt;
    $('#hud').classList.add('damage-flash');
  } else {
    $('#hud').classList.remove('damage-flash');
  }
}

/* ------------------------------------------------------------------ */
/* Camera                                                              */
/* ------------------------------------------------------------------ */
const camDesired = new THREE.Vector3();
const camLook = new THREE.Vector3();
const camTmp = new THREE.Vector3();
const camTmp2 = new THREE.Vector3();

function positionCameraImmediate() {
  if (!worldCar) return;
  updateCamera(1, true);
}
function cycleCamera() {
  if (mode !== 'drive') return;
  const order = ['chase', 'hood', 'orbit'];
  cameraMode = order[(order.indexOf(cameraMode) + 1) % order.length];
  build.camera = cameraMode;
  toast(`Camera: <b>${cameraMode.toUpperCase()}</b>`);
}
function updateCamera(dt, immediate = false) {
  if (!worldCar) return;
  const s = physics;
  const mobileView = isMobileViewport();
  const speed = s.speed * 0.277777;
  introProgress = Math.min(1, introProgress + dt * 0.55);
  const intro = 1 - Math.pow(introProgress, 2.2);
  if (cameraMode === 'hood') {
    worldCar.group.updateMatrixWorld();
    camDesired.copy(worldCar.group.localToWorld(new THREE.Vector3(0, 1.1, 1.5)));
    camLook.copy(worldCar.group.localToWorld(new THREE.Vector3(0, 0.9, 15)));
    if (immediate) activeCamera.position.copy(camDesired);
    else activeCamera.position.lerp(camDesired, 1 - Math.exp(-dt * 12));
    activeCamera.lookAt(camLook);
  } else if (cameraMode === 'orbit') {
    const dist = orbitDistance;
    camDesired.set(
      s.pos.x + Math.sin(orbitYaw) * Math.cos(orbitPitch) * dist,
      s.pos.y + 1.4 + Math.sin(orbitPitch) * dist,
      s.pos.z + Math.cos(orbitYaw) * Math.cos(orbitPitch) * dist
    );
    camLook.set(s.pos.x, s.pos.y + 0.8, s.pos.z);
    if (immediate) activeCamera.position.copy(camDesired);
    else activeCamera.position.lerp(camDesired, 1 - Math.exp(-dt * 5.5));
    activeCamera.lookAt(camLook);
    if (mode === 'drive') orbitYaw += dt * 0.07;
  } else {
    const fwdX = Math.sin(s.yaw);
    const fwdZ = Math.cos(s.yaw);
    const back = 5.9 + clamp(speed * .008, 0, 1.0) + (mobileView ? 1.25 : 0);
    camDesired.set(
      s.pos.x - fwdX * back - fwdX * intro * 3.4,
      s.pos.y + 2.05 + clamp(speed * .006, 0, .35) + (mobileView ? .38 : 0) + intro * 4.1,
      s.pos.z - fwdZ * back - fwdZ * intro * 3.4
    );
    camDesired.x += Math.sin(s.yaw + Math.PI / 2) * 0.22;
    const lookAhead = 4.4 + clamp(speed * .045, 0, 3.5);
    camLook.set(
      s.pos.x + fwdX * lookAhead,
      s.pos.y + 0.85 + intro * 0.3,
      s.pos.z + fwdZ * lookAhead
    );
    if (immediate) activeCamera.position.copy(camDesired);
    else activeCamera.position.lerp(camDesired, 1 - Math.exp(-dt * (4.8 + speed * .035)));
    activeCamera.lookAt(camLook);
  }
  if (cameraShake > 0.001) {
    const amp = cameraShake * 0.15;
    activeCamera.position.x += (Math.random() - .5) * amp;
    activeCamera.position.y += (Math.random() - .5) * amp;
    activeCamera.position.z += (Math.random() - .5) * amp;
    cameraShake *= Math.exp(-dt * 5.3);
  }
  activeCamera.position.y = Math.max(activeCamera.position.y, 0.4);
  const targetFov = cameraMode === 'hood' ? 68 : 56 + clamp(s.speed / 12, 0, 12) + (mobileView ? 4 : 0);
  if (activeCamera.fov !== undefined) {
    activeCamera.fov = damp(activeCamera.fov, targetFov, 3, dt);
    activeCamera.updateProjectionMatrix();
  }
}

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */
const GAME_KEYS = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','KeyC','KeyR','Escape','KeyN']);
window.addEventListener('keydown', (event) => {
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (GAME_KEYS.has(event.code)) event.preventDefault();
  if (event.code === 'Escape') {
    if (helpOpen) { closeHelp(); return; }
    if (mode === 'drive') {
      if (paused) resumeGame(); else pauseGame();
    }
    return;
  }
  if (mode === 'garage') {
    if (event.code === 'KeyG') randomize();
    return;
  }
  if (paused) return;
  if (event.code === 'KeyC') { cycleCamera(); return; }
  if (event.code === 'KeyR') { resetCar(true); return; }
  keys[event.code] = true;
});
window.addEventListener('keyup', (event) => { keys[event.code] = false; });
window.addEventListener('blur', clearInputs);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'drive' && !paused) pauseGame();
});

for (const btn of $$('.touch-controls button')) {
  const action = btn.dataset.touch;
  const on = (event) => {
    event.preventDefault();
    ensureAudio();
    touch[action] = true;
    btn.classList.add('is-down');
  };
  const off = (event) => {
    event.preventDefault();
    touch[action] = false;
    btn.classList.remove('is-down');
  };
  btn.addEventListener('pointerdown', on);
  btn.addEventListener('pointerup', off);
  btn.addEventListener('pointercancel', off);
  btn.addEventListener('pointerleave', off);
  btn.addEventListener('contextmenu', e => e.preventDefault());
}

if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) {
  document.body.classList.add('touch-device');
  $('#touchControls').setAttribute('aria-hidden', 'false');
}

/* ------------------------------------------------------------------ */
/* Main loop                                                           */
/* ------------------------------------------------------------------ */
let lastFrame = performance.now();
let elapsed = 0;
let lastHudUpdate = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const dtRaw = (now - lastFrame) / 1000;
  lastFrame = now;
  const dt = Math.min(0.045, Math.max(0.001, dtRaw));
  elapsed += dt;

  if (mode === 'garage') {
    showroom.update(dt, elapsed);
    if (audio.ready) {
      const nowMs = performance.now();
      let rpm = 920;
      let throttle = 0.04;
      if (nowMs < revUntil) {
        const p = 1 - (revUntil - nowMs) / Math.max(1, revUntil - revStart);
        rpm = 950 + Math.sin(clamp(p, 0, 1) * Math.PI * .92) * 6200;
        throttle = .78;
      }
      audio.update({ rpm, throttle, boost: throttle * build.boost, speed: 0, gear: 1, handbrake: false, limiter: false });
      const bars = $('#audioBars')?.children;
      if (bars) {
        for (let i = 0; i < bars.length; i++) {
          const base = Math.sin(elapsed * (4 + i * .27) + i) * .5 + .5;
          const energy = clamp((rpm - 700) / 6000, 0, 1);
          bars[i].style.height = `${8 + base * (20 + energy * 75)}%`;
          bars[i].style.opacity = String(.22 + energy * .7);
        }
      }
    }
  } else if (!paused) {
    const sub = 1 + Math.min(2, Math.floor(physics.speed / 35));
    for (let i = 0; i < sub; i++) stepPhysics(dt / sub);
    world.updateSun(physics.pos);
    updateEffects(dt);
    updateCamera(dt);
    world.update(dt, elapsed);
    if (audio.ready) {
      audio.update({
        rpm: physics.rpm,
        throttle: physics.throttle,
        boost: physics.boost,
        speed: physics.speed,
        gear: physics.gear,
        handbrake: physics.handbrake,
        limiter: physics.limiter
      });
    }
    if (now - lastHudUpdate > 60) {
      lastHudUpdate = now;
      updateHud(dt);
      updateChallengeUI();
    }
  } else {
    if (audio.ready) audio.update({ rpm: 950, throttle: 0, boost: 0, speed: 0, gear: 1 });
    updateEffects(dt * 0.2);
  }

  renderer.render(activeScene, activeCamera);
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const mobile = isMobileViewport();
  pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.3 : 1.7);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(w, h, false);
  showroom.resize(w, h, mobile);
  driveCamera.aspect = w / h;
  driveCamera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */
function setLoad(pct) {
  $('#loadBar').style.width = `${pct}%`;
  $('#loadPct').textContent = String(Math.round(pct)).padStart(2, '0');
}

async function boot() {
  setLoad(18);
  await new Promise(r => requestAnimationFrame(r));
  buildShowroomCar();
  setLoad(58);
  await new Promise(r => requestAnimationFrame(r));
  updateStatsUI();
  renderTabs();
  renderBuildTab('engine');
  renderChallenges();
  updateChallengeUI();
  $('#buildNameInput').value = build.name;
  $('#comboCount').textContent = formatCount(combos);
  $('#topCombos').textContent = `${formatCount(combos)} BUILDS`;
  $('#hudBuildName').textContent = build.name;
  $('#hudHp').textContent = `${nf.format(stats.power)} HP`;
  // generate RPM segments
  $('#rpmBar').innerHTML = Array.from({ length: 26 }, () => '<i></i>').join('');
  $('#pauseDamage').textContent = '0%';
  $('#pauseScore').textContent = '0';
  $('#pauseSpeed').textContent = '0 KM/H';
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyG' && mode === 'garage' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) randomize();
  });
  setLoad(88);
  resize();
  await new Promise(r => requestAnimationFrame(r));
  setLoad(100);
  lastFrame = performance.now();
  animate(lastFrame);
  requestAnimationFrame(() => {
    setTimeout(() => {
      $('#loading').classList.add('is-done');
      document.body.dataset.ready = 'true';
    }, 220);
  });
}

boot().catch(error => {
  console.error(error);
  $('#loading').classList.add('is-done');
  toast('Renderer failed to initialise.');
});
