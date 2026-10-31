import * as THREE from '../vendor/three.module.min.js';
import {
  ENGINES, INDUCTION, BODY_KITS, WINGS, WHEEL_STYLES, FINISHES, ACCENTS,
  EXHAUSTS, DRIVETRAINS, computeStats
} from './data.js';

const PI = Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeCarbonTexture() {
  const tex = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#131717';
    ctx.fillRect(0, 0, w, h);
    const cell = 8;
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        const on = ((x / cell + y / cell) & 1) === 0;
        ctx.fillStyle = on ? '#252b2a' : '#0b0e0e';
        ctx.fillRect(x, y, cell, cell);
        ctx.strokeStyle = 'rgba(255,255,255,.035)';
        ctx.strokeRect(x + .5, y + .5, cell - 1, cell - 1);
      }
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

function makeBadgeTexture(label = 'BEAMFORGE', sub = 'DYNAMICS LAB') {
  return canvasTexture(512, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#f4f6ee';
    ctx.font = '700 52px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w / 2, h * 0.44);
    ctx.font = '500 17px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(244,246,238,.6)';
    ctx.letterSpacing = '6px';
    ctx.fillText(sub, w / 2, h * 0.78);
  });
}

function makeNumberTexture(number = '08') {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(5,7,7,.82)';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.47, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(240,245,235,.75)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.41, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f4f6ee';
    ctx.font = '900 112px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(number, w / 2, h * 0.52);
  });
}

function makePlateTexture(name) {
  return canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#e8e7de';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#232624';
    ctx.lineWidth = 8;
    ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.fillStyle = '#1a1d1b';
    ctx.font = '700 56px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BF-' + name.replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase(), w / 2, h / 2);
    ctx.font = '500 15px "Inter", sans-serif';
    ctx.fillText('PROVING GROUNDS', w / 2, h - 18);
  });
}

function makeGlowTexture(color) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, color);
    grad.addColorStop(0.3, color + 'aa');
    grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
}

