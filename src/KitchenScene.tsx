import { observeViewport } from './viewport';
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { stageAt, TOTAL_DURATION } from './simulation';
import type { CookingState } from './simulation';
import { makeFlyRig } from './flyRig';
import { chefCue } from './chefPerformance';
import type { ChefAction, ChefCue, MotionClock } from './chefPerformance';
import type { NeuralSnapshot } from './neural';
import { EXTRA_FOOD, makeExtraFood, makeRecipeToppings } from './recipeFood';
import { makePlov, makeTandyr } from './kitchenDetails';
import { makeZirvak } from './zirvak';
import { makeTeaSet } from './teaSet';

export type CameraMode = 'yard' | 'qazan' | 'prep' | 'tandyr' | 'tea' | 'top';
export type { ChefAction } from './chefPerformance';
type SceneProps = { neural?: NeuralSnapshot | null; cueOverride?: RefObject<ChefCue>; cooking: CookingState; cameraMode: CameraMode; chefAction: ChefAction; resetView: number; thought: string; clock: RefObject<MotionClock>; follow: boolean; onManualCamera: () => void };

const colors = { sand: '#e5d5b9', clay: '#be7856', paleClay: '#d1a37e', teal: '#3a7877', darkTeal: '#285c59', wood: '#986640', darkWood: '#725034', cream: '#f0e4c8', green: '#708459' };

function seededRandom(seed = 17) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}

