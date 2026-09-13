import * as THREE from 'three';

function randomStream(seed: number) {
  return () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
}

function modelBuilder() {
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const material = (color: string, options: THREE.MeshStandardMaterialParameters = {}) => {
    const value = new THREE.MeshStandardMaterial({ color, roughness: .8, ...options });
    materials.push(value); return value;
  };
  const add = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, mat: THREE.Material, position: [number, number, number] = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(...position);
    mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  return { materials, textures, material, add };
}

export function makePlov() {
  const { materials, textures, material, add } = modelBuilder();
  const group = new THREE.Group(); group.name = 'Golden plov';
  const random = randomStream(320);
  const heightAt = (r: number) => .205 * Math.pow(Math.max(0, 1 - (r / .925) ** 2), .7);
  const moundProfile = Array.from({ length: 25 }, (_, i) => {
    const r = i / 24 * .925; return new THREE.Vector2(r, heightAt(r) - .015);
  });
  add(group, new THREE.LatheGeometry(moundProfile.reverse(), 64), material('#cb954c'));

  // A dense surface of separate, mostly horizontal grains catches the light.
  const riceMaterial = material('#ffffff', { roughness: .54 });
  const rice = new THREE.InstancedMesh(new THREE.CapsuleGeometry(.012, .054, 3, 6), riceMaterial, 3000);
  const palette = ['#efbf64', '#f4d48c', '#e2a64f', '#f7dc9a', '#d7a05a', '#ffe3a3'].map(color => new THREE.Color(color));
  const dummy = new THREE.Object3D();
  for (let i = 0; i < rice.count; i++) {
    const angle = random() * Math.PI * 2, r = Math.sqrt(random()) * .908;
    dummy.position.set(Math.cos(angle) * r, heightAt(r) + random() * .025, Math.sin(angle) * r);
    dummy.rotation.set(Math.PI / 2 + (random() - .5) * .45, random() * Math.PI, random() * Math.PI);
    dummy.scale.set(.75 + random() * .5, .75 + random() * .5, .85 + random() * .2);
    dummy.updateMatrix(); rice.setMatrixAt(i, dummy.matrix); rice.setColorAt(i, palette[i % palette.length]);
  }
  rice.instanceMatrix.needsUpdate = true;
  if (rice.instanceColor) rice.instanceColor.needsUpdate = true;
  rice.castShadow = rice.receiveShadow = true; group.add(rice);
  const carrots = [material('#d16c26'), material('#e59432'), material('#ecad48')];
  for (let i = 0; i < 63; i++) {
    const a = random() * Math.PI * 2, r = Math.sqrt(random()) * .82;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, y = heightAt(r) + .037;
    const length = .14 + random() * .14;
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-length / 2, 0, 0), new THREE.Vector3(0, .019, .025), new THREE.Vector3(length / 2, 0, -.015));
    const strip = add(group, new THREE.TubeGeometry(curve, 5, .022, 4, false), carrots[i % 3], [x, y, z]);
    strip.userData.ingredient = 'carrot';
    strip.rotation.y = random() * Math.PI * 2;
  }
  const meat = [material('#75422b'), material('#935934'), material('#a66a3e')];
  const searedFat = material('#cca26b');
  const meatGeometry = new THREE.IcosahedronGeometry(1, 1);
  const vertex = meatGeometry.getAttribute('position');
  for (let i = 0; i < vertex.count; i++) { const scale = .9 + random() * .18; vertex.setXYZ(i, vertex.getX(i) * scale, vertex.getY(i) * scale, vertex.getZ(i) * scale); }
  meatGeometry.computeVertexNormals();
  for (let i = 0; i < 13; i++) {
    const a = i / 13 * Math.PI * 2 + random() * .2, r = .37 + random() * .36;
    const piece = add(group, meatGeometry, meat[i % 3], [Math.cos(a) * r, heightAt(r) + .07, Math.sin(a) * r]);
    piece.userData.ingredient = 'lamb';
    piece.scale.set(.115 + random() * .045, .085 + random() * .03, .09 + random() * .055); piece.rotation.y = random() * 3;
    const fat = add(piece, new THREE.SphereGeometry(1, 8, 6), searedFat, [.1, .78, .05]); fat.scale.set(.6, .055, .17); fat.rotation.y = -.6;
  }
  const garlicMaterials = [material('#efdfb0'), material('#dfc18a'), material('#f6e7c3')];
  for (const [x, z, size] of [[-.25, -.08, 1.2], [.27, .26, 1]]) {
    const bulb = new THREE.Group(); bulb.position.set(x, heightAt(Math.hypot(x, z)) + .025, z); bulb.scale.setScalar(size); group.add(bulb);
    bulb.userData.ingredient = 'garlic';
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const clove = add(bulb, new THREE.SphereGeometry(.063, 12, 10), garlicMaterials[i % 3], [Math.sin(a) * .075, .077, Math.cos(a) * .075]);
      clove.scale.set(.8, 1.45, 1); clove.rotation.z = -.17 * Math.sin(a);
    }
    add(bulb, new THREE.ConeGeometry(.028, .14, 10), garlicMaterials[1], [0, .21, 0]);
  }
  const cumin = material('#6a492e');
  const seeds = new THREE.InstancedMesh(new THREE.CapsuleGeometry(.004, .018, 2, 4), cumin, 50);
  for (let i = 0; i < seeds.count; i++) {
    const a = random() * Math.PI * 2, r = Math.sqrt(random()) * .86;
    dummy.position.set(Math.cos(a) * r, heightAt(r) + .044, Math.sin(a) * r);
    dummy.scale.setScalar(1); dummy.rotation.set(Math.PI / 2, 0, random() * 6); dummy.updateMatrix(); seeds.setMatrixAt(i, dummy.matrix);
  }
  seeds.instanceMatrix.needsUpdate = true;
  group.add(seeds); seeds.userData.ingredient = 'spice';
  return { group, materials, textures, update: (ingredients: string[] | null, burn: number) => {
    for (const child of group.children) if (child.userData.ingredient) child.visible = !ingredients || ingredients.includes(child.userData.ingredient);
    riceMaterial.color.set(burn > .5 ? '#62503a' : '#ffffff');
  } };
}

