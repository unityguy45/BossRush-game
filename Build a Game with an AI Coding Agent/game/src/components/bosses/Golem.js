import * as THREE from 'three';
import { Boss, lerpAngle, ease } from './Boss.js';
import { rockGeometry } from '../Arena.js';

export class Golem extends Boss {
  constructor(ctx, def) {
    super(ctx, def);
    this.radius = 72;
    this.heat = def.color;
    this.group.position.set(0, 230, 0);
    this.rock = new THREE.MeshStandardMaterial({ color: 0x2b1f24, roughness: 0.95, flatShading: true });
    this.lava = this.glow(new THREE.MeshStandardMaterial({ color: 0x1a0500, emissive: def.color, emissiveIntensity: 3.2, roughness: 0.6 }));
    this.lavaEntry = this.mats[0];

    this.body = new THREE.Group();
    this.body.position.z = 80;
    this.group.add(this.body);
    this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(40, 1), this.lava);
    this.body.add(this.core);

    const n = 16;
    for (let i = 0; i < n; i++) {
      const y = 1 - ((i + 0.5) / n) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = i * 2.399963;
      const dir = new THREE.Vector3(Math.cos(th) * r, Math.sin(th) * r, y);
      const chunk = new THREE.Mesh(rockGeometry(20 + Math.random() * 12, 0, 0.3), this.rock);
      chunk.position.copy(dir).multiplyScalar(46);
      chunk.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      chunk.castShadow = true;
      this.body.add(chunk);
    }

