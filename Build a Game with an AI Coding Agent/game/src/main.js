import * as THREE from 'three';
import './style.css';
import { Renderer, Composer } from './components/Renderer.js';
import { Camera, CAMERA_OFFSET } from './components/Camera.js';
import { Player } from './components/Player.js';
import { createArena } from './components/Arena.js';
import { Effects, fadeMat } from './components/Effects.js';
import { World } from './components/Combat.js';
import { Hud } from './components/Hud.js';
import { BOSSES } from './components/Bosses.js';
import { lerpAngle } from './components/bosses/Boss.js';
import { Tongue } from './components/Tongue.js';
import {
  PLAYER_MAX_HP, PLAYER_SPEED, PLAYER_ACCEL, JUMP_VELOCITY, GRAVITY,
  DASH_SPEED, DASH_TIME, DASH_COOLDOWN, INVULN_TIME, TONGUE_COOLDOWN, TONGUE_RANGE,
} from './components/Constants.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x12051a);
scene.fog = new THREE.Fog(0x12051a, 1500, 3600);

const arena = createArena(scene);
const player = Player();
scene.add(player);
const camera = Camera();
const renderer = Renderer();
const { composer, bloom } = Composer(renderer, scene, camera);
const effects = new Effects(scene);
const hud = new Hud();

const playerRing = new THREE.Mesh(new THREE.RingGeometry(17, 21, 48), fadeMat(0x4dff9a, 2, 0.6));
playerRing.position.z = 1.4;
scene.add(playerRing);
const reticle = new THREE.Mesh(new THREE.RingGeometry(9, 12, 32), fadeMat(0x8dffc0, 3, 0.9));
reticle.position.z = 1.6;
scene.add(reticle);

const state = {
  mode: 'title',
  bossIndex: 0,
  boss: null,
  hp: PLAYER_MAX_HP,
  invuln: 0,
  vel: new THREE.Vector3(),
  grounded: true,
  dashT: 0,
  dashCool: 0,
  dashDir: new THREE.Vector2(0, 1),
  face: Math.PI / 2,
  hop: 0,
  held: null,
  needRelease: false,
  tongueCool: 0,
  collapseTimer: 8,
  timeScale: 1,
  hitStop: 0,
  modeTimer: 0,
  runTime: 0,
  hits: 0,
  time: 0,
  deathPoints: [],
  boomTimer: 0,
  finalBoom: false,
  deathFocus: null,
  pausedFrom: null,
};

const keys = new Set();
const mouse = { ndc: new THREE.Vector2(), down: false };
const aimPoint = new THREE.Vector3(0, 100, 0);
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const raycaster = new THREE.Raycaster();

function screenPos(x, y, z) {
  const v = new THREE.Vector3(x, y, z).project(camera);
  return [((v.x + 1) / 2) * window.innerWidth, ((1 - v.y) / 2) * window.innerHeight];
}

function popAt(text, x, y, z, cls) {
  const [sx, sy] = screenPos(x, y, z);
  hud.pop(text, sx, sy, cls);
}

function onBossHit(res, amount, x, y, z, src) {
  if (res === 'blocked') {
    popAt('BLOCKED', x, y, z + 30, 'blocked');
    effects.burst(x, y, z, 0xbff6ff, 8, 220, 3);
  } else if (res === 'broke') {
    popAt('SHIELD SHATTERED!', x, y, z + 40, 'huge');
    hud.flash('rgba(160,240,255,0.5)');
    state.hitStop = 0.12;
  } else if (res === 'hit' || res === 'kill') {
    popAt(`${amount}`, x + (Math.random() - 0.5) * 30, y, z + 30, src === 'rubble' ? 'big' : '');
    if (src === 'rubble') state.hitStop = 0.07;
  }
}

function onEnemyHit(e) {
  if (e.dead && e.kind !== 'minion') {
    const p = e.obj.position;
    popAt(e.kind === 'ward' ? 'WARD DESTROYED' : 'GUARD DOWN', p.x, p.y, 60, 'blocked');
  }
}

