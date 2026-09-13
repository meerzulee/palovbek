import * as THREE from 'three';
export const EXTRA_FOOD = ['quince', 'chickpea', 'raisin', 'egg', 'qazi', 'quail'] as const;
export function makeExtraFood(id: string) {
  const group = new THREE.Group(); group.name = id;
  const materials: THREE.Material[] = [];
  const mat = (color: string) => { const value = new THREE.MeshStandardMaterial({color, roughness:.75}); materials.push(value); return value; };
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x=0,y=0,z=0) => { const mesh = new THREE.Mesh(geometry,material); mesh.position.set(x,y,z); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh; };
  const sphere = new THREE.SphereGeometry(1,12,8);
  if (id === 'quince') {
    const skin=mat('#e5ad32'),flesh=mat('#f7d777');
    for(let i=0;i<3;i++) { const piece=add(new THREE.SphereGeometry(.16,14,10,0,Math.PI),skin,(i-1)*.13,.055,(i%2)*.09);piece.rotation.set(-Math.PI/2,0,i*.6);piece.scale.set(1,.85,.5);const cut=add(new THREE.CircleGeometry(.149,14),flesh,piece.position.x,.059,piece.position.z);cut.rotation.x=-Math.PI/2;cut.scale.y=.85; }
  } else if (id === 'chickpea' || id === 'raisin') {
    const food=mat(id==='chickpea'?'#dbbd77':'#60402d');
    for(let i=0;i<21;i++){const a=i*2.4,r=Math.sqrt((i+.5)/21)*.24; const item=add(sphere,food,Math.cos(a)*r,.035+(1-r/.25)*.06,Math.sin(a)*r);item.scale.set(id==='chickpea'?.043:.032,.032,id==='chickpea'?.04:.054);item.rotation.y=i;}
  } else if (id === 'egg') {
    const white=mat('#fff0cd'),yolk=mat('#e4a12e');
    for(const x of [-.11,.11]) {add(sphere,white,x,.04,0).scale.set(.09,.055,.135);add(sphere,yolk,x,.085,.015).scale.set(.051,.014,.063);}
  } else if (id === 'qazi') {
    const meat=mat('#814732'),casing=mat('#5b3525'),fat=mat('#e6c194');
    for(let i=0;i<3;i++){const x=(i-1)*.12,z=(i%2)*.1;add(new THREE.CylinderGeometry(.115,.115,.028,20),casing,x,.02,z);add(new THREE.CylinderGeometry(.101,.101,.029,20),meat,x,.025,z);for(let j=0;j<6;j++){const a=j*2.4,r=.018+j*.012;add(sphere,fat,x+Math.sin(a)*r,.042,z+Math.cos(a)*r).scale.set(.015,.005,.01);}}
  } else if (id === 'quail') {
    const roast=mat('#ba783d'),wing=mat('#9c592d'),bone=mat('#ecd9af');
    add(sphere,roast,0,.1,0).scale.set(.17,.13,.23);
    for(const side of [-1,1]){const w=add(sphere,wing,side*.145,.08,.025);w.scale.set(.07,.055,.15);w.rotation.y=side*.35;const leg=add(sphere,roast,side*.12,.065,.21);leg.scale.set(.075,.065,.09);const tip=add(new THREE.CapsuleGeometry(.017,.08,3,6),bone,side*.14,.055,.29);tip.rotation.x=Math.PI/2;}
  }
  return {group,materials};
}
export function makeRecipeToppings() {
  const group = new THREE.Group(), materials: THREE.Material[]=[];
  for (const id of EXTRA_FOOD) {
    const layer=new THREE.Group();layer.name=id;group.add(layer);
    const count=id==='quail'?2:id==='quince'?3:4;
    for(let i=0;i<count;i++){const a=i/count*Math.PI*2+(id==='egg'?.4:0),r=id==='quail'?.37:.57;const food=makeExtraFood(id);materials.push(...food.materials);food.group.position.set(Math.cos(a)*r,.12,Math.sin(a)*r);food.group.rotation.y=a+.7;food.group.scale.setScalar(id==='quail'?1.25:.7);layer.add(food.group);}
  }
  return {group,materials,update(added:string[]){for(const layer of group.children)layer.visible=added.includes(layer.name);group.position.y=added.includes('rice')?.72:.49;}};
}
