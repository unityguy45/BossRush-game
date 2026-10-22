import * as THREE from 'three';
import { Boss, lerpAngle } from './Boss.js';
import { glowMat } from '../Effects.js';

const BEAM_Z = 28;

export class Eye extends Boss {
  constructor(ctx, def) {
    super(ctx, def);
    this.radius = 58;
    this.hover = 95;
    this.moving = true;
    this.lookPoint = null;
    this.group.position.set(0, 230, 0);

    this.float = new THREE.Group();
    this.float.position.z = this.hover;
    this.group.add(this.float);

    this.ballMat = this.glow(new THREE.MeshStandardMaterial({ color: 0xc9c0dc, roughness: 0.3, metalness: 0.05, emissive: 0x5a2a99, emissiveIntensity: 0.35 }));
    const ball = new THREE.Mesh(new THREE.SphereGeometry(52, 48, 32), this.ballMat);
    ball.castShadow = true;
    this.float.add(ball);

    const veinMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3060).multiplyScalar(1.4) });
    for (let i = 0; i < 7; i++) {
      const vein = new THREE.Mesh(new THREE.TorusGeometry(52.3, 0.6, 4, 40, 0.6 + Math.random() * 0.7), veinMat);
      vein.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      this.float.add(vein);
    }

    this.look = new THREE.Group();
    this.float.add(this.look);
    this.irisMat = this.glow(new THREE.MeshStandardMaterial({ color: 0x110022, emissive: def.color, emissiveIntensity: 3.5 }));
    const iris = new THREE.Mesh(new THREE.SphereGeometry(52.6, 40, 12, 0, Math.PI * 2, 0, 0.5), this.irisMat);
    iris.rotation.x = Math.PI / 2;
    this.look.add(iris);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(53.2, 32, 8, 0, Math.PI * 2, 0, 0.2), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    pupil.rotation.x = Math.PI / 2;
    this.look.add(pupil);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(4, 10, 8), glowMat(0xffffff, 3));
    glint.position.set(12, 14, 50);
    this.look.add(glint);

    this.ringMat = this.glow(new THREE.MeshStandardMaterial({ color: 0x000000, emissive: def.color, emissiveIntensity: 2.5 }));
    this.rings = [new THREE.Mesh(new THREE.TorusGeometry(82, 2.2, 8, 120), this.ringMat), new THREE.Mesh(new THREE.TorusGeometry(98, 1.4, 8, 120), this.ringMat)];
    this.rings[0].rotation.x = 1.2;
    this.rings[1].rotation.y = 1.0;
    this.rings.forEach((r) => this.float.add(r));

    this.shardMat = this.glow(new THREE.MeshStandardMaterial({ color: 0x0a1a22, emissive: 0x5ff2ff, emissiveIntensity: 3, flatShading: true }));
    this.crystals = [];
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(11, 0), this.shardMat);
      mesh.scale.z = 2.2;
      mesh.castShadow = true;
      this.float.add(mesh);
      this.crystals.push({ mesh, alive: true, regrow: 0, phase: (i / 8) * Math.PI * 2 });
    }

    const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true);
    this.beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(def.color).multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.beamCoreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffffff).multiplyScalar(2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.makeShield(84, 0x5ff2ff);
    this.wardRespawn = 0;
    this.prevShield = false;
    this.beams = [0, 1].map(() => {
      const outer = new THREE.Mesh(beamGeo, this.beamMat);
      const inner = new THREE.Mesh(beamGeo, this.beamCoreMat);
      outer.visible = inner.visible = false;
      ctx.scene.add(outer, inner);
      return { outer, inner };
    });
  }

  get shielded() {
    return this.ctx.world.aliveOf(this, 'ward').length > 0;
  }

  shieldCenter() {
    return new THREE.Vector3(this.pos.x, this.pos.y, this.float.position.z);
  }

  shieldHint() {
    const n = this.ctx.world.aliveOf(this, 'ward').length;
    if (n > 0) return `SHIELDED · destroy the ${n} glowing ward${n === 1 ? '' : 's'}`;
    return `EXPOSED · shield returns in ${Math.ceil(Math.max(0, this.wardRespawn))}s`;
  }

  onAwake() {
    this.spawnWards();
  }

  spawnWards() {
    const n = this.enraged ? 4 : 3;
    const off = Math.random() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2;
      this.ctx.world.spawnWard(this, Math.cos(a) * 200, Math.sin(a) * 200, 0x5ff2ff);
    }
    this.wardRespawn = 99;
  }

  onEnrage() {
    this.color = 0xff2a4a;
    this.irisMat.emissive.set(this.color);
    this.ringMat.emissive.set(this.color);
    this.beamMat.color.set(this.color).multiplyScalar(2.2);
    this.ctx.effects.burst(this.pos.x, this.pos.y, this.float.position.z, this.color, 40, 420, 6);
  }

  animate(dt) {
    if (this.awake && !this.dead) {
      const sh = this.shielded;
      if (this.prevShield && !sh) {
        this.wardRespawn = this.enraged ? 7 : 9;
        this.ctx.onShieldDown(this);
      }
      if (!sh) {
        this.wardRespawn -= dt;
        if (this.wardRespawn <= 0) this.spawnWards();
      }
      this.prevShield = sh;
    }
    this.float.position.z = this.hover + Math.sin(this.time * 1.6) * 8;
    const t = this.target;
    this.look.lookAt(this.lookPoint ?? new THREE.Vector3(t.x, t.y, t.z + 12));
    const spin = this.enraged ? 2.4 : 0.9;
    this.rings[0].rotation.z += dt * spin;
    this.rings[1].rotation.x += dt * spin * 0.7;
    for (const s of this.crystals) {
      s.phase += dt * (this.enraged ? 1.7 : 1);
      if (s.alive) {
        s.mesh.visible = true;
        s.mesh.position.set(Math.cos(s.phase) * 128, Math.sin(s.phase) * 128, Math.sin(s.phase * 2) * 22);
        s.mesh.rotation.z += dt * 3;
        s.mesh.scale.x = s.mesh.scale.y = Math.min(1, s.mesh.scale.x + dt * 3);
      } else {
        s.mesh.visible = false;
        s.regrow -= dt;
        if (s.regrow <= 0) {
          s.alive = true;
          s.mesh.scale.x = s.mesh.scale.y = 0.05;
        }
      }
    }
    if (this.moving && this.awake && !this.dead) {
      const a = this.time * 0.45;
      const goal = new THREE.Vector3(t.x + Math.cos(a) * 270, t.y + Math.sin(a) * 270, 0);
      this.clampToArena(goal, 80);
      this.moveToward(goal.x, goal.y, this.def.speed, dt);
    }
  }

  hitCircles() {
    return [{ x: this.pos.x, y: this.pos.y, z: this.float.position.z, r: this.radius * Math.max(this.float.scale.x, 0.2) }];
  }

  deathPoints() {
    return [this.pos.clone().setZ(this.float.position.z)];
  }

  dispose() {
    super.dispose();
    this.beams.forEach((b) => this.ctx.scene.remove(b.outer, b.inner));
  }

  hideBeams() {
    this.beams.forEach((b) => {
      b.outer.visible = b.inner.visible = false;
    });
    this.lookPoint = null;
  }

  drawBeams(angle, count, width, opacity, live) {
    const t = this.target;
    const pr = this.ctx.player.userData.radius;
    this.beamMat.opacity = opacity;
    this.beamCoreMat.opacity = opacity;
    for (let i = 0; i < 2; i++) {
      const b = this.beams[i];
      if (i >= count) {
        b.outer.visible = b.inner.visible = false;
        continue;
      }
      const a = angle + i * Math.PI;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const sx = this.pos.x + ca * 40;
      const sy = this.pos.y + sa * 40;
      const R = this.ctx.arena.radius + 30;
      const b0 = sx * ca + sy * sa;
      const edge = -b0 + Math.sqrt(Math.max(0, b0 * b0 - (sx * sx + sy * sy - R * R)));
      const ray = this.ctx.arena.rayHit(sx, sy, a, Math.max(40, edge));
      const len = ray.t;
      if (live && ray.pillar) {
        ray.pillar.heat += this.dt;
        if (ray.pillar.heat > 1.3) this.ctx.crumblePillar(ray.pillar, 0.4);
      }
      for (const [mesh, w] of [[b.outer, width], [b.inner, width * 0.35]]) {
        mesh.visible = true;
        mesh.position.set(sx + (ca * len) / 2, sy + (sa * len) / 2, BEAM_Z);
        mesh.rotation.set(0, 0, a - Math.PI / 2);
        mesh.scale.set(w, len, w);
      }
      if (i === 0) this.lookPoint = new THREE.Vector3(sx + ca * 100, sy + sa * 100, BEAM_Z);
      if (live) {
        if (Math.random() < 0.8) this.ctx.effects.burst(sx + ca * len, sy + sa * len, BEAM_Z, this.color, 1, 220, 3);
        const px = t.x - sx;
        const py = t.y - sy;
        const along = px * ca + py * sa;
        const perp = Math.abs(-px * sa + py * ca);
        if (along > 0 && along < len && perp < width * 0.5 + pr * 0.6) this.ctx.hurt();
      }
    }
  }

  *laser() {
    this.moving = false;
    const count = this.enraged ? 2 : 1;
    let ang = this.aim();
    yield* this.frames(0.45, (k) => {
      this.hover = 95 - 35 * k;
    });
    yield* this.frames(1.0, (k, dt) => {
      ang = lerpAngle(ang, this.aim(), dt * 4);
      this.drawBeams(ang, count, 2 + k * 3, 0.4, false);
      if (Math.random() < 0.6) {
        const a = Math.random() * Math.PI * 2;
        this.ctx.effects.spark(this.pos.x + Math.cos(a) * 70, this.pos.y + Math.sin(a) * 70, this.float.position.z, this.color, 3, 0.25);
      }
    });
    const dir = Math.random() < 0.5 ? -1 : 1;
    const sweep = this.enraged ? 2.2 : 1.5;
    const dur = this.enraged ? 2.6 : 2.2;
    this.ctx.effects.addShake(12);
    yield* this.frames(dur, (k) => {
      this.drawBeams(ang + dir * sweep * (k - 0.15), count, 20 + Math.sin(this.time * 60) * 3, 0.85, true);
      this.ctx.effects.addShake(4);
    });
    this.hideBeams();
    yield* this.frames(0.45, (k) => {
      this.hover = 60 + 35 * k;
    });
    this.moving = true;
  }

  *shards() {
    const gap = this.enraged ? 0.07 : 0.13;
    for (const s of this.crystals) {
      if (!s.alive) continue;
      const wp = new THREE.Vector3();
      s.mesh.getWorldPosition(wp);
      s.alive = false;
      s.regrow = 3;
      this.ctx.world.enemyShot(wp.x, wp.y, this.aim(wp), this.enraged ? 420 : 360, { color: 0x5ff2ff, size: 10, z: 22 });
      this.ctx.effects.burst(wp.x, wp.y, wp.z, 0x5ff2ff, 5, 120, 3);
      yield gap;
    }
    yield 0.4;
  }

  *spiral() {
    this.moving = false;
    const arms = this.enraged ? 5 : 3;
    const spin = Math.random() < 0.5 ? 1 : -1;
    let a = Math.random() * 6.28;
    let acc = 0;
    yield* this.frames(this.enraged ? 3.4 : 2.8, (k, dt) => {
      acc += dt;
      while (acc >= 0.085) {
        acc -= 0.085;
        a += 0.23 * spin;
        for (let i = 0; i < arms; i++) {
          this.ctx.world.enemyShot(this.pos.x, this.pos.y, a + (i / arms) * Math.PI * 2, 175, { color: this.color, size: 7, curve: 0.18 * spin, z: 30 });
        }
      }
      this.float.rotation.z += dt * 4 * spin;
    });
    this.moving = true;
  }

  *blink() {
    yield* this.frames(0.22, (k) => this.float.scale.setScalar(Math.max(0.01, 1 - k)));
    this.ctx.effects.burst(this.pos.x, this.pos.y, this.float.position.z, this.color, 18, 260, 4);
    const a = Math.random() * Math.PI * 2;
    this.pos.x = this.target.x + Math.cos(a) * 260;
    this.pos.y = this.target.y + Math.sin(a) * 260;
    this.clampToArena(this.pos, 80);
    this.ctx.effects.ring(this.pos.x, this.pos.y, this.color, 160, 0.4);
    yield* this.frames(0.22, (k) => this.float.scale.setScalar(Math.max(0.01, k)));
    const n = this.enraged ? 24 : 16;
    for (let j = 0; j < n; j++) this.ctx.world.enemyShot(this.pos.x, this.pos.y, (j / n) * Math.PI * 2, 230, { color: 0x5ff2ff, size: 8, z: 30 });
    yield 0.3;
  }

  *storm() {
    const n = this.enraged ? 7 : 4;
    for (let i = 0; i < n; i++) {
      const x = this.target.x;
      const y = this.target.y;
      this.ctx.world.telegraph(x, y, 62, 0.75, 0xb9a3ff, () => {
        this.ctx.effects.bolt(x, y, 0xc8b8ff);
        this.ctx.effects.burst(x, y, 4, 0xc8b8ff, 16, 260, 4);
        this.ctx.effects.ring(x, y, 0xffffff, 110, 0.25);
        this.ctx.effects.addShake(12);
        this.ctx.world.hurtArea(x, y, 62);
      });
      yield 0.32;
    }
    yield 0.8;
  }
}