function createRingGeometry(segments, radius) {
  const positions = [];
  const indices = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * PI * 2;
    positions.push(Math.cos(a) * radius, Math.sin(a) * radius, 0);
  }
  for (let i = 0; i < segments; i++) {
    indices.push(i, (i + 1) % segments, i + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function bodyShellGeometry(L, W, H, noseBias) {
  const w = W / 2;
  const stations = [
    { z: -0.5, wf: 0.78, bottom: 0.245, top: 0.80 },
    { z: -0.465, wf: 0.91, bottom: 0.225, top: 0.89 },
    { z: -0.39, wf: 0.985, bottom: 0.21, top: 0.93 },
    { z: -0.25, wf: 1, bottom: 0.205, top: 0.94 },
    { z: -0.08, wf: 1, bottom: 0.2, top: 0.92 },
    { z: 0.1, wf: 1, bottom: 0.195, top: 0.88 },
    { z: 0.27, wf: 0.995, bottom: 0.19, top: 0.81 },
    { z: 0.4, wf: 0.94, bottom: 0.19, top: 0.73 },
    { z: 0.46, wf: 0.86, bottom: 0.195, top: 0.65 },
    { z: 0.5, wf: 0.68, bottom: 0.23, top: 0.56 }
  ];
  const seg = 28;
  const positions = [];
  const indices = [];
  const exp = 3.25;

  for (const s of stations) {
    const zT = s.z;
    // Stretch the nose independently of the tail.
    const z = zT > 0 ? zT * L * (0.94 + noseBias * 0.06) : zT * L;
    const cy = (s.top + s.bottom) / 2 * H;
    const hh = (s.top - s.bottom) / 2 * H;
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * PI * 2;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const x = w * s.wf * Math.sign(c) * Math.pow(Math.abs(c), 2 / exp);
      const y = cy + hh * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / exp);
      positions.push(x, y, z);
    }
  }

  for (let s = 0; s < stations.length - 1; s++) {
    for (let i = 0; i < seg; i++) {
      const a = s * seg + i;
      const b = s * seg + (i + 1) % seg;
      const c = (s + 1) * seg + i;
      const d = (s + 1) * seg + (i + 1) % seg;
      indices.push(a, c, b, b, c, d);
    }
  }

  // End caps with a center fan.
  const rearCenter = positions.length / 3;
  positions.push(0, 0.53 * H, -0.5 * L);
  const frontCenter = positions.length / 3;
  positions.push(0, 0.4 * H, 0.5 * L * (0.94 + noseBias * 0.06));
  for (let i = 0; i < seg; i++) {
    indices.push(rearCenter, i, (i + 1) % seg);
    const base = (stations.length - 1) * seg;
    indices.push(frontCenter, base + (i + 1) % seg, base + i);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function cabinGeometry(L, W, H, cabinScale, rake) {
  const scale = cabinScale / 100;
  const zFrontB = L * 0.235 * scale;
  const zRearB = -L * 0.315 * scale;
  const zFrontM = L * (0.15 + (rake - 100) * 0.0007) * scale;
  const zRearM = -L * 0.255 * scale;
  const zFrontT = L * 0.06 * scale;
  const zRearT = -L * 0.20 * scale;
  const yB = 0.83 * H;
  const yM = 1.10 * H;
  const yT = 1.34 * H;
  const wB = W * 0.385;
  const wM = W * 0.35;
  const wT = W * 0.30;
  const rings = [
    { y: yB, w: wB, zf: zFrontB, zr: zRearB },
    { y: yM, w: wM, zf: zFrontM, zr: zRearM },
    { y: yT, w: wT, zf: zFrontT, zr: zRearT }
  ];
  const positions = [];
  const indices = [];
  for (const r of rings) {
    positions.push(-r.w, r.y, r.zf, r.w, r.y, r.zf, r.w, r.y, r.zr, -r.w, r.y, r.zr);
  }
  for (let s = 0; s < 2; s++) {
    const b = s * 4;
    const n = (s + 1) * 4;
    // left, front, right, rear
    for (let i = 0; i < 4; i++) {
      const i2 = (i + 1) % 4;
      indices.push(b + i, n + i, b + i2, b + i2, n + i, n + i2);
    }
  }
  // bottom + top
  indices.push(0, 2, 1, 0, 3, 2);
  indices.push(8, 9, 10, 8, 10, 11);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function beamBetween(a, b, radius, material, radialSegments = 6) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const dir = new THREE.Vector3().subVectors(end, start);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(radius, radius, len, radialSegments, 1);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

function buildWheel(style, radius, width, materials, accentMaterial) {
  const pivot = new THREE.Group();
  const spin = new THREE.Group();
  pivot.add(spin);

  const half = width / 2;
  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 32, 1, true);
  tireGeo.rotateZ(PI / 2);
  const tire = new THREE.Mesh(tireGeo, materials.rubber);
  spin.add(tire);

  // sidewall ridges and shoulder profile
  const shoulderGeo = new THREE.TorusGeometry(radius * 0.94, radius * 0.075, 6, 28);
  shoulderGeo.rotateY(PI / 2);
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(shoulderGeo, materials.rubber);
    shoulder.position.x = side * half * 0.86;
    spin.add(shoulder);
  }

  const rimRadius = radius * 0.66;
  const barrelGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, width * 0.82, 28, 1);
  barrelGeo.rotateZ(PI / 2);
  const barrel = new THREE.Mesh(barrelGeo, materials.rim);
  spin.add(barrel);

  const lipGeo = new THREE.TorusGeometry(rimRadius * 0.98, radius * 0.035, 6, 32);
  lipGeo.rotateY(PI / 2);
  for (const side of [-1, 1]) {
    const lip = new THREE.Mesh(lipGeo, materials.rimPolished);
    lip.position.x = side * width * 0.43;
    spin.add(lip);
  }

  const discGeo = new THREE.CylinderGeometry(rimRadius * 0.7, rimRadius * 0.7, width * 0.16, 24);
  discGeo.rotateZ(PI / 2);
  const disc = new THREE.Mesh(discGeo, materials.brake);
  spin.add(disc);

  const caliper = new THREE.Mesh(new THREE.BoxGeometry(width * 0.26, radius * 0.22, radius * 0.19), accentMaterial);
  caliper.position.set(0, radius * 0.33, -rimRadius * 0.3);
  spin.add(caliper);

  const spokeCount = style === 'split' ? 5 : style === 'mesh' ? 10 : style === 'fan' ? 12 : style === 'offroad' ? 6 : 6;
  const spokeMat = materials.rimPolished;
  for (let i = 0; i < spokeCount; i++) {
    const angle = (i / spokeCount) * PI * 2;
    const spokeLen = rimRadius * (style === 'dish' ? 1.03 : 0.95);
    const spokeGeo = new THREE.BoxGeometry(width * 0.2, spokeLen, rimRadius * (style === 'offroad' ? 0.28 : 0.13));
    const spoke = new THREE.Mesh(spokeGeo, style === 'fan' ? materials.rim : spokeMat);
    spoke.position.y = spokeLen * 0.44;
    spoke.rotation.x = angle;
    // move the spoke outward to the face of the wheel
    spoke.position.x = width * (style === 'fan' ? 0.25 : 0.31);
    const holder = new THREE.Group();
    holder.rotation.x = angle;
    spoke.rotation.x = 0;
    spoke.position.set(width * 0.31, spokeLen * 0.44, 0);
    holder.add(spoke);
    spin.add(holder);
    if (style === 'mesh') {
      const spoke2 = spoke.clone();
      spoke2.rotation.z = 0.34;
      holder.add(spoke2);
    }
    if (style === 'split') {
      const s2 = spoke.clone();
      s2.rotation.z = 0.18;
      const s3 = spoke.clone();
      s3.rotation.z = -0.18;
      holder.add(s2, s3);
    }
  }

  if (style === 'fan') {
    const discFan = new THREE.Mesh(new THREE.CylinderGeometry(rimRadius * 0.92, rimRadius * 0.92, width * 0.05, 32), materials.rim);
    discFan.geometry.rotateZ(PI / 2);
    discFan.position.x = width * 0.33;
    spin.add(discFan);
    for (let i = 0; i < 10; i++) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(width * 0.08, rimRadius * 0.88, rimRadius * 0.09), materials.rubber);
      slot.position.set(width * 0.37, 0, 0);
      const holder = new THREE.Group();
      holder.rotation.x = (i / 10) * PI * 2;
      holder.add(slot);
      spin.add(holder);
    }
  }

  if (style === 'offroad') {
    for (let i = 0; i < 12; i++) {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.025, radius * 0.025, width * 0.06, 6), accentMaterial);
      bolt.geometry.rotateZ(PI / 2);
      bolt.position.set(width * 0.37, Math.cos(i / 12 * PI * 2) * rimRadius * 0.96, Math.sin(i / 12 * PI * 2) * rimRadius * 0.96);
      spin.add(bolt);
    }
  }

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(rimRadius * 0.2, rimRadius * 0.2, width * 0.1, 18), accentMaterial);
  cap.geometry.rotateZ(PI / 2);
  cap.position.x = width * 0.38;
  spin.add(cap);

  return { pivot, spin, radius };
}

