import * as THREE from 'three';
import { TONGUE_RANGE, TONGUE_SPEED, TONGUE_RETRACT, TONGUE_DAMAGE, TONGUE_ENEMY_DAMAGE, ZIP_SPEED } from './Constants.js';

const UP = new THREE.Vector3(0, 1, 0);

export class Tongue {
  constructor(scene, player, world, arena, effects, hooks) {
    this.player = player;
    this.world = world;
    this.arena = arena;
    this.effects = effects;
    this.hooks = hooks;
    this.mat = new THREE.MeshStandardMaterial({ color: 0xff6f9c, emissive: 0xff2a6a, emissiveIntensity: 0.6, roughness: 0.35 });
    this.rope = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true), this.mat);
    this.tip = new THREE.Mesh(new THREE.SphereGeometry(6, 14, 10), this.mat);
    this.rope.visible = false;
    this.tip.visible = false;
    this.rope.castShadow = true;
    scene.add(this.rope, this.tip);
    this.state = 'idle';
    this.len = 0;
    this.dir = new THREE.Vector2(1, 0);
    this.carry = null;
    this.pillar = null;
    this.zipT = 0;
    this.zipTotal = 1;
  }

  get busy() {
    return this.state !== 'idle';
  }

  get zipping() {
    return this.state === 'zip';
  }

  mouth() {
    const p = this.player.position;
    const f = this.hooks.face();
    return new THREE.Vector3(p.x + Math.cos(f) * 14, p.y + Math.sin(f) * 14, p.z + 14);
  }

  fire(angle) {
    if (this.state !== 'idle') return false;
    this.state = 'out';
    this.len = 0;
    this.dir.set(Math.cos(angle), Math.sin(angle));
    return true;
  }

  release(fling) {
    if (this.state !== 'zip') return;
    this.state = 'back';
    this.len = Math.min(this.len, 80);
    const pillar = this.pillar;
    this.pillar = null;
    this.hooks.zipEnd(fling ? this.dir.clone() : null, pillar);
  }

  reset() {
    if (this.carry) {
      this.world.removeRubble(this.carry);
      this.carry = null;
    }
    this.state = 'idle';
    this.pillar = null;
    this.len = 0;
    this.rope.visible = false;
    this.tip.visible = false;
  }

  findHit(origin, maxLen) {
    let best = null;
    const dx = this.dir.x;
    const dy = this.dir.y;
    const consider = (x, y, r, assist, kind, ref, z) => {
      const fx = x - origin.x;
      const fy = y - origin.y;
      const along = fx * dx + fy * dy;
      if (along < -(r + assist)) return;
      const perp = Math.abs(-fx * dy + fy * dx);
      const rr = r + assist;
      if (perp > rr) return;
      const entry = Math.max(0, along - Math.sqrt(rr * rr - perp * perp));
      if (entry > maxLen) return;
      if (!best || entry < best.t) best = { t: entry, kind, ref, x, y, z };
    };
    for (const e of this.world.enemies) {
      if (!e.dead) consider(e.obj.position.x, e.obj.position.y, e.r, 10, 'enemy', e, e.hover ?? 14);
    }
    const boss = this.hooks.boss();
    if (boss && boss.awake && !boss.dead) {
      for (const c of boss.hitCircles()) consider(c.x, c.y, c.r, 8, 'boss', boss, c.z);
    }
    if (!this.hooks.holding()) {
      for (const r of this.world.rubble) {
        if (r.state === 'ground') consider(r.x, r.y, r.r, 14, 'rubble', r, r.z);
      }
    }
    for (const p of this.arena.pillars) {
      if (this.arena.isSolid(p)) consider(p.x, p.y, p.r, 2, 'pillar', p, 90);
    }
    return best;
  }

  onHit(hit) {
    const fx = this.effects;
    if (hit.kind === 'enemy') {
      this.world.damageEnemy(hit.ref, TONGUE_ENEMY_DAMAGE);
      this.hooks.enemyHit(hit.ref, 'tongue');
      fx.burst(hit.x, hit.y, 20, 0xff6f9c, 6, 160, 3);
      fx.addShake(4);
      this.state = 'back';
    } else if (hit.kind === 'boss') {
      const res = hit.ref.damage(TONGUE_DAMAGE, 'tongue');
      this.hooks.bossHit(res, TONGUE_DAMAGE, hit.x, hit.y, Math.max(20, Math.min(hit.z, 90)), 'tongue');
      fx.burst(hit.x, hit.y, 30, res === 'blocked' ? 0xbff6ff : 0xff6f9c, 8, 200, 3);
      fx.addShake(res === 'blocked' ? 3 : 6);
      this.state = 'back';
    } else if (hit.kind === 'rubble') {
      hit.ref.state = 'pulled';
      hit.ref.ring.visible = false;
      this.carry = hit.ref;
      fx.burst(hit.x, hit.y, 12, 0x5dff9e, 6, 120, 3);
      this.state = 'back';
    } else if (hit.kind === 'pillar') {
      this.state = 'zip';
      this.pillar = hit.ref;
      this.zipT = 0;
      const p = this.player.position;
      const stop = hit.ref.r + this.player.userData.radius + 6;
      this.zipTotal = Math.max(0.15, (Math.hypot(hit.ref.x - p.x, hit.ref.y - p.y) - stop) / ZIP_SPEED);
      fx.ring(hit.ref.x, hit.ref.y, 0x5dff9e, 70, 0.3, 90);
      this.hooks.latched(hit.ref);
    }
  }

  update(dt) {
    if (this.state === 'idle') {
      this.rope.visible = false;
      this.tip.visible = false;
      return;
    }
    const m = this.mouth();
    let tipZ = m.z;
    if (this.state === 'out') {
      const next = Math.min(this.len + TONGUE_SPEED * dt, TONGUE_RANGE);
      const hit = this.findHit(m, next);
      if (hit) {
        this.len = hit.t;
        this.onHit(hit);
      } else {
        this.len = next;
        if (next >= TONGUE_RANGE) this.state = 'back';
      }
    } else if (this.state === 'back') {
      this.len -= TONGUE_RETRACT * dt;
      if (this.len <= 0) {
        this.len = 0;
        this.state = 'idle';
        if (this.carry) {
          const r = this.carry;
          this.carry = null;
          this.hooks.grabbed(r);
        }
      }
    } else if (this.state === 'zip') {
      const p = this.player.position;
      const pl = this.pillar;
      const tx = pl.x - p.x;
      const ty = pl.y - p.y;
      const d = Math.hypot(tx, ty);
      const stop = pl.r + this.player.userData.radius + 6;
      this.zipT += dt;
      if (!this.arena.isSolid(pl) || d <= stop + 1 || this.zipT > this.zipTotal + 0.3) {
        this.release(this.arena.isSolid(pl));
      } else {
        this.dir.set(tx / d, ty / d);
        const step = Math.min(ZIP_SPEED * dt, d - stop);
        p.x += this.dir.x * step;
        p.y += this.dir.y * step;
        p.z = Math.sin(Math.min(1, this.zipT / this.zipTotal) * Math.PI) * 34;
        this.len = d - step - pl.r * 0.5;
        tipZ = 90;
        if (Math.random() < 0.7) this.effects.spark(p.x, p.y, p.z + 10, 0x9dffc0, 4, 0.3, 2, 0);
      }
    }
    if (this.state === 'idle') {
      this.rope.visible = false;
      this.tip.visible = false;
      return;
    }
    const tip = new THREE.Vector3(m.x + this.dir.x * this.len, m.y + this.dir.y * this.len, tipZ);
    if (this.carry) this.carry.mesh.position.copy(tip);
    const span = tip.clone().sub(m);
    const length = span.length();
    this.tip.visible = true;
    this.tip.position.copy(tip);
    if (length < 1) {
      this.rope.visible = false;
      return;
    }
    this.rope.visible = true;
    this.rope.position.copy(m).add(tip).multiplyScalar(0.5);
    this.rope.quaternion.setFromUnitVectors(UP, span.normalize());
    this.rope.scale.set(2.6, length, 2.6);
  }
}
