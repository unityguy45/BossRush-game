import * as THREE from 'three';
import { loadModel, prepareModel, castShadows } from './Loader.js';
import { PLAYER_SCALE } from './Constants.js';

export function Player() {
  const player = new THREE.Group();
  const pivot = new THREE.Group();
  player.add(pivot);
  player.userData.radius = 14;
  player.userData.pivot = pivot;

  loadModel('/models/tode.glb').then((model) => {
    player.userData.radius = prepareModel(model, PLAYER_SCALE) * 0.8;
    castShadows(model);
    pivot.add(model);
  });

  return player;
}