const world = new World(scene, effects, arena, player, {
  hurt: () => hurt(),
  bossHit: onBossHit,
  enemyHit: onEnemyHit,
});

const tongue = new Tongue(scene, player, world, arena, effects, {
  face: () => state.face,
  boss: () => state.boss,
  holding: () => !!state.held,
  bossHit: onBossHit,
  enemyHit: onEnemyHit,
  grabbed(r) {
    r.state = 'held';
    state.held = r;
    state.needRelease = mouse.down;
    effects.burst(player.position.x, player.position.y, 40, 0x5dff9e, 8, 140, 3);
  },
  latched() {
    state.dashT = 0;
    state.vel.set(0, 0, 0);
    state.grounded = false;
  },
  zipEnd(dir) {
    const p = player.position;
    if (dir) {
      state.vel.set(-dir.x * 120, -dir.y * 120, 300);
      effects.ring(p.x, p.y, 0x9dffc0, 50, 0.3);
    } else {
      state.vel.z = Math.max(state.vel.z, 0);
    }
    state.grounded = false;
  },
});

function crumblePillar(p, delay) {
  if (arena.crumble(p, delay)) world.telegraph(p.x, p.y, 60, delay, 0xff4030);
}

arena.hooks.onCollapse = (p) => {
  effects.burst(p.x, p.y, 60, 0x5a4a66, 26, 340, 9, 0.8);
  effects.burst(p.x, p.y, 40, 0xffa060, 14, 260, 4);
  effects.ring(p.x, p.y, 0xffffff, 140, 0.4, 2, 1.2);
  effects.addShake(18);
  world.hurtArea(p.x, p.y, 50);
  world.spawnRubbleAround(p.x, p.y, 2);
  if (tongue.pillar === p) tongue.release(false);
};

const ctx = {
  scene,
  world,
  effects,
  arena,
  player,
  hurt: () => hurt(),
  crumblePillar,
  onShieldDown(boss) {
    const c = boss.shieldCenter();
    popAt('SHIELD DOWN!', c.x, c.y, c.z + 60, 'huge');
    effects.burst(c.x, c.y, c.z, 0x9ff3ff, 40, 420, 6);
    effects.ring(c.x, c.y, 0x9ff3ff, 260, 0.5, Math.max(2, c.z));
    effects.addShake(16);
  },
  onEnrage(boss) {
    hud.flash('rgba(255,255,255,0.5)');
    hud.setEnraged();
    hud.setBossColor(boss.color);
    hud.showBanner('ENRAGED!', '', 'bad');
    world.after(0.9, () => {
      if (state.mode === 'fight') hud.hideBanner();
    });
    arena.setMood(boss.color);
    effects.addShake(22);
    state.hitStop = 0.15;
  },
};

function moveInput() {
  const v = new THREE.Vector2(
    (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0),
    (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0),
  );
  if (v.lengthSq() > 0) v.normalize();
  return v;
}

function canAct() {
  return state.mode === 'fight' || state.mode === 'intro' || state.mode === 'bossDeath' || state.mode === 'victory';
}

function onPress(code) {
  if (code === 'KeyP' || code === 'Escape') {
    togglePause();
    return;
  }
  if (state.mode === 'paused') return;
  if (state.mode === 'title' || state.mode === 'victory') {
    if (code === 'Space' || code === 'Enter') newRun();
    return;
  }
  if (state.mode === 'dead') {
    if (code === 'Space') retryBoss();
    if (code === 'KeyR') newRun();
    return;
  }
  if (code === 'Space') jump();
  if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyK') dash();
  if (code === 'KeyJ') tongueAction(true);
}

