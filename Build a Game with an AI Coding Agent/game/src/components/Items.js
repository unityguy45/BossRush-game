import * as THREE from 'three';
import { glowMat } from './Effects.js';
import { BOX_RESPAWN, ROCKET_DAMAGE, BOMB_DAMAGE, BOMB_RADIUS, THUNDER_DAMAGE, NITRO_TIME, BUBBLE_TIME, PLAYER_MAX_HP } from './Constants.js';

export const ITEMS = {
  rocket: { icon: '🚀', name: 'ROCKETS', ammo: 3 },
  bomb: { icon: '💣', name: 'MEGA BOMB', ammo: 1 },
  nitro: { icon: '🔥', name: 'NITRO', ammo: 1 },
  shield: { icon: '🛡️', name: 'BUBBLE', ammo: 1 },
  thunder: { icon: '⚡', name: 'THUNDER', ammo: 1 },
  heart: { icon: '❤️', name: 'REPAIR KIT', ammo: 1 },
};

const ICONS = Object.values(ITEMS).map((i) => i.icon);

function boxTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 8;
  g.strokeRect(6, 6, 116, 116);
  g.fillStyle = '#fff';
  g.font = 'bold 88px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('?', 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const rocketBody = new THREE.CylinderGeometry(3, 3, 18, 10).rotateZ(-Math.PI / 2);
const rocketNose = new THREE.ConeGeometry(3, 8, 10).rotateZ(-Math.PI / 2).translate(13, 0, 0);
const rocketFin = new THREE.BoxGeometry(5, 10, 1.2);
const bombGeo = new THREE.SphereGeometry(10, 16, 12);

