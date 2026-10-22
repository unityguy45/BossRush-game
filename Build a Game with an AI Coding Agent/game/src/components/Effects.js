import * as THREE from 'three';

const shardGeo = new THREE.OctahedronGeometry(1, 0);
const ringGeo = new THREE.RingGeometry(0.9, 1, 96);
const boltGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
const cache = new Map();
const UP = new THREE.Vector3(0, 1, 0);

export function glowMat(color, boost = 2.4) {
  const key = `${color}:${boost}`;
  if (!cache.has(key)) cache.set(key, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(boost) }));
  return cache.get(key);
}

export function fadeMat(color, boost = 3, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(color).multiplyScalar(boost),
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.parts = [];
    this.rings = [];
    this.bolts = [];
    this.shake = 0;
  }

  burst(x, y, z, color, count = 14, power = 200, size = 4, boost = 2.2, gravity = 600) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(shardGeo, glowMat(color, boost));
      mesh.position.set(x, y, z);
      const a = Math.random() * Math.PI * 2;
      const s = power * (0.3 + Math.random() * 0.9);
      const life = 0.4 + Math.random() * 0.5;
      this.scene.add(mesh);
      this.parts.push({
        mesh,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        vz: (Math.random() * 0.8 + 0.2) * power,
        life,
        max: life,
        size: size * (0.6 + Math.random() * 0.8),
        gravity,
      });
    }
    this.trim();
  }

  spark(x, y, z, color, size = 3, life = 0.3, boost = 2.2, vz = 20) {
    const mesh = new THREE.Mesh(shardGeo, glowMat(color, boost));
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.parts.push({ mesh, vx: 0, vy: 0, vz, life, max: life, size, gravity: 0 });
    this.trim();
  }

  trim() {
    while (this.parts.length > 900) {
      const p = this.parts.shift();
      this.scene.remove(p.mesh);
    }
  }

  ring(x, y, color, maxR = 120, time = 0.4, z = 2, boost = 2) {
    const mesh = new THREE.Mesh(ringGeo, fadeMat(color, boost));
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(0.01);
    this.scene.add(mesh);
    this.rings.push({ mesh, maxR, time, t: 0 });
  }

  bolt(x, y, color) {
    const group = new THREE.Group();
    const mat = fadeMat(color, 5);
    let px = x + (Math.random() - 0.5) * 120;
    let py = y + (Math.random() - 0.5) * 120;
    let pz = 900;
    while (pz > 0) {
      const nz = Math.max(0, pz - 80 - Math.random() * 90);
      const nx = nz === 0 ? x : x + (Math.random() - 0.5) * 70;
      const ny = nz === 0 ? y : y + (Math.random() - 0.5) * 70;
      const a = new THREE.Vector3(px, py, pz);
      const b = new THREE.Vector3(nx, ny, nz);
      const seg = new THREE.Mesh(boltGeo, mat);
      seg.position.copy(a).add(b).multiplyScalar(0.5);
      seg.scale.set(5, a.distanceTo(b), 5);
      seg.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
      group.add(seg);
      px = nx;
      py = ny;
      pz = nz;
    }
    this.scene.add(group);
    this.bolts.push({ group, mat, life: 0.3 });
  }

  addShake(amount) {
    this.shake = Math.max(this.shake, amount);
  }

  shakeOffset() {
    const s = this.shake;
    return new THREE.Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }

  update(dt) {
    this.parts = this.parts.filter((p) => {
      p.life -= dt;
      p.vz -= p.gravity * dt;
      p.vx *= 1 - Math.min(1, dt * 1.5);
      p.vy *= 1 - Math.min(1, dt * 1.5);
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z = Math.max(1, p.mesh.position.z + p.vz * dt);
      p.mesh.rotation.x += dt * 9;
      p.mesh.rotation.y += dt * 7;
      p.mesh.scale.setScalar(Math.max(p.size * (p.life / p.max), 0.001));
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        return false;
      }
      return true;
    });

    this.rings = this.rings.filter((r) => {
      r.t += dt;
      const k = Math.min(r.t / r.time, 1);
      r.mesh.scale.setScalar(Math.max(k * r.maxR, 0.01));
      r.mesh.material.opacity = 1 - k;
      if (k >= 1) {
        this.scene.remove(r.mesh);
        r.mesh.material.dispose();
        return false;
      }
      return true;
    });

    this.bolts = this.bolts.filter((b) => {
      b.life -= dt;
      b.mat.opacity = Math.max(b.life / 0.3, 0);
      if (b.life <= 0) {
        this.scene.remove(b.group);
        b.mat.dispose();
        return false;
      }
      return true;
    });

    this.shake = Math.max(0, this.shake - dt * 45);
  }

  clear() {
    this.parts.forEach((p) => this.scene.remove(p.mesh));
    this.rings.forEach((r) => this.scene.remove(r.mesh));
    this.bolts.forEach((b) => this.scene.remove(b.group));
    this.parts = [];
    this.rings = [];
    this.bolts = [];
  }
}
