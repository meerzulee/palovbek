import * as THREE from 'three';
import { qazanActivity } from './qazanActivity';
import type { QazanConditions } from './qazanActivity';

// A small, deterministic effect: all motion reads the same pausable cooking clock.
export function makeZirvak(mobile: boolean) {
  const group = new THREE.Group();
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const material = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: .55, ...extra });
    materials.push(mat); return mat;
  };
  const add = (geometry: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = group) => {
    const mesh = new THREE.Mesh(geometry, mat); parent.add(mesh); return mesh;
  };
  const brothMat = material('#a96422', { roughness: .23, metalness: .08 });
  const geometry = new THREE.RingGeometry(0, .89, 48, 10);
  geometry.rotateX(-Math.PI / 2);
  const surface = add(geometry, brothMat);
  surface.receiveShadow = true;
  const basePositions = Float32Array.from(geometry.attributes.position.array);
  const ingredients = new THREE.Group(); group.add(ingredients);
  const onionMat = material('#e5b571'), carrotMat = material('#e99330'), lambMat = material('#ad7044');
  const garlicMat = material('#e8d4a5');
  const onionGeometry = new THREE.TorusGeometry(.061, .018, 5, 14, Math.PI * 1.65);
  const lambGeometry = new THREE.DodecahedronGeometry(.11, 0), carrotGeometry = new THREE.BoxGeometry(.042, .028, .22);
  const cloveGeometry = new THREE.SphereGeometry(.052, 8, 6);
  const chunks: { object: THREE.Object3D; id: string; angle: number; radius: number; height: number; spin: number }[] = [];
  const scatter = (id: string, count: number, create: (index: number) => THREE.Object3D) => {
    for (let i = 0; i < count; i++) {
      const object = create(i); ingredients.add(object);
      chunks.push({ object, id, angle: i * 2.399 + id.length, radius: Math.sqrt((i + .5) / count) * .75, height: id === 'lamb' ? .048 : id === 'garlic' ? .045 : .01, spin: i * 1.7 });
    }
  };
  scatter('onion', 16, () => { const onion = new THREE.Mesh(onionGeometry, onionMat); onion.rotation.x = -Math.PI / 2; return onion; });
  scatter('lamb', 11, i => { const lamb = new THREE.Mesh(lambGeometry, lambMat); lamb.scale.set(1 + i % 3 * .12, .7, .85); lamb.castShadow = true; return lamb; });
  scatter('carrot', 28, () => new THREE.Mesh(carrotGeometry, carrotMat));
  scatter('garlic', 2, () => {
    const bulb = new THREE.Group();
    for (let i = 0; i < 7; i++) { const clove = add(cloveGeometry, garlicMat, bulb); clove.position.set(Math.cos(i * Math.PI * 2 / 7) * .054, .03, Math.sin(i * Math.PI * 2 / 7) * .054); clove.scale.y = 1.6; }
    const stem = add(new THREE.ConeGeometry(.027, .09, 6), garlicMat, bulb); stem.position.y = .12;
    return bulb;
  });

  const bubbleGeometry = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const rippleGeometry = new THREE.RingGeometry(.79, 1, 20); rippleGeometry.rotateX(-Math.PI / 2);
  const bubbleCount = mobile ? 16 : 24;
  const bubbles = Array.from({ length: bubbleCount }, (_, i) => {
    const capMat = material('#ffe2a0', { transparent: true, opacity: .72, depthWrite: false, roughness: .15 });
    const ringMat = material('#ffe1a2', { transparent: true, opacity: .65, depthWrite: false, side: THREE.DoubleSide });
    return { cap: add(bubbleGeometry, capMat), ring: add(rippleGeometry, ringMat), capMat, ringMat, angle: i * 2.399, radius: Math.sqrt((i + .5) / bubbleCount) * .78, phase: (i * .381966) % 1 };
  });

  // Soft billboards avoid the opaque polygonal clouds that used to cover the chef.
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(244,242,224,.8)'); gradient.addColorStop(.35, 'rgba(244,242,224,.35)'); gradient.addColorStop(1, 'rgba(244,242,224,0)');
  context.fillStyle = gradient; context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas); textures.push(texture);
  const steam = Array.from({ length: mobile ? 9 : 14 }, (_, i) => {
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false, color: '#fff9eb' }); materials.push(mat);
    const sprite = new THREE.Sprite(mat); group.add(sprite);
    return { sprite, mat, phase: i / (mobile ? 9 : 14), angle: i * 2.399, radius: .15 + (i % 5) * .12 };
  });
  const brothColor = new THREE.Color(), rawMeat = new THREE.Color('#bb7857'), brownedMeat = new THREE.Color('#855029');

  return { group, materials, textures, update(state: QazanConditions, clock: number, stirring: boolean, reducedMotion: boolean) {
    const activity = qazanActivity(state);
    const time = reducedMotion ? 0 : clock;
    const level = activity.wet ? .565 : .49;
    surface.visible = state.added.length > 0 && !activity.rice && !state.covered;
    ingredients.visible = surface.visible;
    surface.position.y = level;
    ingredients.position.y = level;
    brothColor.set(state.burn > .5 ? '#423323' : activity.wet ? '#9f541d' : state.added.includes('lamb') ? '#ad7029' : '#c49024');
    brothMat.color.copy(brothColor);
    lambMat.color.copy(rawMeat).lerp(brownedMeat, state.browning);
    onionMat.color.set(state.browning > .5 ? '#b9833f' : '#edbf76');
    const positions = geometry.attributes.position as THREE.BufferAttribute;
    const wave = reducedMotion ? 0 : .005 * activity.shimmer + .012 * activity.simmer;
    for (let i = 0; i < positions.count; i++) {
      const x = basePositions[i * 3], z = basePositions[i * 3 + 2];
      const edge = Math.max(0, 1 - (x * x + z * z) / (.89 * .89));
      positions.setY(i, Math.sin(x * 11 + time * 2.1) * Math.cos(z * 9 - time * 1.7) * wave * edge);
    }
    positions.needsUpdate = true; geometry.computeVertexNormals();
    ingredients.rotation.y = stirring ? Math.sin(time * .35) * .18 : 0;
    for (const chunk of chunks) {
      chunk.object.visible = state.added.includes(chunk.id);
      const angle = chunk.angle + Math.sin(time * .25 + chunk.spin) * activity.simmer * .04;
      chunk.object.position.set(Math.cos(angle) * chunk.radius, chunk.height + Math.sin(time * 2 + chunk.spin) * activity.simmer * .008, Math.sin(angle) * chunk.radius);
      chunk.object.rotation.y = chunk.spin + Math.sin(time * .6 + chunk.spin) * activity.simmer * .07;
    }
    let visibleBubbles = 0;
    for (let i = 0; i < bubbles.length; i++) {
      const bubble = bubbles[i], p = (time * (.65 + activity.simmer * .4) + bubble.phase) % 1;
      const enabled = !reducedMotion && i < Math.ceil(activity.bubbles * bubbleCount) && state.added.length > 0;
      const radius = activity.rice ? .88 : bubble.radius;
      const y = activity.rice ? .77 : level + .02;
      bubble.cap.visible = enabled && p < .62;
      bubble.ring.visible = enabled && p >= .62;
      bubble.cap.position.set(Math.cos(bubble.angle) * radius, y, Math.sin(bubble.angle) * radius);
      bubble.ring.position.copy(bubble.cap.position);
      const size = .023 + Math.sin(p / .62 * Math.PI / 2) * (.045 + bubble.phase * .026);
      bubble.cap.scale.set(size, size * .72, size);
      const pop = Math.max(0, (p - .62) / .38);
      bubble.ring.scale.setScalar(.04 + pop * .09);
      bubble.ringMat.opacity = .65 * (1 - pop);
      if (enabled) visibleBubbles++;
    }
    for (const puff of steam) {
      const p = (time * .21 + puff.phase) % 1;
      const radius = state.covered ? .96 : puff.radius;
      puff.sprite.visible = activity.steam > 0;
      puff.sprite.position.set(Math.cos(puff.angle) * radius + Math.sin(time * .6 + puff.angle) * p * .1, (state.covered ? .77 : activity.rice ? .82 : level + .06) + p * .9, Math.sin(puff.angle) * radius + p * .12);
      puff.sprite.scale.set(.2 + p * .43, .22 + p * .85, 1);
      puff.mat.opacity = Math.sin(p * Math.PI) * activity.steam * (state.covered ? .65 : .55);
    }
    return { ...activity, visibleBubbles };
  } };
}