window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (!e.repeat) onPress(e.code);
});
window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (e.code === 'KeyJ') state.needRelease = false;
});
window.addEventListener('blur', () => {
  keys.clear();
  mouse.down = false;
});
window.addEventListener('mousemove', (e) => {
  mouse.ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
});
window.addEventListener('mousedown', (e) => {
  if (e.button === 0 || e.button === 2) {
    mouse.down = true;
    if (state.mode === 'title' || state.mode === 'victory') newRun();
    else tongueAction(false);
  }
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 0 || e.button === 2) {
    mouse.down = false;
    state.needRelease = false;
  }
});
window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloom.setSize(window.innerWidth, window.innerHeight);
});

function togglePause() {
  if (state.mode === 'paused') {
    state.mode = state.pausedFrom;
    hud.hideBanner();
  } else if (state.mode === 'fight' || state.mode === 'intro') {
    state.pausedFrom = state.mode;
    state.mode = 'paused';
    hud.showBanner('PAUSED', 'Press P to resume', 'dim');
  }
}

function hurt() {
  if (state.mode !== 'fight' || state.invuln > 0 || state.dashT > 0 || tongue.zipping) return false;
  const p = player.position;
  state.hp -= 1;
  state.hits += 1;
  state.invuln = INVULN_TIME;
  state.hitStop = 0.08;
  hud.setHearts(state.hp, PLAYER_MAX_HP);
  hud.flash('rgba(255,0,40,0.5)');
  hud.hurt();
  effects.addShake(20);
  effects.burst(p.x, p.y, 14, 0x4dff9a, 18, 260, 4);
  if (state.hp <= 0) die();
  return true;
}

function die() {
  const p = player.position;
  state.mode = 'dead';
  player.visible = false;
  playerRing.visible = false;
  effects.burst(p.x, p.y, 14, 0x4dff9a, 50, 420, 6);
  effects.ring(p.x, p.y, 0x4dff9a, 200, 0.5);
  effects.addShake(30);
  state.timeScale = 0.35;
  world.after(0.6, () => {
    state.timeScale = 1;
  });
  hud.showBanner('DEFEATED', 'Space: retry this boss  ·  R: restart the rush', 'bad dim');
}

function jump() {
  if (!canAct()) return;
  if (tongue.zipping) {
    tongue.release(false);
    state.vel.z = JUMP_VELOCITY * 0.8;
    return;
  }
  if (!state.grounded) return;
  state.vel.z = JUMP_VELOCITY;
  state.grounded = false;
  effects.ring(player.position.x, player.position.y, 0x9dffc0, 40, 0.25);
}

function dash() {
  if (!canAct() || state.dashCool > 0) return;
  if (tongue.zipping) tongue.release(false);
  const input = moveInput();
  if (input.lengthSq() > 0) state.dashDir.copy(input);
  else state.dashDir.set(Math.cos(state.face), Math.sin(state.face));
  state.dashT = DASH_TIME;
  state.dashCool = DASH_COOLDOWN;
  effects.ring(player.position.x, player.position.y, 0x9dffc0, 60, 0.3);
}

function aimAngleFor(auto) {
  const p = player.position;
  if (auto) {
    const t = autoTarget();
    if (t) return Math.atan2(t.y - p.y, t.x - p.x);
    return state.face;
  }
  return Math.atan2(aimPoint.y - p.y, aimPoint.x - p.x);
}

function tongueAction(auto) {
  if (state.mode !== 'fight' || tongue.zipping) return;
  const angle = aimAngleFor(auto);
  if (state.held) {
    const p = player.position;
    const r = state.held;
    state.held = null;
    state.needRelease = mouse.down;
    state.face = angle;
    world.throwRubble(r, p.x + Math.cos(angle) * 20, p.y + Math.sin(angle) * 20, p.z + 30, angle);
    effects.ring(p.x, p.y, 0xffe0a0, 50, 0.25);
    effects.addShake(5);
    return;
  }
  if (state.tongueCool > 0 || tongue.busy) return;
  state.face = angle;
  if (tongue.fire(angle)) state.tongueCool = TONGUE_COOLDOWN;
}

