export const ENGINES = {
  i4: {
    id: 'i4', name: '2.0L INLINE-4', short: 'I4', code: 'BF20-T', power: 330, torque: 420,
    redline: 7800, weight: 135, cylinders: 4, note: 'Light. Angry. Endlessly tunable.'
  },
  i6: {
    id: 'i6', name: '3.0L INLINE-6', short: 'I6', code: 'BF30-S', power: 450, torque: 560,
    redline: 7600, weight: 175, cylinders: 6, note: 'Silky surge with a hard edge.'
  },
  v8: {
    id: 'v8', name: '5.0L V8', short: 'V8', code: 'BF50-V', power: 580, torque: 700,
    redline: 7800, weight: 220, cylinders: 8, note: 'The loudest way to move forward.'
  },
  v12: {
    id: 'v12', name: '6.5L V12', short: 'V12', code: 'BF65-X', power: 790, torque: 740,
    redline: 9200, weight: 285, cylinders: 12, note: 'A precision instrument. Also a weapon.'
  },
  rotary: {
    id: 'rotary', name: '13B TWIN-ROTOR', short: 'ROTARY', code: 'BF13-R', power: 390, torque: 380,
    redline: 9800, weight: 118, cylinders: 3, note: 'Tiny, screaming, slightly illegal.'
  },
  ev: {
    id: 'ev', name: 'DUAL-MOTOR EV', short: 'EV', code: 'BF-E2', power: 700, torque: 980,
    redline: 12000, weight: 265, cylinders: 3, electric: true, note: 'Instant torque. Zero patience.'
  }
};

export const INDUCTION = {
  na: { id: 'na', name: 'NATURAL', sub: 'ITB', hpPerPsi: 0, weight: -18, boostLabel: 'INTAKE' },
  turbo: { id: 'turbo', name: 'SINGLE TURBO', sub: 'T3/T4', hpPerPsi: 9.5, weight: 34, boostLabel: 'BOOST' },
  twin: { id: 'twin', name: 'TWIN TURBO', sub: 'BALL BEARING', hpPerPsi: 12, weight: 51, boostLabel: 'BOOST' },
  super: { id: 'super', name: 'SUPERCHARGED', sub: 'TWIN SCREW', hpPerPsi: 10.5, weight: 42, boostLabel: 'BOOST' }
};

export const BODY_KITS = {
  street: { id: 'street', name: 'STREET', sub: 'OEM+', width: 1, flare: 0.02, weight: 0, downforce: 0 },
  wide: { id: 'wide', name: 'WIDEBODY', sub: '+90MM', width: 1.075, flare: 0.13, weight: 26, downforce: 8 },
  track: { id: 'track', name: 'GT TRACK', sub: 'AERO', width: 1.045, flare: 0.09, weight: 18, downforce: 24 },
  rally: { id: 'rally', name: 'RALLY RAID', sub: 'GRAVEL', width: 1.06, flare: 0.12, weight: 34, downforce: 2 },
  drag: { id: 'drag', name: 'DRAG SPEC', sub: '1/4 MILE', width: 1.085, flare: 0.16, weight: 12, downforce: 6 },
  safari: { id: 'safari', name: 'SAFARI', sub: 'OVERLAND', width: 1.05, flare: 0.1, weight: 46, downforce: -4 }
};

export const WINGS = {
  none: { id: 'none', name: 'CLEAN DECK', sub: 'NO WING', downforce: 0, weight: 0 },
  duck: { id: 'duck', name: 'DUCKTAIL', sub: 'LOW DRAG', downforce: 5, weight: 4 },
  swan: { id: 'swan', name: 'SWAN NECK', sub: 'GT3', downforce: 22, weight: 14 },
  track: { id: 'track', name: 'TRACK BLADE', sub: 'HIGH DOWNFORCE', downforce: 30, weight: 18 },
  drag: { id: 'drag', name: 'DRAG WING', sub: '1/4 MILE', downforce: 8, weight: 12 }
};

export const WHEEL_STYLES = {
  fan: { id: 'fan', name: 'TURBOFAN', sub: 'AERO DISC' },
  mesh: { id: 'mesh', name: 'MESH', sub: '10 SPOKE' },
  split: { id: 'split', name: 'SPLIT 5', sub: 'FORGED' },
  dish: { id: 'dish', name: 'DEEP DISH', sub: 'POLISHED LIP' },
  offroad: { id: 'offroad', name: 'OFFROAD', sub: 'BEADLOCK' }
};

