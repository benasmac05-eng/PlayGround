import * as THREE from '../vendor/three.module.min.js';

export function makeCanvasTexture(width, height, draw, colorSpace = true) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  if (colorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function createEnvironment(renderer) {
  const tex = makeCanvasTexture(1024, 512, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#07111f');
    sky.addColorStop(0.32, '#1b3150');
    sky.addColorStop(0.52, '#9b6c63');
    sky.addColorStop(0.61, '#ffb075');
    sky.addColorStop(0.72, '#5e3a2c');
    sky.addColorStop(1, '#171312');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const sun = ctx.createRadialGradient(w * 0.69, h * 0.58, 0, w * 0.69, h * 0.58, 95);
    sun.addColorStop(0, 'rgba(255,253,236,1)');
    sun.addColorStop(0.07, 'rgba(255,246,209,1)');
    sun.addColorStop(0.22, 'rgba(255,190,120,.9)');
    sun.addColorStop(0.5, 'rgba(255,128,72,.2)');
    sun.addColorStop(1, 'rgba(255,100,50,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);

    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 34; i++) {
      const y = h * (0.31 + Math.random() * 0.18);
      const x = Math.random() * w;
      const cw = 40 + Math.random() * 220;
      const grad = ctx.createLinearGradient(x, 0, x + cw, 0);
      grad.addColorStop(0, 'rgba(255,230,205,0)');
      grad.addColorStop(0.5, 'rgba(255,229,205,.8)');
      grad.addColorStop(1, 'rgba(255,230,205,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, cw, 2 + Math.random() * 4);
    }
    ctx.globalAlpha = 1;
  });
  tex.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const rt = pmrem.fromEquirectangular(tex);
  pmrem.dispose();
  tex.dispose();
  return rt.texture;
}

export function createSky(sunDir = new THREE.Vector3(-0.3, 0.24, 0.9).normalize()) {
  const geometry = new THREE.SphereGeometry(420, 40, 20);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uSun: { value: sunDir.clone() },
      uZenith: { value: new THREE.Color('#0c1830') },
      uHorizon: { value: new THREE.Color('#ffb277') },
      uLow: { value: new THREE.Color('#4b2d26') },
      uSunColor: { value: new THREE.Color('#fff1d0') }
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec3 vWorld;
      uniform vec3 uSun, uZenith, uHorizon, uLow, uSunColor;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
      }
      void main() {
        vec3 dir = normalize(vWorld);
        float h = dir.y;
        vec3 color = mix(uHorizon, uZenith, smoothstep(-0.02, 0.52, h));
        color = mix(uLow, color, smoothstep(-0.2, -0.015, h));
        float sunAmount = max(dot(dir, normalize(uSun)), 0.0);
        color += uSunColor * pow(sunAmount, 420.0) * 2.6;
        color += uSunColor * pow(sunAmount, 12.0) * 0.18;
        // thin high-altitude streaks
        float n = noise(vec2(atan(dir.z, dir.x) * 4.0, h * 18.0));
        float cloud = smoothstep(0.62, 0.9, n) * smoothstep(0.06, 0.24, h) * (1.0 - smoothstep(0.28, 0.4, h));
        color = mix(color, vec3(1.0, 0.76, 0.63), cloud * 0.22);
        float haze = 1.0 - smoothstep(0.0, 0.16, abs(h));
        color += vec3(0.18, 0.1, 0.07) * haze * 0.35;
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

export function makeAsphaltTexture() {
  const tex = makeCanvasTexture(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#2f3230';
    ctx.fillRect(0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 30;
      d[i] += n;
      d[i + 1] += n;
      d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
    // Aggregate flecks
    for (let i = 0; i < 11000; i++) {
      const shade = 30 + Math.random() * 80;
      ctx.fillStyle = `rgba(${shade},${shade + 2},${shade},${0.12 + Math.random() * 0.28})`;
      const s = Math.random() * 2.2;
      ctx.fillRect(Math.random() * w, Math.random() * h, s, s);
    }
    // cracks
    for (let c = 0; c < 18; c++) {
      let x = Math.random() * w;
      let y = Math.random() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 9; s++) {
        x += (Math.random() - 0.5) * 28;
        y += Math.random() * 22;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(8,10,9,.32)';
      ctx.lineWidth = 0.7 + Math.random() * 1.2;
      ctx.stroke();
    }
    // tire bloom / oil stains
    for (let i = 0; i < 20; i++) {
      const g = ctx.createRadialGradient(Math.random() * w, Math.random() * h, 0, Math.random() * w, Math.random() * h, 20 + Math.random() * 90);
      g.addColorStop(0, 'rgba(5,7,6,.12)');
      g.addColorStop(1, 'rgba(5,7,6,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(20, 20);
  return tex;
}

export function makeSandTexture() {
  const tex = makeCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#9a6242';
    ctx.fillRect(0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 26;
      d[i] += n;
      d[i + 1] += n * .7;
      d[i + 2] += n * .5;
    }
    ctx.putImageData(img, 0, 0);
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < 80; i++) {
      ctx.strokeStyle = i % 2 ? '#c8956d' : '#6b412d';
      ctx.lineWidth = 1 + Math.random() * 2;
      ctx.beginPath();
      const y = Math.random() * h;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * .3, y + 10, w * .6, y - 10, w, y + 4);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(35, 35);
  return tex;
}

export function makeConcreteTexture() {
  const tex = makeCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#87847a';
    ctx.fillRect(0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 24;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(30,29,25,${Math.random() * .13})`;
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, 4 + Math.random() * 30, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

export function makeStripeTexture() {
  const tex = makeCanvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f3b12b';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#151817';
    for (let x = -h; x < w + h; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + 32, h);
      ctx.lineTo(x + 32 + h, 0);
      ctx.lineTo(x + h, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 250; i++) {
      ctx.fillStyle = Math.random() > .5 ? '#2b2118' : '#f2d684';
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function makeTextTexture(lines, options = {}) {
  const {
    width = 1024, height = 512, background = 'transparent',
    accent = '#c9ff2f', color = '#f5f7ef', align = 'center'
  } = options;
  return makeCanvasTexture(width, height, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    if (background !== 'transparent') {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    const x = align === 'center' ? w / 2 : 48;
    let y = h * 0.16;
    for (const line of lines) {
      const { text, size = 110, weight = 700, font = 'Barlow Condensed', spacing = 0, color: c = color, bar = false, alpha = 1 } = line;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = c;
      ctx.font = `${weight} ${size}px "${font}", sans-serif`;
      ctx.letterSpacing = `${spacing}px`;
      ctx.fillText(text, x, y);
      if (bar) {
        ctx.fillStyle = accent;
        ctx.fillRect(align === 'center' ? w * .42 : 48, y + size * .62, w * .16, 3);
      }
      y += size * 1.05 + 16;
      ctx.restore();
    }
  });
}

export function makeContainerTexture(color = '#395d61') {
  const tex = makeCanvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) {
      const g = ctx.createLinearGradient(x, 0, x + 32, 0);
      g.addColorStop(0, 'rgba(0,0,0,.16)');
      g.addColorStop(.35, 'rgba(255,255,255,.06)');
      g.addColorStop(.7, 'rgba(0,0,0,.02)');
      g.addColorStop(1, 'rgba(0,0,0,.28)');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 32, h);
    }
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    for (let i = 0; i < 130; i++) {
      ctx.fillStyle = `rgba(98,52,32,${Math.random() * .18})`;
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.fillRect(x, y, 1 + Math.random() * 5, 4 + Math.random() * 40);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