function autoTarget() {
  const p = player.position;
  const b = state.boss;
  const near = (list) => {
    let best = null;
    let bd = Infinity;
    for (const [x, y] of list) {
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < bd) {
        bd = d;
        best = new THREE.Vector3(x, y, 0);
      }
    }
    return [best, bd];
  };
  const enemies = world.enemies.filter((e) => !e.dead).map((e) => [e.obj.position.x, e.obj.position.y]);
  const bossPts = b && b.awake && !b.dead ? b.hitCircles().map((c) => [c.x, c.y]) : [];
  const shielded = b && b.shielded;
  if (state.held) {
    if (shielded && !b.rubbleBreaksShield && enemies.length) return near(enemies)[0];
    if (bossPts.length) return near(bossPts)[0];
    return near(enemies)[0];
  }
  const [e, ed] = near(enemies);
  const [bp, bd] = shielded ? [null, Infinity] : near(bossPts);
  const options = [[e, ed], [bp, bd]].filter((c) => c[0] && c[1] < TONGUE_RANGE + 40).sort((x, y) => x[1] - y[1]);
  if (options.length) return options[0][0];
  const [r] = near(world.groundRubble().map((g) => [g.x, g.y]));
  return r ?? e ?? bp;
}

function updatePlayer(dt) {
  if (dt <= 0) return;
  const p = player.position;
  const pivot = player.userData.pivot;
  const input = canAct() ? moveInput() : new THREE.Vector2();
  state.dashCool = Math.max(0, state.dashCool - dt);
  state.tongueCool = Math.max(0, state.tongueCool - dt);

  if (tongue.zipping) {
    state.face = lerpAngle(state.face, Math.atan2(tongue.dir.y, tongue.dir.x), dt * 20);
    pivot.rotation.z = state.face + Math.PI / 2;
    pivot.scale.set(0.85, 0.85, 1.2);
    arena.pushOut(p, player.userData.radius);
  } else if (state.dashT > 0) {
    state.dashT -= dt;
    state.vel.x = state.dashDir.x * DASH_SPEED;
    state.vel.y = state.dashDir.y * DASH_SPEED;
    for (let i = 0; i < 2; i++) effects.spark(p.x + (Math.random() - 0.5) * 16, p.y + (Math.random() - 0.5) * 16, p.z + 10, 0x6dffb0, 5, 0.35, 2.5, 0);
    if (state.dashT <= 0) {
      state.vel.x *= 0.3;
      state.vel.y *= 0.3;
    }
  } else {
    const slow = world.slowed() ? 0.45 : 1;
    const tx = input.x * PLAYER_SPEED * slow;
    const ty = input.y * PLAYER_SPEED * slow;
    const dvx = tx - state.vel.x;
    const dvy = ty - state.vel.y;
    const dl = Math.hypot(dvx, dvy);
    const max = PLAYER_ACCEL * dt;
    const k = dl > max ? max / dl : 1;
    state.vel.x += dvx * k;
    state.vel.y += dvy * k;
  }

  if (!tongue.zipping) {
    p.x += state.vel.x * dt;
    p.y += state.vel.y * dt;
    arena.pushOut(p, player.userData.radius);
  }

  if (!state.grounded && !tongue.zipping) {
    state.vel.z -= GRAVITY * dt;
    p.z += state.vel.z * dt;
    if (p.z <= 0) {
      p.z = 0;
      state.vel.z = 0;
      state.grounded = true;
      effects.ring(p.x, p.y, 0x9dffc0, 34, 0.25);
      effects.burst(p.x, p.y, 2, 0x8a7a9a, 6, 90, 3, 0.6);
    }
  }

  const moving = Math.hypot(state.vel.x, state.vel.y) > 20;
  if (!tongue.zipping) {
    const want = tongue.busy ? Math.atan2(tongue.dir.y, tongue.dir.x) : moving ? Math.atan2(state.vel.y, state.vel.x) : state.face;
    state.face = lerpAngle(state.face, want, dt * 16);
    pivot.rotation.z = state.face + Math.PI / 2;
  }

  if (state.mode === 'fight' && !state.needRelease && !tongue.busy) {
    if (mouse.down && !state.held) tongueAction(false);
    else if (keys.has('KeyJ') && !mouse.down && state.tongueCool <= 0) tongueAction(true);
  }

  if (state.held) {
    const r = state.held;
    r.mesh.position.set(p.x, p.y, p.z + 52 + Math.sin(state.time * 6) * 3);
    r.mesh.rotation.y += dt * 2;
  }

  if (tongue.zipping) {
    pivot.position.z = 0;
  } else if (!state.grounded) {
    pivot.position.z = 0;
    pivot.scale.set(0.9, 0.9, 1.15);
  } else if (moving) {
    state.hop += dt * 16;
    pivot.position.z = Math.abs(Math.sin(state.hop)) * 7;
    const s = Math.sin(state.hop * 2) * 0.07;
    pivot.scale.set(1 - s, 1 - s, 1 + s);
  } else {
    pivot.position.z *= 0.8;
    pivot.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 12));
  }

  state.invuln = Math.max(0, state.invuln - dt);
  tongue.update(dt);
  const blink = state.invuln > 0 && state.mode === 'fight' && Math.floor(state.invuln * 16) % 2 === 0;
  player.visible = state.mode !== 'dead' && !blink;
  playerRing.visible = state.mode !== 'dead';
  playerRing.position.set(p.x, p.y, 1.4);
  playerRing.scale.setScalar(1 + p.z / 120);
}