export const FINISHES = {
  metallic: { id: 'metallic', name: 'METALLIC', roughness: 0.22, metalness: 0.72, clearcoat: 1, clearcoatRoughness: 0.1 },
  gloss: { id: 'gloss', name: 'GLOSS', roughness: 0.1, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.035 },
  satin: { id: 'satin', name: 'SATIN', roughness: 0.39, metalness: 0.45, clearcoat: 0.55, clearcoatRoughness: 0.32 },
  matte: { id: 'matte', name: 'MATTE', roughness: 0.7, metalness: 0.18, clearcoat: 0, clearcoatRoughness: 0.7 },
  chrome: { id: 'chrome', name: 'CHROME', roughness: 0.055, metalness: 1, clearcoat: 1, clearcoatRoughness: 0.03 },
  pearl: { id: 'pearl', name: 'PEARL', roughness: 0.19, metalness: 0.66, clearcoat: 1, clearcoatRoughness: 0.07, sheen: 1, sheenColor: '#ffd9f4' }
};

export const PAINTS = [
  { name: 'VOLT GREEN', hex: '#c9ff2f' },
  { name: 'NUCLEAR', hex: '#ffd21f' },
  { name: 'SIGNAL RED', hex: '#ef3d25' },
  { name: 'GLACIER', hex: '#e9f2f2' },
  { name: 'MIDNIGHT', hex: '#111619' },
  { name: 'GULF BLUE', hex: '#1597d6' },
  { name: 'COPPER', hex: '#b76532' },
  { name: 'MOSS', hex: '#566b43' },
  { name: 'PLUM', hex: '#512d5b' },
  { name: 'SAND', hex: '#c3a77e' },
  { name: 'ORANGE POP', hex: '#ff6a00' },
  { name: 'ULTRAVIOLET', hex: '#6c45d9' },
  { name: 'BONE', hex: '#d8d2c4' },
  { name: 'RACING WHITE', hex: '#f5f7f2' },
  { name: 'STEALTH', hex: '#343b3a' },
  { name: 'ACID PINK', hex: '#ff2f8b' }
];

export const ACCENTS = [
  { name: 'CARBON', hex: '#171b1b' },
  { name: 'BLACK', hex: '#050606' },
  { name: 'WHITE', hex: '#eef2ec' },
  { name: 'GOLD', hex: '#c59a4a' },
  { name: 'RED', hex: '#d53225' },
  { name: 'BLUE', hex: '#2b6fe0' },
  { name: 'ACID', hex: '#c9ff2f' },
  { name: 'RAW', hex: '#787f7c' }
];

export const EXHAUSTS = {
  titanium: { id: 'titanium', name: 'TITANIUM', sub: 'BURNT TIPS', gain: 1.02, rasp: 8 },
  race: { id: 'race', name: 'RACE', sub: 'STRAIGHT PIPE', gain: 1.12, rasp: 18 },
  straight: { id: 'straight', name: 'STRAIGHT CUT', sub: 'LOUD', gain: 1.2, rasp: 28 },
  twin: { id: 'twin', name: 'TWIN LOOP', sub: 'CROSSOVER', gain: 1.06, rasp: 12 },
  quiet: { id: 'quiet', name: 'TOURING', sub: 'VALVED', gain: 0.8, rasp: -15 }
};

export const AUDIO_PROFILES = {
  scream: { id: 'scream', name: 'SCREAMER', pitch: 72, rumble: 42, rasp: 70, turbo: 64, pops: 66 },
  muscle: { id: 'muscle', name: 'MUSCLE', pitch: 38, rumble: 88, rasp: 52, turbo: 38, pops: 84 },
  exotic: { id: 'exotic', name: 'EXOTIC', pitch: 64, rumble: 48, rasp: 86, turbo: 28, pops: 72 },
  sleeper: { id: 'sleeper', name: 'SLEEPER', pitch: 46, rumble: 66, rasp: 22, turbo: 86, pops: 38 },
  electric: { id: 'electric', name: 'EV WHINE', pitch: 84, rumble: 18, rasp: 10, turbo: 2, pops: 0 }
};

export const DRIVETRAINS = {
  rwd: { id: 'rwd', name: 'RWD', sub: 'REAR DRIVE', launch: 0.84, weight: 0 },
  awd: { id: 'awd', name: 'AWD', sub: 'ALL WHEELS', launch: 1, weight: 62 }
};

