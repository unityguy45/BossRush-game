import * as THREE from 'three';
import { ARENA_RADIUS, PILLAR_COUNT, PILLAR_RING, PILLAR_REGROW } from './Constants.js';

const FAR_COLOR = new THREE.Color(0x12051a);

function jagged(geo, amount, keep = () => false) {
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const seen = new Map();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (keep(v)) continue;
    const key = `${Math.round(v.x * 10)},${Math.round(v.y * 10)},${Math.round(v.z * 10)}`;
    if (!seen.has(key)) seen.set(key, 1 + (Math.random() - 0.5) * amount * 2);
    const k = seen.get(key);
    pos.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

function radialJagged(geo, amount, keep) {
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const seen = new Map();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (keep(v)) continue;
    const key = `${Math.round(v.x * 10)},${Math.round(v.y * 10)},${Math.round(v.z * 10)}`;
    if (!seen.has(key)) seen.set(key, [1 + (Math.random() - 0.5) * amount * 2, (Math.random() - 0.5) * 18]);
    const [k, dz] = seen.get(key);
    pos.setXYZ(i, v.x * k, v.y * k, v.z + dz);
  }
  geo.computeVertexNormals();
  return geo;
}

export function rockGeometry(radius, detail = 0, jag = 0.28) {
  return jagged(new THREE.IcosahedronGeometry(radius, detail), jag);
}

function floorTextures() {
  const size = 2048;
  const c = size / 2;
  const base = document.createElement('canvas');
  base.width = base.height = size;
  const g = base.getContext('2d');
  g.fillStyle = '#120e18';
  g.fillRect(0, 0, size, size);

  const ringW = 76;
  for (let r0 = 60; r0 < c; r0 += ringW) {
    const r1 = Math.min(r0 + ringW, c);
    const n = Math.max(8, Math.floor((Math.PI * (r0 + r1)) / 95));
    const off = Math.random() * Math.PI;
    for (let j = 0; j < n; j++) {
      const a0 = off + (j / n) * Math.PI * 2;
      const a1 = off + ((j + 1) / n) * Math.PI * 2;
      const l = 20 + Math.random() * 13;
      g.fillStyle = `hsl(${258 + Math.random() * 18}, ${10 + Math.random() * 8}%, ${l}%)`;
      g.beginPath();
      g.arc(c, c, r1 - 4, a0 + 0.006, a1 - 0.006);
      g.arc(c, c, r0 + 4, a1 - 0.006, a0 + 0.006, true);
      g.closePath();
      g.fill();
    }
  }
  g.fillStyle = '#2b2533';
  g.beginPath();
  g.arc(c, c, 56, 0, Math.PI * 2);
  g.fill();

  for (let i = 0; i < 26000; i++) {
    g.fillStyle = Math.random() < 0.6 ? 'rgba(0,0,0,0.18)' : 'rgba(255,240,255,0.05)';
    const s = 1 + Math.random() * 3;
    g.fillRect(Math.random() * size, Math.random() * size, s, s);
  }
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  for (let i = 0; i < 70; i++) {
    let x = Math.random() * size;
    let y = Math.random() * size;
    g.lineWidth = 1 + Math.random() * 2;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      x += (Math.random() - 0.5) * 60;
      y += (Math.random() - 0.5) * 60;
      g.lineTo(x, y);
    }
    g.stroke();
  }

  const glow = document.createElement('canvas');
  glow.width = glow.height = size;
  const h = glow.getContext('2d');
  h.fillStyle = '#000';
  h.fillRect(0, 0, size, size);
  h.strokeStyle = '#fff';
  h.fillStyle = '#fff';
  const circle = (r, w) => {
    h.lineWidth = w;
    h.beginPath();
    h.arc(c, c, r, 0, Math.PI * 2);
    h.stroke();
  };
  circle(c * 0.9, 9);
  circle(c * 0.83, 4);
  circle(c * 0.36, 7);
  circle(c * 0.31, 3);
  circle(c * 0.08, 5);

  const glyphs = 56;
  for (let i = 0; i < glyphs; i++) {
    const a = (i / glyphs) * Math.PI * 2;
    h.save();
    h.translate(c + Math.cos(a) * c * 0.865, c + Math.sin(a) * c * 0.865);
    h.rotate(a + Math.PI / 2);
    h.lineWidth = 4;
    h.beginPath();
    for (let s = 0; s < 3; s++) {
      h.moveTo((Math.random() - 0.5) * 22, (Math.random() - 0.5) * 18);
      h.lineTo((Math.random() - 0.5) * 22, (Math.random() - 0.5) * 18);
    }
    h.stroke();
    h.restore();
  }

  h.lineWidth = 4;
  for (const off of [0, Math.PI / 6]) {
    h.beginPath();
    for (let i = 0; i <= 3; i++) {
      const a = off + (i / 3) * Math.PI * 2 - Math.PI / 2;
      const x = c + Math.cos(a) * c * 0.31;
      const y = c + Math.sin(a) * c * 0.31;
      if (i === 0) h.moveTo(x, y);
      else h.lineTo(x, y);
    }
    h.stroke();
  }
  h.lineWidth = 3;
  h.setLineDash([18, 22]);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    h.beginPath();
    h.moveTo(c + Math.cos(a) * c * 0.37, c + Math.sin(a) * c * 0.37);
    h.lineTo(c + Math.cos(a) * c * 0.82, c + Math.sin(a) * c * 0.82);
    h.stroke();
  }
  h.setLineDash([]);

  const map = new THREE.CanvasTexture(base);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const glowMap = new THREE.CanvasTexture(glow);
  glowMap.anisotropy = 8;
  return { map, glowMap };
}

function lavaMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTint: { value: new THREE.Color(0xff6a1a) },
      uFar: { value: FAR_COLOR.clone() },
    },
    vertexShader: `
      varying vec2 vPos;
      void main() {
        vPos = (modelMatrix * vec4(position, 1.0)).xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uTint;
      uniform vec3 uFar;
      varying vec2 vPos;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
        return v;
      }
      void main() {
        vec2 p = vPos * 0.0025;
        float n = fbm(p * 2.0 + vec2(uTime * 0.03, uTime * 0.02));
        float m = fbm(p * 4.0 + n * 1.8 - vec2(uTime * 0.05, -uTime * 0.04));
        float veins = smoothstep(0.42, 0.62, m);
        float hot = smoothstep(0.55, 0.8, m);
        vec3 crust = vec3(0.03, 0.01, 0.02);
        vec3 lava = mix(vec3(1.0, 0.16, 0.02), vec3(1.0, 0.62, 0.14), hot);
        lava = mix(lava, uTint, 0.18);
        vec3 col = mix(crust, lava * (0.45 + 1.5 * hot), veins * 0.85);
        float d = length(vPos);
        col = mix(col, uFar, smoothstep(1300.0, 3200.0, d));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x040110) },
      uHorizon: { value: new THREE.Color(0x3a0c2c) },
      uBottom: { value: FAR_COLOR.clone() },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uBottom;
      varying vec3 vDir;
      void main() {
        float h = vDir.z;
        vec3 col = h > 0.0 ? mix(uHorizon, uTop, pow(h, 0.45)) : mix(uHorizon, uBottom, pow(-h, 0.35));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

export function createArena(scene) {
  const R = ARENA_RADIUS;
  const group = new THREE.Group();
  scene.add(group);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(6000, 32, 16), skyMaterial());
  group.add(sky);

  const moon = new THREE.Mesh(new THREE.SphereGeometry(240, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd9c2).multiplyScalar(1.2), fog: false }));
  moon.position.set(1700, 4200, 1300);
  group.add(moon);

  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  for (let i = 0; i < 1600; i++) {
    const a = Math.random() * Math.PI * 2;
    const z = 0.05 + Math.random() * 0.95;
    const r = Math.sqrt(1 - z * z);
    starPos.push(Math.cos(a) * r * 5200, Math.sin(a) * r * 5200, z * 5200);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  group.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(2), size: 9, fog: false })));

  const hemi = new THREE.HemisphereLight(0x8c7cff, 0xff6a2a, 1.1);
  scene.add(hemi);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const sun = new THREE.DirectionalLight(0xffe4cf, 2.6);
  sun.position.set(-380, -260, 820);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -600;
  sun.shadow.camera.right = 600;
  sun.shadow.camera.top = 600;
  sun.shadow.camera.bottom = -600;
  sun.shadow.camera.near = 100;
  sun.shadow.camera.far = 2200;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  const lava = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), lavaMaterial());
  lava.position.z = -140;
  group.add(lava);

  const { map, glowMap } = floorTextures();
  const floorMat = new THREE.MeshStandardMaterial({ map, emissiveMap: glowMap, emissive: 0xff6a1a, emissiveIntensity: 1.6, roughness: 0.92 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 128), floorMat);
  floor.receiveShadow = true;
  group.add(floor);

  const rockMat = new THREE.MeshStandardMaterial({ color: 0x2a2132, roughness: 0.95, flatShading: true });
  const darkRock = new THREE.MeshStandardMaterial({ color: 0x1c1524, roughness: 1, flatShading: true });

  const sideGeo = new THREE.CylinderGeometry(R, R * 0.86, 80, 128, 4, true);
  sideGeo.rotateX(Math.PI / 2);
  sideGeo.translate(0, 0, -40);
  radialJagged(sideGeo, 0.05, (v) => v.z > -2);
  const side = new THREE.Mesh(sideGeo, rockMat);
  side.receiveShadow = true;
  group.add(side);

  const coneGeo = new THREE.ConeGeometry(R * 0.86, 420, 96, 8, true);
  coneGeo.rotateX(-Math.PI / 2);
  coneGeo.translate(0, 0, -80 - 210);
  radialJagged(coneGeo, 0.12, (v) => v.z > -82);
  group.add(new THREE.Mesh(coneGeo, darkRock));

  const dripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff5a10).multiplyScalar(1.8) });
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2;
    const len = 40 + Math.random() * 140;
    const drip = new THREE.Mesh(new THREE.ConeGeometry(2 + Math.random() * 3, len, 5), dripMat);
    drip.rotation.x = -Math.PI / 2;
    const z = -90 - Math.random() * 120;
    const rr = R * 0.86 * (1 - (-80 - z) / 420) + 3;
    drip.position.set(Math.cos(a) * rr, Math.sin(a) * rr, z - len / 2);
    group.add(drip);
  }

  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2 + Math.random() * 0.05;
    const south = Math.sin(a) < -0.3;
    const s = south ? 10 + Math.random() * 12 : 14 + Math.random() * 26;
    const rock = new THREE.Mesh(rockGeometry(s, 0, 0.35), rockMat);
    const rr = R + 4 + Math.random() * 18;
    rock.position.set(Math.cos(a) * rr, Math.sin(a) * rr, -4 + Math.random() * 8);
    rock.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }

  for (let i = 0; i < 12; i++) {
    const a = 0.25 + (i / 11) * (Math.PI - 0.5) + (Math.random() - 0.5) * 0.12;
    const hgt = 140 + Math.random() * 200;
    const spireGeo = jagged(new THREE.ConeGeometry(26 + Math.random() * 18, hgt, 6, 4), 0.12);
    spireGeo.rotateX(Math.PI / 2);
    spireGeo.translate(0, 0, hgt / 2 - 20);
    const spire = new THREE.Mesh(spireGeo, rockMat);
    const rr = R + 40 + Math.random() * 40;
    spire.position.set(Math.cos(a) * rr, Math.sin(a) * rr, 0);
    spire.rotation.set(Math.sin(a) * 0.25, -Math.cos(a) * 0.25, Math.random() * 6);
    spire.castShadow = true;
    group.add(spire);
  }

  const crystalMat = new THREE.MeshStandardMaterial({ color: 0x0b0b1a, emissive: 0xff6a1a, emissiveIntensity: 1.0, roughness: 0.2, flatShading: true });
  const hookMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x5dff9e).multiplyScalar(1.6) });
  const pillars = [];
  const pillarGeo = {
    base: new THREE.CylinderGeometry(36, 42, 16, 8).rotateX(Math.PI / 2).translate(0, 0, 8),
    shaft: jagged(new THREE.CylinderGeometry(24, 29, 96, 8, 3), 0.05).rotateX(Math.PI / 2).translate(0, 0, 64),
    band: new THREE.TorusGeometry(28, 3.5, 6, 8),
    cap: new THREE.CylinderGeometry(33, 26, 12, 8).rotateX(Math.PI / 2).translate(0, 0, 118),
    hook: new THREE.TorusGeometry(15, 2.4, 8, 28),
    crack: new THREE.CylinderGeometry(26, 30, 100, 8, 4, true).rotateX(Math.PI / 2).translate(0, 0, 62),
    crystal: new THREE.OctahedronGeometry(15, 0),
  };
  for (let i = 0; i < PILLAR_COUNT; i++) {
    const a = ((i + 0.5) / PILLAR_COUNT) * Math.PI * 2;
    const x = Math.cos(a) * PILLAR_RING;
    const y = Math.sin(a) * PILLAR_RING;
    const group = new THREE.Group();
    group.position.set(x, y, 0);
    const stone = new THREE.MeshStandardMaterial({ color: 0x3d3349, roughness: 0.85, flatShading: true, transparent: true });
    const parts = [
      new THREE.Mesh(pillarGeo.base, stone),
      new THREE.Mesh(pillarGeo.shaft, stone),
      new THREE.Mesh(pillarGeo.cap, stone),
    ];
    for (const z of [38, 90]) {
      const band = new THREE.Mesh(pillarGeo.band, stone);
      band.position.z = z;
      parts.push(band);
    }
    parts.forEach((m) => {
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    });
    const hook = new THREE.Mesh(pillarGeo.hook, hookMat);
    hook.position.z = 127;
    group.add(hook);
    const crackMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3020).multiplyScalar(2.5), wireframe: true, transparent: true, opacity: 0 });
    const crack = new THREE.Mesh(pillarGeo.crack, crackMat);
    group.add(crack);
    const crystal = new THREE.Mesh(pillarGeo.crystal, crystalMat);
    crystal.scale.set(1, 1, 1.8);
    crystal.position.z = 162;
    crystal.castShadow = true;
    group.add(crystal);
    group.add(new THREE.Mesh(new THREE.RingGeometry(40, 44, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x5dff9e).multiplyScalar(0.8), transparent: true, opacity: 0.35, depthWrite: false })));
    group.children[group.children.length - 1].position.z = 1.3;
    scene.add(group);
    pillars.push({ x, y, r: 32, group, stone, crackMat, crystal, hook, state: 'stand', t: 0, delay: 1, heat: 0, phase: i * 1.3 });
  }
  const solid = (p) => p.state === 'stand' || p.state === 'crumble';
  const hooks = { onCollapse: null };
  const collapse = (p) => {
    if (!solid(p)) return;
    p.state = 'gone';
    p.t = PILLAR_REGROW + Math.random() * 6;
    p.heat = 0;
    p.group.visible = false;
    if (hooks.onCollapse) hooks.onCollapse(p);
  };

  const floaters = [];
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = 640 + Math.random() * 600;
    const rock = new THREE.Mesh(rockGeometry(18 + Math.random() * 46, 0, 0.35), rockMat);
    rock.position.set(Math.cos(a) * d, Math.sin(a) * d, -60 + Math.random() * 220);
    rock.castShadow = true;
    group.add(rock);
    floaters.push({ mesh: rock, a, d, z: rock.position.z, speed: 0.02 + Math.random() * 0.04, spin: (Math.random() - 0.5) * 0.6, phase: Math.random() * 6 });
  }

  const EMBERS = 700;
  const emberGeo = new THREE.BufferGeometry();
  const emberPos = new Float32Array(EMBERS * 3);
  const emberSpeed = new Float32Array(EMBERS);
  const resetEmber = (i, randomZ) => {
    const a = Math.random() * Math.PI * 2;
    const d = R * 0.9 + Math.random() * 1500;
    emberPos[i * 3] = Math.cos(a) * d;
    emberPos[i * 3 + 1] = Math.sin(a) * d;
    emberPos[i * 3 + 2] = randomZ ? -140 + Math.random() * 560 : -140;
    emberSpeed[i] = 30 + Math.random() * 80;
  };
  for (let i = 0; i < EMBERS; i++) resetEmber(i, true);
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  const emberMat = new THREE.PointsMaterial({ color: new THREE.Color(0xff7a2a).multiplyScalar(2.2), size: 5, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  group.add(new THREE.Points(emberGeo, emberMat));

  const mood = new THREE.Color(0xff6a1a);
  const moodTarget = new THREE.Color(0xff6a1a);

  return {
    radius: R,
    pillars,
    setMood(color) {
      moodTarget.set(color);
    },
    hooks,
    isSolid: solid,
    collapse,
    crumble(p, delay = 1.4) {
      if (p.state !== 'stand') return false;
      p.state = 'crumble';
      p.t = delay;
      p.delay = delay;
      return true;
    },
    solidPillars() {
      return pillars.filter(solid);
    },
    pillarAt(x, y, r) {
      return pillars.some((p) => solid(p) && Math.hypot(x - p.x, y - p.y) < p.r + r);
    },
    pushOut(pos, r) {
      for (const p of pillars) {
        if (!solid(p)) continue;
        const dx = pos.x - p.x;
        const dy = pos.y - p.y;
        const d = Math.hypot(dx, dy);
        const min = p.r + r;
        if (d < min && d > 0.001) {
          pos.x = p.x + (dx / d) * min;
          pos.y = p.y + (dy / d) * min;
        }
      }
      const d0 = Math.hypot(pos.x, pos.y);
      const lim = R - r - 6;
      if (d0 > lim) {
        pos.x *= lim / d0;
        pos.y *= lim / d0;
      }
    },
    rayHit(x, y, angle, maxLen) {
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      let best = maxLen;
      let pillar = null;
      for (const p of pillars) {
        if (!solid(p)) continue;
        const fx = x - p.x;
        const fy = y - p.y;
        const b = fx * dx + fy * dy;
        const c = fx * fx + fy * fy - p.r * p.r;
        const disc = b * b - c;
        if (disc < 0) continue;
        const t = -b - Math.sqrt(disc);
        if (t > 0 && t < best) {
          best = t;
          pillar = p;
        }
      }
      return { t: best, pillar };
    },
    rayToPillar(x, y, angle, maxLen) {
      return this.rayHit(x, y, angle, maxLen).t;
    },
    fade(pos) {
      for (const p of pillars) {
        const blocking = p.y < pos.y - 10 && p.y > pos.y - 300 && Math.abs(p.x - pos.x) < 95;
        const target = blocking ? 0.28 : 1;
        p.stone.opacity += (target - p.stone.opacity) * 0.15;
        p.stone.depthWrite = p.stone.opacity > 0.9;
      }
    },
    reset() {
      for (const p of pillars) {
        p.state = 'stand';
        p.t = 0;
        p.heat = 0;
        p.group.visible = true;
        p.group.scale.set(1, 1, 1);
        p.group.position.set(p.x, p.y, 0);
        p.crackMat.opacity = 0;
      }
    },
    update(time, dt) {
      lava.material.uniforms.uTime.value = time;
      mood.lerp(moodTarget, Math.min(1, dt * 2));
      floorMat.emissive.copy(mood);
      floorMat.emissiveIntensity = 0.9 + Math.sin(time * 2.2) * 0.3;
      crystalMat.emissive.copy(mood);
      lava.material.uniforms.uTint.value.copy(mood);
      hemi.groundColor.copy(mood).multiplyScalar(0.45);
      for (const p of pillars) {
        p.crystal.rotation.z += dt * 0.8;
        p.crystal.position.z = 162 + Math.sin(time * 1.5 + p.phase) * 8;
        p.hook.rotation.z -= dt * 1.5;
        if (p.state === 'crumble') {
          p.t -= dt;
          const k = 1 - Math.max(p.t, 0) / p.delay;
          p.crackMat.opacity = Math.min(1, k * 1.3);
          p.group.position.set(p.x + (Math.random() - 0.5) * 6 * k, p.y + (Math.random() - 0.5) * 6 * k, 0);
          if (p.t <= 0) collapse(p);
        } else if (p.state === 'gone') {
          p.t -= dt;
          if (p.t <= 0) {
            p.state = 'rise';
            p.t = 0;
            p.crackMat.opacity = 0;
            p.group.position.set(p.x, p.y, 0);
            p.group.scale.set(1, 1, 0.01);
            p.group.visible = true;
          }
        } else if (p.state === 'rise') {
          p.t += dt;
          p.group.scale.z = Math.min(1, p.t / 1.2);
          if (p.t >= 1.2) {
            p.state = 'stand';
            p.group.scale.z = 1;
          }
        }
      }
      for (const f of floaters) {
        f.a += f.speed * dt;
        f.mesh.position.set(Math.cos(f.a) * f.d, Math.sin(f.a) * f.d, f.z + Math.sin(time * 0.6 + f.phase) * 14);
        f.mesh.rotation.x += f.spin * dt;
        f.mesh.rotation.y += f.spin * 0.7 * dt;
      }
      for (let i = 0; i < EMBERS; i++) {
        emberPos[i * 3 + 2] += emberSpeed[i] * dt;
        emberPos[i * 3] += Math.sin(time + i) * 8 * dt;
        if (emberPos[i * 3 + 2] > 420) resetEmber(i, false);
      }
      emberGeo.attributes.position.needsUpdate = true;
    },
  };
}