function contactDamage() {
  const b = state.boss;
  if (!b || b.dead || !b.awake || tongue.zipping) return;
  const p = player.position;
  const pr = player.userData.radius;
  for (const c of b.contactCircles()) {
    if (Math.hypot(p.x - c.x, p.y - c.y) < c.r + pr * 0.7 && Math.abs((c.z ?? 0) - (p.z + 12)) < c.r + 14) {
      hurt();
      return;
    }
  }
}

function updateAim() {
  raycaster.setFromCamera(mouse.ndc, camera);
  const hit = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(groundPlane, hit)) aimPoint.copy(hit);
  reticle.position.set(aimPoint.x, aimPoint.y, 1.6);
  reticle.rotation.z += 0.05;
  reticle.visible = state.mode === 'fight';
}

function resetPlayer() {
  player.position.set(0, -230, 0);
  state.vel.set(0, 0, 0);
  state.grounded = true;
  state.dashT = 0;
  state.dashCool = 0;
  state.invuln = 0;
  state.face = Math.PI / 2;
  player.visible = true;
  playerRing.visible = true;
}

function startIntro(index) {
  tongue.reset();
  state.held = null;
  world.clearAll();
  arena.reset();
  state.collapseTimer = 7;
  if (state.boss) state.boss.dispose();
  const def = BOSSES[index];
  state.bossIndex = index;
  arena.setMood(def.color);
  state.boss = def.make(ctx, def);
  state.mode = 'intro';
  state.modeTimer = 3.2;
  state.timeScale = 1;
  resetPlayer();
  hud.showTitle(false);
  hud.setBoss(index, BOSSES.length, def);
  hud.setBossHp(1, 0, true);
  hud.showBossPanel(false);
  hud.setHearts(state.hp, PLAYER_MAX_HP);
  hud.showBanner(def.name, def.title, 'boss', `BOSS ${index + 1} OF ${BOSSES.length}`);
  hud.setShield(null, false);
  [[-170, -120], [170, -120], [0, -40]].forEach(([x, y], i) => world.spawnRubble(x, y, 300 + i * 60));
  const b = state.boss.pos;
  effects.ring(b.x, b.y, def.color, 260, 0.8);
  effects.burst(b.x, b.y, 40, def.color, 30, 360, 6);
  effects.addShake(16);
}

