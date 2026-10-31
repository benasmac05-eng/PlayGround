import * as THREE from '../vendor/three.module.min.js';
import {
  createEnvironment, createSky, makeAsphaltTexture, makeSandTexture, makeConcreteTexture,
  makeStripeTexture, makeTextTexture, makeCanvasTexture
} from './environment.js';

const V3 = THREE.Vector3;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function skySun() {
  return new V3(0.12, 0.115, 0.985).normalize();
}

function addBox(scene, material, size, pos, opts = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  mesh.position.set(pos[0], pos[1], pos[2]);
  if (opts.rotation) mesh.rotation.set(...opts.rotation);
  mesh.castShadow = opts.castShadow ?? true;
  mesh.receiveShadow = opts.receiveShadow ?? true;
  scene.add(mesh);
  return mesh;
}

function addTextPlane(scene, lines, options, size, pos, rotation = [0, 0, 0]) {
  const tex = makeTextTexture(lines, options);
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false,
    side: THREE.DoubleSide, toneMapped: false, opacity: options.opacity ?? 1
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), mat);
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.rotation.set(...rotation);
  scene.add(mesh);
  return mesh;
}

function groundDecal(scene, texture, width, height, x, z, rotation = 0) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0.85, toneMapped: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = rotation;
  mesh.position.set(x, 0.022, z);
  scene.add(mesh);
  return mesh;
}