export const DEFAULT_BUILD = {
  name: 'VANTAGE // RS',
  engine: 'v8',
  induction: 'twin',
  boost: 18,
  exhaust: 'race',
  exhaustSize: 100,
  drivetrain: 'rwd',
  bodyKit: 'wide',
  wing: 'swan',
  wingSpan: 100,
  wingAngle: 12,
  paint: '#c9ff2f',
  finish: 'metallic',
  accent: '#171b1b',
  wheelStyle: 'mesh',
  wheelSize: 21,
  wheelWidth: 12,
  wheelOffset: 10,
  camber: -3,
  rideHeight: 45,
  suspension: 56,
  grip: 72,
  downforce: 44,
  gearing: 50,
  brake: 68,
  bodyLength: 100,
  bodyWidth: 100,
  bodyHeight: 100,
  noseLength: 100,
  cabinScale: 100,
  cabinRake: 100,
  fenderFlare: 100,
  tint: 42,
  underglow: '#42f5ff',
  glowStrength: 14,
  audioProfile: 'scream',
  soundPitch: 64,
  soundRumble: 58,
  soundRasp: 64,
  soundTurbo: 74,
  soundPops: 62,
  volume: 72,
  assist: true,
  camera: 'chase'
};

export const PRESETS = [
  {
    name: 'VANTAGE // RS', tags: 'TRACK WEAPON', patch: {
      engine: 'v8', induction: 'twin', boost: 18, bodyKit: 'wide', wing: 'swan', paint: '#c9ff2f',
      finish: 'metallic', wheelStyle: 'mesh', wheelSize: 21, rideHeight: 40, grip: 78, soundPitch: 64
    }
  },
  {
    name: 'DUST DEVIL', tags: 'RALLY RAID', patch: {
      engine: 'i6', induction: 'turbo', boost: 22, bodyKit: 'rally', wing: 'duck', paint: '#ffd21f',
      finish: 'satin', accent: '#171b1b', wheelStyle: 'offroad', wheelSize: 20, wheelWidth: 14,
      rideHeight: 74, suspension: 72, grip: 63, camber: 0, tint: 20, audioProfile: 'sleeper'
    }
  },
  {
    name: 'NIGHT SHIFT', tags: 'STREET SLEEPER', patch: {
      engine: 'i6', induction: 'turbo', boost: 28, bodyKit: 'street', wing: 'duck', paint: '#111619',
      finish: 'gloss', accent: '#343b3a', wheelStyle: 'dish', wheelSize: 20, wheelWidth: 11,
      rideHeight: 34, grip: 70, underglow: '#ff2f8b', glowStrength: 36, soundRumble: 74, soundPops: 82
    }
  },
  {
    name: 'APEX ZERO', tags: 'TIME ATTACK', patch: {
      engine: 'v12', induction: 'na', boost: 0, exhaust: 'titanium', bodyKit: 'track', wing: 'track',
      wingSpan: 116, paint: '#f5f7f2', finish: 'pearl', accent: '#d53225', wheelStyle: 'split',
      wheelSize: 20, wheelWidth: 12, rideHeight: 28, suspension: 32, grip: 88, downforce: 82,
      gearing: 38, brake: 88, soundPitch: 78, soundRumble: 42, soundRasp: 82
    }
  }
];

export function computeStats(build) {
  const engine = ENGINES[build.engine] || ENGINES.v8;
  const induction = INDUCTION[build.induction] || INDUCTION.na;
  const body = BODY_KITS[build.bodyKit] || BODY_KITS.street;
  const wing = WINGS[build.wing] || WINGS.none;
  const drivetrain = DRIVETRAINS[build.drivetrain] || DRIVETRAINS.rwd;
  const exhaust = EXHAUSTS[build.exhaust] || EXHAUSTS.race;
  const finish = FINISHES[build.finish] || FINISHES.metallic;

  const boostHp = build.boost * induction.hpPerPsi;
  const exhaustHp = engine.power * (exhaust.gain - 1) * 0.55;
  const power = Math.round(engine.power + boostHp + exhaustHp);
  const torque = Math.round(engine.torque * (1 + build.boost * 0.013) + (exhaust.gain - 1) * 40);
  const weight = Math.round(
    1110 + engine.weight + induction.weight + body.weight + wing.weight + drivetrain.weight +
    (build.wheelSize - 19) * 8 + (build.wheelWidth - 10) * 5 + (100 - build.rideHeight) * 0.7
  );
  const powerToWeight = power / (weight / 1000);
  const awd = build.drivetrain === 'awd';
  const traction = (0.55 + build.grip / 180) * drivetrain.launch * (1 + body.downforce / 160);
  const zeroTo100 = Math.max(2.05, 4.9 - powerToWeight / 220 + (awd ? -0.25 : 0.15) + (build.grip - 70) * -0.008);
  const drag = 0.37 - (build.downforce / 100) * 0.045 - (body.downforce / 100) * 0.025;
  const topSpeed = Math.round(165 + Math.sqrt(power) * 6.6 - drag * 80);
  const gripRating = Math.round(Math.min(99, 38 + build.grip * 0.52 + body.downforce * 0.13 + build.suspension * 0.08));
  const aero = Math.round(Math.min(99, build.downforce * 0.55 + wing.downforce + body.downforce));
  const braking = Math.round(Math.min(99, 30 + build.brake * 0.63 + build.grip * 0.08));
  const launch = Math.round(Math.min(99, traction * 78));
  const balance = Math.round(Math.min(99, 45 + (build.suspension - 50) * 0.28 + build.grip * 0.2));

  return {
    power, torque, weight, zeroTo100, topSpeed, gripRating, aero, braking, launch, balance,
    powerToWeight, engine, induction, body, wing, drivetrain, exhaust, finish
  };
}

