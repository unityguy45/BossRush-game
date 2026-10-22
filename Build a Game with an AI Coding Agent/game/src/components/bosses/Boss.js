import * as THREE from 'three';

export function lerpAngle(a, b, t) {
  let d = b - a;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return a + d * Math.min(1, t);
}

export const ease = (k) => 1 - Math.pow(1 - k, 3);

export class Boss {
  constructor(ctx, def) {
    this.ctx = ctx;
    this.def = def;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.group = new THREE.Group();
    ctx.scene.add(this.group);
    this.mats = [];
    this.flash = 0;
    this.enraged = false;
    this.dead = false;
    this.awake = false;
    this.co = null;
    this.wait = 0;
    this.dt = 0;
    this.time = 0;
    this.actionIndex = 0;
    this.radius = 60;
    this.color = def.color;
    this.rubbleBreaksShield = false;
  }

  get pos() {
    return this.group.position;
  }

  get target() {
    return this.ctx.player.position;
  }

  glow(material) {
    this.mats.push({ m: material, base: material.emissiveIntensity });
    return material;
  }

  angleTo(x, y, from = this.pos) {
    return Math.atan2(y - from.y, x - from.x);
  }

  aim(from = this.pos) {
    return this.angleTo(this.target.x, this.target.y, from);
  }

  dist(from = this.pos) {
    return Math.hypot(this.target.x - from.x, this.target.y - from.y);
  }

  get shielded() {
    return false;
  }

  shieldHint() {
    return null;
  }

  onAwake() {}

  breakShield() {}

  shieldCenter() {
    const c = this.hitCircles()[0];
    return new THREE.Vector3(c.x, c.y, c.z);
  }

  makeShield(radius, color) {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.2), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false });
    const wireMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2), wireframe: true, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false });
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 3), mat), new THREE.Mesh(new THREE.IcosahedronGeometry(radius * 1.02, 1), wireMat));
    group.visible = false;
    this.ctx.scene.add(group);
    this.shield = { group, mat, wireMat, k: 0, ping: 0 };
  }

  updateShield(dt) {
    const s = this.shield;
    if (!s) return;
    const on = this.shielded && !this.dead;
    s.k += ((on ? 1 : 0) - s.k) * Math.min(1, dt * 8);
    s.ping = Math.max(0, s.ping - dt);
    s.group.visible = s.k > 0.02;
    s.group.scale.setScalar(Math.max(0.01, s.k));
    s.group.position.copy(this.shieldCenter());
    s.group.rotation.z += dt * 0.6;
    s.group.rotation.x += dt * 0.2;
    s.mat.opacity = 0.14 + s.ping * 1.5;
    s.wireMat.opacity = 0.4 + s.ping * 2;
  }

  damage(n, src = 'tongue') {
    if (this.dead || !this.awake) return 'none';
    if (this.shielded) {
      if (this.shield) this.shield.ping = 0.25;
      if (src === 'rubble' && this.rubbleBreaksShield) {
        this.breakShield();
        return 'broke';
      }
      return 'blocked';
    }
    this.hp = Math.max(0, this.hp - n);
    this.flash = 0.07;
    if (!this.enraged && this.hp <= this.maxHp * 0.5 && this.hp > 0) {
      this.enraged = true;
      this.onEnrage();
      this.ctx.onEnrage(this);
    }
    if (this.hp <= 0) this.dead = true;
    return this.dead ? 'kill' : 'hit';
  }

  onEnrage() {}

  rest() {
    return this.def.rest * (this.enraged ? 0.6 : 1);
  }

  *run(name) {
    yield* this[name]();
    yield this.rest();
  }

  pick() {
    const list = this.enraged ? this.def.rage : this.def.actions;
    const name = list[this.actionIndex % list.length];
    this.actionIndex += 1;
    return this.run(name);
  }

  *frames(duration, fn) {
    let e = 0;
    while (e < duration) {
      fn(Math.min(e / duration, 1), this.dt);
      yield 0;
      e += this.dt;
    }
    fn(1, 0);
  }

  think(dt) {
    if (!this.co) {
      this.co = this.pick();
      this.wait = 0;
    }
    this.wait -= dt;
    while (this.co && this.wait <= 0) {
      const r = this.co.next();
      if (r.done) {
        this.co = null;
        break;
      }
      if (!r.value) {
        this.wait = 0;
        break;
      }
      this.wait += r.value;
    }
  }

  update(dt) {
    this.dt = dt;
    this.time += dt;
    if (this.awake && !this.dead && dt > 0) this.think(dt);
    this.animate(dt);
    this.flash -= dt;
    for (const { m, base } of this.mats) m.emissiveIntensity = this.flash > 0 ? base + 6 : base;
    this.updateShield(dt);
  }

  animate() {}

  hitCircles() {
    return [{ x: this.pos.x, y: this.pos.y, z: this.pos.z, r: this.radius }];
  }

  contactCircles() {
    return this.hitCircles();
  }

  deathPoints() {
    return [this.pos.clone().setZ(this.pos.z + 40)];
  }

  dispose() {
    this.ctx.scene.remove(this.group);
    if (this.shield) this.ctx.scene.remove(this.shield.group);
  }

  clampToArena(v, margin = 60) {
    const d = Math.hypot(v.x, v.y);
    const lim = this.ctx.arena.radius - margin;
    if (d > lim) {
      v.x *= lim / d;
      v.y *= lim / d;
    }
  }

  moveToward(x, y, speed, dt, stopAt = 0) {
    const dx = x - this.pos.x;
    const dy = y - this.pos.y;
    const d = Math.hypot(dx, dy);
    if (d <= stopAt || d < 1) return;
    const step = Math.min(speed * dt, d - stopAt);
    this.pos.x += (dx / d) * step;
    this.pos.y += (dy / d) * step;
    this.clampToArena(this.pos);
  }
}
