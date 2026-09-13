import * as THREE from 'three';

// Hand-drawn ornament inspired by the user's cobalt, white and gold porcelain.
// It wraps around the model, so the design stays visible while orbiting the scene.
function porcelainPattern() {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#101941'; ctx.fillRect(0, 0, 1024, 512);
  const mask = document.createElement('canvas'); mask.width = 1024; mask.height = 512;
  const gold = mask.getContext('2d')!; gold.fillStyle = '#000'; gold.fillRect(0, 0, 1024, 512);
  const path = (draw: (c: CanvasRenderingContext2D) => void, white = true, width = 2.5) => {
    for (const [context, metallic] of [[ctx, false], [gold, true]] as const) {
      context.beginPath(); draw(context);
      if (white) { context.fillStyle = metallic ? '#000' : '#f2f0df'; context.fill(); }
      context.strokeStyle = metallic ? '#fff' : '#bda361'; context.lineWidth = width; context.lineJoin = 'round'; context.lineCap = 'round'; context.stroke();
    }
  };
  for (let repeat = 0; repeat < 4; repeat++) {
    const center = repeat * 256 + 128;
    ctx.save(); gold.save(); ctx.translate(center, 264); gold.translate(center, 264);
    for (const side of [-1, 1]) {
      // A mirrored white cotton/floral medallion with a navy pointed centre.
      ctx.save(); gold.save(); ctx.scale(side, 1); gold.scale(side, 1);
      path(c => {
        c.moveTo(0, 111); c.bezierCurveTo(4, 84, 12, 60, 37, 46);
        c.bezierCurveTo(72, 28, 85, -3, 66, -28);
        c.bezierCurveTo(82, -52, 61, -78, 40, -78);
        c.bezierCurveTo(42, -110, 13, -132, 0, -129);
        c.lineTo(0, -87); c.bezierCurveTo(19, -61, 26, -28, 18, -10);
        c.bezierCurveTo(43, -20, 65, -8, 58, 8); c.bezierCurveTo(35, 17, 17, 22, 0, 38); c.closePath();
      });
      path(c => {
        c.moveTo(0, 112); c.bezierCurveTo(38, 159, 90, 116, 74, 90);
        c.bezierCurveTo(39, 116, 45, 68, 66, 72); c.bezierCurveTo(62, 46, 105, 44, 106, 69);
        c.bezierCurveTo(133, 71, 124, 111, 98, 116); c.bezierCurveTo(90, 164, 37, 183, 0, 146); c.closePath();
      });
      path(c => {
        c.moveTo(9, -177); c.bezierCurveTo(38, -193, 60, -161, 92, -168);
        c.bezierCurveTo(71, -131, 46, -144, 38, -151);
        c.bezierCurveTo(58, -122, 47, -109, 29, -117); c.bezierCurveTo(31, -143, 12, -148, 9, -177); c.closePath();
      });
      path(c => { c.moveTo(17, -105); c.bezierCurveTo(42, -128, 53, -88, 31, -86); c.bezierCurveTo(11, -84, 39, -58, 48, -70); c.bezierCurveTo(77, -81, 70, -42, 47, -42); c.bezierCurveTo(32, -41, 38, -20, 49, -21); }, false, 1.8);
      ctx.restore(); gold.restore();
    }
    ctx.restore(); gold.restore();
  }
  for (const y of [24, 474, 482]) {
    ctx.fillStyle = '#d0b66c'; ctx.fillRect(0, y, 1024, y === 24 ? 4 : 2);
    gold.fillStyle = '#fff'; gold.fillRect(0, y, 1024, y === 24 ? 4 : 2);
  }
  const color = new THREE.CanvasTexture(canvas); color.colorSpace = THREE.SRGBColorSpace; color.anisotropy = 4;
  const metalness = new THREE.CanvasTexture(mask);
  return { color, metalness };
}

