import * as THREE from 'three';
import { loadModel, prepareModel } from './Loader.js';
import { ENEMY_SCALE, HALF_MAP, SPAWN_INSET } from './Constants.js';

const edge = HALF_MAP - SPAWN_INSET;
export const SPAWN_POINTS = [
  new THREE.Vector2(-edge, -edge),
  new THREE.Vector2(edge, -edge),
  new THREE.Vector2(-edge, edge),
  new THREE.Vector2(edge, edge),
];

export function Enemy(x, y) {
  const enemy = new THREE.Group();
  enemy.position.set(x, y, 0);
  enemy.userData.radius = 12;

  loadModel('/models/enemy.glb').then((model) => {
    enemy.userData.radius = prepareModel(model, ENEMY_SCALE) * 0.8;
    const pivot = new THREE.Group();
    pivot.add(model);
    enemy.add(pivot);
    enemy.userData.model = pivot;
  });

  return enemy;
}
