import * as THREE from 'three';
import { glowMat, fadeMat } from './Effects.js';
import { loadModel, prepareModel, castShadows } from './Loader.js';
import { MINION_SCALE, MINION_SPEED, MINION_HP, GUARD_HP, WARD_HP, RUBBLE_DAMAGE, RUBBLE_SPEED, RUBBLE_RANGE, RUBBLE_MAX } from './Constants.js';
import { rockGeometry } from './Arena.js';

const ballGeo = new THREE.SphereGeometry(1, 16, 12);
const ringGeo = new THREE.RingGeometry(0.94, 1, 96);
const discGeo = new THREE.CircleGeometry(1, 64);
const planeGeo = new THREE.PlaneGeometry(1, 1);
const rockGeo = new THREE.IcosahedronGeometry(1, 0);
const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x4a3f57, roughness: 0.9, flatShading: true });
const wardStone = new THREE.MeshStandardMaterial({ color: 0x2c2638, roughness: 0.8, flatShading: true });
const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
const UP = new THREE.Vector3(0, 1, 0);
const wallGeo = new THREE.CylinderGeometry(1, 1, 1, 96, 1, true);
wallGeo.rotateX(Math.PI / 2);
wallGeo.translate(0, 0, 0.5);

function removeMesh(scene, mesh, disposeMaterial = false) {
  scene.remove(mesh);
  if (disposeMaterial) {
    mesh.traverse((o) => {
      if (o.material) o.material.dispose();
    });
  }
}

export class World {
  constructor(scene, effects, arena, player, hooks) {
    this.scene = scene;
    this.effects = effects;
    this.arena = arena;
    this.player = player;
    this.hooks = hooks;
    this.enemyShots = [];
    this.waves = [];
    this.teles = [];
    this.zones = [];
    this.lobs = [];
    this.enemies = [];
    this.rubble = [];
    this.timers = [];
  }

  enemyShot(x, y, angle, speed, o = {}) {
    const size = o.size ?? 8;
    const color = o.color ?? 0xff4060;
    const mesh = new THREE.Mesh(ballGeo, glowMat(color, o.boost ?? 2.4));
    mesh.scale.setScalar(size);
    mesh.position.set(x, y, o.z ?? 18);
    this.scene.add(mesh);
    this.enemyShots.push({ mesh, angle, speed, size, color, homing: o.homing ?? 0, curve: o.curve ?? 0, accel: o.accel ?? 0, life: o.life ?? 7 });
  }

  shockwave(x, y, color, speed = 300, maxR = 900) {
    const mesh = new THREE.Mesh(ringGeo, fadeMat(color, 2.4, 0.95));
    mesh.position.set(x, y, 2.5);
    const wall = new THREE.Mesh(wallGeo, fadeMat(color, 1.4, 0.5));
    wall.position.set(x, y, 0);
    this.scene.add(mesh, wall);
    this.waves.push({ mesh, wall, x, y, r: 10, speed, maxR });
  }

  telegraph(x, y, r, time, color = 0xff3344, onDone = null) {
    const group = new THREE.Group();
    group.position.set(x, y, 1.6);
    const ring = new THREE.Mesh(ringGeo, fadeMat(color, 2.5, 0.9));
    ring.scale.setScalar(r);
    const fill = new THREE.Mesh(discGeo, fadeMat(color, 1.2, 0.35));
    fill.scale.setScalar(0.01);
    group.add(ring, fill);
    this.scene.add(group);
    const tele = { group, ring, fill, r, time, t: 0, onDone };
    this.teles.push(tele);
    return tele;
  }

  lineTelegraph(x, y, angle, length, width, time, color) {
    const mesh = new THREE.Mesh(planeGeo, fadeMat(color, 1.6, 0.4));
    mesh.scale.set(length, width, 1);
    mesh.rotation.z = angle;
    mesh.position.set(x + (Math.cos(angle) * length) / 2, y + (Math.sin(angle) * length) / 2, 1.7);
    this.scene.add(mesh);
    this.teles.push({ group: mesh, line: true, time, t: 0, onDone: null });
  }