export function createWorld(renderer, envMap) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1a1718');
  scene.fog = new THREE.FogExp2(0x9c6b54, 0.0028);
  scene.environment = envMap;
  scene.environmentIntensity = 0.62;

  const sunDir = skySun();
  const sky = createSky(sunDir);
  scene.add(sky);

  // Lighting.
  const hemi = new THREE.HemisphereLight(0x91b9de, 0x5c3424, 1.15);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffd3a2, 3.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -55;
  sun.shadow.camera.right = 55;
  sun.shadow.camera.top = 55;
  sun.shadow.camera.bottom = -55;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 240;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  scene.add(sun.target);

  const fill = new THREE.DirectionalLight(0x7aa6d1, 0.85);
  fill.position.set(-55, 30, -30);
  scene.add(fill);

  // A soft travelling bounce keeps the car readable against the low sun.
  const carFill = new THREE.PointLight(0xffc79c, 26, 17, 2);
  carFill.position.set(-4, 5, -6);
  scene.add(carFill);

  // Ground planes.
  const sandTex = makeSandTexture();
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ map: sandTex, color: 0xb17852, roughness: 0.97, metalness: 0.02 })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = -0.055;
  sand.receiveShadow = true;
  scene.add(sand);

  const asphaltTex = makeAsphaltTexture();
  const asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 240),
    new THREE.MeshStandardMaterial({
      map: asphaltTex, color: 0x9a9f99, roughness: 0.83, metalness: 0.08,
      envMapIntensity: 0.45
    })
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set(0, 0, 20);
  asphalt.receiveShadow = true;
  scene.add(asphalt);

  // Edge wear where the proving ground meets the desert.
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x6f5b4d, roughness: 0.95 });
  addBox(scene, edgeMat, [220, 0.09, 5], [0, -0.01, -101], { castShadow: false });
  addBox(scene, edgeMat, [220, 0.09, 5], [0, -0.01, 141], { castShadow: false });

  // Painted lane markings.
  const paintWhite = new THREE.MeshBasicMaterial({ color: 0xdcded3, transparent: true, opacity: 0.66, toneMapped: false });
  const paintYellow = new THREE.MeshBasicMaterial({ color: 0xf4bd35, transparent: true, opacity: 0.7, toneMapped: false });
  const lineGeo = new THREE.BoxGeometry(0.16, 0.012, 3.4);
  for (let z = -86; z < 124; z += 7.4) {
    const line = new THREE.Mesh(lineGeo, paintWhite);
    line.position.set(0, 0.015, z);
    scene.add(line);
  }
  for (const x of [-14.5, 14.5]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.012, 210), paintWhite);
    edge.position.set(x, 0.014, 18);
    scene.add(edge);
  }
  for (const x of [-38, 38]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 190), paintYellow);
    edge.position.set(x, 0.013, 20);
    scene.add(edge);
  }
  for (let i = 0; i < 24; i++) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.013, 0.16), paintWhite);
    dash.position.set(-82 + i * 7, 0.014, -79);
    scene.add(dash);
  }

  const startTex = makeCanvasTexture(1024, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const cell = 64;
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 16; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#121514' : '#edf1e8';
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    ctx.fillStyle = 'rgba(10,12,11,.78)';
    ctx.fillRect(0, 135, w, 240);
    ctx.fillStyle = '#f2f5eb';
    ctx.font = '900 132px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '22px';
    ctx.fillText('SEND IT', w / 2, 260);
    ctx.font = '500 26px "Inter", sans-serif';
    ctx.fillStyle = '#c9ff2f';
    ctx.letterSpacing = '10px';
    ctx.fillText('BEAMFORGE PROVING GROUNDS  /  SECTOR 04', w / 2, 340);
  });
  groundDecal(scene, startTex, 22, 11, 0, -72);

  const driftTex = makeCanvasTexture(1024, 1024, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(235,240,228,.42)';
    ctx.lineWidth = 7;
    ctx.setLineDash([52, 34]);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.38, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(201,255,47,.7)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.19, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(238,242,233,.55)';
    ctx.font = '600 28px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '8px';
    ctx.fillText('DRIFT CIRCLE', w / 2, h * 0.86);
  });
  groundDecal(scene, driftTex, 30, 30, -35, -44);

  const impactTex = makeCanvasTexture(1024, 512, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(201,255,47,.68)';
    ctx.fillRect(0, 205, w, 12);
    ctx.font = '900 156px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(240,244,234,.7)';
    ctx.letterSpacing = '28px';
    ctx.fillText('IMPACT LAB', w / 2, 190);
    ctx.font = '500 32px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(240,244,234,.45)';
    ctx.letterSpacing = '12px';
    ctx.fillText('FULL SEND  •  MEASURE  •  REPEAT', w / 2, 300);
    ctx.strokeStyle = 'rgba(201,255,47,.32)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      ctx.strokeRect(250 - i * 18, 60 - i * 16, 524 + i * 36, 350 + i * 32);
    }
  });
  groundDecal(scene, impactTex, 22, 11, -34, -3);

  // Colliders for the car controller.
  const colliders = [];
  const smashables = [];
  const addCollider = (box, kind = 'solid', extra = {}) => {
    colliders.push({ box, kind, ...extra });
  };
  const boxAt = (x, y, z, sx, sy, sz) => new THREE.Box3(
    new V3(x - sx / 2, y - sy / 2, z - sz / 2),
    new V3(x + sx / 2, y + sy / 2, z + sz / 2)
  );

  // Concrete barriers along the main straight.
  const stripeTex = makeStripeTexture();
  const barrierMat = new THREE.MeshStandardMaterial({
    color: 0xc0b9a8, roughness: 0.85, metalness: 0.04, map: makeConcreteTexture()
  });
  const barrierTopMat = new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.7, metalness: 0.1 });
  const barrierGeo = new THREE.BoxGeometry(1.9, 0.72, 0.42);
  for (const side of [-1, 1]) {
    for (let z = -92; z < -8; z += 4.2) {
      if (Math.abs(z + 40) < 7) continue;
      const barrier = new THREE.Mesh(barrierGeo, barrierMat);
      barrier.position.set(side * 17.2, 0.36, z);
      barrier.castShadow = true;
      barrier.receiveShadow = true;
      scene.add(barrier);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.14, 0.44), barrierTopMat);
      stripe.position.set(side * 17.2, 0.75, z);
      scene.add(stripe);
      addCollider(boxAt(side * 17.2, 0.4, z, 1.92, 0.9, 0.46), 'barrier');
    }
  }

  // Crash lab wall.
  const wallMat = new THREE.MeshStandardMaterial({ map: makeConcreteTexture(), color: 0xaaa697, roughness: 0.9 });
  const wall = addBox(scene, wallMat, [2.4, 6.2, 30], [-40, 3.1, 20]);
  addCollider(boxAt(-40, 3.1, 20, 2.4, 6.2, 30), 'wall');
  const wallSign = addTextPlane(scene, [
    { text: 'IMPACT', size: 138, weight: 900, spacing: 12, color: '#f0f2e8' },
    { text: 'TEST WALL  /  RATED 80 KM/H', size: 24, weight: 500, font: 'Inter', spacing: 6, color: '#c9ff2f' }
  ], { width: 1024, height: 384 }, [19, 7.1], [-38.76, 3.4, 20], [0, Math.PI / 2, 0]);
  wallSign.material.opacity = 0.9;
  for (let i = 0; i < 9; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.55, 3.1), barrierTopMat);
    stripe.position.set(-38.77, 0.55, 7.5 + i * 3.1);
    stripe.rotation.z = 0;
    scene.add(stripe);
  }
  // Hazard chevrons at the base.
  for (let i = 0; i < 9; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.5, 3.05), barrierTopMat);
    stripe.position.set(-38.68, 0.35, 7.5 + i * 3.1);
    scene.add(stripe);
  }

  // Big jump ramp.
  function buildRamp(x, z0, z1, width, height, material = asphalt) {
    const w = width / 2;
    const positions = [
      -w, 0, z0, w, 0, z0, -w, height, z1, w, height, z1,
      -w, 0, z1, w, 0, z1
    ];
    const idx = [
      0, 1, 2, 2, 1, 3,
      0, 2, 4, 2, 4, 5,
      1, 3, 5, 3, 1, 5,
      2, 3, 5, 2, 5, 4
    ];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      map: asphaltTex, color: 0x8c9691, roughness: 0.76, metalness: 0.16
    });
    const ramp = new THREE.Mesh(geo, mat);
    ramp.position.set(x, 0.018, 0);
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    scene.add(ramp);
    // side rails
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, z1 - z0), new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.6 }));
      rail.position.set(x + side * w, height / 2 + 0.2, (z0 + z1) / 2);
      rail.rotation.x = Math.atan2(height, z1 - z0);
      scene.add(rail);
    }
    // support trusses
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      const z = z0 + (z1 - z0) * t;
      const h = height * t;
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, h, 0.14), new THREE.MeshStandardMaterial({ color: 0x232827, roughness: 0.55, metalness: 0.6 }));
        post.position.set(x + side * (w - 0.35), h / 2, z);
        scene.add(post);
      }
    }
    addTextPlane(scene, [
      { text: 'SEND IT', size: 100, weight: 900, spacing: 8, color: '#f4f5eb' }
    ], { width: 512, height: 256 }, [4.2, 2.1], [x, height + 0.35, z1 - 1.8], [0, Math.PI, 0]).rotation.x = -0.32;
  }
  buildRamp(19, 17, 39, 15, 4.5);
  buildRamp(-20, 59, 71, 10, 2.4);

  // Ramp ground height map.
  const ramps = [
    { x: 19, z0: 17, z1: 39, halfW: 7.5, h: 4.5 },
    { x: -20, z0: 59, z1: 71, halfW: 5, h: 2.4 }
  ];
  function getGroundHeight(x, z) {
    let h = 0;
    for (const r of ramps) {
      if (Math.abs(x - r.x) <= r.halfW && z >= r.z0 && z <= r.z1) {
        h = Math.max(h, r.h * (z - r.z0) / (r.z1 - r.z0));
      }
    }
    return h;
  }

  // Shipping containers.
  const containerColors = ['#36545a', '#8b513d', '#4c5c3c', '#6a4b63', '#80522e'];
  const containerMat = new THREE.MeshStandardMaterial({ roughness: 0.64, metalness: 0.38 });
  function addContainer(x, y, z, sx, sy, sz, color, rotationY = 0, label = '') {
    const group = new THREE.Group();
    const tex = makeCanvasTexture(512, 256, (ctx, w, h) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, h);
      for (let xx = 0; xx < w; xx += 18) {
        const g = ctx.createLinearGradient(xx, 0, xx + 18, 0);
        g.addColorStop(0, 'rgba(0,0,0,.24)');
        g.addColorStop(.4, 'rgba(255,255,255,.08)');
        g.addColorStop(1, 'rgba(0,0,0,.18)');
        ctx.fillStyle = g;
        ctx.fillRect(xx, 0, 18, h);
      }
      ctx.strokeStyle = 'rgba(0,0,0,.48)';
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, w - 10, h - 10);
      for (let i = 0; i < 18; i++) {
        ctx.fillStyle = `rgba(80,42,24,${Math.random() * .18})`;
        ctx.fillRect(Math.random() * w, 0, 1 + Math.random() * 4, h);
      }
    });
    const mat = containerMat.clone();
    mat.color = new THREE.Color(color);
    mat.map = tex;
    const box = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    box.castShadow = true;
    box.receiveShadow = true;
    group.add(box);
    // door details on the cargo face
    for (const side of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, sy * .8, 0.04), new THREE.MeshStandardMaterial({ color: 0x232827, metalness: .8, roughness: .4 }));
      bar.position.set(side * sx * 0.32, 0, sz / 2 + 0.025);
      group.add(bar);
    }
    if (label) {
      const labelTex = makeCanvasTexture(512, 128, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(232,236,224,.72)';
        ctx.font = '700 58px "Barlow Condensed", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, w / 2, h / 2);
      });
      const labelMesh = new THREE.Mesh(new THREE.PlaneGeometry(sx * .7, sy * .18), new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, toneMapped: false, depthWrite: false }));
      labelMesh.position.set(0, sy * .22, -sz / 2 - 0.03);
      labelMesh.rotation.y = Math.PI;
      group.add(labelMesh);
    }
    group.position.set(x, y, z);
    group.rotation.y = rotationY;
    scene.add(group);
    if (rotationY === 0) {
      addCollider(boxAt(x, y, z, sx, sy, sz), 'container');
    }
    return group;
  }
  addContainer(52, 1.3, 33, 9, 2.6, 2.5, containerColors[0], 0, 'BEAMFORGE FREIGHT');
  addContainer(52, 1.3, 36, 9, 2.6, 2.5, containerColors[1], 0, 'SECTOR 04');
  addContainer(52, 3.9, 34.5, 9, 2.6, 2.5, containerColors[2], 0, 'CRASH CARGO');
  addContainer(-62, 1.3, 88, 2.5, 2.6, 9, containerColors[3], Math.PI / 2, '');
  addContainer(73, 1.3, -20, 2.5, 2.6, 9, containerColors[4], Math.PI / 2, '');

  // Barrier stacks / tire walls.
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x151717, roughness: 0.93, metalness: 0.02 });
  const tireGeo = new THREE.TorusGeometry(0.48, 0.18, 8, 24);
  tireGeo.rotateX(Math.PI / 2);
  const tireWalls = [
    [-34, -18, 7], [44, 8, 6], [-16, 93, 5], [28, 95, 4]
  ];
  for (const [x, z, count] of tireWalls) {
    for (let i = 0; i < count; i++) {
      for (let level = 0; level < 3; level++) {
        const tire = new THREE.Mesh(tireGeo, tireMat);
        tire.position.set(x + i * 1.02, 0.19 + level * 0.35, z + (level % 2) * 0.07);
        tire.castShadow = true;
        scene.add(tire);
      }
    }
    addCollider(boxAt(x + count * .5, .6, z, count * 1.04, 1.2, 1.2), 'tires', { soft: true });
  }

  // Cones and barrels (smashable).
  const coneGeo = new THREE.ConeGeometry(0.23, 0.65, 10);
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xff6a00, roughness: 0.72 });
  const coneBandMat = new THREE.MeshBasicMaterial({ color: 0xf4f2e5, toneMapped: false });
  function addCone(x, z) {
    const g = new THREE.Group();
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.y = 0.325;
    cone.castShadow = true;
    g.add(cone);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.09, 10), coneBandMat);
    band.position.y = 0.33;
    g.add(band);
    const base = new THREE.Mesh(new THREE.BoxGeometry(.5, .04, .5), coneMat);
    base.position.y = 0.02;
    g.add(base);
    g.position.set(x, 0, z);
    scene.add(g);
    smashables.push({ group: g, x, z, radius: .65, kind: 'cone', points: 120, smashable: true });
  }
  const barrelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.95, 16);
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0xdf4a21, roughness: 0.55, metalness: 0.34 });
  const barrelMat2 = new THREE.MeshStandardMaterial({ color: 0x2d6c87, roughness: 0.55, metalness: 0.34 });
  function addBarrel(x, z, blue = false) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(barrelGeo, blue ? barrelMat2 : barrelMat);
    b.position.y = .475;
    b.castShadow = true;
    g.add(b);
    for (const y of [.28, .67]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.39, .018, 6, 20), new THREE.MeshStandardMaterial({ color: 0x1a1d1c, metalness: .6, roughness: .4 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      g.add(ring);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    smashables.push({ group: g, x, z, radius: .78, kind: 'barrel', points: 260, smashable: true });
  }
  for (const [x, z] of [[-31, -1], [-29, 5], [-31, 11], [-28, 17], [-32, 23], [-30, 29]]) addBarrel(x, z);
  for (const [x, z] of [[-27, 4], [-27, 15], [-29, 24]]) addBarrel(x, z, true);
  for (let i = 0; i < 7; i++) addCone(10.3 + i * 2.6, 9.5);
  for (let i = 0; i < 8; i++) addCone(-13 + i * 1.2, 76);
  for (const [x, z] of [[22, -14], [24, -16], [20, -17], [-25, 50], [-27, 52], [-23, 55], [40, 62], [42, 65]]) addCone(x, z);

  // Crate stacks are also smashable.
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x8d6e47, roughness: 0.86 });
  const crateEdgeMat = new THREE.MeshStandardMaterial({ color: 0x2d241b, roughness: 0.8 });
  function addCrate(x, z, size = 1.1) {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), crateMat);
    box.position.y = size / 2;
    box.castShadow = true;
    g.add(box);
    for (const y of [size * .18, size * .82]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(size * 1.01, .06, size * 1.01), crateEdgeMat);
      edge.position.y = y;
      g.add(edge);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    smashables.push({ group: g, x, z, radius: .8, kind: 'crate', points: 180, smashable: true });
  }
  addCrate(12, 94); addCrate(13.3, 94); addCrate(12.65, 95.3); addCrate(36, -35); addCrate(37.2, -35);

  // Floodlight towers.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x202624, roughness: 0.4, metalness: 0.8 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff1d2, toneMapped: false });
  for (const [x, z, h] of [[-78, -55, 13], [78, -55, 13], [-78, 95, 13], [78, 95, 13]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.16, .25, h, 8), poleMat);
    pole.position.set(x, h / 2, z);
    pole.castShadow = true;
    scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(2.0, .25, .7), poleMat);
    head.position.set(x, h, z);
    head.rotation.z = x > 0 ? -.12 : .12;
    scene.add(head);
    for (let i = 0; i < 3; i++) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(.5, .08, .55), lampMat);
      lamp.position.set(x - .65 + i * .65, h - .18, z + .1);
      scene.add(lamp);
    }
    addCollider(boxAt(x, h / 2, z, .7, h, .7), 'pole');
  }

  // Start gantry.
  const gantryMat = new THREE.MeshStandardMaterial({ color: 0x252b29, roughness: .45, metalness: .72 });
  for (const x of [-13.8, 13.8]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(.4, 8.4, .4), gantryMat);
    post.position.set(x, 4.2, -78);
    post.castShadow = true;
    scene.add(post);
  }
  const gantry = new THREE.Mesh(new THREE.BoxGeometry(28, .65, .5), gantryMat);
  gantry.position.set(0, 8.2, -78);
  gantry.castShadow = true;
  scene.add(gantry);
  addTextPlane(scene, [
    { text: 'BEAMFORGE', size: 150, weight: 900, spacing: 10, color: '#f3f4ea' },
    { text: 'PROVING GROUNDS  /  BAY 04', size: 23, weight: 500, font: 'Inter', spacing: 8, color: '#c9ff2f' }
  ], { width: 1024, height: 384 }, [12.2, 4.55], [0, 6.4, -77.72], [0, 0, 0]);
  for (const x of [-13.8, 13.8]) addCollider(boxAt(x, 4.2, -78, .6, 8.4, .6), 'pole');

  // Roadside billboard.
  const billboardPostMat = poleMat;
  for (const x of [58, 68]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(.3, 8, .3), billboardPostMat);
    p.position.set(x, 4, 73);
    scene.add(p);
  }
  addTextPlane(scene, [
    { text: 'SEND IT.', size: 210, weight: 900, spacing: 2, color: '#f3f4e8' },
    { text: 'IF IT BREAKS, BUILD IT LOUDER.', size: 30, weight: 500, font: 'Inter', spacing: 5, color: '#c9ff2f' }
  ], { width: 1024, height: 512 }, [17, 8.5], [63, 8, 73], [0, Math.PI, 0]);

  // Observation tower.
  const towerGroup = new THREE.Group();
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x3b4642, roughness: .58, metalness: .5 });
  for (const [x, z] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(.18, 9, .18), towerMat);
    leg.position.set(x, 4.5, z);
    towerGroup.add(leg);
  }
  const cab = new THREE.Mesh(new THREE.BoxGeometry(6.5, 2.4, 6.5), towerMat);
  cab.position.y = 9.8;
  cab.castShadow = true;
  towerGroup.add(cab);
  const cabGlass = new THREE.Mesh(new THREE.BoxGeometry(6.1, .9, 6.1), new THREE.MeshStandardMaterial({ color: 0x95bfca, metalness: .7, roughness: .15 }));
  cabGlass.position.y = 10.1;
  towerGroup.add(cabGlass);
  const towerDeck = new THREE.Mesh(new THREE.BoxGeometry(7.2, .2, 7.2), towerMat);
  towerDeck.position.y = 8.5;
  towerGroup.add(towerDeck);
  towerGroup.position.set(-72, 0, 18);
  scene.add(towerGroup);
  addCollider(boxAt(-72, 4.5, 18, 6.5, 9, 6.5), 'tower');

  // Water tower to break the horizon.
  const waterTower = new THREE.Group();
  const wtMat = new THREE.MeshStandardMaterial({ color: 0x8d7962, roughness: .8, metalness: .3 });
  for (const [x, z] of [[-3.2, -3.2], [3.2, -3.2], [-3.2, 3.2], [3.2, 3.2]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(.16, .25, 18, 6), wtMat);
    leg.position.set(x, 9, z);
    leg.rotation.z = x * .02;
    waterTower.add(leg);
  }
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 5, 24), wtMat);
  tank.position.y = 19.5;
  tank.castShadow = true;
  waterTower.add(tank);
  const tankTop = new THREE.Mesh(new THREE.ConeGeometry(5.5, 2.2, 24), wtMat);
  tankTop.position.y = 23.1;
  waterTower.add(tankTop);
  waterTower.position.set(-104, 0, -32);
  scene.add(waterTower);

  // Desert rocks.
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x85604a, roughness: .95, flatShading: true });
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  let rockSeed = 12;
  function rand() { rockSeed = (rockSeed * 16807) % 2147483647; return rockSeed / 2147483647; }
  for (let i = 0; i < 55; i++) {
    const a = rand() * Math.PI * 2;
    const r = 120 + rand() * 130;
    const s = 1 + rand() * 5;
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.scale.set(s * (0.7 + rand()), s * (.4 + rand() * .6), s * (.7 + rand()));
    rock.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    rock.position.set(Math.cos(a) * r, s * .25 - .1, Math.sin(a) * r + 20);
    scene.add(rock);
  }

  // Distant mesas.
  const mesaMat = new THREE.MeshStandardMaterial({ color: 0x8b5b43, roughness: 1, flatShading: true });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + rand() * .2;
    const r = 245 + rand() * 80;
    const h = 25 + rand() * 45;
    const geo = new THREE.CylinderGeometry(14 + rand() * 24, 30 + rand() * 35, h, 5 + Math.floor(rand() * 3), 1);
    const mesa = new THREE.Mesh(geo, mesaMat);
    mesa.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r + 20);
    mesa.rotation.y = rand() * 3;
    scene.add(mesa);
  }

  // Cacti / scrub.
  const cactusMat = new THREE.MeshStandardMaterial({ color: 0x4c5d3b, roughness: .92 });
  for (let i = 0; i < 20; i++) {
    const a = rand() * Math.PI * 2;
    const r = 100 + rand() * 60;
    const h = 2.5 + rand() * 3;
    const cactus = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.18, .25, h, 7), cactusMat);
    trunk.position.y = h / 2;
    cactus.add(trunk);
    if (rand() > .4) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(.12, .14, h * .45, 6), cactusMat);
      arm.position.set(.35, h * .55, 0);
      arm.rotation.z = -.6;
      cactus.add(arm);
    }
    cactus.position.set(Math.cos(a) * r, 0, Math.sin(a) * r + 20);
    scene.add(cactus);
  }

  // Dust motes and heat shimmer feel.
  const dustCount = 600;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  const dustSeed = [];
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - .5) * 260;
    dustPos[i * 3 + 1] = Math.random() * 12;
    dustPos[i * 3 + 2] = (Math.random() - .5) * 290 + 10;
    dustSeed.push(Math.random() * 10);
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0xf7d2a5, size: .085, transparent: true, opacity: .22, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: true
  }));
  scene.add(dust);

  // Invisible boundary walls.
  addCollider(boxAt(0, 4, -123, 260, 8, 1), 'boundary');
  addCollider(boxAt(0, 4, 143, 260, 8, 1), 'boundary');
  addCollider(boxAt(-119, 4, 10, 1, 8, 270), 'boundary');
  addCollider(boxAt(119, 4, 10, 1, 8, 270), 'boundary');

  const spawn = new V3(0, 0, -64);
  const spawnYaw = 0;

  function updateSun(carPos) {
    sun.position.set(carPos.x - 38, 58, carPos.z + 72);
    sun.target.position.set(carPos.x, 0, carPos.z);
    sun.target.updateMatrixWorld();
    carFill.position.set(carPos.x - 4, carPos.y + 4.5, carPos.z - 6);
  }

  function update(dt, time) {
    // Dust drift.
    const p = dust.geometry.attributes.position;
    for (let i = 0; i < dustCount; i++) {
      p.array[i * 3] += dt * (.2 + dustSeed[i] * .03);
      p.array[i * 3 + 1] += Math.sin(time * .5 + dustSeed[i]) * dt * .02;
      if (p.array[i * 3] > 130) p.array[i * 3] = -130;
    }
    p.needsUpdate = true;
    // Sky follows the camera target loosely enough to avoid clipping.
  }

  return {
    scene, sun, hemi, sky, colliders, smashables, ramps, getGroundHeight, spawn, spawnYaw,
    updateSun, update, sunDir
  };
}