function newRun() {
  state.hp = PLAYER_MAX_HP;
  state.runTime = 0;
  state.hits = 0;
  effects.clear();
  startIntro(0);
}

function retryBoss() {
  state.hp = PLAYER_MAX_HP;
  startIntro(state.bossIndex);
}

function beginBossDeath() {
  const b = state.boss;
  state.mode = 'bossDeath';
  state.modeTimer = 2.6;
  state.timeScale = 0.3;
  state.boomTimer = 0;
  state.finalBoom = false;
  state.deathPoints = b.deathPoints();
  state.deathFocus = state.deathPoints[0].clone();
  world.clearHostiles();
  hud.setShield(null, false);
  hud.showBossPanel(false);
  hud.flash('rgba(255,255,255,0.5)');
  effects.addShake(30);
}

function updateBossDeath(raw) {
  const b = state.boss;
  state.modeTimer -= raw;
  state.boomTimer -= raw;
  if (!state.finalBoom && state.boomTimer <= 0 && b) {
    state.boomTimer = 0.11;
    const pt = state.deathPoints[Math.floor(Math.random() * state.deathPoints.length)];
    const x = pt.x + (Math.random() - 0.5) * 60;
    const y = pt.y + (Math.random() - 0.5) * 60;
    effects.burst(x, y, Math.max(10, pt.z), b.color, 14, 300, 5);
    effects.ring(x, y, b.color, 90, 0.3, Math.max(2, pt.z));
    effects.addShake(14);
  }
  if (!state.finalBoom && state.modeTimer <= 1.3 && b) {
    state.finalBoom = true;
    state.timeScale = 1;
    for (const pt of state.deathPoints) {
      effects.burst(pt.x, pt.y, Math.max(10, pt.z), b.color, 30, 520, 7);
      effects.burst(pt.x, pt.y, Math.max(10, pt.z), 0xffffff, 10, 420, 4, 1.4);
    }
    const c = state.deathPoints[0];
    effects.ring(c.x, c.y, 0xffffff, 700, 0.9, 2, 1.2);
    effects.ring(c.x, c.y, b.color, 500, 0.7);
    effects.addShake(40);
    hud.flash('rgba(255,255,255,0.6)');
    b.dispose();
    state.boss = null;
    if (state.bossIndex === BOSSES.length - 1) {
      state.mode = 'victory';
      hud.showBanner('VICTORY!', `All four titans fell in ${state.runTime.toFixed(1)}s with ${state.hits} hit${state.hits === 1 ? '' : 's'} taken  ·  Space to play again`, 'good dim', 'TODE IS LEGEND');
      arena.setMood(0x5dff9e);
      return;
    }
    state.hp = Math.min(PLAYER_MAX_HP, state.hp + 2);
    hud.setHearts(state.hp, PLAYER_MAX_HP);
    hud.showBanner('VANQUISHED', '+2 hearts', 'good');
  }
  if (state.modeTimer <= 0 && state.mode === 'bossDeath') startIntro(state.bossIndex + 1);
}

function updateCollapses(dt) {
  state.collapseTimer -= dt;
  const solid = arena.solidPillars().filter((p) => p !== tongue.pillar && p.state === 'stand');
  const rubbleLeft = world.groundRubble().length + (state.held ? 1 : 0);
  if (rubbleLeft === 0) state.collapseTimer = Math.min(state.collapseTimer, 1.5);
  if (state.collapseTimer > 0) return;
  const b = state.boss;
  state.collapseTimer = (b && b.enraged ? 4 : 6) + Math.random() * 4;
  if (solid.length < 3 && rubbleLeft > 0) return;
  if (!solid.length) return;
  crumblePillar(solid[Math.floor(Math.random() * solid.length)], 1.4);
}