  lob(from, x, y, r, time, color, { arc = 0, size = 10, accel = false, onLand = null } = {}) {
    const mesh = new THREE.Mesh(rockGeo, glowMat(color, 2.5));
    mesh.scale.setScalar(size);
    mesh.position.copy(from);
    this.scene.add(mesh);
    this.lobs.push({ mesh, from: from.clone(), to: new THREE.Vector3(x, y, 4), time, t: 0, arc, accel, color });
    this.telegraph(x, y, r, time, color, onLand);
  }

  meteor(x, y, r, time, color, fire = false) {
    const from = new THREE.Vector3(x + 260, y + 160, 900);
    this.lob(from, x, y, r, time, color, {
      size: r * 0.4,
      accel: true,
      onLand: () => {
        this.effects.burst(x, y, 6, color, 22, 340, 6);
        this.effects.burst(x, y, 6, 0x4a3030, 10, 260, 7, 0.7);
        this.effects.ring(x, y, color, r * 1.8, 0.35);
        this.effects.addShake(12);
        this.hurtArea(x, y, r);
        this.smash(x, y, r * 0.7);
        if (fire) this.zone(x, y, r * 0.9, 3.5, 'fire', color);
      },
    });
  }

  zone(x, y, r, time, kind, color) {
    const mesh = new THREE.Mesh(discGeo, fadeMat(color, kind === 'fire' ? 2 : 1.1, 0.55));
    mesh.scale.setScalar(r);
    mesh.position.set(x, y, 1.2);
    this.scene.add(mesh);
    this.zones.push({ mesh, x, y, r, time, t: 0, kind, color });
  }

  hurtArea(x, y, r) {
    const p = this.player.position;
    if (Math.hypot(p.x - x, p.y - y) < r + this.player.userData.radius * 0.7) this.hooks.hurt();
  }

  after(t, fn) {
    this.timers.push({ t, fn });
  }

  slowed() {
    const p = this.player.position;
    return this.zones.some((z) => z.kind === 'honey' && p.z < 6 && Math.hypot(p.x - z.x, p.y - z.y) < z.r);
  }

  smash(x, y, r) {
    for (const p of this.arena.pillars) {
      if (this.arena.isSolid(p) && Math.hypot(p.x - x, p.y - y) < r + p.r) this.arena.collapse(p);
    }
  }

  addEnemy(e) {
    this.scene.add(e.obj);
    this.enemies.push(e);
    return e;
  }

  beeEnemy(x, y, scale, color, hp, kind, extra = {}) {
    const obj = new THREE.Group();
    obj.position.set(x, y, 0);
    const pivot = new THREE.Group();
    obj.add(pivot);
    const e = { obj, pivot, hp, maxHp: hp, r: scale * 2, kind, color, mats: [], flash: 0, bob: Math.random() * 6, dead: false, contact: true, hover: 14, ...extra };
    loadModel('/models/enemy.glb').then((model) => {
      e.r = prepareModel(model, scale) * 0.9;
      model.traverse((o) => {
        if (o.isMesh) {
          o.material = o.material.clone();
          o.material.emissive = new THREE.Color(color);
          o.material.emissiveIntensity = 0.4;
          e.mats.push(o.material);
        }
      });
      castShadows(model);
      pivot.add(model);
    });
    return this.addEnemy(e);
  }

  spawnMinion(x, y, color = 0xffb000) {
    if (this.enemies.filter((e) => e.kind === 'minion').length >= 12) return;
    this.beeEnemy(x, y, MINION_SCALE, color, MINION_HP, 'minion');
    this.effects.burst(x, y, 20, color, 10, 150, 3);
  }

  spawnGuard(owner, index, count) {
    const c = owner.pos;
    const phase = (index / count) * Math.PI * 2;
    const e = this.beeEnemy(c.x + Math.cos(phase) * 125, c.y + Math.sin(phase) * 125, 9, 0xff2a2a, GUARD_HP, 'guard', {
      owner,
      phase,
      diveTimer: 2.5 + Math.random() * 3,
      diving: 0,
      diveTarget: new THREE.Vector3(),
      hover: 22,
    });
    const halo = new THREE.Mesh(new THREE.TorusGeometry(15, 1.6, 6, 24), glowMat(0xffd040, 2));
    halo.position.z = 48;
    e.obj.add(halo);
    e.halo = halo;
    this.effects.burst(e.obj.position.x, e.obj.position.y, 20, 0xff4040, 14, 200, 4);
    return e;
  }

