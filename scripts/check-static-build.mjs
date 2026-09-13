import {readdir,stat,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
async function files(folder){return (await Promise.all((await readdir(folder,{withFileTypes:true})).map(entry=>entry.isDirectory()?files(join(folder,entry.name)):[join(folder,entry.name)]))).flat();}
const paths=await files('dist'),oversized=[];let total=0,max=0;
for(const path of paths){const size=(await stat(path)).size;total+=size;max=Math.max(max,size);if(size>25*2**20)oversized.push(path);}
if(oversized.length)throw Error(`Exceeds Cloudflare's per-asset size: ${oversized.join(', ')}`);
const lock=JSON.parse(await readFile('src/vendor/xenova/sources.lock.json','utf8'));
for(const [name,expected]of Object.entries(lock.distributed_assets)){const bytes=await readFile(join('dist/browser-brain',name));if(createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('Changed static model asset: '+name);}
console.log(JSON.stringify({assets:paths.length,total_bytes:total,largest_asset_bytes:max,all_model_hashes_valid:true,python_backend_required:false},null,2));
