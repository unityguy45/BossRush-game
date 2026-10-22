import * as THREE from 'three';
import { loadModel } from './Loader.js';
import { HOUSE_SCALE, HOUSE_COUNT, HALF_MAP, TILE_SIZE } from './Constants.js';

export const houseBoxes = [];

function randomPosition(placed) {
  const limit = HALF_MAP - 200;
  for (let attempt = 0; attempt < 50; attempt++) {
    const x = Math.round((Math.random() * 2 - 1) * limit / TILE_SIZE) * TILE_SIZE;
    const y = Math.round((Math.random() * 2 - 1) * limit / TILE_SIZE) * TILE_SIZE;
    if (Math.hypot(x, y) < 150) continue;
    if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < 220)) continue;
    return new THREE.Vector2(x, y);
  }
  return new THREE.Vector2(limit, 0);
}

export async function loadHouses(parent) {
  houseBoxes.length = 0;
  const placed = [];
  for (let i = 0; i < HOUSE_COUNT; i++) {
    const model = await loadModel('/models/small_house.glb');
    model.scale.setScalar(HOUSE_SCALE);
    model.rotation.x = Math.PI / 2;
    model.rotation.y = Math.floor(Math.random() * 4) * (Math.PI / 2);
    const pos = randomPosition(placed);
    placed.push(pos);
    model.position.set(pos.x, pos.y, 0);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    model.position.z -= box.min.z;
    model.updateMatrixWorld(true);
    parent.add(model);
    houseBoxes.push(new THREE.Box3().setFromObject(model));
  }
}

export function hitsHouse(x, y, radius) {
  return houseBoxes.some((box) => {
    const cx = Math.max(box.min.x, Math.min(x, box.max.x));
    const cy = Math.max(box.min.y, Math.min(y, box.max.y));
    return Math.hypot(x - cx, y - cy) < radius;
  });
}
