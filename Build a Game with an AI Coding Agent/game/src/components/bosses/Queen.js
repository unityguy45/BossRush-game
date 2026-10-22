import * as THREE from 'three';
import { Boss, lerpAngle } from './Boss.js';
import { loadModel, prepareModel, castShadows } from '../Loader.js';
import { glowMat, fadeMat } from '../Effects.js';

export class Queen extends Boss {
  constructor(ctx, def) {
    super(ctx, def);
    this.radius = 52;
    this.hover = 30;
    this.moving = true;
    this.lockFace = false;
    this.faceAngle = -Math.PI / 2;
    this.group.position.set(0, 230, 0);

    this.float = new THREE.Group();
    this.float.position.z = this.hover;
    this.group.add(this.float);
    this.pivot = new THREE.Group();
    this.float.add(this.pivot);

    const gold = this.glow(new THREE.MeshStandardMaterial({ color: 0xffcc44, metalness: 1, roughness: 0.25, emissive: 0xff8800, emissiveIntensity: 0.5 }));
    this.crown = new THREE.Group();
    this.crown.add(new THREE.Mesh(new THREE.TorusGeometry(13, 2.4, 8, 32), gold));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(3, 13, 6), gold);
      spike.rotation.x = Math.PI / 2;
      spike.position.set(Math.cos(a) * 13, Math.sin(a) * 13, 7);
      this.crown.add(spike);
    }
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(5, 0), glowMat(0xff2244, 3));
    gem.position.z = 6;
    this.crown.add(gem);
    this.crown.position.z = 60;
    this.pivot.add(this.crown);

    loadModel('/models/enemy.glb').then((model) => {
      this.radius = prepareModel(model, 26) * 0.85;
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      this.crown.position.z = box.max.z + 4;
      model.traverse((o) => {
        if (o.isMesh) {
          o.material = o.material.clone();
          o.material.emissive = new THREE.Color(0xff9a00);
          o.material.emissiveIntensity = 0.25;
          this.glow(o.material);
        }
      });
      castShadows(model);
      this.pivot.add(model);
    });

    this.makeShield(78, 0xffc21a);
    this.guardRespawn = 0;
    this.prevShield = false;
    this.aura = new THREE.Mesh(new THREE.RingGeometry(46, 54, 64), fadeMat(def.color, 2, 0.6));
    this.aura.position.z = 1.5;
    this.group.add(this.aura);
  }

  get shielded() {
    return this.ctx.world.aliveOf(this, 'guard').length > 0;
  }

  shieldCenter() {
    return new THREE.Vector3(this.pos.x, this.pos.y, this.float.position.z + 20);
  }

  shieldHint() {
    const n = this.ctx.world.aliveOf(this, 'guard').length;
    if (n > 0) return `SHIELDED · defeat her ${n} royal guard${n === 1 ? '' : 's'}`;
    return `EXPOSED · guards return in ${Math.ceil(Math.max(0, this.guardRespawn))}s`;
  }

  onAwake() {
    this.spawnGuards();
  }

  spawnGuards() {
    const n = this.enraged ? 5 : 4;
    for (let i = 0; i < n; i++) this.ctx.world.spawnGuard(this, i, n);
    this.guardRespawn = 99;
  }

  onEnrage() {
    this.color = 0xff6a00;
    this.mats.forEach((e) => {
      e.base += 0.35;
    });
    this.aura.material.color.set(this.color).multiplyScalar(2);
    this.ctx.effects.burst(this.pos.x, this.pos.y, 40, this.color, 40, 420, 6);
  }

  animate(dt) {
    if (this.awake && !this.dead) {
      const sh = this.shielded;
      if (this.prevShield && !sh) {
        this.guardRespawn = this.enraged ? 8 : 11;
        this.ctx.onShieldDown(this);
      }
      if (!sh) {
        this.guardRespawn -= dt;
        if (this.guardRespawn <= 0) this.spawnGuards();
      }
      this.prevShield = sh;
    }
    this.float.position.z = this.hover + Math.sin(this.time * 5) * 5;
    if (!this.lockFace) this.faceAngle = this.aim();
    this.pivot.rotation.z = lerpAngle(this.pivot.rotation.z, this.faceAngle + Math.PI / 2, dt * 8);
    this.crown.rotation.z += dt;
    this.aura.rotation.z += dt * 0.5;
    this.aura.scale.setScalar(1 + Math.sin(this.time * 4) * 0.06);
    if (this.moving && this.awake && !this.dead) {
      const a = this.aim() + Math.PI + Math.sin(this.time * 0.8) * 1.2;
      const goal = new THREE.Vector3(this.target.x + Math.cos(a) * 230, this.target.y + Math.sin(a) * 230, 0);
      this.clampToArena(goal, 70);
      this.moveToward(goal.x, goal.y, this.def.speed * (this.enraged ? 1.3 : 1), dt);
    }
    if (Math.random() < dt * 12) this.ctx.effects.spark(this.pos.x + (Math.random() - 0.5) * 50, this.pos.y + (Math.random() - 0.5) * 50, this.float.position.z, this.color, 2.5, 0.6, 3, -30);
  }

  hitCircles() {
    return [{ x: this.pos.x, y: this.pos.y, z: this.float.position.z, r: this.radius }];
  }

  deathPoints() {
    return [this.pos.clone().setZ(this.float.position.z + 20)];
  }

  edgeDistance(a) {
    const R = this.ctx.arena.radius - 60;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const b = this.pos.x * dx + this.pos.y * dy;
    const c = this.pos.x * this.pos.x + this.pos.y * this.pos.y - R * R;
    return -b + Math.sqrt(Math.max(0, b * b - c));
  }

  *charge() {
    const reps = this.enraged ? 4 : 3;
    for (let i = 0; i < reps; i++) {
      this.moving = false;
      this.lockFace = true;
      const a = this.aim();
      this.faceAngle = a;
      const len = Math.max(150, this.edgeDistance(a));
      const tele = this.enraged ? 0.45 : 0.6;
      this.ctx.world.lineTelegraph(this.pos.x, this.pos.y, a, len, 80, tele, this.color);
      yield* this.frames(tele, () => {
        this.float.position.x = (Math.random() - 0.5) * 6;
      });
      this.float.position.x = 0;
      const sx = this.pos.x;
      const sy = this.pos.y;
      let acc = 0;
      yield* this.frames(len / 1100, (k, dt) => {
        this.pos.x = sx + Math.cos(a) * len * k;
        this.pos.y = sy + Math.sin(a) * len * k;
        this.ctx.effects.burst(this.pos.x, this.pos.y, 30, this.color, 1, 60, 4);
        this.ctx.world.smash(this.pos.x, this.pos.y, 40);
        acc += dt;
        if (this.enraged && acc > 0.05) {
          acc = 0;
          for (const s of [-1, 1]) this.ctx.world.enemyShot(this.pos.x, this.pos.y, a + (s * Math.PI) / 2, 150, { color: this.color, size: 6 });
        }
      });
      this.ctx.effects.addShake(10);
      this.ctx.effects.ring(this.pos.x, this.pos.y, this.color, 120, 0.3);
      yield 0.3;
    }
    this.lockFace = false;
    this.moving = true;
  }

  *stingers() {
    const bursts = this.enraged ? 6 : 4;
    for (let b = 0; b < bursts; b++) {
      const base = this.aim();
      for (let j = 0; j < 7; j++) {
        this.ctx.world.enemyShot(this.pos.x, this.pos.y, base + (j - 3) * 0.14 + (b % 2 ? 0.07 : 0), 330, { color: 0xffd040, size: 6, z: 30 });
      }
      yield 0.28;
    }
  }

  *honey() {
    const n = this.enraged ? 7 : 5;
    const { world, effects } = this.ctx;
    for (let i = 0; i < n; i++) {
      const tgt = new THREE.Vector3(this.target.x, this.target.y, 0);
      if (i > 0) {
        tgt.x += (Math.random() - 0.5) * 240;
        tgt.y += (Math.random() - 0.5) * 240;
      }
      this.clampToArena(tgt, 40);
      const from = new THREE.Vector3(this.pos.x, this.pos.y, 60);
      const { x, y } = tgt;
      world.lob(from, x, y, 60, 1.0, 0xffb300, {
        arc: 260,
        size: 11,
        onLand: () => {
          world.hurtArea(x, y, 60);
          world.zone(x, y, 75, 6, 'honey', 0xffa000);
          effects.burst(x, y, 4, 0xffb300, 14, 200, 5);
        },
      });
      yield 0.14;
    }
    yield 0.6;
  }

  *swarm() {
    const n = this.enraged ? 7 : 5;
    this.ctx.effects.ring(this.pos.x, this.pos.y, this.color, 180, 0.4);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const p = new THREE.Vector3(this.pos.x + Math.cos(a) * 90, this.pos.y + Math.sin(a) * 90, 0);
      this.clampToArena(p, 30);
      this.ctx.world.spawnMinion(p.x, p.y, this.color);
      yield 0.1;
    }
    yield 0.6;
  }
}
