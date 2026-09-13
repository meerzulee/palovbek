import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const root=dirname(dirname(fileURLToPath(import.meta.url))),vendor=join(root,'src/vendor/xenova');
const lock=JSON.parse(await readFile(join(vendor,'sources.lock.json'),'utf8'));
const base=`${lock.repository}/resolve/${lock.commit}/`;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
let reused=0,downloaded=0;
for(const [name,expected] of Object.entries(lock.distributed_assets)){
  const path=join(root,'public/browser-brain',name);
  try{if(hash(await readFile(path))===expected){reused++;continue;}}catch{}
  await mkdir(dirname(path),{recursive:true});
  let bytes;
  if(name==='data/manifest.json')bytes=await readFile(join(vendor,'browser-manifest.json'));
  else{
    const origin=name==='LICENSE.txt'?'LICENSE':name.startsWith('licenses/')?name:name==='upstream-model.json'?'public/model.json':'public/'+name.replace(/\.dat$/,'.gz');
    for(let attempt=0;attempt<4;attempt++){
      try{
        const response=await fetch(base+origin,{signal:AbortSignal.timeout(90000)});
        if(!response.ok)throw Error(`HTTP ${response.status}`);
        const body=new Uint8Array(await response.arrayBuffer());
        if(hash(body)!==expected)throw Error('SHA-256 mismatch');
        bytes=body;break;
      }catch(error){if(attempt===3)throw Error(`${name}: ${error.message}`);console.log(`Retry ${attempt+1}/3: ${name}`);await new Promise(resolve=>setTimeout(resolve,1000*2**attempt));}
    }
  }
  if(hash(bytes)!==expected)throw Error(`Pinned asset differs: ${name}`);
  await writeFile(path+'.partial',bytes);await rename(path+'.partial',path);downloaded++;
  console.log(`Verified ${name}`);
}
console.log(`Browser brain assets: ${reused} verified locally, ${downloaded} prepared.`);