  spawnWard(owner, x, y, color) {
    const obj = new THREE.Group();
    obj.position.set(x, y, 0);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(15, 20, 22, 6).rotateX(Math.PI / 2).translate(0, 0, 11), wardStone);
    base.castShadow = true;
    obj.add(base);
    const crystalMat = new THREE.MeshStandardMaterial({ color: 0x06121a, emissive: color, emissiveIntensity: 2.2, flatShading: true });
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(15, 0), crystalMat);
    crystal.scale.z = 1.7;
    crystal.position.z = 58;
    crystal.castShadow = true;
    obj.add(crystal);
    const ring = new THREE.Mesh(new THREE.RingGeometry(24, 28, 32), fadeMat(color, 1.6, 0.6));
    ring.position.z = 1.5;
    obj.add(ring);
    const beam = new THREE.Mesh(beamGeo, fadeMat(color, 1.8, 0.5));
    this.scene.add(beam);
    const e = { obj, pivot: obj, crystal, ring, beam, hp: WARD_HP, maxHp: WARD_HP, r: 24, kind: 'ward', owner, color, mats: [crystalMat], baseGlow: 2.2, flash: 0, bob: Math.random() * 6, dead: false, contact: false, hover: 50 };
    this.effects.ring(x, y, color, 90, 0.4);
    this.effects.burst(x, y, 40, color, 12, 200, 4);
    return this.addEnemy(e);
  }

  aliveOf(owner, kind) {
    return this.enemies.filter((e) => !e.dead && e.owner === owner && (!kind || e.kind === kind));
  }

  damageEnemy(e, n) {
    if (e.dead) return;
    e.hp -= n;
    e.flash = 0.12;
    const p = e.obj.position;
    this.effects.burst(p.x, p.y, e.hover ?? 14, e.color, 5, 160, 3);
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    if (e.dead) return;
    const p = e.obj.position;
    this.effects.burst(p.x, p.y, e.hover ?? 18, e.color, e.kind === 'minion' ? 14 : 26, e.kind === 'minion' ? 220 : 320, e.kind === 'minion' ? 4 : 6);
    if (e.kind !== 'minion') this.effects.ring(p.x, p.y, e.color, 120, 0.35);
    this.scene.remove(e.obj);
    if (e.beam) this.scene.remove(e.beam);
    e.dead = true;
  }

  spawnRubble(x, y, drop = 140) {
    if (this.rubble.filter((r) => r.state === 'ground').length >= RUBBLE_MAX) return null;
    const s = 12 + Math.random() * 5;
    const mesh = new THREE.Mesh(rockGeometry(s, 0, 0.3), rubbleMat);
    mesh.castShadow = true;
    mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    const ring = new THREE.Mesh(new THREE.RingGeometry(s + 7, s + 10, 28), fadeMat(0x5dff9e, 1.4, 0.5));
    this.scene.add(mesh, ring);
    const r = { mesh, ring, x, y, r: s, z: s * 0.6 + drop, rest: s * 0.6, vz: 0, state: 'ground', vx: 0, vy: 0, travel: 0, t: Math.random() * 6 };
    mesh.position.set(x, y, r.z);
    ring.position.set(x, y, 1.4);
    this.rubble.push(r);
    return r;
  }

  spawnRubbleAround(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 45 + Math.random() * 55;
      const pos = new THREE.Vector3(x + Math.cos(a) * d, y + Math.sin(a) * d, 0);
      this.arena.pushOut(pos, 18);
      this.spawnRubble(pos.x, pos.y, 120 + Math.random() * 80);
    }
  }

  groundRubble() {
    return this.rubble.filter((r) => r.state === 'ground');
  }

  throwRubble(r, x, y, z, angle) {
    r.state = 'thrown';
    r.x = x;
    r.y = y;
    r.z = z;
    r.vx = Math.cos(angle) * RUBBLE_SPEED;
    r.vy = Math.sin(angle) * RUBBLE_SPEED;
    r.travel = 0;
    r.ring.visible = false;
  }

  removeRubble(r) {
    this.scene.remove(r.mesh, r.ring);
    r.state = 'gone';
  }

  shatter(r) {
    this.effects.burst(r.x, r.y, r.z, 0x6a5a7a, 14, 260, 5, 0.8);
    this.effects.burst(r.x, r.y, r.z, 0xffe0a0, 6, 200, 3);
    this.effects.addShake(6);
    this.removeRubble(r);
  }

  clearShotsNear(x, y, r) {
    this.enemyShots = this.enemyShots.filter((s) => {
      if (Math.hypot(s.mesh.position.x - x, s.mesh.position.y - y) < r) {
        this.effects.spark(s.mesh.position.x, s.mesh.position.y, s.mesh.position.z, 0x9dffc8, 5, 0.3);
        this.scene.remove(s.mesh);
        return false;
      }
      return true;
    });
  }

  clearHostiles() {
    this.enemyShots.forEach((s) => this.scene.remove(s.mesh));
    this.waves.forEach((w) => {
      removeMesh(this.scene, w.mesh, true);
      removeMesh(this.scene, w.wall, true);
    });
    this.teles.forEach((t) => removeMesh(this.scene, t.group, true));
    this.zones.forEach((z) => removeMesh(this.scene, z.mesh, true));
    this.lobs.forEach((l) => this.scene.remove(l.mesh));
    this.enemies.forEach((e) => this.killEnemy(e));
    this.enemyShots = [];
    this.waves = [];
    this.teles = [];
    this.zones = [];
    this.lobs = [];
    this.enemies = [];
    this.timers = [];
  }

  clearAll() {
    this.clearHostiles();
    this.rubble.forEach((r) => this.removeRubble(r));
    this.rubble = [];
  }

  update(dt, boss) {
    if (dt <= 0) return;
    const p = this.player.position;
    const pr = this.player.userData.radius;
    const arena = this.arena;
    const fx = this.effects;

    this.timers = this.timers.filter((tm) => {
      tm.t -= dt;
      if (tm.t <= 0) {
        tm.fn();
        return false;
      }
      return true;
    });

    this.enemyShots = this.enemyShots.filter((s) => {
      const pos = s.mesh.position;
      if (s.homing) {
        const want = Math.atan2(p.y - pos.y, p.x - pos.x);
        let d = want - s.angle;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        s.angle += THREE.MathUtils.clamp(d, -s.homing * dt, s.homing * dt);
      }
      s.angle += s.curve * dt;
      s.speed += s.accel * dt;
      pos.x += Math.cos(s.angle) * s.speed * dt;
      pos.y += Math.sin(s.angle) * s.speed * dt;
      s.life -= dt;
      let gone = s.life <= 0 || Math.hypot(pos.x, pos.y) > arena.radius + 300;
      if (!gone && arena.pillarAt(pos.x, pos.y, s.size)) {
        fx.burst(pos.x, pos.y, pos.z, s.color, 4, 120, 3);
        gone = true;
      }
      if (!gone && this.player.visible !== undefined && Math.hypot(p.x - pos.x, p.y - pos.y) < s.size + pr * 0.75) {
        if (this.hooks.hurt()) gone = true;
      }
      if (gone) this.scene.remove(s.mesh);
      return !gone;
    });

    this.rubble = this.rubble.filter((r) => {
      if (r.state === 'gone') return false;
      if (r.state === 'ground') {
        r.t += dt;
        if (r.z > r.rest) {
          r.vz -= 1400 * dt;
          r.z = Math.max(r.rest, r.z + r.vz * dt);
          if (r.z === r.rest) {
            fx.burst(r.x, r.y, 3, 0x6a5a7a, 5, 90, 3, 0.7);
            r.vz = 0;
          }
        }
        r.mesh.position.set(r.x, r.y, r.z);
        r.ring.visible = true;
        r.ring.position.set(r.x, r.y, 1.4);
        r.ring.material.opacity = 0.35 + Math.sin(r.t * 5) * 0.2;
        return true;
      }
      if (r.state !== 'thrown') return true;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.z = Math.max(10, r.z - 30 * dt);
      r.travel += RUBBLE_SPEED * dt;
      r.mesh.position.set(r.x, r.y, r.z);
      r.mesh.rotation.x += dt * 14;
      r.mesh.rotation.y += dt * 10;
      if (Math.random() < 0.8) fx.spark(r.x, r.y, r.z, 0xffe0a0, 3, 0.25, 1.6, 0);
      for (const e of this.enemies) {
        if (!e.dead && Math.hypot(e.obj.position.x - r.x, e.obj.position.y - r.y) < e.r + r.r + 4) {
          this.killEnemy(e);
          this.hooks.enemyHit(e, 'rubble');
          this.shatter(r);
          return false;
        }
      }
      if (boss && !boss.dead && boss.awake) {
        for (const c of boss.hitCircles()) {
          if (Math.hypot(c.x - r.x, c.y - r.y) < c.r + r.r) {
            const res = boss.damage(RUBBLE_DAMAGE, 'rubble');
            this.hooks.bossHit(res, RUBBLE_DAMAGE, r.x, r.y, Math.max(r.z, 30), 'rubble');
            fx.burst(r.x, r.y, r.z, boss.color, 16, 320, 5);
            fx.addShake(14);
            this.shatter(r);
            return false;
          }
        }
      }
      if (arena.pillarAt(r.x, r.y, r.r * 0.6) || r.travel > RUBBLE_RANGE || Math.hypot(r.x, r.y) > arena.radius + 40) {
        this.shatter(r);
        return false;
      }
      return true;
    });

    for (const e of this.enemies) {
      if (e.dead) continue;
      const o = e.obj.position;
      e.bob += dt * 8;
      e.flash -= dt;
      if (e.kind === 'ward') {
        e.crystal.rotation.z += dt * 2;
        e.crystal.position.z = 58 + Math.sin(e.bob * 0.5) * 6;
        e.mats[0].emissiveIntensity = e.flash > 0 ? 8 : e.baseGlow;
        e.ring.rotation.z += dt;
        if (!e.owner || e.owner.dead) {
          this.killEnemy(e);
          continue;
        }
        const a = new THREE.Vector3(o.x, o.y, e.crystal.position.z);
        const b = e.owner.shieldCenter();
        const len = a.distanceTo(b);
        e.beam.position.copy(a).add(b).multiplyScalar(0.5);
        e.beam.scale.set(2.5 + Math.sin(e.bob * 3), len, 2.5 + Math.sin(e.bob * 3));
        e.beam.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
        continue;
      }
      let dx = p.x - o.x;
      let dy = p.y - o.y;
      if (e.kind === 'minion') {
        const d = Math.hypot(dx, dy) || 1;
        o.x += (dx / d) * MINION_SPEED * dt;
        o.y += (dy / d) * MINION_SPEED * dt;
      } else if (e.kind === 'guard') {
        if (!e.owner || e.owner.dead) {
          this.killEnemy(e);
          continue;
        }
        e.phase += dt * 1.4;
        e.halo.rotation.z += dt * 3;
        if (e.diving > 0) {
          e.diving -= dt;
          const tx = e.diveTarget.x - o.x;
          const ty = e.diveTarget.y - o.y;
          const td = Math.hypot(tx, ty) || 1;
          const step = Math.min(td, 430 * dt);
          o.x += (tx / td) * step;
          o.y += (ty / td) * step;
          if (Math.random() < 0.6) fx.spark(o.x, o.y, 20, e.color, 3, 0.3);
        } else {
          const c = e.owner.pos;
          const gx = c.x + Math.cos(e.phase) * 125;
          const gy = c.y + Math.sin(e.phase) * 125;
          o.x += (gx - o.x) * Math.min(1, dt * 5);
          o.y += (gy - o.y) * Math.min(1, dt * 5);
          e.diveTimer -= dt;
          if (e.diveTimer <= 0) {
            e.diveTimer = 3.5 + Math.random() * 3;
            e.diving = 0.75;
            e.diveTarget.set(p.x, p.y, 0);
            this.lineTelegraph(o.x, o.y, Math.atan2(p.y - o.y, p.x - o.x), Math.hypot(p.x - o.x, p.y - o.y), 34, 0.3, e.color);
          }
        }
      }
      for (const other of this.enemies) {
        if (other === e || other.dead || other.kind === 'ward') continue;
        const ox = o.x - other.obj.position.x;
        const oy = o.y - other.obj.position.y;
        const od = Math.hypot(ox, oy);
        const min = e.r + other.r + 4;
        if (od < min && od > 0.01) {
          o.x += (ox / od) * (min - od) * 0.5;
          o.y += (oy / od) * (min - od) * 0.5;
        }
      }
      arena.pushOut(o, e.r);
      dx = p.x - o.x;
      dy = p.y - o.y;
      e.pivot.rotation.z = Math.atan2(dy, dx) + Math.PI / 2;
      e.pivot.position.z = e.hover + Math.sin(e.bob) * 5;
      e.mats.forEach((mat) => {
        mat.emissiveIntensity = e.flash > 0 ? 4 : 0.4;
      });
      if (e.contact && Math.hypot(dx, dy) < e.r + pr * 0.8 && p.z < 30) this.hooks.hurt();
    }
    this.enemies = this.enemies.filter((e) => !e.dead);

    this.waves = this.waves.filter((w) => {
      w.r += w.speed * dt;
      w.mesh.scale.setScalar(w.r);
      w.wall.scale.set(w.r, w.r, 16);
      const k = 1 - w.r / w.maxR;
      w.mesh.material.opacity = 0.95 * k;
      w.wall.material.opacity = 0.6 * k;
      const d = Math.hypot(p.x - w.x, p.y - w.y);
      if (Math.abs(d - w.r) < 16 && p.z < 12) this.hooks.hurt();
      if (w.r >= w.maxR) {
        removeMesh(this.scene, w.mesh, true);
        removeMesh(this.scene, w.wall, true);
        return false;
      }
      return true;
    });

    this.teles = this.teles.filter((t) => {
      t.t += dt;
      const k = Math.min(t.t / t.time, 1);
      if (t.line) {
        t.group.material.opacity = 0.25 + 0.25 * Math.sin(t.t * 30);
      } else {
        t.fill.scale.setScalar(Math.max(t.r * k, 0.01));
        t.ring.material.opacity = 0.6 + 0.4 * Math.sin(t.t * 25);
      }
      if (k >= 1) {
        removeMesh(this.scene, t.group, true);
        if (t.onDone) t.onDone();
        return false;
      }
      return true;
    });

    this.lobs = this.lobs.filter((l) => {
      l.t += dt;
      const k = Math.min(l.t / l.time, 1);
      const e = l.accel ? k * k : k;
      l.mesh.position.lerpVectors(l.from, l.to, e);
      l.mesh.position.z += Math.sin(k * Math.PI) * l.arc;
      l.mesh.rotation.x += dt * 5;
      l.mesh.rotation.y += dt * 4;
      if (Math.random() < 0.7) fx.spark(l.mesh.position.x, l.mesh.position.y, l.mesh.position.z, l.color, l.mesh.scale.x * 0.5, 0.35, 2.5, 0);
      if (k >= 1) {
        this.scene.remove(l.mesh);
        return false;
      }
      return true;
    });

    this.zones = this.zones.filter((z) => {
      z.t += dt;
      const left = z.time - z.t;
      z.mesh.material.opacity = 0.55 * Math.min(1, left / 0.5) * (z.kind === 'fire' ? 0.75 + Math.sin(z.t * 20) * 0.25 : 1);
      if (z.kind === 'fire' && Math.random() < dt * 25) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * z.r;
        fx.spark(z.x + Math.cos(a) * d, z.y + Math.sin(a) * d, 3, z.color, 4, 0.5, 3, 60);
      }
      if (z.kind === 'fire' && p.z < 6 && Math.hypot(p.x - z.x, p.y - z.y) < z.r) this.hooks.hurt();
      if (left <= 0) {
        removeMesh(this.scene, z.mesh, true);
        return false;
      }
      return true;
    });
  }
}