export function getAudioProfile(build) {
  const engine = ENGINES[build.engine] || ENGINES.v8;
  const base = AUDIO_PROFILES[build.audioProfile] || AUDIO_PROFILES.scream;
  return {
    ...base,
    pitch: build.soundPitch,
    rumble: build.soundRumble,
    rasp: build.soundRasp,
    turbo: engine.electric ? 0 : build.soundTurbo,
    pops: engine.electric ? 0 : build.soundPops,
    exhaust: build.exhaust,
    cylinders: engine.cylinders,
    electric: !!engine.electric
  };
}

export function buildVariationCount() {
  return Object.keys(ENGINES).length * Object.keys(INDUCTION).length * Object.keys(EXHAUSTS).length *
    Object.keys(BODY_KITS).length * Object.keys(WINGS).length * Object.keys(WHEEL_STYLES).length *
    Object.keys(DRIVETRAINS).length * PAINTS.length * Object.keys(FINISHES).length *
    ACCENTS.length * Object.keys(AUDIO_PROFILES).length * 11;
}

export function formatCount(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const between = (a, b, step = 1) => {
  const n = Math.round((a + Math.random() * (b - a)) / step) * step;
  return Math.max(a, Math.min(b, n));
};

export function randomiseBuild(current) {
  const engine = pick(Object.keys(ENGINES));
  const induction = pick(Object.keys(INDUCTION));
  const paint = pick(PAINTS);
  const accent = pick(ACCENTS);
  const suffix = String(Math.floor(Math.random() * 899) + 100);
  const names = ['VANTAGE', 'HAMMERHEAD', 'NOVA', 'REDLINE', 'DIRT', 'APEX', 'STATIC', 'RIPTIDE', 'PHANTOM', 'VOLT'];
  return {
    ...current,
    name: `${pick(names)} // ${suffix}`,
    engine,
    induction,
    boost: induction === 'na' ? 0 : between(4, 38),
    exhaust: pick(Object.keys(EXHAUSTS)),
    drivetrain: pick(Object.keys(DRIVETRAINS)),
    bodyKit: pick(Object.keys(BODY_KITS)),
    wing: pick(Object.keys(WINGS)),
    paint: paint.hex,
    finish: pick(Object.keys(FINISHES)),
    accent: accent.hex,
    wheelStyle: pick(Object.keys(WHEEL_STYLES)),
    wheelSize: between(18, 24),
    wheelWidth: between(9, 15),
    camber: between(-8, 2),
    rideHeight: between(24, 82),
    suspension: between(25, 85),
    grip: between(50, 95),
    downforce: between(10, 90),
    gearing: between(30, 75),
    brake: between(40, 95),
    bodyLength: between(88, 112),
    bodyWidth: between(92, 110),
    bodyHeight: between(88, 112),
    noseLength: between(88, 112),
    cabinScale: between(86, 114),
    cabinRake: between(85, 115),
    fenderFlare: between(80, 125),
    wingSpan: between(78, 125),
    wingAngle: between(0, 22),
    tint: between(10, 80),
    underglow: pick(['#42f5ff', '#ff2f8b', '#c9ff2f', '#ff6a00', '#6c45d9']),
    glowStrength: Math.random() > 0.45 ? between(8, 55) : 0,
    audioProfile: pick(Object.keys(AUDIO_PROFILES)),
    soundPitch: between(30, 90),
    soundRumble: between(25, 95),
    soundRasp: between(20, 95),
    soundTurbo: between(10, 95),
    soundPops: between(5, 95)
  };
}

export const CHALLENGES = [
  { id: 'speed', label: 'BREAK 180 KM/H', target: 180, unit: 'KM/H', reward: 1200 },
  { id: 'air', label: 'CATCH 1.4S OF AIR', target: 1.4, unit: 'SEC', reward: 2500 },
  { id: 'drift', label: 'HOLD A 60M DRIFT', target: 60, unit: 'M', reward: 2200 },
  { id: 'smash', label: 'DESTROY 5 PROPS', target: 5, unit: '', reward: 1800 },
  { id: 'damage', label: 'CAUSE $12K DAMAGE', target: 12000, unit: '', reward: 3000 }
];