const camFocus = new THREE.Vector3();
const camPos = new THREE.Vector3(0, -900, 700);
const INTRO_OFFSET = new THREE.Vector3(0, -380, 200);
const DEATH_OFFSET = new THREE.Vector3(0, -420, 320);

function updateCamera(raw) {
  let focus;
  let offset;
  const b = state.boss;
  if (state.mode === 'title') {
    const a = state.time * 0.12 - Math.PI / 2;
    focus = new THREE.Vector3(0, 0, 40);
    offset = new THREE.Vector3(Math.cos(a) * 820, Math.sin(a) * 820, 340);
  } else if (state.mode === 'intro' && state.modeTimer > 0.9 && b) {
    const c = b.hitCircles()[0];
    focus = new THREE.Vector3(c.x, c.y, Math.max(40, c.z));
    offset = INTRO_OFFSET;
  } else if (state.mode === 'bossDeath' && state.deathFocus && !state.finalBoom) {
    focus = state.deathFocus;
    offset = DEATH_OFFSET;
  } else {
    const p = player.position;
    focus = new THREE.Vector3(p.x, p.y, 0);
    if (b && !b.dead) {
      const c = b.hitCircles()[0];
      const bias = new THREE.Vector3(c.x - p.x, c.y - p.y, 0).multiplyScalar(0.22);
      if (bias.length() > 140) bias.setLength(140);
      focus.add(bias);
    }
    offset = CAMERA_OFFSET;
  }
  const k = 1 - Math.exp(-raw * 3.2);
  camFocus.lerp(focus, k);
  camPos.lerp(focus.clone().add(offset), k);
  camera.position.copy(camPos).add(effects.shakeOffset());
  camera.lookAt(camFocus.x, camFocus.y, camFocus.z + 10);
}

const clock = new THREE.Clock();
hud.setHearts(state.hp, PLAYER_MAX_HP);
hud.setTime(0);
hud.showTitle(true);
player.position.set(0, 0, 0);

function step(raw) {
  let dt = raw * state.timeScale;
  if (state.hitStop > 0) {
    state.hitStop -= raw;
    dt = 0;
  }
  if (state.mode === 'paused') dt = 0;
  state.time += raw;

  arena.update(state.time, raw);
  updateAim();

  const b = state.boss;
  if (state.mode === 'intro') {
    state.modeTimer -= raw;
    if (state.modeTimer <= 0) {
      state.mode = 'fight';
      b.awake = true;
      b.onAwake();
      hud.showBossPanel(true);
      hud.showBanner('FIGHT!', '', '');
      world.after(0.7, () => {
        if (state.mode === 'fight') hud.hideBanner();
      });
    }
  }

  if (state.mode !== 'paused' && state.mode !== 'title') {
    updatePlayer(dt);
    if (state.boss) state.boss.update(dt);
    world.update(dt, state.boss);
    if (state.mode === 'fight') {
      contactDamage();
      updateCollapses(dt);
      state.runTime += dt;
      if (state.boss && state.boss.dead) beginBossDeath();
    }
  }
  if (state.mode === 'bossDeath') updateBossDeath(raw);
  if (state.mode === 'title') {
    player.userData.pivot.rotation.z += raw * 0.6;
  }

  if (state.boss) {
    hud.setBossHp(state.boss.hp / state.boss.maxHp, raw);
    if (state.boss.awake && !state.boss.dead) {
      const hint = state.boss.shieldHint();
      hud.setShield(hint, !!hint && !state.boss.shielded);
    }
  }
  hud.setHeld(state.held ? 'rock' : tongue.zipping ? 'zip' : 'ready');
  hud.setDash(state.dashCool <= 0);
  hud.setTime(state.runTime);

  effects.update(state.mode === 'paused' ? 0 : dt);
  updateCamera(raw);
  arena.fade(player.position);
}

renderer.setAnimationLoop(() => {
  step(Math.min(clock.getDelta(), 0.05));
  composer.render();
});