export class Items {
  constructor(scene, world, arena, effects, api) {
    this.scene = scene;
    this.world = world;
    this.arena = arena;
    this.effects = effects;
    this.api = api;
    this.held = null;
    this.ammo = 0;
    this.rolling = 0;
    this.rollTick = 0;
    this.rockets = [];
    this.boxes = [];
    const tex = boxTexture();
    const spots = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
      spots.push([Math.cos(a) * 170, Math.sin(a) * 170]);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      spots.push([Math.cos(a) * 400, Math.sin(a) * 400]);
    }
    for (const [x, y] of spots) {
      const mat = new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, emissive: 0xff00ff, emissiveIntensity: 0.6, transparent: true, opacity: 0.88, roughness: 0.2 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(24, 24, 24), mat);
      mesh.castShadow = true;
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(6, 0), glowMat(0xffffff, 2));
      mesh.add(core);
      mesh.position.set(x, y, 24);
      scene.add(mesh);
      this.boxes.push({ mesh, mat, x, y, active: true, t: 0, phase: Math.random() * 6 });
    }
  }

  reset() {
    this.held = null;
    this.ammo = 0;
    this.rolling = 0;
    this.rockets.forEach((r) => this.scene.remove(r.mesh));
    this.rockets = [];
    for (const b of this.boxes) {
      b.active = true;
      b.t = 0;
      b.mesh.visible = true;
      b.mesh.scale.setScalar(1);
    }
    this.api.hud.setItem(null, 0);
  }

  roll() {
    const b = this.api.boss();
    const hp = this.api.state.hp;
    const table = [
      ['rocket', 32],
      ['bomb', 24],
      ['nitro', 18],
      ['shield', 12],
      ['thunder', b && b.shielded ? 14 : 6],
      ['heart', hp <= 2 ? 22 : hp <= 4 ? 8 : 2],
    ];
    const total = table.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [name, w] of table) {
      r -= w;
      if (r <= 0) return name;
    }
    return 'rocket';
  }

  pickTarget(fromX, fromY) {
    const b = this.api.boss();
    if (!b || b.dead || !b.awake) {
      const e = this.world.enemies.find((x) => !x.dead);
      return e ? { kind: 'enemy', ref: e } : null;
    }
    const guards = this.world.enemies.filter((e) => !e.dead && (e.owner === b || e.kind === 'minion'));
    if (b.shielded && guards.length) {
      guards.sort((a, c) => Math.hypot(a.obj.position.x - fromX, a.obj.position.y - fromY) - Math.hypot(c.obj.position.x - fromX, c.obj.position.y - fromY));
      return { kind: 'enemy', ref: guards[0] };
    }
    return { kind: 'boss', ref: b };
  }

  targetPos(t) {
    if (!t) return null;
    if (t.kind === 'enemy') return t.ref.dead ? null : t.ref.obj.position;
    if (t.ref.dead) return null;
    const c = t.ref.hitCircles()[0];
    return new THREE.Vector3(c.x, c.y, Math.min(c.z, 60));
  }

  use() {
    if (this.rolling > 0 || !this.held) return;
    const st = this.api.state;
    const p = this.api.player.position;
    const fx = this.effects;
    const item = this.held;
    if (item === 'rocket') this.fireRocket();
    else if (item === 'bomb') this.throwBomb();
    else if (item === 'nitro') {
      st.nitro = NITRO_TIME;
      fx.ring(p.x, p.y, 0xff8a2a, 90, 0.35);
      fx.addShake(8);
      this.api.pop('NITRO!', 'big');
    } else if (item === 'shield') {
      st.shield = BUBBLE_TIME;
      fx.ring(p.x, p.y, 0x7fe8ff, 70, 0.35);
      this.api.pop('BUBBLE UP!', 'blocked');
    } else if (item === 'thunder') this.thunder();
    else if (item === 'heart') {
      st.hp = Math.min(PLAYER_MAX_HP, st.hp + 2);
      this.api.hud.setHearts(st.hp, PLAYER_MAX_HP);
      fx.burst(p.x, p.y, 30, 0xff5c8a, 18, 200, 4);
      this.api.pop('+2 HEARTS', 'good');
    }
    this.ammo -= 1;
    if (this.ammo <= 0) this.held = null;
    this.api.hud.setItem(this.held, this.ammo);
  }

  fireRocket() {
    const p = this.api.player.position;
    const h = this.api.state.heading;
    const mesh = new THREE.Group();
    mesh.add(new THREE.Mesh(rocketBody, new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.5, roughness: 0.3 })));
    mesh.add(new THREE.Mesh(rocketNose, new THREE.MeshStandardMaterial({ color: 0xff3b30, roughness: 0.4 })));
    for (const s of [-1, 1]) {
      const fin = new THREE.Mesh(rocketFin, new THREE.MeshStandardMaterial({ color: 0xff3b30 }));
      fin.position.set(-7, s * 3, 0);
      mesh.add(fin);
    }
    const tail = new THREE.Mesh(new THREE.SphereGeometry(3.5, 8, 6), glowMat(0xffa040, 3));
    tail.position.x = -10;
    mesh.add(tail);
    mesh.position.set(p.x + Math.cos(h) * 30, p.y + Math.sin(h) * 30, p.z + 30);
    mesh.rotation.z = h;
    this.scene.add(mesh);
    this.rockets.push({ mesh, angle: h, speed: 520, life: 3.2, target: this.pickTarget(p.x, p.y) });
    this.effects.burst(mesh.position.x, mesh.position.y, mesh.position.z, 0xffa040, 6, 120, 3);
  }

  throwBomb() {
    const p = this.api.player.position;
    const h = this.api.state.heading;
    let tx = p.x + Math.cos(h) * 320;
    let ty = p.y + Math.sin(h) * 320;
    const t = this.targetPos(this.pickTarget(p.x, p.y));
    if (t) {
      const a = Math.atan2(t.y - p.y, t.x - p.x);
      let d = a - h;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const dist = Math.hypot(t.x - p.x, t.y - p.y);
      if (Math.abs(d) < 1.1 && dist < 560) {
        tx = t.x;
        ty = t.y;
      }
    }
    const v = new THREE.Vector3(tx, ty, 0);
    const lim = this.arena.radius - 30;
    if (v.length() > lim) v.setLength(lim);
    const from = new THREE.Vector3(p.x, p.y, p.z + 34);
    this.world.lob(from, v.x, v.y, BOMB_RADIUS * 0.6, 0.75, 0x5dff9e, {
      arc: 180,
      size: 10,
      onLand: () => this.explode(v.x, v.y, BOMB_RADIUS, BOMB_DAMAGE, 'bomb'),
    });
  }

  explode(x, y, r, dmg, src) {
    const fx = this.effects;
    fx.burst(x, y, 10, 0xffa040, 34, 420, 7);
    fx.burst(x, y, 10, 0xffffff, 12, 300, 4, 1.4);
    fx.ring(x, y, 0xffd060, r * 1.4, 0.4, 3, 2.4);
    fx.ring(x, y, 0xff6020, r, 0.3, 3, 2);
    fx.addShake(20);
    for (const e of this.world.enemies) {
      if (!e.dead && Math.hypot(e.obj.position.x - x, e.obj.position.y - y) < r + e.r) {
        this.world.killEnemy(e);
        this.api.enemyHit(e);
      }
    }
    const b = this.api.boss();
    if (b && b.awake && !b.dead) {
      const hit = b.hitCircles().find((c) => Math.hypot(c.x - x, c.y - y) < r + c.r);
      if (hit) {
        const res = b.damage(dmg, src);
        this.api.bossHit(res, dmg, hit.x, hit.y, Math.max(30, Math.min(hit.z, 90)), src);
      }
    }
  }

  thunder() {
    const b = this.api.boss();
    const fx = this.effects;
    this.api.flash('rgba(220,200,255,0.6)');
    fx.addShake(26);
    if (!b || !b.awake || b.dead) return;
    const protectors = this.world.aliveOf(b);
    if (protectors.length) {
      for (const e of protectors) {
        const q = e.obj.position;
        fx.bolt(q.x, q.y, 0xd8c8ff);
        this.world.killEnemy(e);
        this.api.enemyHit(e);
      }
      this.api.pop('THUNDERSTRUCK!', 'huge');
      return;
    }
    const c = b.hitCircles()[0];
    fx.bolt(c.x, c.y, 0xd8c8ff);
    fx.bolt(c.x + 30, c.y - 20, 0xd8c8ff);
    fx.burst(c.x, c.y, Math.min(c.z, 80), 0xd8c8ff, 30, 400, 6);
    const res = b.damage(THUNDER_DAMAGE, 'thunder');
    this.api.bossHit(res, THUNDER_DAMAGE, c.x, c.y, Math.min(c.z, 90), 'thunder');
  }

  update(dt, time) {
    if (dt <= 0) return;
    const p = this.api.player.position;
    for (const b of this.boxes) {
      const hue = (time * 0.25 + b.phase * 0.1) % 1;
      b.mat.emissive.setHSL(hue, 1, 0.5);
      b.mat.color.setHSL(hue, 0.6, 0.8);
      if (b.active) {
        b.mesh.rotation.x += dt * 1.1;
        b.mesh.rotation.y += dt * 1.6;
        b.mesh.position.z = 26 + Math.sin(time * 3 + b.phase) * 5;
        if (b.mesh.scale.x < 1) b.mesh.scale.setScalar(Math.min(1, b.mesh.scale.x + dt * 3));
        if (this.api.canGrab() && Math.hypot(p.x - b.x, p.y - b.y) < 36 && p.z < 50) {
          b.active = false;
          b.t = BOX_RESPAWN;
          b.mesh.visible = false;
          this.effects.burst(b.x, b.y, 24, b.mat.emissive.getHex(), 16, 240, 4);
          this.effects.ring(b.x, b.y, 0xffffff, 50, 0.25, 20);
          if (!this.held && this.rolling <= 0) {
            this.rolling = 0.9;
            this.rollTick = 0;
          }
        }
      } else {
        b.t -= dt;
        if (b.t <= 0) {
          b.active = true;
          b.mesh.visible = true;
          b.mesh.scale.setScalar(0.05);
        }
      }
    }

    if (this.rolling > 0) {
      this.rolling -= dt;
      this.rollTick -= dt;
      if (this.rollTick <= 0) {
        this.rollTick = 0.07;
        this.api.hud.rollIcon(ICONS[Math.floor(Math.random() * ICONS.length)]);
      }
      if (this.rolling <= 0) {
        this.held = this.roll();
        this.ammo = ITEMS[this.held].ammo;
        this.api.hud.setItem(this.held, this.ammo);
      }
    }

    this.rockets = this.rockets.filter((r) => {
      const pos = r.mesh.position;
      r.speed = Math.min(820, r.speed + 900 * dt);
      const tp = this.targetPos(r.target);
      if (tp) {
        const want = Math.atan2(tp.y - pos.y, tp.x - pos.x);
        let d = want - r.angle;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        r.angle += THREE.MathUtils.clamp(d, -6.5 * dt, 6.5 * dt);
        pos.z += (Math.max(16, tp.z) - pos.z) * Math.min(1, dt * 3);
      } else if (r.target) {
        r.target = this.pickTarget(pos.x, pos.y);
      }
      pos.x += Math.cos(r.angle) * r.speed * dt;
      pos.y += Math.sin(r.angle) * r.speed * dt;
      r.mesh.rotation.z = r.angle;
      r.life -= dt;
      this.effects.spark(pos.x - Math.cos(r.angle) * 12, pos.y - Math.sin(r.angle) * 12, pos.z, Math.random() < 0.5 ? 0xffa040 : 0x8a8090, 4, 0.4, 1.4, 10);
      let hit = false;
      for (const e of this.world.enemies) {
        if (!e.dead && Math.hypot(e.obj.position.x - pos.x, e.obj.position.y - pos.y) < e.r + 10) {
          this.world.damageEnemy(e, 4);
          this.api.enemyHit(e);
          hit = true;
          break;
        }
      }
      const b = this.api.boss();
      if (!hit && b && b.awake && !b.dead) {
        const c = b.hitCircles().find((q) => Math.hypot(q.x - pos.x, q.y - pos.y) < q.r + 8);
        if (c) {
          const res = b.damage(ROCKET_DAMAGE, 'rocket');
          this.api.bossHit(res, ROCKET_DAMAGE, pos.x, pos.y, pos.z, 'rocket');
          hit = true;
        }
      }
      if (!hit && (this.arena.pillarAt(pos.x, pos.y, 4) || r.life <= 0 || Math.hypot(pos.x, pos.y) > this.arena.radius + 60)) hit = true;
      if (hit) {
        this.effects.burst(pos.x, pos.y, pos.z, 0xffa040, 16, 260, 5);
        this.effects.ring(pos.x, pos.y, 0xffd060, 50, 0.25, Math.max(2, pos.z));
        this.effects.addShake(6);
        this.scene.remove(r.mesh);
        return false;
      }
      return true;
    });
  }
}
