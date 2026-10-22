import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const cache = new Map();

export function loadModel(url) {
  if (!cache.has(url)) {
    cache.set(url, new Promise((resolve, reject) => loader.load(url, (gltf) => resolve(gltf.scene), undefined, reject)));
  }
  return cache.get(url).then((scene) => cloneSkinned(scene));
}

export function prepareModel(model, scale) {
  model.rotation.x = Math.PI / 2;
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  model.position.z -= box.min.z;
  const size = new THREE.Vector3();
  box.getSize(size);
  return Math.min(size.x, size.y) / 2;
}

export function castShadows(object) {
  object.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
    if (o.isSkinnedMesh) o.frustumCulled = false;
  });
}