export function makeTeaSet() {
  const group = new THREE.Group(); group.name = 'Cobalt Uzbek porcelain tea set';
  const materials: THREE.Material[] = [], textures: THREE.Texture[] = [];
  const mat = (parameters: THREE.MeshPhysicalMaterialParameters) => {
    const value = new THREE.MeshPhysicalMaterial({ roughness: .22, clearcoat: 1, clearcoatRoughness: .12, ...parameters }); materials.push(value); return value;
  };
  const pattern = porcelainPattern(); textures.push(pattern.color, pattern.metalness);
  const cobalt = mat({ color: '#111b44' }), white = mat({ color: '#f5f1df' });
  const decorated = mat({ map: pattern.color, metalnessMap: pattern.metalness, metalness: .85 });
  const gold = mat({ color: '#d9b758', metalness: .8, roughness: .24 });
  const dark = mat({ color: '#181927', roughness: .65 });
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const ring = (radius: number, tube: number, parent: THREE.Object3D, y: number) => {
    const mesh = add(new THREE.TorusGeometry(radius, tube, 8, 56), gold, parent, 0, y); mesh.rotation.x = Math.PI / 2; return mesh;
  };
  const pot = new THREE.Group(); group.add(pot); pot.position.set(-.06, 0, -.04); pot.rotation.y = -.12;
  const profile = [[.001, 0], [.155, 0], [.185, .012], [.217, .06], [.245, .135], [.26, .23], [.251, .32], [.224, .392], [.19, .433], [.152, .447], [.001, .447]];
  const body = add(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 72), decorated, pot);
  body.name = 'White cotton ornament on cobalt glaze'; body.rotation.y = Math.PI / 4;
  ring(.174, .006, pot, .007);
  const lidProfile = [[.001, .44], [.156, .44], [.171, .451], [.15, .466], [.11, .49], [.055, .517], [.028, .526], [.001, .526]];
  add(new THREE.LatheGeometry(lidProfile.map(([r, y]) => new THREE.Vector2(r, y)), 56), cobalt, pot);
  ring(.168, .006, pot, .454);
  ring(.032, .004, pot, .528);
  add(new THREE.SphereGeometry(.037, 20, 14), gold, pot, 0, .553, 0).scale.y = 1.08;
  // Swept, tapering spout, with a dark opening recessed behind the gold lip.
  const curve = new THREE.CubicBezierCurve3(new THREE.Vector3(.217, .13, 0), new THREE.Vector3(.335, .13, 0), new THREE.Vector3(.331, .4, 0), new THREE.Vector3(.48, .447, 0));
  const segments = 32, sides = 20, vertices: number[] = [], normals: number[] = [], indices: number[] = [];
  const tangent = new THREE.Vector3(), sideways = new THREE.Vector3(0, 0, 1), perpendicular = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, p = curve.getPoint(t), radius = .081 * (1 - t) + .026 * t;
    curve.getTangent(t, tangent); perpendicular.crossVectors(sideways, tangent).normalize();
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * Math.PI * 2, normal = perpendicular.clone().multiplyScalar(Math.cos(a)).addScaledVector(sideways, Math.sin(a));
      vertices.push(p.x + normal.x * radius, p.y + normal.y * radius, p.z + normal.z * radius); normals.push(...normal.toArray());
      if (i < segments && j < sides) { const v = i * (sides + 1) + j; indices.push(v, v + 1, v + sides + 1, v + 1, v + sides + 2, v + sides + 1); }
    }
  }
  const spoutGeometry = new THREE.BufferGeometry(); spoutGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); spoutGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); spoutGeometry.setIndex(indices);
  add(spoutGeometry, white, pot);
  const lip = add(new THREE.TorusGeometry(.026, .006, 8, 28), gold, pot, .48, .447, 0);
  lip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), curve.getTangent(1));
  const opening = add(new THREE.CircleGeometry(.021, 24), dark, pot); opening.position.copy(curve.getPoint(.997)); opening.quaternion.copy(lip.quaternion);
  const cuff = add(new THREE.TorusGeometry(.078, .007, 8, 32), gold, pot, .224, .136, 0); cuff.rotation.y = Math.PI / 2;
  // High oval handle, rather than a horizontal loop hidden behind the body.
  const handleCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-.206, .09, 0), new THREE.Vector3(-.319, .192, 0), new THREE.Vector3(-.396, .39, 0), new THREE.Vector3(-.355, .482, 0), new THREE.Vector3(-.265, .465, 0), new THREE.Vector3(-.217, .36, 0)]);
  add(new THREE.TubeGeometry(handleCurve, 36, .02, 10, false), white, pot);
  for (const [x, y] of [[-.206, .09], [-.217, .36]]) { const collar = add(new THREE.TorusGeometry(.031, .006, 8, 24), gold, pot, x, y, 0); collar.rotation.y = Math.PI / 2; }

  const cup = new THREE.Group(); cup.position.set(.23, 0, .24); group.add(cup);
  const cupProfile = [[.035, 0], [.049, 0], [.077, .027], [.103, .073], [.11, .088], [.105, .092], [.092, .063], [.066, .025], [.001, .016]];
  add(new THREE.LatheGeometry(cupProfile.map(([r, y]) => new THREE.Vector2(r, y)), 40), decorated, cup);
  const inside = add(new THREE.SphereGeometry(.104, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), white, cup, 0, .092, 0); inside.scale.y = .75; inside.material.side = THREE.DoubleSide;
  const tea = add(new THREE.CircleGeometry(.081, 32), mat({ color: '#7e3918', roughness: .13 }), cup, 0, .045, 0); tea.rotation.x = -Math.PI / 2;
  ring(.108, .004, cup, .09); ring(.048, .003, cup, .004);
  return { group, materials, textures };
}
