// Cut short, normal-speed highlights from the recorded real-model cook.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';

const output=resolve(process.env.PALOVBEK_MEDIA_DIR ?? 'artifacts/social');
const capture=JSON.parse(await readFile(join(output,'capture.json'),'utf8'));
const first=predicate=>{
  const found=capture.events.find(predicate);
  if(!found) throw Error('A required cooking moment is absent from the capture.');
  return found.seconds;
};
const clips=[
  {name:'fire-and-foreleg-grooming',start:first(e=>e.grooming==='true')+.3,duration:3},
  {name:'onion-into-hot-oil',start:first(e=>e.visual==='pouring'&&e.stage===1)-.2,duration:3.4},
  {name:'browning-and-stirring',start:first(e=>e.visual==='stirring'&&e.added.includes('lamb'))+2,duration:3.4},
  {name:'chopping-carrots',start:first(e=>e.visual==='chopping')+.5,duration:4.5},
  {name:'carrots-into-the-qazan',start:first(e=>e.visual==='pouring'&&e.stage===2)-.35,duration:3.2},
  {name:'simmering-zirvak',start:first(e=>e.label==='Add water for the zirvak')+3,duration:3.5},
  {name:'layering-rice',start:first(e=>e.visual==='pouring'&&e.stage===4)-.3,duration:3.2},
  {name:'lid-and-steam',start:first(e=>e.covered)-1.1,duration:3.2},
  {name:'osh-tayyor',start:first(e=>e.outcome==='served')+1.8,duration:4.2},
];
const run=(command,args)=>{
  const result=spawnSync(command,args,{encoding:'utf8',maxBuffer:8*1024*1024});
  if(result.error) throw result.error;
  if(result.status!==0) throw Error(`${command}: ${result.stderr}`);
  return result.stdout;
};
const cuts=join(output,'cuts'); await mkdir(cuts,{recursive:true});
for(const [i,clip] of clips.entries()){
  console.log(`Encoding ${i+1}/${clips.length}: ${clip.name}`);
  run('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',clip.start.toFixed(3),'-i',join(output,'full-cook.webm'),
    '-t',String(clip.duration),'-an','-vf','fps=30,setsar=1','-c:v','libx264','-preset','medium','-crf','20',
    '-pix_fmt','yuv420p','-movflags','+faststart',join(cuts,`${i}.mp4`)]);
}
await writeFile(join(cuts,'concat.txt'),clips.map((_,i)=>`file '${i}.mp4'`).join('\n')+'\n');
const target=join(output,'palovbek-vertical.mp4');
run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','1','-i',join(cuts,'concat.txt'),
  '-c','copy','-movflags','+faststart',target]);
const probe=JSON.parse(run('ffprobe',['-v','error','-show_entries','format=duration,size:stream=codec_name,width,height,pix_fmt,avg_frame_rate','-of','json',target]));
const report={source:'Actual browser simulation; no scripted demo or synthetic spike counters.',
  editing:'Selected normal-speed moments, joined with cuts. Waiting time omitted. No audio track.',
  recorded_at:capture.recorded_at,locale:capture.locale??'en',presentation:capture.presentation,neurons:capture.neurons,connections:capture.connections,
  outcome:capture.events.at(-1).outcome,total_spikes:capture.events.at(-1).spikes,
  mistakes:capture.events.at(-1).mistakes,backend:capture.events.at(-1).backend,
  clips,export:probe};
await writeFile(join(output,'media-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
