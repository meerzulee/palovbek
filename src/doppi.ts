import * as THREE from 'three';

// Original canvas embroidery and a four-panel crown, modeled from the user's do‘ppi references.
export function makeDoppi() {
  const group = new THREE.Group();
  const textures: THREE.Texture[] = [];
  const materials: THREE.Material[] = [];
  const makeCanvas = (band = false) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#19191d';ctx.fillRect(0,0,512,512);
    // Subtle woven threads keep the fabric matte.
    ctx.strokeStyle='#ffffff05';ctx.lineWidth=1;
    for(let i=0;i<512;i+=4){ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(512,i);ctx.stroke();}
    ctx.strokeStyle='#ddd0f0';ctx.fillStyle='#ddd0f0';ctx.lineCap='round';ctx.lineJoin='round';
    if(band) {
      ctx.lineWidth=7;
      for(const y of [100,128,385,413]){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();}
      for(let i=0;i<4;i++) {
        const x=i*128;
        for(let j=0;j<3;j++){ctx.lineWidth=4;ctx.strokeRect(x+8+j*12,148+j*23,112-j*24,217-j*46);}
        ctx.beginPath();ctx.arc(x+64,257,7,0,Math.PI*2);ctx.fill();
      }
    } else {
      // The sweeping qalampir/paisley embroidery is repeated on each crown panel.
      ctx.lineWidth=6;
      const paisley = new Path2D('M 357 415 C 371 292 281 144 183 194 C 79 246 106 382 184 378 C 244 375 234 313 197 298 C 271 304 328 354 357 415 Z');
      ctx.stroke(paisley);
      ctx.lineWidth=3;
      const inner = new Path2D('M 350 394 C 348 290 271 165 186 207 C 99 252 124 366 184 363 C 229 361 219 316 190 314 C 258 308 325 356 350 394');ctx.stroke(inner);
      const inner2=new Path2D('M 340 370 C 317 263 251 188 185 222 C 119 257 139 348 181 349 C 212 349 208 327 185 329');ctx.stroke(inner2);
      for(const [x,y,r] of [[173,276,34],[230,249,20],[159,330,13]])for(let i=0;i<3;i++){ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,Math.max(2,r-i*8),0,Math.PI*2);ctx.stroke();}
      for(const [x,y] of [[272,371],[285,315],[237,405]])for(let i=0;i<5;i++){const a=i/5*Math.PI*2;ctx.beginPath();ctx.arc(x+Math.cos(a)*7,y+Math.sin(a)*7,2.4,0,Math.PI*2);ctx.fill();}
      ctx.strokeStyle='#797382';ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(7,505);ctx.lineTo(256,8);ctx.lineTo(505,505);ctx.stroke();
    }
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;textures.push(texture);return texture;
  };
  const crownMaterial=new THREE.MeshStandardMaterial({map:makeCanvas(),roughness:1,color:'#e4dfe7'});
  const bandMaterial=new THREE.MeshStandardMaterial({map:makeCanvas(true),roughness:1,color:'#e4dfe7'});
  const fabricMaterial=new THREE.MeshStandardMaterial({color:'#202025',roughness:1});materials.push(crownMaterial,bandMaterial,fabricMaterial);
  const band=new THREE.Mesh(new THREE.BoxGeometry(.575,.12,.575),[bandMaterial,bandMaterial,fabricMaterial,fabricMaterial,bandMaterial,bandMaterial]);band.position.y=.04;group.add(band);
  for(let face=0;face<4;face++){
    const positions:number[]=[];const uvs:number[]=[];const indices:number[]=[];const segments=14;
    for(let row=0;row<=segments;row++)for(let col=0;col<=segments;col++){
      const u=col/segments,v=row/segments;
      positions.push((u-.5)*.575*(1-v),.1+v*.245+Math.sin(u*Math.PI)*Math.sin(v*Math.PI)*.025,.2875*(1-v));
      uvs.push(u,v);
    }
    for(let row=0;row<segments;row++)for(let col=0;col<segments;col++){const a=row*(segments+1)+col,b=a+segments+1;indices.push(a,a+1,b,a+1,b+1,b);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
    const panel=new THREE.Mesh(geometry,crownMaterial);panel.rotation.y=face*Math.PI/2;group.add(panel);
  }
  group.rotation.y=Math.PI/4;
  group.traverse(object=>{if(object instanceof THREE.Mesh){object.castShadow=true;object.receiveShadow=true;}});
  return {group,textures,materials};
}
