import * as THREE from 'three';
import { makeDoppi } from './doppi';

const UP = new THREE.Vector3(0, 1, 0);

/** Two fixed-length limb segments, with a stable outward bend. */
export function solveLeg(hip: THREE.Vector3, target: THREE.Vector3, bend: THREE.Vector3, upper = .31, lower = .36) {
  const direction = target.clone().sub(hip);
  const distance = THREE.MathUtils.clamp(direction.length(), .055, upper + lower - .0001);
  direction.normalize();
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
  const across = Math.sqrt(Math.max(0, upper * upper - along * along));
  const normal = bend.clone().addScaledVector(direction, -bend.dot(direction)).normalize();
  return { knee: hip.clone().addScaledVector(direction, along).addScaledVector(normal, across), ankle: hip.clone().addScaledVector(direction, distance) };
}

export function makeFlyRig() {
  const group = new THREE.Group();
  group.name = 'Palovbek — six-legged fly';
  group.scale.setScalar(.94);
  const materials: THREE.Material[] = [];
  const material = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => {
    const result = new THREE.MeshStandardMaterial({ color, roughness: .8, ...extra }); materials.push(result); return result;
  };
  const shell = material('#68503a'), abdomenMat = material('#9a7849'), jointMat = material('#433d30'), cream = material('#f1e7cc');
  const add = (geometry: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    const object = new THREE.Mesh(geometry, mat); object.position.set(x, y, z); object.castShadow = object.receiveShadow = true; parent.add(object); return object;
  };
  const ball = (r: number, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => add(new THREE.SphereGeometry(r, 20, 12), mat, parent, x, y, z);
  const segmentGeometry = new THREE.CylinderGeometry(1, 1, 1, 7);
  const segment = (parent: THREE.Object3D, radius: number, mat = jointMat) => {
    const mesh = add(segmentGeometry, mat, parent); mesh.userData.radius = radius; return mesh;
  };
  const placeSegment = (mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) => {
    const delta = b.clone().sub(a); mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.scale.set(mesh.userData.radius, delta.length(), mesh.userData.radius);
    mesh.quaternion.setFromUnitVectors(UP, delta.normalize());
  };
  const fixedRod = (a: THREE.Vector3, b: THREE.Vector3, r: number, parent: THREE.Object3D, mat = jointMat) => {
    const mesh = segment(parent, r, mat); placeSegment(mesh, a, b); return mesh;
  };

  // Distinct abdomen, thorax, and head. All three leg pairs attach to the thorax.
  ball(.29, abdomenMat, group, 0, -.015, -.37).scale.set(.79, .84, 1.38);
  for (const [z, radius] of [[-.25, .224], [-.39, .223], [-.53, .2], [-.65, .13]]) {
    const band = add(new THREE.TorusGeometry(radius, .014, 6, 32), shell, group, 0, -.015, z); band.scale.x = .92;
  }
  ball(.245, shell, group, 0, .055, .005).scale.set(.9, 1.04, 1.12);
  const head = new THREE.Group(); head.position.set(0, .17, .31); group.add(head);
  ball(.235, shell, head).scale.set(1.05, .9, .88);
  const eyeMaterial = material('#b94d38', { roughness: .47 });
  const eyeGeometry = new THREE.IcosahedronGeometry(.164, 3);
  for (const side of [-1, 1]) {
    add(eyeGeometry, eyeMaterial, head, side * .17, .015, .1).scale.set(.75, 1, .91);
    ball(.029, cream, head, side * .213, .081, .209);
    // Short antennae with a fine arista, clear of the hat.
    ball(.034, abdomenMat, head, side * .07, .08, .225).scale.set(.8, .75, 1.2);
    fixedRod(new THREE.Vector3(side * .07, .085, .235), new THREE.Vector3(side * .1, .19, .29), .006, head);
    fixedRod(new THREE.Vector3(side * .08, .13, .257), new THREE.Vector3(side * .15, .155, .28), .004, head);
    // A single pair of wings, plus the small balancing halteres behind them.
    fixedRod(new THREE.Vector3(side * .16, .09, -.17), new THREE.Vector3(side * .25, .14, -.23), .01, group);
    ball(.027, abdomenMat, group, side * .25, .14, -.23);
  }
  ball(.047, shell, head, 0, -.105, .2).scale.set(.7, .8, 1);
  const doppi = makeDoppi(); doppi.group.position.set(0, .20, -.015); doppi.group.scale.set(.82, .61, .82); head.add(doppi.group);
  materials.push(...doppi.materials);

  const wingMaterial = material('#e5e8db', { transparent: true, opacity: .53, roughness: .35, side: THREE.DoubleSide, depthWrite: false });
  const veinMaterial = material('#9b9f86', { transparent: true, opacity: .65 });
  const wings: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Group(); wing.position.set(side * .13, .25, -.035); group.add(wing);
    ball(.35, wingMaterial, wing, side * .105, .006, -.36).scale.set(.47, .025, 1.42);
    for (const offset of [-.05, .04, .12]) fixedRod(new THREE.Vector3(0, .018, 0), new THREE.Vector3(side * (.1 + offset), .018, -.74 + Math.abs(offset)), .003, wing, veinMaterial);
    wings.push(wing);
  }
  // An apron follows the underside of the thorax, leaving the leg sockets visible.
  const apron = ball(.23, cream, group, 0, -.07, .13); apron.scale.set(.64, 1.05, .63);
  add(new THREE.BoxGeometry(.12, .085, .017), material('#d2be99'), group, 0, -.12, .276);

  const limbs = [-1, 1].flatMap(side => [0, 1, 2].map(pair => {
    const hip = new THREE.Vector3(side * .17, .015, .18 - pair * .16);
    const root = new THREE.Group(); root.name = `${side < 0 ? 'left' : 'right'}-${['fore', 'middle', 'hind'][pair]}leg`; group.add(root);
    ball(.031, shell, root).position.copy(hip);
    const upper = segment(root, .019), lower = segment(root, .014), foot = segment(root, .012);
    const knee = ball(.024, jointMat, root), ankle = ball(.018, jointMat, root);
    const claws = [segment(root, .007), segment(root, .007)];
    return { side, pair, hip, upper, lower, foot, knee, ankle, claws };
  }));
  const supportFeet = limbs.map(({ side, pair }) => new THREE.Vector3(side * (pair === 1 ? .40 : .34), -.54, pair === 0 ? .4 : pair === 1 ? -.025 : -.43));
  const footWorld = new THREE.Vector3();
  let gripError = 0;
  const forelegTips=[new THREE.Vector3(),new THREE.Vector3()];

  function pose(time: number, flying: boolean, grips: [THREE.Vector3, THREE.Vector3] | null, support: THREE.Vector3, yaw: number, working: boolean, grooming = 0) {
    const wingBeat = Math.sin(time * 72);
    wings.forEach((wing, i) => {
      const side = i === 0 ? -1 : 1;
      wing.rotation.y = flying ? side * -.95 : side * -.12;
      wing.rotation.z = flying ? side * (.25 + wingBeat * .65) : side * .035;
    });
    head.rotation.x = working ? .13 + Math.sin(time * 2) * .025 : -.035+grooming*.10;
    group.updateMatrixWorld(true);
    const supportRotation = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
    gripError = 0;
    limbs.forEach((leg, index) => {
      const isGrip = leg.pair === 0 && grips;
      const target = isGrip ? group.worldToLocal(grips[leg.side < 0 ? 0 : 1].clone()) : flying
        ? new THREE.Vector3(leg.side * .27, -.30, .12 - leg.pair * .18)
        : group.worldToLocal(footWorld.copy(supportFeet[index]).multiplyScalar(.94).applyQuaternion(supportRotation).add(support).clone());
      if(leg.pair===0&&!isGrip&&!flying&&grooming>0){
        // Opposing tarsal strokes touch in front of the chest. The middle and
        // hind legs retain their exact support targets while the forelegs rub.
        const rub=Math.sin(time*17), lift=Math.cos(time*17);
        target.lerp(new THREE.Vector3(leg.side*.018,-.095+leg.side*lift*.024,.48+leg.side*rub*.048),grooming);
      }
      const toe = target.clone();
      // Tarsi wrap round a handle; supporting feet lie flat on the surface.
      const ankleTarget = target.clone().add(isGrip ? new THREE.Vector3(leg.side * .025, .018, -.035) : new THREE.Vector3(0, .055, -.045));
      const bend = new THREE.Vector3(leg.side, .22, leg.pair === 2 ? -.6 : .4);
      const solution = solveLeg(leg.hip, ankleTarget, bend);
      leg.knee.position.copy(solution.knee); leg.ankle.position.copy(solution.ankle);
      placeSegment(leg.upper, leg.hip, solution.knee); placeSegment(leg.lower, solution.knee, solution.ankle);
      // Never stretch a leg to conceal an unreachable tool target.
      const reachError = solution.ankle.distanceTo(ankleTarget);
      if (isGrip) gripError = Math.max(gripError, reachError);
      if (reachError > .015) toe.add(solution.ankle.clone().sub(ankleTarget));
      if(leg.pair===0)forelegTips[leg.side<0?0:1].copy(toe);
      placeSegment(leg.foot, solution.ankle, toe);
      leg.claws.forEach((claw, i) => placeSegment(claw, toe, toe.clone().add(new THREE.Vector3((i ? 1 : -1) * .019, isGrip ? -.023 : 0, .025))));
    });
  }
  return { group, materials, textures: doppi.textures, pose, getGripError: () => gripError, getForelegTips:()=>forelegTips.flatMap(point=>point.toArray()) };
}
