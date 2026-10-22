import * as THREE from 'three';

export const CAMERA_OFFSET = new THREE.Vector3(0, -420, 470);

export function Camera() {
  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 1, 9000);
  camera.up.set(0, 0, 1);
  camera.position.set(0, -700, 600);
  camera.lookAt(0, 0, 0);
  return camera;
}
