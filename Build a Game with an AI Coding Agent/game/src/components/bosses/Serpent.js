import * as THREE from 'three';
import { Boss } from './Boss.js';

const SEGMENTS = 26;

export class Serpent extends Boss {
  constructor(ctx, def) {
    super(ctx, def);
    this.radius = 40;
    this.skin = new THREE.MeshStandardMaterial({ color: 0x1b1030, metalness: 0.55, roughness: 0.35, flatShading: true });
    this.band = this.glow(new THREE.MeshStandardMaterial({ color: 0x000000, emissive: def.color, emissiveIntensity: 3 }));
    this.eyeMat = this.glow(new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 5 }));

    this.head = new THREE.Group();
    this.head.up.set(0, 0, 1);
    this.group.add(this.head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(30, 16, 12), this.skin);
    skull.scale.set(1, 0.8, 1.3);
    skull.castShadow = true;
    this.head.add(skull);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(20, 58, 8), this.skin);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, 4, 44);
    snout.castShadow = true;
    this.head.add(snout);
    const jaw = new THREE.Mesh(new THREE.ConeGeometry(14, 48, 8), this.skin);
    jaw.rotation.x = Math.PI / 2;
    jaw.position.set(0, -14, 36);
    this.head.add(jaw);
    const mouth = new THREE.Mesh(new THREE.ConeGeometry(13, 40, 8), this.band);
    mouth.rotation.x = Math.PI / 2;
    mouth.position.set(0, -6, 38);
    this.head.add(mouth);
    for (const s of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(6, 62, 6), this.skin);
      horn.position.set(s * 17, 22, -16);
      horn.rotation.set(-2.1, 0, s * 0.35);
      horn.castShadow = true;
      this.head.add(horn);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(5, 12, 8), this.eyeMat);
      eye.position.set(s * 16, 11, 24);
      this.head.add(eye);
    }

    this.segs = [];
    this.offsets = [];
    let off = 0;
    let prevR = 30;
    for (let i = 0; i < SEGMENTS; i++) {
      const r = THREE.MathUtils.lerp(30, 10, i / (SEGMENTS - 1));
      off += i === 0 ? 46 : (prevR + r) * 0.72;
      prevR = r;
      const g = new THREE.Group();
      g.up.set(0, 0, 1);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), this.skin);
      ball.scale.z = 1.25;
      ball.castShadow = true;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.98, r * 0.14, 6, 24), this.band);
      g.add(ball, ring);
      if (i % 2 === 0) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(r * 0.35, r * 1.5, 5), this.skin);
        spike.position.y = r * 0.95;
        spike.rotation.x = -0.5;
        g.add(spike);
      }
      this.group.add(g);
      this.segs.push({ g, r });
      this.offsets.push(off);
    }

    this.rubbleBreaksShield = true;
    this.shieldOn = true;
    this.shieldTimer = 0;
    this.makeShield(62, 0x9dffff);
    this.vel = new THREE.Vector3(0, -1, 1).setLength(def.speed);
    this.head.position.set(0, 520, -320);
    this.history = [];
    for (let i = 0; i < 300; i++) this.history.push(new THREE.Vector3(0, 520 + i * 2, -320 - i * 3));
    this.goal = null;
    this.speedMul = 1;
    this.turn = 2.6;
    this.layout();
  }

  get pos() {
    return this.head.position;
  }

  get shielded() {
    return this.shieldOn;
  }

  shieldCenter() {
    return this.head.position.clone();
  }

  shieldHint() {
    if (this.shieldOn) return 'VOID SHIELD · only thrown rubble can break it';
    return `EXPOSED · shield returns in ${Math.ceil(Math.max(0, this.shieldTimer))}s`;
  }

  breakShield() {
    this.shieldOn = false;
    this.shieldTimer = this.enraged ? 6 : 8;
    const h = this.head.position;
    this.ctx.effects.burst(h.x, h.y, h.z, 0x9dffff, 40, 420, 6);
    this.ctx.effects.ring(h.x, h.y, 0x9dffff, 220, 0.5, Math.max(2, h.z));
    this.ctx.onShieldDown(this);
  }

  onEnrage() {
    this.color = 0xff2a3a;
    this.band.emissive.set(this.color);
    this.ctx.effects.burst(this.pos.x, this.pos.y, this.pos.z, this.color, 40, 420, 6);
  }

  layout() {
    let a = this.head.position;
    let j = 0;
    let travelled = 0;
    let prev = this.head;
    for (let i = 0; i < this.segs.length; i++) {
      const s = this.segs[i];
      const want = this.offsets[i];
      let placed = false;
      while (j < this.history.length) {
        const b = this.history[j];
        const d = a.distanceTo(b);
        if (d < 1e-6) {
          a = b;
          j++;
          continue;
        }
        if (travelled + d >= want) {
          s.g.position.lerpVectors(a, b, (want - travelled) / d);
          placed = true;
          break;
        }
        travelled += d;
        a = b;
        j++;
      }
      if (!placed) s.g.position.copy(a);
      s.g.lookAt(prev.position);
      prev = s.g;
    }
  }

  animate(dt) {
    if (dt <= 0) return;
    if (!this.shieldOn && this.awake && !this.dead) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) {
        this.shieldOn = true;
        const h = this.head.position;
        this.ctx.effects.ring(h.x, h.y, 0x9dffff, 160, 0.4, Math.max(2, h.z));
      }
    }
    this.band.emissive.set(this.shieldOn ? 0x7fe8ff : this.color);
    const t = this.target;
    let goal = this.goal;
    if (!goal) {
      if (!this.awake) {
        goal = new THREE.Vector3(Math.cos(this.time * 0.8) * 200, Math.sin(this.time * 0.8) * 200 + 60, 110);
      } else {
        const a = this.time * (this.enraged ? 1.1 : 0.8);
        goal = new THREE.Vector3(t.x + Math.cos(a) * 230, t.y + Math.sin(a) * 230, 60 + Math.sin(this.time * 1.7) * 35);
        this.clampToArena(goal, 40);
      }
    }
    const speed = this.def.speed * this.speedMul * (this.enraged ? 1.25 : 1);
    const desired = goal.clone().sub(this.head.position);
    if (desired.lengthSq() > 1) desired.setLength(speed);
    this.vel.lerp(desired, Math.min(1, dt * this.turn));
    if (this.vel.lengthSq() < 1) this.vel.set(1, 0, 0);
    this.vel.setLength(speed);
    this.head.position.addScaledVector(this.vel, dt);
    this.head.lookAt(this.head.position.clone().add(this.vel));
    if (this.history[0].distanceTo(this.head.position) > 3) {
      this.history.unshift(this.head.position.clone());
      if (this.history.length > 700) this.history.pop();
    }
    this.layout();
    if (Math.random() < dt * 30) {
      const s = this.segs[Math.floor(Math.random() * this.segs.length)].g.position;
      if (s.z > -20) this.ctx.effects.spark(s.x, s.y, s.z, this.color, 3, 0.5, 3, 30);
    }
  }

  hitCircles() {
    const out = [{ x: this.head.position.x, y: this.head.position.y, z: this.head.position.z, r: 40 }];
    for (const s of this.segs) {
      if (s.g.position.z > -30) out.push({ x: s.g.position.x, y: s.g.position.y, z: s.g.position.z, r: s.r });
    }
    return out;
  }

  deathPoints() {
    return [this.head.position.clone(), ...this.segs.filter((_, i) => i % 3 === 0).map((s) => s.g.position.clone())];
  }

  *barrage() {
    for (let i = 0; i < this.segs.length; i += 2) {
      const p = this.segs[i].g.position;
      const prev = i === 0 ? this.head.position : this.segs[i - 1].g.position;
      if (p.z > -20) {
        const along = Math.atan2(prev.y - p.y, prev.x - p.x);
        for (const side of [-1, 1]) {
          this.ctx.world.enemyShot(p.x, p.y, along + (side * Math.PI) / 2, this.enraged ? 240 : 200, { color: this.color, size: 8, z: Math.max(14, Math.min(p.z, 60)) });
        }
        this.ctx.effects.burst(p.x, p.y, p.z, this.color, 3, 120, 3);
      }
      yield 0.05;
    }
    yield 0.4;
  }

  *dive() {
    const reps = this.enraged ? 3 : 2;
    const R = this.ctx.arena.radius;
    const { world, effects } = this.ctx;
    for (let r = 0; r < reps; r++) {
      const edge = Math.atan2(this.head.position.y, this.head.position.x);
      this.goal = new THREE.Vector3(Math.cos(edge) * (R + 240), Math.sin(edge) * (R + 240), -420);
      this.speedMul = 1.6;
      this.turn = 3.2;
      let guard = 0;
      while (this.head.position.z > -200 && guard < 4) {
        yield 0;
        guard += this.dt;
      }
      const tx = this.target.x;
      const ty = this.target.y;
      world.telegraph(tx, ty, 85, 1.1, this.color);
      this.goal = new THREE.Vector3(tx, ty, -450);
      yield 0.85;
      this.head.position.set(tx, ty, -230);
      this.vel.set(0, 0, 1);
      this.goal = new THREE.Vector3(tx, ty, 440);
      this.speedMul = 2.4;
      this.turn = 0.6;
      guard = 0;
      while (this.head.position.z < 0 && guard < 2) {
        yield 0;
        guard += this.dt;
      }
      world.hurtArea(tx, ty, 85);
      world.smash(tx, ty, 90);
      world.shockwave(tx, ty, this.color, 300, 700);
      effects.burst(tx, ty, 5, this.color, 30, 380, 6);
      effects.burst(tx, ty, 5, 0x2a2132, 16, 300, 9, 0.8);
      effects.ring(tx, ty, 0xffffff, 150, 0.3);
      effects.addShake(32);
      if (this.enraged) {
        for (let j = 0; j < 14; j++) world.enemyShot(tx, ty, (j / 14) * Math.PI * 2, 220, { color: this.color, size: 8 });
      }
      yield 0.55;
      this.turn = 2.6;
      this.goal = null;
      this.speedMul = 1;
      yield 0.6;
    }
  }

  *breath() {
    this.speedMul = 0.35;
    yield 0.4;
    let acc = 0;
    yield* this.frames(this.enraged ? 2.6 : 2.0, (k, dt) => {
      acc += dt;
      while (acc > 0.045) {
        acc -= 0.045;
        const h = this.head.position;
        const a = this.aim(h) + Math.sin(this.time * 5) * 0.55;
        this.ctx.world.enemyShot(h.x + Math.cos(a) * 40, h.y + Math.sin(a) * 40, a, 430, { color: 0xff6ad5, size: 7, z: Math.max(14, Math.min(h.z, 40)) });
      }
    });
    this.speedMul = 1;
  }

  *orbs() {
    const n = this.enraged ? 8 : 6;
    const h = this.head.position;
    for (let j = 0; j < n; j++) {
      this.ctx.world.enemyShot(h.x, h.y, (j / n) * Math.PI * 2, 140, { color: 0xc04bff, size: 11, homing: 1.8, life: 6, z: 24 });
    }
    this.ctx.effects.ring(h.x, h.y, 0xc04bff, 140, 0.4, Math.max(2, h.z));
    yield 0.6;
  }
}