function glowStrip(width, length, material) {
  const group = new THREE.Group();
  for (const side of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.022, length), material);
    bar.position.set(side * width, 0.04, 0);
    group.add(bar);
  }
  const rear = new THREE.Mesh(new THREE.BoxGeometry(width * 2, 0.018, 0.035), material);
  rear.position.z = -length / 2;
  group.add(rear);
  return group;
}

export function createCar(build, options = {}) {
  const stats = computeStats(build);
  const bodyKit = BODY_KITS[build.bodyKit] || BODY_KITS.street;
  const engine = ENGINES[build.engine] || ENGINES.v8;
  const wingDef = WINGS[build.wing] || WINGS.none;
  const finish = FINISHES[build.finish] || FINISHES.metallic;
  const accentDef = ACCENTS.find(a => a.hex === build.accent) || ACCENTS[0];
  const L = 4.55 * (build.bodyLength / 100);
  const W = 1.96 * (build.bodyWidth / 100) * bodyKit.width;
  const H = clamp(1.02 * (build.bodyHeight / 100), 0.86, 1.16);
  const noseBias = (build.noseLength - 100) / 100;
  const wheelRadius = 0.305 + (build.wheelSize - 18) * 0.0125;
  const wheelWidth = 0.255 + (build.wheelWidth - 9) * 0.021;
  const wheelBase = L * 0.625;
  const track = W * 0.515;
  const axleY = wheelRadius;
  const bodyY = 0.035 + (build.rideHeight - 45) * 0.0023;
  const frontZ = 0.5 * L * (0.94 + noseBias * 0.06);

  const group = new THREE.Group();
  group.name = 'BEAMFORGE vehicle';
  const body = new THREE.Group();
  body.position.y = bodyY;
  group.add(body);

  const carbonTex = makeCarbonTexture();
  const paintColor = new THREE.Color(build.paint);
  const paintMat = new THREE.MeshPhysicalMaterial({
    color: paintColor,
    metalness: finish.metalness,
    roughness: finish.roughness,
    clearcoat: finish.clearcoat,
    clearcoatRoughness: finish.clearcoatRoughness,
    envMapIntensity: 1.35,
    sheen: finish.sheen || 0,
    sheenRoughness: 0.4,
    ...(finish.sheenColor ? { sheenColor: new THREE.Color(finish.sheenColor) } : {})
  });
  const accentColor = new THREE.Color(accentDef.hex);
  const accentMat = new THREE.MeshPhysicalMaterial({
    color: accentColor, map: carbonTex, metalness: 0.38, roughness: 0.34,
    clearcoat: 0.4, clearcoatRoughness: 0.4, envMapIntensity: 1
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x0a0d0d, metalness: 0.35, roughness: 0.54 });
  const softBlack = new THREE.MeshStandardMaterial({ color: 0x111414, metalness: 0.1, roughness: 0.82 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#071015').lerp(new THREE.Color('#8295a2'), build.tint / 520),
    metalness: 0.28,
    roughness: 0.06,
    transparent: true,
    opacity: 0.82,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 2.1,
    side: THREE.DoubleSide,
    depthWrite: true
  });
  const chromeMat = new THREE.MeshPhysicalMaterial({ color: 0xc7cbc5, metalness: 1, roughness: 0.16, envMapIntensity: 1.7 });
  const rimMat = new THREE.MeshPhysicalMaterial({ color: 0x313737, metalness: 0.92, roughness: 0.24, envMapIntensity: 1.4 });
  const rimPolished = new THREE.MeshPhysicalMaterial({ color: 0x929a99, metalness: 1, roughness: 0.2, envMapIntensity: 1.35 });
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x0c0e0e, roughness: 0.94, metalness: 0.02 });
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0x686d6c, metalness: 0.8, roughness: 0.38 });
  const redGlow = new THREE.MeshStandardMaterial({ color: 0x5a0d08, emissive: 0xff1d0d, emissiveIntensity: 4.6, roughness: 0.3 });
  const coolGlow = new THREE.MeshStandardMaterial({ color: 0xc8e8f2, emissive: 0xdff7ff, emissiveIntensity: 6, roughness: 0.2 });
  const amberGlow = new THREE.MeshStandardMaterial({ color: 0x5a3506, emissive: 0xff9b21, emissiveIntensity: 3.4, roughness: 0.3 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xdadfd7, roughness: 0.5, metalness: 0.1 });
  const badgeTex = makeBadgeTexture(build.name.replace(/\/\/.*/, '').trim() || 'BEAMFORGE', 'DYNAMICS LAB');
  const badgeMat = new THREE.MeshBasicMaterial({ map: badgeTex, transparent: true, depthWrite: false, toneMapped: false });
  const numberTex = makeNumberTexture(String(Math.floor(Math.random() * 89) + 10));
  const numberMat = new THREE.MeshBasicMaterial({ map: numberTex, transparent: true, depthWrite: false, toneMapped: false });
  const plateTex = makePlateTexture(build.name.replace(/\/\/.*/, '').trim() || 'BF');
  const plateMat = new THREE.MeshBasicMaterial({ map: plateTex, toneMapped: false });
  const glowColor = new THREE.Color(build.underglow);
  const glowMat = new THREE.MeshBasicMaterial({
    color: glowColor, transparent: true, opacity: 0.55 * (build.glowStrength / 55),
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
  });

  const materials = {
    paintMat, accentMat, trimMat, glassMat, chromeMat,
    rim: rimMat, rimPolished, rubber: rubberMat, brake: brakeMat,
    rimMat, rubberMat, brakeMat
  };

  // Main body shell.
  const shellGeo = bodyShellGeometry(L, W, H, noseBias);
  const shell = new THREE.Mesh(shellGeo, paintMat);
  shell.castShadow = true;
  shell.receiveShadow = true;
  body.add(shell);

  // Cabin / greenhouse.
  const cabinGeo = cabinGeometry(L, W, H, build.cabinScale, build.cabinRake);
  const cabin = new THREE.Mesh(cabinGeo, glassMat);
  cabin.castShadow = true;
  body.add(cabin);

  // Roof skin.
  const roof = new THREE.Mesh(new THREE.BoxGeometry(W * 0.52, 0.045, L * 0.21), paintMat);
  roof.position.set(0, 1.347 * H, -L * 0.075);
  roof.castShadow = true;
  body.add(roof);

  const roofFrontZ = L * 0.06;
  const roofRearZ = -L * 0.20;
  for (const side of [-1, 1]) {
    body.add(beamBetween(
      [side * W * 0.3, 1.337 * H, roofFrontZ],
      [side * W * 0.3, 1.337 * H, roofRearZ],
      0.021, paintMat, 5
    ));
    body.add(beamBetween(
      [side * W * 0.37, 0.85 * H, L * 0.235],
      [side * W * 0.3, 1.33 * H, L * 0.06],
      0.024, paintMat, 5
    ));
    body.add(beamBetween(
      [side * W * 0.385, 0.86 * H, -L * 0.12],
      [side * W * 0.3, 1.327 * H, -L * 0.18],
      0.028, paintMat, 5
    ));
  }

  // Hood details and vents.
  const hood = new THREE.Mesh(new THREE.BoxGeometry(W * 0.55, 0.035, L * 0.27), paintMat);
  hood.position.set(0, 0.82 * H, L * 0.265);
  hood.rotation.x = -0.022;
  hood.castShadow = true;
  body.add(hood);
  for (let i = 0; i < 4; i++) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(W * 0.11, 0.025, 0.035), trimMat);
    vent.position.set(0, 0.855 * H, L * (0.16 + i * 0.028));
    vent.rotation.x = -0.1;
    body.add(vent);
  }
  for (const side of [-1, 1]) {
    const crease = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, L * 0.24), paintMat);
    crease.position.set(side * W * 0.235, 0.838 * H, L * 0.26);
    body.add(crease);
  }

  // Front splitter / bumper.
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(W * 0.91, 0.065, L * (build.bodyKit === 'drag' ? 0.085 : 0.055)), accentMat);
  splitter.position.set(0, 0.17, frontZ + 0.015);
  splitter.castShadow = true;
  body.add(splitter);
  for (const side of [-1, 1]) {
    const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.15, L * 0.06), accentMat);
    endplate.position.set(side * W * 0.456, 0.235, frontZ + 0.02);
    body.add(endplate);
  }

  const grille = new THREE.Mesh(new THREE.BoxGeometry(W * 0.54, 0.2, 0.05), trimMat);
  grille.position.set(0, 0.49 * H, frontZ + 0.005);
  body.add(grille);
  for (let i = 0; i < 3; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(W * 0.48, 0.018, 0.02), accentMat);
    slat.position.set(0, 0.46 * H + i * 0.037, frontZ + 0.031);
    body.add(slat);
  }
  const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.135), badgeMat);
  badge.position.set(0, 0.63 * H, frontZ + 0.038);
  body.add(badge);

  // Headlights: sharp angular LED signatures.
  for (const side of [-1, 1]) {
    const housing = new THREE.Mesh(new THREE.BoxGeometry(W * 0.26, 0.1, 0.04), trimMat);
    housing.position.set(side * W * 0.285, 0.68 * H, frontZ + 0.012);
    housing.rotation.z = side * -0.06;
    body.add(housing);
    const mainBar = new THREE.Mesh(new THREE.BoxGeometry(W * 0.21, 0.025, 0.018), coolGlow);
    mainBar.position.set(side * W * 0.285, 0.69 * H, frontZ + 0.035);
    mainBar.rotation.z = side * -0.06;
    body.add(mainBar);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.075, 0.018), coolGlow);
    hook.position.set(side * W * 0.19, 0.655 * H, frontZ + 0.037);
    body.add(hook);
    const intake = new THREE.Mesh(new THREE.BoxGeometry(W * 0.17, 0.12, 0.03), trimMat);
    intake.position.set(side * W * 0.29, 0.32 * H, frontZ + 0.018);
    body.add(intake);
    if (build.bodyKit === 'track' || build.bodyKit === 'drag') {
      const canard = new THREE.Mesh(new THREE.BoxGeometry(W * 0.15, 0.018, 0.22), accentMat);
      canard.position.set(side * W * 0.445, 0.3 * H, frontZ - 0.09);
      canard.rotation.z = side * 0.16;
      body.add(canard);
    }
  }

  // Side skirts, doors, mirrors and badges.
  for (const side of [-1, 1]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, L * 0.42), accentMat);
    skirt.position.set(side * (W / 2 - 0.015), 0.2, -L * 0.035);
    body.add(skirt);
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.44, 0.012), softBlack);
    seam.position.set(side * (W / 2 + 0.006), 0.55 * H, L * 0.06);
    body.add(seam);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.035, 0.14), chromeMat);
    handle.position.set(side * (W / 2 + 0.012), 0.64 * H, L * 0.1);
    body.add(handle);
    const mirrorStalk = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 0.045), trimMat);
    mirrorStalk.position.set(side * (W * 0.46), 0.93 * H, L * 0.19);
    mirrorStalk.rotation.z = side * 0.18;
    body.add(mirrorStalk);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.095, 0.1), paintMat);
    mirror.position.set(side * (W * 0.53), 0.96 * H, L * 0.18);
    mirror.rotation.z = side * 0.12;
    mirror.castShadow = true;
    body.add(mirror);
    const mirrorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.07), chromeMat);
    mirrorGlass.position.set(side * (W * 0.53 + 0.087), 0.96 * H, L * 0.18);
    mirrorGlass.rotation.y = side * PI / 2;
    body.add(mirrorGlass);
    const sideBadge = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.11), badgeMat);
    sideBadge.position.set(side * (W / 2 + 0.009), 0.55 * H, L * 0.22);
    sideBadge.rotation.y = side * PI / 2;
    body.add(sideBadge);
    const roundel = new THREE.Mesh(new THREE.PlaneGeometry(0.37, 0.37), numberMat);
    roundel.position.set(side * (W / 2 + 0.011), 0.66 * H, -L * 0.18);
    roundel.rotation.y = side * PI / 2;
    body.add(roundel);
  }

  // Rear light bar, diffuser, exhausts and plate.
  const rearPanel = new THREE.Mesh(new THREE.BoxGeometry(W * 0.82, 0.2, 0.03), trimMat);
  rearPanel.position.set(0, 0.66 * H, -L * 0.493);
  body.add(rearPanel);
  const lightBar = new THREE.Mesh(new THREE.BoxGeometry(W * 0.75, 0.035, 0.014), redGlow);
  lightBar.position.set(0, 0.72 * H, -L * 0.511);
  body.add(lightBar);
  for (const side of [-1, 1]) {
    const tailHook = new THREE.Mesh(new THREE.BoxGeometry(W * 0.08, 0.085, 0.015), redGlow);
    tailHook.position.set(side * W * 0.37, 0.675 * H, -L * 0.511);
    body.add(tailHook);
  }
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(W * 0.82, 0.16, 0.32), accentMat);
  diffuser.position.set(0, 0.24, -L * 0.46);
  body.add(diffuser);
  for (let i = -2; i <= 2; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.15, 0.34), accentMat);
    fin.position.set(i * W * 0.14, 0.22, -L * 0.455);
    body.add(fin);
  }
  const plateHolder = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.12), plateMat);
  plateHolder.position.set(0, 0.46 * H, -L * 0.515);
  plateHolder.rotation.y = PI;
  body.add(plateHolder);

  const exhaustRadius = 0.052 * (build.exhaustSize / 100);
  const exhaustCount = build.exhaust === 'twin' ? 4 : build.exhaust === 'straight' ? 2 : 2;
  for (let i = 0; i < exhaustCount; i++) {
    const x = exhaustCount === 4
      ? (i < 2 ? -1 : 1) * W * (0.12 + (i % 2) * 0.11)
      : (i === 0 ? -1 : 1) * W * 0.19;
    const pipeGeo = new THREE.CylinderGeometry(exhaustRadius, exhaustRadius * 1.05, 0.3, 16, 1, true);
    pipeGeo.rotateX(PI / 2);
    const pipe = new THREE.Mesh(pipeGeo, chromeMat);
    pipe.position.set(x, 0.29, -L * 0.495);
    body.add(pipe);
    const inner = new THREE.Mesh(new THREE.CircleGeometry(exhaustRadius * 0.8, 16), softBlack);
    inner.position.set(x, 0.29, -L * 0.648);
    inner.rotation.y = PI;
    body.add(inner);
  }

  // Rear wing.
  const wingParts = new THREE.Group();
  wingParts.name = 'rear wing';
  body.add(wingParts);
  if (build.wing === 'duck') {
    const duck = new THREE.Mesh(new THREE.BoxGeometry(W * 0.68, 0.045, 0.22), accentMat);
    duck.position.set(0, 0.9 * H, -L * 0.455);
    duck.rotation.x = -0.18;
    wingParts.add(duck);
  } else if (build.wing !== 'none') {
    const span = W * 0.82 * (build.wingSpan / 100) * (build.wing === 'drag' ? 1.03 : 1);
    const wingY = (build.wing === 'drag' ? 1.28 : build.wing === 'track' ? 1.13 : 1.06) * H;
    const chord = build.wing === 'drag' ? 0.4 : 0.34;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(span, 0.035, chord), accentMat);
    blade.position.set(0, wingY, -L * 0.43);
    blade.rotation.x = -(build.wingAngle / 80);
    blade.castShadow = true;
    wingParts.add(blade);
    const gurney = new THREE.Mesh(new THREE.BoxGeometry(span, 0.055, 0.018), accentMat);
    gurney.position.set(0, wingY + 0.038, -L * 0.43 - chord * 0.44);
    wingParts.add(gurney);
    for (const side of [-1, 1]) {
      const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.025, build.wing === 'drag' ? 0.28 : 0.17, chord * 0.95), accentMat);
      endplate.position.set(side * span / 2, wingY - 0.04, -L * 0.43);
      wingParts.add(endplate);
      if (build.wing === 'swan') {
        const upright = beamBetween(
          [side * span * 0.35, 0.89 * H, -L * 0.43],
          [side * span * 0.31, wingY - 0.03, -L * 0.43],
          0.025, accentMat, 6
        );
        wingParts.add(upright);
      } else {
        const upright = new THREE.Mesh(new THREE.BoxGeometry(0.035, wingY - 0.86 * H, 0.11), accentMat);
        upright.position.set(side * span * 0.32, (wingY + 0.86 * H) / 2, -L * 0.43);
        wingParts.add(upright);
      }
      if (build.wing === 'track') {
        const lower = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, chord * 1.2), accentMat);
        lower.position.set(side * span / 2, wingY - 0.14, -L * 0.43);
        wingParts.add(lower);
      }
    }
  }

  // Wheel wells, fender flares and wheels.
  const wheelWellMat = new THREE.MeshBasicMaterial({ color: 0x050707, side: THREE.DoubleSide });
  const wheelWellGeo = new THREE.CircleGeometry(wheelRadius * 1.16, 28);
  const wheels = [];
  for (const zSign of [1, -1]) {
    for (const xSign of [-1, 1]) {
      const x = xSign * track;
      const z = zSign * wheelBase / 2;
      const well = new THREE.Mesh(wheelWellGeo, wheelWellMat);
      well.rotation.y = xSign * PI / 2;
      well.position.set(xSign * (W / 2 - 0.015), axleY, z);
      body.add(well);

      const fenderGeo = new THREE.TorusGeometry(wheelRadius * 1.16, 0.045 + bodyKit.flare * 0.18, 7, 30);
      fenderGeo.rotateY(PI / 2);
      const fender = new THREE.Mesh(fenderGeo, paintMat);
      fender.position.set(xSign * (W / 2 + 0.01), axleY, z);
      fender.castShadow = true;
      body.add(fender);

      const { pivot, spin } = buildWheel(build.wheelStyle, wheelRadius, wheelWidth, materials, accentMat);
      pivot.position.set(x, axleY, z);
      pivot.rotation.order = 'YXZ';
      pivot.rotation.z = xSign * (build.camber / 100) * 1.35;
      pivot.userData.side = xSign;
      pivot.userData.front = zSign > 0;
      group.add(pivot);
      wheels.push({ pivot, spin, radius: wheelRadius, width: wheelWidth, side: xSign, front: zSign > 0, lastSpin: 0 });
    }
  }

  // Underbody glow.
  const underglow = glowStrip(W * 0.46, L * 0.63, glowMat);
  underglow.position.y = 0.045 + bodyY;
  underglow.visible = build.glowStrength > 0;
  group.add(underglow);
  const glowPlane = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.6, L * 1.12), new THREE.MeshBasicMaterial({
    map: makeGlowTexture(build.underglow), transparent: true,
    opacity: 0.4 * (build.glowStrength / 55), blending: THREE.AdditiveBlending,
    depthWrite: false, toneMapped: false
  }));
  glowPlane.rotation.x = -PI / 2;
  glowPlane.position.y = 0.015;
  glowPlane.visible = build.glowStrength > 0;
  group.add(glowPlane);
  const glowLights = [];
  if (build.glowStrength > 0) {
    for (const x of [-track, track]) {
      const light = new THREE.PointLight(glowColor, build.glowStrength / 18, 2.7, 2);
      light.position.set(x, 0.08, -wheelBase * 0.15);
      group.add(light);
      glowLights.push(light);
    }
  }

  // A tiny shadow catcher keeps the car planted in the showroom.
  const shadowTex = canvasTexture(256, 512, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,.65)');
    g.addColorStop(.55, 'rgba(0,0,0,.28)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.45, L * 1.1), new THREE.MeshBasicMaterial({
    map: shadowTex, transparent: true, depthWrite: false, opacity: 0.6
  }));
  shadowPlane.rotation.x = -PI / 2;
  shadowPlane.position.y = 0.011;
  shadowPlane.renderOrder = 1;
  group.add(shadowPlane);

  group.userData = {
    stats, build, L, W, H, track, wheelBase, wheelRadius, wheelWidth,
    paintMat, accentMat, materials, bodyGroup: body, wingParts
  };

  const deformables = [];
  for (const mesh of [shell, hood, cabin]) {
    const pos = mesh.geometry.attributes.position;
    deformables.push({ mesh, base: new Float32Array(pos.array), normals: mesh.geometry.attributes.normal });
  }
  // Roof is deformed too, it is part of the crumple zone.
  {
    const pos = roof.geometry.attributes.position;
    deformables.push({ mesh: roof, base: new Float32Array(pos.array), normals: roof.geometry.attributes.normal });
  }

  const car = {
    group,
    body,
    wheels,
    shell,
    cabin,
    wingParts,
    glowLights,
    deformables,
    paintMat,
    materials,
    stats,
    build,
    dimensions: { L, W, H, track, wheelBase, wheelRadius, wheelWidth },
    wheelAngle: 0,
    damage: 0,
    detached: [],
    deform(localPoint, severity = 1) {
      const radius = 0.5 + severity * 0.3;
      const amount = clamp(severity, 0.1, 1) * 0.23;
      for (const d of deformables) {
        const pos = d.mesh.geometry.attributes.position;
        const arr = pos.array;
        const base = d.base;
        let touched = false;
        for (let i = 0; i < arr.length; i += 3) {
          const dx = base[i] - localPoint.x;
          const dy = base[i + 1] - localPoint.y;
          const dz = base[i + 2] - localPoint.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < radius) {
            const f = Math.pow(1 - dist / radius, 2);
            const normal = d.mesh.geometry.attributes.normal || null;
            const nx = normal ? normal.getX(i / 3) : dx / (dist || 1);
            const ny = normal ? normal.getY(i / 3) : dy / (dist || 1);
            const nz = normal ? normal.getZ(i / 3) : dz / (dist || 1);
            const crinkle = Math.sin(i * 0.7 + localPoint.x * 14) * 0.012 * severity;
            arr[i] += (-nx * amount * f) + crinkle * (dx > 0 ? 1 : -1);
            arr[i + 1] += -ny * amount * f * 0.7 + crinkle * 0.4;
            arr[i + 2] += -nz * amount * f;
            touched = true;
          }
        }
        if (touched) {
          pos.needsUpdate = true;
          d.mesh.geometry.computeVertexNormals();
          d.mesh.geometry.attributes.normal.needsUpdate = true;
        }
      }
      this.damage = Math.min(100, this.damage + severity * 18);
      const roughness = clamp(this.paintMat.roughness + severity * 0.02, 0.05, 0.9);
      this.paintMat.roughness = roughness;
      this.paintMat.clearcoat = Math.max(0, this.paintMat.clearcoat - severity * 0.03);
      // knock the rear wing loose after a big one
      if (this.damage > 66 && this.build.wing !== 'none' && !this.wingParts.userData.detached && severity > 0.65) {
        this.wingParts.userData.detached = true;
        this.detached.push(this.wingParts);
        this.wingParts.visible = false;
      }
    },
    setSteer(steer) {
      for (const w of this.wheels) {
        if (w.front) w.pivot.rotation.y = steer * 0.48;
      }
    },
    spinWheels(distance, dt) {
      for (const w of this.wheels) {
        w.spin.rotation.x += distance / w.radius;
      }
    },
    setDamageVisual(damage) {
      this.damage = Math.min(100, Math.max(this.damage, damage));
    },
    dispose() {
      const seenMat = new Set();
      const seenGeo = new Set();
      const seenTex = new Set();
      group.traverse(obj => {
        if (obj.geometry && !seenGeo.has(obj.geometry)) {
          seenGeo.add(obj.geometry);
          obj.geometry.dispose();
        }
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) {
            if (seenMat.has(m)) continue;
            seenMat.add(m);
            for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) {
              if (m[key] && !seenTex.has(m[key])) {
                seenTex.add(m[key]);
                m[key].dispose();
              }
            }
            m.dispose();
          }
        }
      });
      glowLights.forEach(l => l.dispose && l.dispose());
    }
  };

  return car;
}