function makeTexture(kind: 'tile' | 'rug' | 'wood') {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  if (kind === 'tile') {
    ctx.fillStyle = '#d8d6b8'; ctx.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 64) for (let y = 0; y < 256; y += 64) {
      ctx.fillStyle = '#508986'; ctx.fillRect(x + 2, y + 2, 60, 60);
      ctx.strokeStyle = '#e6e4c8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 32, y + 6); ctx.lineTo(x + 58, y + 32); ctx.lineTo(x + 32, y + 58); ctx.lineTo(x + 6, y + 32); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = '#274f57';
      ctx.beginPath(); for (let p = 0; p < 16; p++) { const a = p * Math.PI / 8; const r = p % 2 ? 9 : 21; const px = x + 32 + Math.cos(a) * r; const py = y + 32 + Math.sin(a) * r; if (p === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d7b778'; ctx.beginPath(); ctx.arc(x + 32, y + 32, 4, 0, Math.PI * 2); ctx.fill();
    }
  } else if (kind === 'rug') {
    ctx.fillStyle = '#a35d45'; ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#e1c296'; ctx.lineWidth = 4; ctx.strokeRect(9, 9, 238, 238); ctx.strokeRect(21, 21, 214, 214);
    for (let x = 48; x < 256; x += 80) for (let y = 48; y < 256; y += 80) {
      ctx.fillStyle = '#ddb984'; ctx.beginPath(); ctx.moveTo(x, y - 23); ctx.lineTo(x + 23, y); ctx.lineTo(x, y + 23); ctx.lineTo(x - 23, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#486d60'; ctx.fillRect(x - 6, y - 6, 12, 12);
    }
  } else {
    ctx.fillStyle = '#b48455'; ctx.fillRect(0, 0, 256, 256);
    const random = seededRandom();
    for (let i = 0; i < 110; i++) { ctx.strokeStyle = `rgba(83,52,24,${random() * .17})`; ctx.lineWidth = random() * 2 + .5; const y = random() * 256; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(70, y + random() * 8, 180, y - random() * 8, 256, y); ctx.stroke(); }
    ctx.strokeStyle = '#7f5937'; ctx.lineWidth = 2; for (let y = 0; y < 256; y += 64) {ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();}
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createKitchen(host: HTMLDivElement, bubble: HTMLDivElement, getState: () => SceneProps) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b1115');
  scene.fog = new THREE.Fog('#0b1115', 18, 38);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  const mobileViewport = matchMedia('(max-width: 850px)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobileViewport ? 1.4 : 1.8));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.domElement.setAttribute('aria-label', 'Interactive 3D Uzbek courtyard: a fly chef, ingredient table, clay tandyr, and qazan of golden plov over a wood fire. Drag to orbit and scroll to zoom.');
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('tabindex', '0');
  host.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(35, 1, .1, 80);
  camera.position.set(9.6, 9.2, 12.8);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, .6, 0);
  controls.enableDamping = true;
  controls.dampingFactor = .07;
  controls.minDistance = 3.4; controls.maxDistance = 24;
  controls.maxPolarAngle = Math.PI / 2.1; controls.minPolarAngle = .12;
  controls.enablePan = false;
  controls.update();

  const textures: THREE.Texture[] = [];
  const materials: THREE.Material[] = [];
  const mat = (color: string, options: THREE.MeshStandardMaterialParameters = {}) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: .85, ...options }); materials.push(material); return material;
  };
  const tileTexture = makeTexture('tile'); textures.push(tileTexture);
  const rugTexture = makeTexture('rug'); textures.push(rugTexture);
  const woodTexture = makeTexture('wood'); textures.push(woodTexture);
  const tileMat = mat('#ffffff', { map: tileTexture });
  const woodMat = mat('#dfc19a', { map: woodTexture });
  const plasterMat = mat('#d5cbb5');
  const groundMat = mat('#d8cdb7');
  const stoneTrim = mat('#eee3ca');
  const darkIron = mat('#29282c', { metalness: .45, roughness: .7 });
  const trimIron = mat('#4b4948', { metalness: .6, roughness: .45 });
  const tealMat = mat(colors.teal);
  const creamMat = mat(colors.cream);
  const random = seededRandom();

  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    const object = new THREE.Mesh(geometry, material); object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  };
  const box = (w: number, h: number, d: number, material: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => mesh(new THREE.BoxGeometry(w, h, d), material, parent, x, y, z);
  const sphere = (r: number, material: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0, detail = 16) => mesh(new THREE.SphereGeometry(r, detail, Math.max(8, detail / 2)), material, parent, x, y, z);
  const cylinder = (r1: number, r2: number, h: number, material: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0, segments = 24) => mesh(new THREE.CylinderGeometry(r1, r2, h, segments), material, parent, x, y, z);
  const torus = (r: number, tube: number, material: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => mesh(new THREE.TorusGeometry(r, tube, 8, 40), material, parent, x, y, z);
  const rod = (from: THREE.Vector3, to: THREE.Vector3, radius: number, material: THREE.Material, parent: THREE.Object3D) => {
    const object = cylinder(radius, radius, from.distanceTo(to), material, parent); object.position.copy(from).add(to).multiplyScalar(.5); object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize()); return object;
  };

  // Cool night fill and a warm work light keep the food readable in the dark yard.
  scene.add(new THREE.HemisphereLight('#bbd6ec', '#0a1019', .95));
  const sunlight = new THREE.DirectionalLight('#ffe1b8', 2.1);
  sunlight.position.set(-3, 9, 5); sunlight.castShadow = true;
  const shadowSize = mobileViewport ? 1024 : 2048;
  sunlight.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(sunlight.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: .5, far: 25 });
  sunlight.shadow.normalBias = .035; sunlight.shadow.bias = -.0002;
  scene.add(sunlight);
  const fill = new THREE.DirectionalLight('#84c7df', 1.15); fill.position.set(5, 4, -5); scene.add(fill);
  const floor = mesh(new THREE.PlaneGeometry(200, 200), mat('#0b1115'), scene, 0, -.4, 0); floor.rotation.x = -Math.PI / 2;

  const yard = new THREE.Group(); scene.add(yard);
  box(10, .33, 7.4, mat('#111b22'), yard, 0, -.18, 0);
  box(9.9, .09, 7.3, groundMat, yard, 0, .025, 0);
  // Large, irregularly toned paving slabs.
  for (let x = 0; x < 10; x++) for (let z = 0; z < 7; z++) {
    const shade = new THREE.Color('#ded4c1').offsetHSL(0, 0, (random() - .5) * .035);
    box(.975, .025, 1.015, mat(`#${shade.getHexString()}`), yard, x - 4.5, .08, z * 1.04 - 3.12);
  }
  // A low courtyard wall frames the kitchen without hiding the food.
  box(10, 1.55, .25, plasterMat, yard, 0, .78, -3.55);
  box(.25, 1.55, 4.0, plasterMat, yard, -4.85, .78, -1.65);
  box(10.12, .14, .38, stoneTrim, yard, 0, 1.59, -3.55);
  box(.38, .14, 4.13, stoneTrim, yard, -4.85, 1.59, -1.65);
  for (let i = 0; i < 10; i++) box(.97, .62, .015, tileMat, yard, i - 4.5, .45, -3.412);
  for (let i = 0; i < 4; i++) box(.015, .62, .97, tileMat, yard, -4.712, .45, -3.1 + i);

  // A raised arch, with a recessed turquoise mosaic.
  const arch = new THREE.Shape(); arch.moveTo(-.82, 0); arch.lineTo(-.82, 1.15); arch.absarc(0, 1.15, .82, Math.PI, 0, true); arch.lineTo(.82, 0); arch.closePath();
  const archBack = mesh(new THREE.ExtrudeGeometry(arch, { depth: .18, bevelEnabled: true, bevelThickness: .055, bevelSize: .055, bevelSegments: 2, steps: 1 }), stoneTrim, yard, -2.35, .9, -3.66);
  const innerArch = mesh(new THREE.ShapeGeometry(arch), tealMat, archBack, 0, .07, .195); innerArch.scale.set(.78, .83, 1);
  box(1.18, .75, .02, tileMat, yard, -2.35, 1.45, -3.45);
  box(1.87, .13, .4, stoneTrim, yard, -2.35, .94, -3.43);
  const nicheJug = new THREE.Group(); nicheJug.position.set(-2.35, 1.03, -3.14); yard.add(nicheJug);
  sphere(.18, mat('#c18c60'), nicheJug, 0, .2, 0).scale.set(1, 1.2, 1);
  cylinder(.07, .09, .14, mat('#c18c60'), nicheJug, 0, .44, 0);

  // Carved prep table, complete with a hanging textile.
  const table = new THREE.Group(); table.position.set(-2.12, 0, -.18); yard.add(table);
  for (const x of [-1.38, 1.38]) for (const z of [-.54, .54]) {
    box(.16, 1.3, .16, mat(colors.darkWood), table, x, .73, z);
    cylinder(.12, .12, .17, mat(colors.wood), table, x, 1.02, z);
    box(.2, .08, .2, mat(colors.wood), table, x, .15, z);
  }
  box(2.86, .14, .12, mat(colors.darkWood), table, 0, .47, .54);
  box(3.15, .19, 1.53, woodMat, table, 0, 1.48, 0);
  box(3.0, .2, .07, mat(colors.darkWood), table, 0, 1.3, .65);
  const clothMat = mat('#e5d9ba');
  box(.78, .02, 1.5, clothMat, table, -.62, 1.59, 0);
  box(.78, .5, .035, clothMat, table, -.62, 1.34, .78);
  for (let i = 0; i < 3; i++) box(.03, .5, .04, tealMat, table, -.89 + i * .12, 1.34, .783);
  for (let i = 0; i < 13; i++) box(.017, .065, .02, clothMat, table, -1.0 + i * .06, 1.07, .783);

  const bowl = (parent: THREE.Object3D, x: number, y: number, z: number, radius: number, color = colors.teal) => {
    const group = new THREE.Group(); group.position.set(x, y, z); parent.add(group);
    const profile = [new THREE.Vector2(.08, 0), new THREE.Vector2(radius * .6, .025), new THREE.Vector2(radius * .91, radius * .32), new THREE.Vector2(radius, radius * .53), new THREE.Vector2(radius * .94, radius * .55), new THREE.Vector2(radius * .83, radius * .3), new THREE.Vector2(.05, .075)];
    mesh(new THREE.LatheGeometry(profile, 32), mat(color), group);
    cylinder(radius * .85, radius * .7, .025, creamMat, group, 0, radius * .32, 0);
    torus(radius * .975, .018, creamMat, group, 0, radius * .53, 0).rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const petal = sphere(.026, creamMat, group, Math.sin(a) * radius * .92, radius * .32, Math.cos(a) * radius * .92, 8); petal.scale.y = 1.7; }
    return group;
  };
  const extraShelf = box(3.2,.07,.5,woodMat,table,0,1.58,-1.02);
  const extraBowls = EXTRA_FOOD.map(id => { const portion=makeExtraFood(id);materials.push(...portion.materials);const dish=bowl(table,0,1.63,-1.02,.27);portion.group.position.y=.11;dish.add(portion.group);dish.name=id;return dish; });
  const riceBowl = bowl(table, -.95, 1.59, -.12, .42);
  const riceMat = mat('#f3e3b7');
  const grainGeometry = new THREE.CapsuleGeometry(.016, .055, 2, 4);
  const ricePile = new THREE.InstancedMesh(grainGeometry, riceMat, 220);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 220; i++) { const a = random() * Math.PI * 2; const r = Math.sqrt(random()) * .33; dummy.position.set(Math.cos(a) * r, .17 + (1-r/.38) * .1 + random() * .035, Math.sin(a) * r); dummy.rotation.set(random() * 3, random() * 3, random() * 3); dummy.updateMatrix(); ricePile.setMatrixAt(i, dummy.matrix); }
  ricePile.castShadow = true; riceBowl.add(ricePile);
  const meatBowl = bowl(table, .03, 1.59, -.27, .36, '#b77b60');
  const meatMat = mat('#b97257');
  for (let i = 0; i < 10; i++) { const piece = box(.13 + random() * .05, .12, .12, meatMat, meatBowl, (random()-.5)*.42, .15 + random()*.09, (random()-.5)*.4); piece.rotation.y = random()*3; }
  const cuttingBoard = box(.82, .055, .54, mat('#d5ab6e'), table, .54, 1.61, .05); cuttingBoard.rotation.y = -.13;
  const carrotMat = mat('#ee9a3e');
  const choppedCarrots: THREE.Mesh[] = [];
  for (let i = 0; i < 14; i++) { const carrot = box(.042, .038, .2 + random() * .1, carrotMat, table, .18 + random() * .25, 1.68 + random() * .035, -.05 + random() * .28); carrot.rotation.y = -.3 + random() * .6; carrot.userData={ x:carrot.position.x,y:carrot.position.y,z:carrot.position.z,phase:random()*Math.PI*2 };choppedCarrots.push(carrot); }
  const wholeCarrot=cylinder(.055,.025,.49,carrotMat,table,.68,1.70,-.04,10);wholeCarrot.rotation.x=Math.PI/2;
  const knifePivot = new THREE.Group(); knifePivot.position.set(1.08,1.69,.1); table.add(knifePivot);
  box(.03,.22,.35,mat('#c2c9c2',{metalness:.8,roughness:.27}),knifePivot,0,.14,-.07);
  box(.034,.035,.36,mat('#eef0dd',{metalness:.9,roughness:.15}),knifePivot,0,.04,-.07);
  box(.075,.085,.21,mat(colors.darkWood),knifePivot,0,.19,.21);
  for(const z of [.15,.25])sphere(.013,trimIron,knifePivot,.041,.19,z,8);
  knifePivot.rotation.z=Math.PI/2;
  const onions = new THREE.Group(); onions.position.set(-.27, 1.62, .43); table.add(onions);
  const onionMat = mat('#b291a1');
  for (const [x, z] of [[0, 0], [.27, -.04]]) { sphere(.135, onionMat, onions, x, .1, z).scale.y = .87; cylinder(.018, .04, .09, mat('#ac9970'), onions, x, .25, z); }
  const garlic = (parent: THREE.Object3D, x: number, y: number, z: number, size = 1) => {
    const group = new THREE.Group(); group.position.set(x, y, z); group.scale.setScalar(size); parent.add(group);
    for (let j = 0; j < 7; j++) { const a = j/7*Math.PI*2; sphere(.073, creamMat, group, Math.cos(a)*.065, .08, Math.sin(a)*.065, 10).scale.y = 1.3; }
    cylinder(.012, .038, .15, creamMat, group, 0, .22, 0); return group;
  };
  const tableGarlic = garlic(table, -.2, 1.61, -.65, .8);
  const oil = new THREE.Group(); oil.position.set(-1.36, 1.6, -.44); table.add(oil);
  cylinder(.1, .12, .32, mat('#ab9446', { transparent: true, opacity: .82 }), oil, 0, .17, 0);
  cylinder(.045, .09, .08, mat('#b9a657'), oil, 0, .37, 0);
  cylinder(.043, .043, .12, mat('#b9a657'), oil, 0, .46, 0);
  cylinder(.05, .05, .055, mat('#526145'), oil, 0, .53, 0);
  box(.13, .14, .006, creamMat, oil, 0, .17, .116);
  const tableSpice = bowl(table, .53, 1.59, -.45, .16, '#af7853');

  // Cast-iron qazan over a clay wood-fired hearth.
  const cooker = new THREE.Group(); cooker.position.set(1.48, .1, .48); yard.add(cooker);
  cylinder(1.02, 1.13, .13, mat('#b5a081'), cooker, 0, .08, 0, 12);
  const stoveMat = mat('#bb8060');
  mesh(new THREE.CylinderGeometry(.79, .96, .99, 32, 1, false, .63, Math.PI * 2 - 1.26), stoveMat, cooker, 0, .6, 0);
  cylinder(.8, .8, .13, mat('#a16749'), cooker, 0, 1.13, 0);
  cylinder(.66, .66, .025, mat('#312c21'), cooker, 0, .14, 0);
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 12; i++) { const a = .7 + (i + (row % 2) * .3) / 12 * 4.85; const r = .932 - row * .055; const mortar = box(.02, .28, .014, mat('#c79671'), cooker, Math.sin(a)*r, .27+row*.3, Math.cos(a)*r); mortar.rotation.y = a; }
    const seam = mesh(new THREE.TorusGeometry(.925-row*.055, .012, 4, 40, 5.02), mat('#c79671'), cooker, 0, .18+row*.3, 0); seam.rotation.x = Math.PI/2; seam.rotation.z = -Math.PI/2+.63;
  }
  const logs: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) { const log = cylinder(.095, .1, 1.02, mat(i % 2 ? '#382b24' : '#493126', {emissive:'#e7450b',emissiveIntensity:.2}), cooker, (i - 1.5)*.16, .25 + (i%2)*.08, .23); log.rotation.x = Math.PI/2; log.rotation.z = (i-1.5)*.27; logs.push(log); }
  const fireLight = new THREE.PointLight('#ff9a34', 7, 4.5, 2); fireLight.position.set(0, .55, .5); cooker.add(fireLight);
  const flames: THREE.Mesh[] = [];
  const flameGeometry=new THREE.LatheGeometry([[0,0],[.55,.035],[.92,.17],[.68,.39],[.34,.65],[.14,.83],[0,1]].map(([x,y])=>new THREE.Vector2(x,y)),10);
  const flameOuter=new THREE.MeshBasicMaterial({color:'#ff761b',transparent:true,opacity:.72,depthWrite:false,toneMapped:false});
  const flameCore=new THREE.MeshBasicMaterial({color:'#ffe895',transparent:true,opacity:.92,depthWrite:false,toneMapped:false});
  materials.push(flameOuter,flameCore);
  for (let i = 0; i < (mobileViewport?10:15); i++) {
    const flame = mesh(flameGeometry,flameOuter,cooker,(random()-.5)*.64,.32,(random()-.5)*.4+.31);
    flame.castShadow=flame.receiveShadow=false;
    flame.scale.set(.09+random()*.085,.46+random()*.45,.09+random()*.045);
    const core=new THREE.Mesh(flameGeometry,flameCore);core.scale.set(.55,.7,.55);core.position.y=.025;flame.add(core);
    flame.userData = { base: flame.scale.y, width:flame.scale.x, phase: random()*Math.PI*2 }; flames.push(flame);
  }
  const sparkMat = new THREE.PointsMaterial({ color: '#ffc86d', size: .027, transparent: true, opacity: .8, depthWrite:false, toneMapped:false, vertexColors:true }); materials.push(sparkMat);
  const sparkGeometry = new THREE.BufferGeometry(); const sparkPositions = new Float32Array(36*3),sparkColors=new Float32Array(36*3);sparkGeometry.setAttribute('color',new THREE.BufferAttribute(sparkColors,3)); sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3)); const sparks = new THREE.Points(sparkGeometry, sparkMat); cooker.add(sparks);
  const qazanProfile: THREE.Vector2[] = [];
  for (let i=0; i<=20; i++) { const a=i/20*Math.PI/2; qazanProfile.push(new THREE.Vector2(Math.max(.01, Math.sin(a)*1.02), .72*(1-Math.cos(a)))); }
  for (let i=20; i>=0; i--) { const a=i/20*Math.PI/2; qazanProfile.push(new THREE.Vector2(Math.max(.01, Math.sin(a)*.955), .07+.65*(1-Math.cos(a)))); }
  const qazan = mesh(new THREE.LatheGeometry(qazanProfile, 64), darkIron, cooker, 0, 1.13, 0);
  torus(1.02, .055, trimIron, qazan, 0, .72, 0).rotation.x = Math.PI/2;
  for (const side of [-1, 1]) { const handle = torus(.2, .048, darkIron, qazan, side*1.09, .64, 0); handle.rotation.y = Math.PI/2; box(.13, .11, .28, darkIron, qazan, side*.985, .61, 0); }
  const zirvak = makeZirvak(mobileViewport);
  qazan.add(zirvak.group); materials.push(...zirvak.materials); textures.push(...zirvak.textures);
  const plovModel = makePlov(); const plov = plovModel.group;
  const toppings=makeRecipeToppings();qazan.add(toppings.group);materials.push(...toppings.materials);
  plov.position.y = .64; qazan.add(plov); materials.push(...plovModel.materials); textures.push(...plovModel.textures);
  const spoonPivot = new THREE.Group(); spoonPivot.position.set(0, .59, 0); qazan.add(spoonPivot);
  const spoon = new THREE.Group(); spoon.rotation.z = -.65; spoonPivot.add(spoon);
  cylinder(.032, .036, 1.30, mat('#a67c49'), spoon, 0, .67, 0);
  sphere(.13, mat('#a67c49'), spoon, 0, .04, 0).scale.set(.7, 1.4, .35);
  const lid=new THREE.Group();lid.position.set(0,1.87,0);cooker.add(lid);lid.visible=false;
  const lidDome=sphere(1.015,darkIron,lid);lidDome.scale.y=.16;
  torus(1.01,.03,trimIron,lid).rotation.x=Math.PI/2;
  cylinder(.095,.13,.08,mat('#6c5436'),lid,0,.23,0);


  const tandyr = makeTandyr(); tandyr.group.position.set(2.15, .1, -2.17); tandyr.group.scale.setScalar(.94); yard.add(tandyr.group);
  materials.push(...tandyr.materials); textures.push(...tandyr.textures);

  // A handwoven rug, extra firewood, tea, and a little courtyard greenery.
  const rug = box(2.4,.025,1.75,mat('#ffffff',{map:rugTexture}),yard,1.25,.11,2.5); rug.rotation.y=-.09;
  for(let i=0;i<24;i++) { const fringe=box(.035,.015,.12,creamMat,yard, .08+i*.099,.115,3.4); fringe.rotation.y=-.09; }
  const stool=new THREE.Group();stool.position.set(-2.2,.12,2.24);yard.add(stool);
  cylinder(.44,.47,.12,woodMat,stool,0,.58,0);
  for(let i=0;i<3;i++){const a=i/3*Math.PI*2;rod(new THREE.Vector3(Math.sin(a)*.27,.55,Math.cos(a)*.27),new THREE.Vector3(Math.sin(a)*.36,0,Math.cos(a)*.36),.055,mat(colors.darkWood),stool);}
  const teaSet=makeTeaSet(); teaSet.group.position.set(0,.65,0); stool.add(teaSet.group);
  materials.push(...teaSet.materials); textures.push(...teaSet.textures);
  const firewood=new THREE.Group();firewood.position.set(3.84,.12,-.75);yard.add(firewood);
  for(let row=0;row<3;row++)for(let i=0;i<3-row;i++){const log=cylinder(.115,.12,.86,mat(colors.wood),firewood,i*.25+row*.12,row*.19+.12,0,9);log.rotation.x=Math.PI/2;const end=cylinder(.086,.086,.006,mat('#d1b081'),firewood,i*.25+row*.12,row*.19+.12,.434,9);end.rotation.x=Math.PI/2;}
  const plant=(x:number,z:number,scale=1)=>{const group=new THREE.Group();group.position.set(x,.11,z);group.scale.setScalar(scale);yard.add(group);cylinder(.26,.18,.43,mat(colors.clay),group,0,.22,0);torus(.265,.032,mat('#c99471'),group,0,.43,0).rotation.x=Math.PI/2;cylinder(.225,.225,.012,mat('#625840'),group,0,.427,0);for(let i=0;i<9;i++){const a=i/9*Math.PI*2;const leaf=sphere(.12,mat(i%2?'#778a58':'#586f48'),group,Math.cos(a)*.2,.65+random()*.22,Math.sin(a)*.2,8);leaf.scale.set(.6,2.7,.55);leaf.rotation.z=Math.cos(a)*-.7;leaf.rotation.x=Math.sin(a)*.7;}return group;};
  plant(4,-2.95,1.5);plant(-4.15,-2.68,1.1);plant(4.25,2.65,.7);
  const sack=sphere(.38,mat('#b4aa7b'),yard,-3.94,.49,-.1);sack.scale.set(.9,1.2,.85);cylinder(.2,.26,.13,creamMat,yard,-3.94,.92,-.1);
  const serving=bowl(yard,3.25,.13,1.47,.49);
  cylinder(.35,.35,.015,tealMat,serving,0,.17,0);

  // A stable work platform keeps all four supporting feet clear of the hot qazan.
  const workStep = new THREE.Group(); workStep.position.set(2.97, 0, 1.15); yard.add(workStep);
  box(1.10, .12, 1.05, woodMat, workStep, 0, 1.76, 0);
  for (const x of [-.43, .43]) for (const z of [-.4, .4]) box(.12, 1.63, .12, mat(colors.darkWood), workStep, x, .89, z);
  for (const y of [.43, .88, 1.29]) box(.89, .07, .06, mat(colors.wood), workStep, 0, y, .43);
  box(.88, .05, .3, woodMat, workStep, 0, .88, .57);
  const rig = makeFlyRig(); const fly = rig.group; scene.add(fly);
  materials.push(...rig.materials); textures.push(...rig.textures);
  const stations = {
    yard: { position: new THREE.Vector3(0, .13 + .54 * .94, 2.5), yaw: .3 },
    prep: { position: new THREE.Vector3(-.97, 1.575 + .54 * .94, .14), yaw: -Math.PI / 2 },
    qazan: { position: new THREE.Vector3(2.97, 1.82 + .54 * .94, 1.15), yaw: -1.98 },
  };
  const carriedCarrots = new THREE.Group(); scene.add(carriedCarrots);
  for (let i = 0; i < 5; i++) box(.045, .045, .28, carrotMat, carriedCarrots, (i % 3 - 1) * .047, Math.floor(i / 3) * .045, 0);
  const carriedBowl = bowl(scene, 0, 0, 0, .23);
  const bowlRice = cylinder(.19, .19, .035, mat('#f3d38b'), carriedBowl, 0, .105, 0);
  const riceStream = new THREE.InstancedMesh(grainGeometry, riceMat, 48); scene.add(riceStream);
  const grips: [THREE.Vector3, THREE.Vector3] = [new THREE.Vector3(), new THREE.Vector3()];
  const spoonBowl = new THREE.Vector3(), spoonDirection = new THREE.Vector3(), toolAnchor = new THREE.Vector3();
  const support = new THREE.Vector3(), fromPosition = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  let last=performance.now(), time=0, cameraChange=0, currentMode=getState().cameraMode, currentReset=getState().resetView;
  let wasFollowing = false, manualCamera = false;
  const destCamera=new THREE.Vector3().copy(camera.position), destTarget=new THREE.Vector3().copy(controls.target);
  const projected=new THREE.Vector3(); fly.position.copy(stations.prep.position); let disposed=false;
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const intersection=observeViewport(host);
  const resize=()=>{const w=host.clientWidth;const h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();currentReset=-1;};
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  const onControl=()=>{cameraChange=0; manualCamera=true; getState().onManualCamera();};controls.addEventListener('start',onControl);
  const onKey=(event:KeyboardEvent)=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(event.key))return;event.preventDefault();onControl();const offset=camera.position.clone().sub(controls.target);const spherical=new THREE.Spherical().setFromVector3(offset);if(event.key==='ArrowLeft')spherical.theta-=.13;if(event.key==='ArrowRight')spherical.theta+=.13;if(event.key==='ArrowUp')spherical.phi=Math.max(.15,spherical.phi-.1);if(event.key==='ArrowDown')spherical.phi=Math.min(Math.PI/2.1,spherical.phi+.1);if(event.key==='+')spherical.radius=Math.max(3.4,spherical.radius-.6);if(event.key==='-')spherical.radius=Math.min(24,spherical.radius+.6);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));controls.update();};renderer.domElement.addEventListener('keydown',onKey);
  const animate=()=>{
    if(disposed)return;
    const now=performance.now();const dt=Math.min((now-last)/1000,.05);last=now;if(!intersection.canRender())return;
    const state=getState();const c=state.cooking;const done=c.elapsed>=TOTAL_DURATION;const stage=stageAt(c.elapsed);
    const clock=state.clock.current;
    const taskTime=clock.time;
    const cue=state.cueOverride?.current ?? chefCue(c,state.chefAction,clock.elapsed);
    if(!reducedMotion.matches) time+=dt*.7;
    const chopActive=cue.action==='chopping', stirActive=cue.action==='stirring', flying=cue.action==='flying';
    const grooming=!reducedMotion.matches&&cue.action==='watching'&&!cue.carrying&&(!cue.task||cue.task==='wait');
    const groomProgress=cue.task?cue.progress:(taskTime*.45)%1;
    const groomAmount=grooming?THREE.MathUtils.smoothstep(groomProgress,0,.18)*(1-THREE.MathUtils.smoothstep(groomProgress,.85,1)):0;
    host.dataset.chefAction=cue.action;
    host.dataset.animationTime=taskTime.toFixed(2);
    host.dataset.locomotion=flying?'flying':'planted';
    host.dataset.supportLegs=flying?'0':chopActive||stirActive||cue.carrying||groomAmount>.02?'4':'6';
    host.dataset.grooming=String(groomAmount>.02);
    if(currentMode!==state.cameraMode||currentReset!==state.resetView){currentMode=state.cameraMode;currentReset=state.resetView;cameraChange=1;manualCamera=false;
      if(currentMode==='yard'){destCamera.set(9.6,9.2,12.8);destTarget.set(0,.6,0);}
      if(currentMode==='qazan'){destCamera.set(1.1,4.5,6.4);destTarget.set(2.0,1.85,.75);}
      if(currentMode==='prep'){destCamera.set(-3.4,4.4,4.8);destTarget.set(-1.23,1.85,.05);}
      if(currentMode==='tandyr'){destCamera.set(5.5,5.8,3.4);destTarget.set(2.15,1.1,-1.8);}
      if(currentMode==='tea'){destCamera.set(-1.6,2.25,5.6);destTarget.set(-2.24,1.03,2.22);}
      if(currentMode==='top'){destCamera.set(.1,16,.8);destTarget.set(0,0,0);}
      if(camera.aspect<1.15&&currentMode!=='top') destCamera.sub(destTarget).multiplyScalar(1.18).add(destTarget);
    }
    const fireScale=c.heat > 0 ? .3+c.heat/100*.85 : 0;
    sparks.visible=c.heat > 0;
    const fireTime=reducedMotion.matches?0:time;
    for(let i=0;i<flames.length;i++){
      const f=flames[i],phase=f.userData.phase;
      f.visible=c.heat > 0;
      f.scale.y=f.userData.base*fireScale*(1+Math.sin(fireTime*8+phase)*.18+Math.sin(fireTime*13+phase*2)*.08);
      f.scale.x=f.userData.width*(1+Math.sin(fireTime*7+phase)*.16);
      f.rotation.z=Math.sin(fireTime*5+phase)*.2;f.rotation.x=Math.sin(fireTime*4+phase)*.14;
      f.children[0].scale.y=.64+Math.sin(fireTime*11+phase)*.08;
    }
    fireLight.intensity=c.heat > 0 ? (1.4+c.heat*.045)*(1+Math.sin(fireTime*15)*.1+Math.sin(fireTime*7)*.06) : 0;
    logs.forEach((log,i)=>{(log.material as THREE.MeshStandardMaterial).emissiveIntensity=c.heat/100*(.27+Math.sin(fireTime*2+i)*.1);});
    sparkMat.opacity=c.heat/100*.9;
    host.dataset.fireFlames=String(c.heat>0?flames.length:0);
    host.dataset.fireIntensity=fireLight.intensity.toFixed(3);
    host.dataset.fireAnimationTime=fireTime.toFixed(3);
    tandyr.update(time);
    for(let i=0;i<36;i++){const progress=(fireTime*(.32+c.heat/350)+i/36)%1;sparkPositions[i*3]=Math.sin(i*13.4)*.3+Math.sin(fireTime+i)*progress*.15;sparkPositions[i*3+1]=.32+progress*.78;sparkPositions[i*3+2]=.4+Math.cos(i*17)*.2;sparkColors[i*3]=1-progress*.65;sparkColors[i*3+1]=.85*(1-progress);sparkColors[i*3+2]=.4*(1-progress);}sparkGeometry.attributes.position.needsUpdate=true;sparkGeometry.attributes.color.needsUpdate=true;
    for (const [id, object] of Object.entries({rice:riceBowl,lamb:meatBowl,onion:onions,garlic:tableGarlic,oil,spice:tableSpice})) object.visible = !state.neural || state.neural.world.available.includes(id as typeof c.added[number]);
    const extras=state.neural?.world.required_ingredients.filter(id=>(EXTRA_FOOD as readonly string[]).includes(id)) ?? [];
    extraShelf.visible=extras.length>0;
    for(const dish of extraBowls){const index=extras.indexOf(dish.name as typeof c.added[number]);dish.visible=index>=0 && !!state.neural?.world.available.includes(dish.name as typeof c.added[number]);dish.position.x=(index-(extras.length-1)/2)*.75;}
    toppings.update(state.neural ? c.added : []);
    const showCarrot = !state.neural || state.neural.world.available.includes('carrot') || chopActive;
    wholeCarrot.visible = showCarrot;
    choppedCarrots.forEach(object => { object.visible = showCarrot && (!state.neural || state.neural.world.carrot_chops > 0 || chopActive); });
    const dishPreview=!c.started&&c.added.length===0;
    plovModel.update(state.neural ? c.added : null, state.neural?.world.burn ?? 0);
    host.dataset.neuralTime=String(state.neural?.neural.simulated_seconds ?? 0);
    plov.scale.y=.85+.15*(state.neural?.world.quantities?.rice?.factor??1);
    const covered=state.neural ? state.neural.world.covered : c.started&&stage===5&&!done&&state.chefAction==='auto';
    const lidProgress=cue.task==='cover'?cue.progress:cue.task==='uncover'?1-cue.progress:covered?1:0;
    const lidClosure=THREE.MathUtils.smoothstep(lidProgress,0,1);
    plov.visible=(dishPreview||c.added.includes('rice'))&&lidClosure<.995;
    toppings.group.visible=lidClosure<.995;
    // Settle the heaped rice and tall garnishes below the descending dome.
    plov.position.y=.64-lidClosure*.36;
    toppings.group.position.y=-lidClosure*.36;
    spoonPivot.visible=stirActive;
    lid.visible=lidClosure>0;
    const world = state.neural?.world;
    const qazanState = zirvak.update({
      added: c.added,
      temperature: world?.temperature ?? (!c.started ? 22 : stage >= 3 ? 98 : Math.min(140, 22 + c.elapsed * 12)),
      water: world?.water ?? (c.started && stage >= 3 ? .4 : 0),
      covered,
      hydration: world?.hydration ?? (stage >= 5 ? .95 : 0),
      browning: world?.browning ?? Math.min(1, Math.max(0, (c.elapsed - 10) / 18)),
      burn: world?.burn ?? 0,
    }, taskTime, stirActive, reducedMotion.matches);
    lid.position.set((1-lidClosure)*.45,1.87+(1-lidClosure)*1.1+(reducedMotion.matches?0:Math.sin(taskTime*8)*.002*qazanState.steam),0);
    lid.rotation.z=(1-lidClosure)*-.18;
    host.dataset.qazanCovered=String(covered);
    host.dataset.qazanFoodVisible=String(plov.visible||toppings.group.visible&&c.added.some(id=>(EXTRA_FOOD as readonly string[]).includes(id)));
    host.dataset.qazanPhase=qazanState.phase;
    host.dataset.qazanBubbles=String(qazanState.visibleBubbles);
    host.dataset.qazanSteam=qazanState.steam.toFixed(3);
    host.dataset.qazanAnimationTime=(reducedMotion.matches?0:taskTime).toFixed(3);


    // Feet never orbit with the spoon. Only a transfer between stations uses flight.
    const station=stations[cue.station]; support.copy(station.position);
    let yaw=station.yaw;
    if(flying){
      const p=cue.progress, ease=p*p*(3-2*p);
      fromPosition.copy(stations[cue.from].position);
      support.lerpVectors(fromPosition,station.position,ease);
      support.y+=Math.sin(ease*Math.PI)**2*1.05;
      const travelYaw=Math.atan2(station.position.x-fromPosition.x,station.position.z-fromPosition.z);
      const launch=THREE.MathUtils.smoothstep(p,0,.25),turn=THREE.MathUtils.smoothstep(p,.72,1);
      const startYaw=stations[cue.from].yaw;
      yaw=startYaw+Math.atan2(Math.sin(travelYaw-startYaw),Math.cos(travelYaw-startYaw))*launch;
      yaw+=Math.atan2(Math.sin(station.yaw-yaw),Math.cos(station.yaw-yaw))*turn;
    }
    fly.position.copy(support); fly.rotation.set(0,yaw,0);
    fly.updateMatrixWorld(true);
    let hasGrip=false;
    const chopBeat=(1-Math.cos(taskTime*7.5))*.5;
    knifePivot.rotation.set(chopActive?-.05+chopBeat*.12:0,0,chopActive?0:Math.PI/2);
    knifePivot.position.set(chopActive?.62:1.27,chopActive?1.64+chopBeat*.22:1.71,chopActive?.12:.1);
    for(const carrot of choppedCarrots){
      const bounce=chopActive?Math.max(0,Math.cos(taskTime*7.5+carrot.userData.phase*.12)-.82)*.18:0;
      carrot.position.y=carrot.userData.y+bounce;carrot.rotation.z=chopActive?bounce*.8:0;
    }
    wholeCarrot.scale.y=chopActive?.85:1;
    if(chopActive){
      knifePivot.updateWorldMatrix(true,false);
      // Near foreleg wraps the wooden handle; the other steadies the carrot behind the blade.
      grips[1].set(0,.19,.22).applyMatrix4(knifePivot.matrixWorld);
      grips[0].set(.68,1.75,-.19).applyMatrix4(table.matrixWorld);
      hasGrip=true;
    }
    if(stirActive){
      const phase=taskTime*1.65;
      spoonBowl.set(1.55+Math.cos(phase)*.16,1.87,.48+Math.sin(phase)*.28);
      toolAnchor.set(2.36,2.24,.93);
      spoonDirection.copy(toolAnchor).sub(spoonBowl).normalize();
      spoonPivot.position.copy(qazan.worldToLocal(spoonBowl.clone()));
      spoonPivot.rotation.set(0,0,0); spoon.rotation.set(0,0,0);
      spoon.quaternion.setFromUnitVectors(up,spoonDirection);
      grips[0].copy(spoonBowl).addScaledVector(spoonDirection,1.03);
      grips[1].copy(spoonBowl).addScaledVector(spoonDirection,1.20);
      hasGrip=true;
      plov.rotation.y=taskTime*.08;
    }
    carriedCarrots.visible=cue.carrying==='carrot'; carriedBowl.visible=!!cue.carrying&&cue.carrying!=='carrot'; riceStream.visible=cue.action==='pouring'&&cue.carrying==='rice'&&cue.progress>.2&&cue.progress<.94;
    const cargoColors = {rice:'#f3d38b',oil:'#cfad37',onion:'#c9989e',lamb:'#9c6744',spice:'#91734b',garlic:'#f4e8c3',carrot:'#ea9a42',quince:'#deb64f',chickpea:'#d8bd7c',raisin:'#775347',egg:'#efe2b6',qazi:'#915a45',quail:'#bb8050'};
    (bowlRice.material as THREE.MeshStandardMaterial).color.set(cargoColors[cue.carrying ?? 'rice']);
    if(cue.carrying){
      const carried=cue.carrying==='carrot'?carriedCarrots:carriedBowl;
      const pourBlend=cue.action==='pouring'?THREE.MathUtils.smoothstep(cue.progress,0,.25)*(1-THREE.MathUtils.smoothstep(cue.progress,.8,1)):0;
      carried.position.copy(fly.localToWorld(new THREE.Vector3(0,-.15+.25*pourBlend,.56)));
      carried.quaternion.setFromAxisAngle(up,yaw);
      carried.rotateX(pourBlend*(.95+Math.sin(taskTime*2)*.06));
      carried.updateMatrixWorld(true);
      grips[0].set(-.2,.09,0).applyMatrix4(carried.matrixWorld);
      grips[1].set(.2,.09,0).applyMatrix4(carried.matrixWorld);
      if(cue.carrying==='carrot'){grips[0].set(-.09,.035,0).applyMatrix4(carried.matrixWorld);grips[1].set(.09,.035,0).applyMatrix4(carried.matrixWorld);}
      hasGrip=true;
      bowlRice.visible=cue.progress<.94;
      if(riceStream.visible){
        const start=carried.localToWorld(new THREE.Vector3(0,.12,.19));
        for(let i=0;i<48;i++){
          const p=(taskTime*.95+i/48)%1;
          dummy.position.set(start.x+(1.8-start.x)*p+Math.sin(i*43)*.08,THREE.MathUtils.lerp(start.y,1.91,p*p),start.z+(.58-start.z)*p+Math.cos(i*27)*.07);
          dummy.rotation.set(i,taskTime+i,i*.7);dummy.scale.setScalar(1);dummy.updateMatrix();riceStream.setMatrixAt(i,dummy.matrix);
        }
        riceStream.instanceMatrix.needsUpdate=true;
      }
    }
    rig.pose(reducedMotion.matches?0:taskTime,flying,hasGrip?grips:null,support,yaw,chopActive||stirActive||cue.action==='pouring',groomAmount);
    host.dataset.forelegTips=rig.getForelegTips().map(n=>n.toFixed(4)).join(',');
    host.dataset.gripError=rig.getGripError().toFixed(4);
    host.dataset.flyPosition=fly.position.toArray().map(n=>n.toFixed(3)).join(',');
    host.dataset.toolPosition=(stirActive?spoonBowl:knifePivot.position).toArray().map(n=>n.toFixed(3)).join(',');

    // A gentle director camera composes the working feet, tool, and cooking surface together.
    if(state.follow&&!wasFollowing) manualCamera=false;
    const following=state.follow&&!manualCamera;
    if(following){
      const close=cue.station==='prep';
      if(flying){destTarget.copy(fly.position);destTarget.y-=.15;destCamera.copy(destTarget).add(new THREE.Vector3(3.8,3.1,5.1));}
      else if(cue.station==='yard'){destTarget.copy(fly.position);destCamera.copy(fly.position).add(new THREE.Vector3(3.4,2.3,4.5));}
      else if(close){destTarget.set(-1.22,2.22,.06);destCamera.set(-3.3,4.37,4.3);}
      else {destTarget.set(2.08,2.22,.72);destCamera.set(.95,4.27,5.8);}
      // Portrait framing steps back just enough to retain both the fly and its tool.
      if(camera.aspect<1.15) destCamera.sub(destTarget).multiplyScalar(1.28).add(destTarget);
      if(!reducedMotion.matches&&cue.active&&!flying){
        const drift=Math.sin(taskTime*.16)*.12;
        destCamera.x+=drift;destCamera.z-=drift*.5;
      }
      if(cue.active||!wasFollowing) cameraChange=1;
    }
    if(cameraChange){
      const blend=reducedMotion.matches?1:1-Math.exp(-dt*(following?1.8:2.8));
      camera.position.lerp(destCamera,blend);controls.target.lerp(destTarget,blend);
      if(camera.position.distanceTo(destCamera)<.005){camera.position.copy(destCamera);controls.target.copy(destTarget);cameraChange=0;}
    }
    wasFollowing=following;
    controls.update();
    host.dataset.cameraMode=following?'director':currentMode;
    host.dataset.cameraPosition=camera.position.toArray().map(n=>n.toFixed(3)).join(',');
    projected.copy(fly.position);projected.y+=1.05;projected.project(camera);
    const bx=(projected.x*.5+.5)*host.clientWidth;const by=(-projected.y*.5+.5)*host.clientHeight;
    const inset=bubble.offsetWidth/2+14;
    const bubbleX=THREE.MathUtils.clamp(bx,inset,host.clientWidth-inset);
    // Keep the text above the do'ppi instead of pushing it down into the hat
    // when a wrapped line makes the speech balloon taller.
    const hatTop=fly.localToWorld(new THREE.Vector3(0,.65,.31)).project(camera);
    const hatY=(-hatTop.y*.5+.5)*host.clientHeight;
    const bubbleY=Math.min(Math.max(by,bubble.offsetHeight+70),hatY-18);
    host.dataset.hatScreenY=hatY.toFixed(2);
    bubble.style.transform=`translate(${bubbleX}px, ${bubbleY}px) translate(-50%, -100%)`;
    bubble.style.opacity=currentMode!=='tea'&&projected.z<1&&by>0&&by<host.clientHeight&&bx>0&&bx<host.clientWidth?'1':'0';
    renderer.render(scene,camera);
  };renderer.setAnimationLoop(animate);
  return ()=>{disposed=true;renderer.setAnimationLoop(null);observer.disconnect();intersection.disconnect();controls.dispose();renderer.domElement.removeEventListener('keydown',onKey);const geometries=new Set<THREE.BufferGeometry>();scene.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Points)geometries.add(object.geometry);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.domElement.remove();};
}

export default function KitchenScene(props: SceneProps) {
  const host=useRef<HTMLDivElement>(null);const bubble=useRef<HTMLDivElement>(null);const latest=useRef(props);
  const [error,setError]=useState(false);
  useEffect(()=>{latest.current=props;},[props]);
  useEffect(()=>{if(!host.current||!bubble.current)return;try{return createKitchen(host.current,bubble.current,()=>latest.current);}catch(error){console.error('Kitchen renderer could not start',error);setError(true);}},[]);
  return <div className="scene-viewport"><div ref={host} className="canvas-host"/><div ref={bubble} className="fly-thought"><span className="thought-dot"/>{props.thought}</div>{error&&<div className="scene-error"><span>Our little kitchen needs WebGL.</span><p>Try a browser with hardware acceleration enabled. You can still follow the recipe below.</p></div>}</div>;
}
