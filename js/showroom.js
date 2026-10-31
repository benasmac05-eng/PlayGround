import * as THREE from '../vendor/three.module.min.js';
import { makeCanvasTexture, makeTextTexture, createSky } from './environment.js';

export function createShowroom(renderer, envMap) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#070909');
  scene.environment = envMap;
  scene.environmentIntensity = 0.9;

  const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 80);
  const pivot = new THREE.Group();
  scene.add(pivot);

  // Floor and turntable.
  const floorTex = makeCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#0a0d0c';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) {
      const v = 18 + Math.random() * 22;
      ctx.fillStyle = `rgba(${v},${v + 2},${v},${Math.random() * .16})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
    }
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(15, 15);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ map: floorTex, color: 0x151817, roughness: 0.32, metalness: 0.64, envMapIntensity: 0.8 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  floor.receiveShadow = true;
  scene.add(floor);

  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(3.35, 3.48, 0.13, 96),
    new THREE.MeshPhysicalMaterial({ color: 0x0b0e0d, roughness: 0.2, metalness: 0.72, clearcoat: 0.8, envMapIntensity: 1.2 })
  );
  platform.position.y = 0.055;
  platform.receiveShadow = true;
  scene.add(platform);

  const ringMat = new THREE.MeshBasicMaterial({ color: 0xc9ff2f, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.36, 0.016, 6, 128), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.131;
  scene.add(ring);
  const softRing = new THREE.Mesh(
    new THREE.RingGeometry(3.38, 3.75, 96),
    new THREE.MeshBasicMaterial({ color: 0xc9ff2f, transparent: true, opacity: 0.1, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  softRing.rotation.x = -Math.PI / 2;
  softRing.position.y = 0.125;
  scene.add(softRing);

  // Circular floor markings.
  const lineMat = new THREE.LineBasicMaterial({ color: 0x91a09a, transparent: true, opacity: 0.12 });
  for (const r of [4.2, 5.2, 6.4, 8.4]) {
    const pts = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0.005, Math.sin(a) * r));
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat);
    scene.add(line);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(Math.cos(a) * 4.1, 0.006, Math.sin(a) * 4.1),
      new THREE.Vector3(Math.cos(a) * 8.5, 0.006, Math.sin(a) * 8.5)
    ]);
    scene.add(new THREE.Line(geo, lineMat));
  }

  // Industrial room shell.
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(15, 15, 13, 64, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x111513, roughness: 0.8, metalness: 0.24, side: THREE.BackSide })
  );
  shell.position.y = 5.8;
  scene.add(shell);

  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 9),
    new THREE.MeshStandardMaterial({ color: 0x0b0e0c, roughness: 0.9, metalness: 0.12 })
  );
  backWall.position.set(0, 4.2, -10.2);
  scene.add(backWall);

  // Brand mark.
  const wordTex = makeTextTexture([
    { text: 'BEAMFORGE', size: 210, weight: 900, spacing: 16, color: '#eef2e9' },
    { text: 'VEHICLE DYNAMICS LAB  /  BAY 04', size: 28, weight: 500, font: 'Inter', spacing: 9, color: '#8f9c94' }
  ], { width: 2048, height: 512 });
  const word = new THREE.Mesh(
    new THREE.PlaneGeometry(10.5, 2.62),
    new THREE.MeshBasicMaterial({ map: wordTex, transparent: true, opacity: 0.42, depthWrite: false, toneMapped: false })
  );
  word.position.set(0, 4.25, -9.8);
  scene.add(word);

  const bayTex = makeTextTexture([
    { text: '04', size: 360, weight: 900, spacing: 4, color: '#1d2421' }
  ], { width: 512, height: 768, align: 'center' });
  const bay = new THREE.Mesh(
    new THREE.PlaneGeometry(3.1, 4.65),
    new THREE.MeshBasicMaterial({ map: bayTex, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false })
  );
  bay.position.set(-8.3, 3.2, -9.5);
  scene.add(bay);

  // Vertical light slices.
  const strips = [];
  for (const [x, z, color, h] of [
    [-7.8, -6.6, '#6dd7ff', 5.6],
    [7.8, -6.6, '#ff8b4a', 5.6],
    [-6.6, 4.2, '#c9ff2f', 3.2],
    [6.6, 4.2, '#c9ff2f', 3.2]
  ]) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, toneMapped: false });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.035, h, 0.035), mat);
    strip.position.set(x, h / 2 + 0.1, z);
    scene.add(strip);
    strips.push(strip);
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, h + .4),
      new THREE.MeshBasicMaterial({
        map: makeCanvasTexture(128, 256, (ctx, w, hh) => {
          const g = ctx.createLinearGradient(0, 0, w, 0);
          g.addColorStop(0, 'rgba(255,255,255,0)');
          g.addColorStop(.5, color + '33');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, hh);
        }),
        transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
      })
    );
    halo.position.set(x, h / 2 + 0.1, z);
    halo.lookAt(0, h / 2, 0);
    scene.add(halo);
  }

  // Overhead ring light and softboxes.
  const ringLight = new THREE.Mesh(
    new THREE.TorusGeometry(3.7, 0.045, 8, 96),
    new THREE.MeshBasicMaterial({ color: 0xfff4df, toneMapped: false })
  );
  ringLight.rotation.x = Math.PI / 2;
  ringLight.position.y = 5.4;
  scene.add(ringLight);

  const softboxMat = new THREE.MeshBasicMaterial({ color: 0xfff6e8, toneMapped: false });
  const softbox = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.07, 0.28), softboxMat);
  softbox.position.set(0, 5.38, 2.8);
  scene.add(softbox);
  const softbox2 = softbox.clone();
  softbox2.position.set(0, 5.37, -2.8);
  scene.add(softbox2);

  // Lighting rig.
  scene.add(new THREE.HemisphereLight(0x9ab4c8, 0x080a08, 0.8));
  const key = new THREE.SpotLight(0xfff1dc, 130, 30, 0.48, 0.65, 1.6);
  key.position.set(4.4, 8.6, 6.4);
  key.target.position.set(0, 0.65, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0004;
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 25;
  scene.add(key, key.target);

  const cool = new THREE.SpotLight(0x8fd6ff, 90, 22, 0.55, 0.8, 1.4);
  cool.position.set(-7.2, 4.6, -3.2);
  cool.target.position.set(0, 0.8, 0);
  scene.add(cool, cool.target);

  const warm = new THREE.SpotLight(0xff8b4b, 110, 22, 0.55, 0.8, 1.4);
  warm.position.set(7.4, 4, 3.1);
  warm.target.position.set(0, 0.7, 0);
  scene.add(warm, warm.target);

  const top = new THREE.PointLight(0xfff4df, 50, 10, 1.7);
  top.position.set(0, 5.2, 0);
  scene.add(top);

  // Broad frontal fill so the near flank reads against the dark bay.
  const frontFill = new THREE.SpotLight(0xd9e9ff, 65, 26, 0.62, 0.9, 1.4);
  frontFill.position.set(6.8, 3.6, 8.4);
  frontFill.target.position.set(0, 0.75, 0);
  scene.add(frontFill, frontFill.target);

  // Floating workshop dust.
  const dustCount = 180;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 13;
    dustPos[i * 3 + 1] = Math.random() * 6;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 13;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0xe6efe3, size: 0.025, transparent: true, opacity: 0.24,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
  }));
  scene.add(dust);

  let carObject = null;
  let view = { yaw: 0.56, pitch: 0.17, distance: 9.6, targetY: 0.7, auto: true };
  let mobile = false;
  let width = 1;
  let height = 1;
  let drag = false;

  function setCar(car) {
    for (const child of [...pivot.children]) pivot.remove(child);
    carObject = car;
    car.group.position.y = 0.122;
    pivot.add(car.group);
    pivot.rotation.y = -0.16;
  }

  function resize(w, h, isMobile) {
    width = w; height = h; mobile = isMobile;
    word.visible = !mobile;
    camera.aspect = w / h;
    camera.fov = mobile ? 43 : 33;
    view.distance = mobile ? 14.5 : 12.4;
    view.targetY = mobile ? 0.05 : 0.7;
    view.yaw = mobile ? 0.44 : 0.56;
    view.pitch = mobile ? 0.12 : 0.17;
    camera.updateProjectionMatrix();
  }

  function setView(next) {
    view = { ...view, ...next };
  }

  function update(dt, time) {
    if (!carObject) return;
    if (view.auto) pivot.rotation.y += dt * 0.085;
    if (drag) {
      // The turntable still rotates, but a little slower while inspecting.
      pivot.rotation.y -= dt * 0.02;
    }

    // A restrained camera float keeps the still frame alive.
    const yaw = view.yaw + Math.sin(time * 0.17) * 0.022;
    const pitch = view.pitch + Math.sin(time * 0.23) * 0.006;
    const dist = view.distance + Math.sin(time * 0.31) * 0.08;
    const cy = Math.cos(pitch) * dist;
    camera.position.set(
      Math.sin(yaw) * cy,
      view.targetY + Math.sin(pitch) * dist + 1.25,
      Math.cos(yaw) * cy
    );
    const aiming = mobile ? -0.24 : -0.14;
    camera.lookAt(aiming, view.targetY - (mobile ? 0 : 0.05), -aiming * 0.6);

    const positions = dust.geometry.attributes.position;
    for (let i = 0; i < dustCount; i++) {
      positions.array[i * 3 + 1] += dt * (0.025 + (i % 7) * 0.004);
      if (positions.array[i * 3 + 1] > 6.3) positions.array[i * 3 + 1] = 0.2;
    }
    positions.needsUpdate = true;
    strips.forEach((s, i) => { s.material.opacity = 0.58 + Math.sin(time * 1.7 + i) * 0.16; });
    ring.material.opacity = 0.8;
    ringLight.material.color.setHSL(0.12, 0.12, 0.92 + Math.sin(time * .6) * .03);
  }

  function setDragging(value) { drag = value; }

  return {
    scene, camera, pivot, platform, setCar, resize, update, setView, setDragging,
    get view() { return view; }
  };
}
