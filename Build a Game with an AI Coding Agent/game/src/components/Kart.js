import * as THREE from 'three';
import { loadModel, prepareModel, castShadows } from './Loader.js';
import { glowMat } from './Effects.js';

export function Kart() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const paint = new THREE.MeshStandardMaterial({ color: 0xff3b30, metalness: 0.45, roughness: 0.3 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xffd23a, metalness: 0.3, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1a22, roughness: 0.75 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xa4aab4, metalness: 0.9, roughness: 0.28 });
  const exhaustGlow = new THREE.MeshStandardMaterial({ color: 0x220800, emissive: 0xff6a1a, emissiveIntensity: 0.4 });

  const add = (geo, mat, x, y, z, parent = body) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };

  add(new THREE.BoxGeometry(56, 32, 9), paint, 0, 0, 11);
  const nose = add(new THREE.BoxGeometry(26, 26, 7), paint, 36, 0, 10);
  nose.rotation.y = 0.14;
  add(new THREE.BoxGeometry(6, 44, 5), dark, 49, 0, 7);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(42, 7, 11), accent, -2, s * 19, 11);
  add(new THREE.BoxGeometry(7, 24, 22), dark, -14, 0, 24);
  add(new THREE.BoxGeometry(18, 22, 12), metal, -28, 0, 18);
  add(new THREE.BoxGeometry(10, 48, 3), accent, -37, 0, 37);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(3, 3, 17), dark, -35, s * 14, 28);
  const numberPlate = add(new THREE.CircleGeometry(7, 20), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), 30, 0, 14.6);
  numberPlate.castShadow = false;

  const flames = [];
  for (const s of [-1, 1]) {
    const pipe = add(new THREE.CylinderGeometry(3, 3.6, 14, 10), metal, -41, s * 7, 18);
    pipe.rotation.z = Math.PI / 2;
    const tip = add(new THREE.CircleGeometry(2.7, 10), exhaustGlow, -48.2, s * 7, 18);
    tip.rotation.y = -Math.PI / 2;
    const flame = add(new THREE.ConeGeometry(4.5, 20, 10), glowMat(0xff8a2a, 3), -58, s * 7, 18);
    flame.rotation.z = Math.PI / 2;
    flame.visible = false;
    flame.castShadow = false;
    flames.push(flame);
  }

  const column = add(new THREE.CylinderGeometry(1.2, 1.2, 14, 6), dark, 18, 0, 20);
  column.rotation.y = -0.9;
  const wheel = add(new THREE.TorusGeometry(6.5, 1.4, 6, 18), dark, 14, 0, 26);
  wheel.rotation.y = -0.9;
  for (const s of [-1, 1]) add(new THREE.SphereGeometry(2.6, 10, 8), glowMat(0xfff4c0, 2.4), 48, s * 11, 12).castShadow = false;

  const wheelGeo = new THREE.CylinderGeometry(9.5, 9.5, 9, 20);
  const hubGeo = new THREE.CylinderGeometry(4.5, 4.5, 9.4, 10);
  const treadGeo = new THREE.BoxGeometry(3, 9.6, 2);
  const wheels = [];
  for (const [x, s] of [[23, 1], [23, -1], [-23, 1], [-23, -1]]) {
    const holder = new THREE.Group();
    holder.position.set(x, s * 22, 9.5);
    group.add(holder);
    const w = new THREE.Mesh(wheelGeo, dark);
    w.castShadow = true;
    w.add(new THREE.Mesh(hubGeo, metal));
    for (let i = 0; i < 6; i++) {
      const tread = new THREE.Mesh(treadGeo, metal);
      const a = (i / 6) * Math.PI * 2;
      tread.position.set(Math.cos(a) * 9.4, 0, Math.sin(a) * 9.4);
      tread.rotation.y = -a;
      w.add(tread);
    }
    holder.add(w);
    wheels.push({ holder, w, front: x > 0, side: s });
  }

  const seat = new THREE.Group();
  seat.position.set(-2, 0, 14);
  body.add(seat);
  loadModel('/models/tode.glb').then((model) => {
    prepareModel(model, 13);
    castShadows(model);
    const pivot = new THREE.Group();
    pivot.rotation.z = Math.PI / 2;
    pivot.add(model);
    seat.add(pivot);
  });

  group.userData.radius = 22;

  return {
    group,
    body,
    seat,
    wheels,
    rearWheelPositions() {
      return wheels.filter((w) => !w.front).map((w) => w.holder.getWorldPosition(new THREE.Vector3()));
    },
    exhaustPositions() {
      return flames.map((f) => f.getWorldPosition(new THREE.Vector3()));
    },
    update(dt, { speed, steer, drift, boosting, time, accel }) {
      for (const w of wheels) {
        w.w.rotation.y += (speed * dt) / 9.5;
        if (w.front) w.holder.rotation.z = THREE.MathUtils.lerp(w.holder.rotation.z, steer * 0.45, Math.min(1, dt * 12));
      }
      const roll = -(steer * 0.05) - drift * 0.14;
      body.rotation.x = THREE.MathUtils.lerp(body.rotation.x, roll, Math.min(1, dt * 8));
      body.rotation.y = THREE.MathUtils.lerp(body.rotation.y, -accel * 0.04, Math.min(1, dt * 6));
      body.position.z = Math.abs(Math.sin(time * 30)) * Math.min(1, Math.abs(speed) / 400) * 0.8;
      seat.rotation.z = THREE.MathUtils.lerp(seat.rotation.z, steer * 0.25 + drift * 0.2, Math.min(1, dt * 8));
      exhaustGlow.emissiveIntensity = boosting ? 4 : 0.4 + Math.min(1, Math.abs(speed) / 430) * 0.6;
      flames.forEach((f, i) => {
        f.visible = boosting;
        const s = 0.8 + Math.random() * 0.6;
        f.scale.set(1, s, 1);
        f.position.x = -58 - (s - 1) * 10 + i * 0;
      });
    },
  };
}