    this.head = new THREE.Group();
    this.head.position.set(12, 0, 64);
    this.body.add(this.head);
    const skull = new THREE.Mesh(rockGeometry(26, 0, 0.25), this.rock);
    skull.castShadow = true;
    this.head.add(skull);
    this.eyeMat = this.glow(new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffe066, emissiveIntensity: 6 }));
    for (const s of [-10, 10]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(4.5, 12, 8), this.eyeMat);
      eye.position.set(23, s, 4);
      this.head.add(eye);
    }
    for (const s of [-1, 1]) {
      const sh = new THREE.Mesh(rockGeometry(30, 0, 0.3), this.rock);
      sh.position.set(0, s * 64, 36);
      sh.castShadow = true;
      this.body.add(sh);
    }

    this.orbiters = [];
    for (let i = 0; i < 6; i++) {
      const o = new THREE.Mesh(rockGeometry(7 + Math.random() * 5, 0, 0.3), i % 2 ? this.rock : this.lava);
      this.body.add(o);
      this.orbiters.push({ mesh: o, phase: (i / 6) * Math.PI * 2, tilt: Math.random() * 0.8 });
    }

    this.fists = [-1, 1].map((side) => {
      const mesh = new THREE.Group();
      const knuckle = new THREE.Mesh(new THREE.IcosahedronGeometry(17, 0), this.lava);
      mesh.add(knuckle);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const c = new THREE.Mesh(rockGeometry(13 + Math.random() * 5, 0, 0.3), this.rock);
        c.position.set(Math.cos(a) * 19, Math.sin(a) * 19, (i % 2 ? 1 : -1) * 8);
        c.castShadow = true;
        mesh.add(c);
      }
      mesh.position.set(side * 95, 230, 70);
      this.group.parent.add(mesh);
      return { mesh, side, mode: 'home' };
    });

    this.jumpZ = 0;
    this.moving = true;
    this.flare = 0;
    this.face = -Math.PI / 2;
  }

  onEnrage() {
    this.heat = 0x4fd8ff;
    this.lava.emissive.set(this.heat);
    this.color = this.heat;
    this.ctx.effects.burst(this.pos.x, this.pos.y, 80, this.heat, 40, 400, 6);
  }

  animate(dt) {
    this.face = lerpAngle(this.face, this.aim(), dt * 3);
    this.body.rotation.z = this.face;
    this.body.position.z = 80 + Math.sin(this.time * 2) * 6 + this.jumpZ;
    this.core.rotation.x += dt;
    this.core.rotation.y += dt * 0.7;
    this.flare = Math.max(0, this.flare - dt);
    this.lavaEntry.base = 3.2 + this.flare * 5;

    if (this.moving && this.awake && !this.dead) this.moveToward(this.target.x, this.target.y, this.def.speed * (this.enraged ? 1.4 : 1), dt, 170);

    for (const o of this.orbiters) {
      o.phase += dt * 1.4;
      o.mesh.position.set(Math.cos(o.phase) * 92, Math.sin(o.phase) * 92, Math.sin(o.phase + o.tilt) * 30);
      o.mesh.rotation.x += dt * 2;
    }

    const a = this.face;
    for (const f of this.fists) {
      if (f.mode === 'home') {
        const hx = this.pos.x + Math.cos(a) * 30 - Math.sin(a) * 100 * f.side;
        const hy = this.pos.y + Math.sin(a) * 30 + Math.cos(a) * 100 * f.side;
        const hz = 70 + this.jumpZ + Math.sin(this.time * 2 + f.side) * 8;
        f.mesh.position.lerp(new THREE.Vector3(hx, hy, hz), Math.min(1, dt * 7));
      }
      f.mesh.rotation.z += dt * 0.8;
      f.mesh.rotation.x += dt * 0.4;
    }

    if (Math.random() < dt * 25) {
      const b = this.body.position;
      this.ctx.effects.spark(this.pos.x + (Math.random() - 0.5) * 80, this.pos.y + (Math.random() - 0.5) * 80, b.z + (Math.random() - 0.5) * 60, this.heat, 3, 0.8, 3, 70);
    }
  }

  hitCircles() {
    const out = [{ x: this.pos.x, y: this.pos.y, z: this.body.position.z, r: 72 }];
    for (const f of this.fists) out.push({ x: f.mesh.position.x, y: f.mesh.position.y, z: f.mesh.position.z, r: 34 });
    return out;
  }

  deathPoints() {
    return [this.pos.clone().setZ(this.body.position.z), ...this.fists.map((f) => f.mesh.position.clone())];
  }

  dispose() {
    super.dispose();
    this.fists.forEach((f) => this.ctx.scene.remove(f.mesh));
  }

  impact(x, y, r) {
    const { world, effects } = this.ctx;
    world.hurtArea(x, y, r);
    world.smash(x, y, r);
    world.shockwave(x, y, this.heat, 330, 750);
    effects.burst(x, y, 8, this.heat, 30, 360, 6);
    effects.burst(x, y, 8, 0x3a2a2a, 14, 300, 8, 0.8);
    effects.ring(x, y, 0xffffff, r * 1.6, 0.25);
    effects.addShake(26);
    if (this.enraged) {
      for (let j = 0; j < 12; j++) world.enemyShot(x, y, (j / 12) * Math.PI * 2, 230, { color: this.heat, size: 8 });
    }
  }

  *slam() {
    const reps = this.enraged ? 3 : 1;
    for (let i = 0; i < reps; i++) {
      const f = this.fists[(this.actionIndex + i) % 2];
      f.mode = 'free';
      const tx = this.target.x;
      const ty = this.target.y;
      const time = this.enraged ? 0.75 : 0.95;
      this.ctx.world.telegraph(tx, ty, 95, time + 0.12, this.heat);
      const start = f.mesh.position.clone();
      const up = new THREE.Vector3(tx, ty, 280);
      yield* this.frames(time, (k) => f.mesh.position.lerpVectors(start, up, ease(k)));
      yield* this.frames(0.12, (k) => {
        f.mesh.position.z = 280 - 255 * k * k;
      });
      this.impact(tx, ty, 95);
      yield 0.3;
      f.mode = 'home';
      yield 0.15;
    }
  }

  *meteors() {
    this.moving = false;
    this.flare = 1.2;
    this.ctx.effects.ring(this.pos.x, this.pos.y, this.heat, 220, 0.5);
    yield 0.6;
    const n = this.enraged ? 16 : 10;
    const R = this.ctx.arena.radius - 50;
    for (let i = 0; i < n; i++) {
      let x;
      let y;
      if (i % 3 === 0) {
        x = this.target.x + (Math.random() - 0.5) * 80;
        y = this.target.y + (Math.random() - 0.5) * 80;
      } else {
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * R;
        x = Math.cos(a) * d;
        y = Math.sin(a) * d;
      }
      this.ctx.world.meteor(x, y, 70, 1.25, this.heat, this.enraged);
      yield 0.11;
    }
    this.moving = true;
    yield 1.0;
  }

  *magmaBurst() {
    this.moving = false;
    this.flare = 1;
    yield 0.45;
    const waves = this.enraged ? 5 : 3;
    for (let w = 0; w < waves; w++) {
      const n = this.enraged ? 22 : 18;
      const off = w * 0.17;
      for (let j = 0; j < n; j++) {
        this.ctx.world.enemyShot(this.pos.x, this.pos.y, off + (j / n) * Math.PI * 2, 210, { color: this.heat, size: 9, z: 30 });
      }
      this.ctx.effects.ring(this.pos.x, this.pos.y, this.heat, 140, 0.3, 30);
      this.ctx.effects.addShake(6);
      this.flare = 0.6;
      yield 0.38;
    }
    this.moving = true;
  }

  *quake() {
    this.moving = false;
    const reps = this.enraged ? 2 : 1;
    for (let i = 0; i < reps; i++) {
      const sx = this.pos.x;
      const sy = this.pos.y;
      const tgt = new THREE.Vector3(this.target.x, this.target.y, 0);
      this.clampToArena(tgt, 80);
      const time = 1.0;
      this.ctx.world.telegraph(tgt.x, tgt.y, 120, time, this.heat);
      yield* this.frames(time, (k) => {
        this.pos.x = sx + (tgt.x - sx) * k;
        this.pos.y = sy + (tgt.y - sy) * k;
        this.jumpZ = Math.sin(k * Math.PI) * 260;
      });
      this.jumpZ = 0;
      this.impact(tgt.x, tgt.y, 120);
      this.ctx.world.after(0.25, () => this.ctx.world.shockwave(tgt.x, tgt.y, this.heat, 220, 600));
      this.ctx.effects.addShake(34);
      yield 0.5;
    }
    this.moving = true;
  }
}