export function makeTandyr() {
  const { materials, textures, material, add } = modelBuilder();
  const group = new THREE.Group(); group.name = 'Clay tandyr';
  const random = randomStream(74);
  const textureCanvas = document.createElement('canvas'); textureCanvas.width = textureCanvas.height = 256;
  const ctx = textureCanvas.getContext('2d')!;
  ctx.fillStyle = '#c89472'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 7000; i++) { ctx.fillStyle = random() > .5 ? '#6c392314' : '#fff0c719'; const r = .5 + random() * 1.7; ctx.fillRect(random() * 256, random() * 256, r, r); }
  for (let y = 0; y < 256; y += 32) { ctx.strokeStyle = '#91583520'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(60, y + 3, 160, y - 2, 256, y); ctx.stroke(); }
  const clayTexture = new THREE.CanvasTexture(textureCanvas); clayTexture.colorSpace = THREE.SRGBColorSpace; textures.push(clayTexture);
  const clay = material('#d7b195', { map: clayTexture, roughness: 1 });
  const darkClay = material('#795038', { roughness: 1, side: THREE.DoubleSide });
  const stone = material('#bba384');
  add(group, new THREE.CylinderGeometry(1.02, 1.1, .15, 12), stone, [0, .06, 0]);
  const outer = [[.79, .1], [.94, .24], [1, .7], [.96, 1.16], [.8, 1.64], [.59, 1.91], [.565, 2.04]].map(([r, y]) => new THREE.Vector2(r, y));
  add(group, new THREE.LatheGeometry(outer, 56), clay);
  const inside = [[.49, 2.04], [.49, 1.91], [.71, 1.62], [.85, 1.16], [.86, .7], [.71, .25]].map(([r, y]) => new THREE.Vector2(r, y));
  add(group, new THREE.LatheGeometry(inside, 56), darkClay);
  const lip = add(group, new THREE.TorusGeometry(.527, .055, 12, 56), material('#a77551'), [0, 2.04, 0]); lip.rotation.x = Math.PI / 2;
  const innerLip = add(group, new THREE.TorusGeometry(.49, .016, 6, 56), material('#463226'), [0, 2.02, 0]); innerLip.rotation.x = Math.PI / 2;
  add(group, new THREE.CylinderGeometry(.72, .72, .035, 40), material('#30261f'), [0, .26, 0]);
  const ember = material('#a9461b', { emissive: '#f96615', emissiveIntensity: 1.4 });
  const charcoal = material('#372923');
  for (let i = 0; i < 28; i++) {
    const a = random() * 6.28, r = Math.sqrt(random()) * .6;
    const coal = add(group, new THREE.IcosahedronGeometry(.10, 0), i % 3 ? charcoal : ember, [Math.cos(a) * r, .32 + random() * .04, Math.sin(a) * r]); coal.scale.y = .5;
  }
  const glow = new THREE.PointLight('#ff8d39', 3.5, 2.6, 2); glow.position.set(0, .75, 0); group.add(glow);
  // A soot-darkened draft vent at the foot of the oven.
  const vent = add(group, new THREE.SphereGeometry(.21, 16, 10), material('#493023'), [0, .28, .94]); vent.scale.set(1, .68, .07);
  const ventRim = add(group, new THREE.TorusGeometry(.21, .025, 8, 20, Math.PI), material('#a07150'), [0, .26, .949]); ventRim.scale.y = .72;

  const breadCrust = material('#bf803c', { roughness: .85 });
  const breadInside = material('#e5b568');
  const toasted = material('#875024');
  const bread = (radius: number) => {
    const loaf = new THREE.Group();
    const rim = add(loaf, new THREE.TorusGeometry(radius * .71, radius * .23, 12, 36), breadCrust); rim.rotation.x = Math.PI / 2; rim.scale.z = .52;
    add(loaf, new THREE.CylinderGeometry(radius * .58, radius * .58, .025, 28), breadInside, [0, .012, 0]);
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.28; const dot = add(loaf, new THREE.SphereGeometry(.009, 5, 4), toasted, [Math.cos(a) * radius * .31, .031, Math.sin(a) * radius * .31]); dot.scale.y = .3; }
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; add(loaf, new THREE.SphereGeometry(.007, 5, 4), toasted, [Math.cos(a) * radius * .14, .031, Math.sin(a) * radius * .14]); }
    return loaf;
  };
  for (const a of [3.2, 4.15, 5.05]) {
    const loaf = bread(.205); loaf.position.set(Math.sin(a) * .605, 1.72, Math.cos(a) * .605);
    loaf.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-Math.sin(a), .55, -Math.cos(a)).normalize()); group.add(loaf);
  }
  const bench = add(group, new THREE.BoxGeometry(.84, .15, .63), material('#8e623d'), [1.01, .38, .46]);
  for (const x of [.72, 1.30]) add(group, new THREE.BoxGeometry(.11, .36, .41), material('#795434'), [x, .17, .46]);
  for (let i = 0; i < 3; i++) { const loaf = bread(.25); loaf.position.set(.02 * i, .1 + i * .069, 0); loaf.rotation.y = i * .65; bench.add(loaf); }
  const paddle = new THREE.Group(); paddle.position.set(-.86, .15, .64); paddle.rotation.set(.16, -.3, -.23); group.add(paddle);
  add(paddle, new THREE.CylinderGeometry(.025, .03, 1.9, 10), material('#b58a54'), [0, .93, 0]);
  const peel = add(paddle, new THREE.SphereGeometry(.24, 20, 12), material('#bd965e'), [0, 1.97, 0]); peel.scale.set(.86, 1.1, .1);
  return { group, materials, textures, update: (time: number) => { glow.intensity = 3.2 + Math.sin(time * 6.7) * .35; } };
}
