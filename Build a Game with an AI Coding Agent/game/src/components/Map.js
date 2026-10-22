import * as THREE from 'three';
import { MAP_SIZE, TILE_SIZE } from './Constants.js';

export function GameMap() {
  const map = new THREE.Group();
  const tiles = MAP_SIZE / TILE_SIZE;
  const geometry = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
  const dark = new THREE.MeshLambertMaterial({ color: '#228B22' });
  const light = new THREE.MeshLambertMaterial({ color: '#90EE90' });

  for (let i = 0; i < tiles; i++) {
    for (let j = 0; j < tiles; j++) {
      const tile = new THREE.Mesh(geometry, (i + j) % 2 === 0 ? dark : light);
      tile.position.set(-MAP_SIZE / 2 + TILE_SIZE / 2 + i * TILE_SIZE, -MAP_SIZE / 2 + TILE_SIZE / 2 + j * TILE_SIZE, 0);
      map.add(tile);
    }
  }
  return map;
}
