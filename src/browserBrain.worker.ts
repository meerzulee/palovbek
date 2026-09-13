/// <reference lib="webworker" />
import { neuralPortion } from './neuralChoice';
import { cookingFrameSeconds, taskFrameDelay } from './playback';
import { BrowserKitchen, RECIPE_VERSION } from './browserKitchen';
import { BrainCPU } from './vendor/xenova/brain.js';
import { configureAssetBase, loadGraph } from './vendor/xenova/data-loader.js';
import type { BrainGPU } from './vendor/xenova/brain-gpu.js';
import type { Graph } from './vendor/xenova/types';
import type { CookingLogEntry, NeuralMetadata, NeuralSnapshot } from './neural';

let graph:Graph, brain:BrainCPU|BrainGPU, kitchen=new BrowserKitchen(), backend='cpu';
let metadata:NeuralMetadata, sample:number[]=[], regions:number[]=[];
let sensory:Record<string,number[]>={}, groups:number[][]=[[],[],[]];
let runId=crypto.randomUUID(),sequence=0,seed=17,running=false,sensoryEnabled=true,transmissionOff=false;
let totalSpikes=0,wallSeconds=0,lastWall=0,startedAt=new Date().toISOString(),completed=0;
let portionPlan:{id:string;waits:number;choice:ReturnType<typeof neuralPortion>}|null=null;
let outputLeft:number[]=[],outputRight:number[]=[];
let decision:NeuralSnapshot['decision']=null, log:CookingLogEntry[]=[];
let telemetry:NeuralSnapshot['neural']={simulated_seconds:0,window_seconds:.01,total_spikes:0,window_spikes:0,active_neurons:0,population_hz:[0,0,0],sample_counts:[],active_cells:[]};
let queue=Promise.resolve(), timer:ReturnType<typeof setTimeout>|undefined, disposed=false;
const send=(message:unknown)=>postMessage(message);
const STEP_COUNT=100, NEURAL_SECONDS=.01, KITCHEN_SECONDS=.25;
const channels:Record<string,string>={odor_oil:'ORN_DM1',odor_onion:'ORN_DM2',odor_lamb:'ORN_DM3',odor_carrot:'ORN_DM4',odor_spice:'ORN_DL1',odor_garlic:'ORN_VA2',odor_rice:'ORN_VM2',heat:'TRN_VP1m',contact:'BM',prep_view:'LC9',qazan_view:'LC4',smoke:'ORN_DC4'};

let frameSeconds = cookingFrameSeconds('wait', 1);

function snapshot():NeuralSnapshot {
  // Array memory is an estimate, not browser RSS or device VRAM telemetry.
  const bytes=graph ? graph.sources.byteLength+graph.counts.byteLength+graph.offsets.byteLength+graph.sign.byteLength+(backend==='cpu'?graph.sources.byteLength*2:graph.sources.byteLength*2+graph.n*100) : 0;
  return {type:'snapshot',protocol:1,run_id:runId,sequence,model_version:'xenova-malecns-browser-v1',seed,running,sensory_enabled:sensoryEnabled,output_silenced:transmissionOff,checkpoint_available:false,controller:'recipe',recipe:kitchen.progress(),continuous:false,completed_episodes:completed,cooking_log:log.slice(-40),log_count:log.length,world:kitchen.world,neural:telemetry,decision,performance:{frame_seconds:frameSeconds,window_wall_seconds:lastWall,simulation_speed:wallSeconds?telemetry.simulated_seconds/wallSeconds:0,rss_bytes:bytes,backend,memory_estimated:true}};
}
function report(){return {format:'plov-cooking-log-v1',run_id:runId,started_at:startedAt,seed,controller:'recipe',engine:'xenova-malecns-browser-v1',upstream_commit:'776d115ee5aa934578a87fd6d260d138084f59c1',backend,recipe:kitchen.recipe,recipe_version:RECIPE_VERSION,outcome:kitchen.world.outcome,world_seconds:kitchen.world.elapsed,neural_seconds:telemetry.simulated_seconds,total_spikes:totalSpikes,mistakes:kitchen.world.mistakes,ingredients:kitchen.world.added,actions:log,interventions,portion_readout:'recipe+neural-portions-v1',playback:'1.5 seconds per action; 1.8 seconds for travel, chopping and stirring; slower when compute-bound; fixed simulation timesteps',notice:'Recipe rules constrain order; measured output spikes influence portions and hesitation. Neural activity is simulated from MaleCNS connectivity with engineered kitchen sensory inputs; it is not learned cooking.'};}
let interventions:{time:number;command:string;enabled:boolean}[]=[];
async function reset(recipeId:string,nextSeed:number){
  const next=new BrowserKitchen(recipeId); // Validate before changing the current episode.
  running=false;clearTimeout(timer);frameSeconds=cookingFrameSeconds('wait',1);kitchen=next;seed=nextSeed;brain.seed=seed;await brain.reset();
  runId=crypto.randomUUID();sequence=0;totalSpikes=wallSeconds=lastWall=0;log=[];interventions=[];decision=null;portionPlan=null;sensoryEnabled=true;transmissionOff=false;startedAt=new Date().toISOString();
  telemetry={simulated_seconds:0,window_seconds:NEURAL_SECONDS,total_spikes:0,window_spikes:0,active_neurons:0,population_hz:[0,0,0],sample_counts:sample.map(()=>0),active_cells:[]};
}
function schedule(){clearTimeout(timer);if(running&&!disposed)timer=setTimeout(()=>{queue=queue.then(tick).catch(fail);},taskFrameDelay(lastWall,frameSeconds));}
function fail(error:unknown){running=false;clearTimeout(timer);send({type:'error',message:`Browser brain stopped: ${error instanceof Error?error.message:String(error)}. Reload the brain to start a fresh session.`});if(graph&&brain)send(snapshot());}
async function tick(){
  if(!running||kitchen.world.outcome)return;
  const start=performance.now(),rates=new Float32Array(graph.n),cues=kitchen.observe();
  if(sensoryEnabled)for(const [name,indices] of Object.entries(sensory)){const hz=Math.max(0,Math.min(1,cues[name]??0))*140;for(const i of indices)rates[i]=Math.min(200,rates[i]+hz);}
  const result=await brain.batch(STEP_COUNT,rates,transmissionOff);
  let total=0,active=0;const sums=[0,0,0],top:number[]=[];
  for(let i=0;i<graph.n;i++){const count=result.counts[i];total+=count;sums[regions[i]]+=count;if(count){active++;if(top.length<6||count>result.counts[top[top.length-1]]){top.push(i);top.sort((a,b)=>result.counts[b]-result.counts[a]||a-b);top.length=Math.min(top.length,6);}}}
  totalSpikes+=total;
  telemetry={simulated_seconds:result.tick*.0001,window_seconds:NEURAL_SECONDS,total_spikes:totalSpikes,window_spikes:total,active_neurons:active,population_hz:sums.map((sum,i)=>groups[i].length?sum/groups[i].length/NEURAL_SECONDS:0),sample_counts:sample.map(i=>result.counts[i]),active_cells:top.map(i=>({body_id:String(graph.neurons[i][0]),type:graph.neurons[i][1]||'untyped',count:result.counts[i],hz:result.counts[i]/NEURAL_SECONDS}))};
  if(!kitchen.world.pending){decision=kitchen.choose();
    if(decision.action.startsWith('pick_')){
      const id=decision.action.slice(5);
      if(portionPlan?.id!==id){const sum=(indices:number[])=>indices.reduce((n,i)=>n+result.counts[i],0);const proposal=neuralPortion(telemetry.population_hz[2],sum(outputLeft),sum(outputRight));const choice={...proposal,factor:['garlic','quince','egg','quail'].includes(id)?1:proposal.factor};portionPlan={id,waits:choice.hesitation,choice};}
      decision.neural_choice=portionPlan.choice;
      if(portionPlan.waits>0){portionPlan.waits--;decision={...decision,action:'wait',source:'recipe+neural-portions-v1',reason:`Considering the ${id} portion · ${portionPlan.choice.output_hz.toFixed(2)} Hz output drive`};}
      else{kitchen.nextPortionFactor=portionPlan.choice.factor;decision.source='recipe+neural-portions-v1';decision.reason=`Choose ${Math.round(portionPlan.choice.factor*100)}% of the recipe's ${id} portion${portionPlan.choice.fallback?' (neutral default: no output spikes)':''}`;}
    }
    if(decision.blocked){running=false;kitchen.world.last_result=decision.reason;}else kitchen.begin(decision.action);}
  if(running){frameSeconds=cookingFrameSeconds(kitchen.world.pending!.name,kitchen.world.pending!.duration,KITCHEN_SECONDS);const id=kitchen.world.pending!.id;kitchen.advance(KITCHEN_SECONDS);if(!kitchen.world.pending&&kitchen.world.events.length){const w=kitchen.world,event=w.events.at(-1)!;log.push({...event,id,instruction:decision!.reason,ingredients:[...w.added],temperature:w.temperature,heat:w.heat,hydration:w.hydration,browning:w.browning,burn:w.burn,covered:w.covered,neural_seconds:telemetry.simulated_seconds,spikes:totalSpikes,neural_choice:decision?.neural_choice,quantities:structuredClone(w.quantities)});}}
  lastWall=(performance.now()-start)/1000;wallSeconds+=lastWall;sequence++;
  if(kitchen.world.outcome){running=false;completed++;send({type:'archive',report:report()});}
  send(snapshot());schedule();
}
async function initialize(assetBase:string,preferred:string){
  configureAssetBase(assetBase);
  graph=await loadGraph(value=>send({type:'progress',value}),message=>send({type:'stage',message}));
  graph.neurons.forEach((row,i)=>{if(['dopamine','octopamine','serotonin'].includes(row[4]))graph.sign[i]=1;});
  for(const [name,type] of Object.entries(channels))sensory[name]=graph.neurons.flatMap((row,i)=>row[1]===type?[i]:[]);
  // Humidity shares the ORN_DM1 drive as an explicit engineered proxy.
  sensory.moisture=sensory.odor_oil.slice(0,32);
  const input=new Set(Object.values(sensory).flat());groups=[[],[],[]];regions=[];
  graph.neurons.forEach((row,i)=>{const region=input.has(i)?0:['descending_neuron','motor_neuron'].includes(row[2])?2:1;regions[i]=region;groups[region].push(i);});
  outputLeft=groups[2].filter(i=>graph.neurons[i][3]==='L');outputRight=groups[2].filter(i=>graph.neurons[i][3]==='R');
  const candidates=graph.neurons.flatMap((r,i)=>r[6]&&r[6][2]>=9000&&r[6][2]<=58000?[i]:[]);
  // A deterministic display sample; every graph neuron still participates in computation.
  sample=candidates.filter((_,i)=>i%Math.max(1,Math.floor(candidates.length/8000))===0).slice(0,8500);
  const cells:NeuralMetadata['sample_cells']=sample.map(i=>{const row=graph.neurons[i],p=row[6]!;return {body_id:String(row[0]),type:row[1]||'untyped',superclass:row[2],position:[-(p[0]-48000)/42000,-(p[2]-35000)/42000,(p[1]-24000)/42000],source_soma_voxels:p,region:regions[i]===0?1:regions[i]===2?2:0};});
  let check:unknown=null;
  if(preferred!=='cpu')try{
    send({type:'stage',message:'Checking WebGPU against the reference engine…'});
    const {BrainGPU}=await import('./vendor/xenova/brain-gpu.js'),{checkGPU}=await import('./vendor/xenova/gpu-check.js');
    check=await checkGPU(g=>BrainGPU.create(g));
    send({type:'stage',message:'Loading the complete graph into WebGPU…'});
    brain=await BrainGPU.create(graph,{seed});backend='gpu';
  }catch(error){send({type:'stage',message:`WebGPU unavailable; using the JavaScript neural engine. ${error instanceof Error?error.message:''}`});brain=new BrainCPU(graph,{seed});backend='cpu';}
  else{brain=new BrainCPU(graph,{seed});backend='cpu';}
  metadata={type:'metadata',protocol:1,model_version:'xenova-malecns-browser-v1',dataset:graph.manifest.dataset,neurons:graph.n,connections:graph.manifest.edges,synapse_weight_sum:graph.manifest.synapses,decoder:'Recipe order + measured neural output for portion and hesitation',actions:[],notice:'Xenova MaleCNS LIF model in a browser worker. Kitchen cues stimulate selected annotated cells. Recipe rules constrain order; an engineered output readout changes portion size and short pauses. Not learned cooking.',sample_cells:cells,brain_window_seconds:NEURAL_SECONDS,world_window_seconds:KITCHEN_SECONDS};
  await reset('classic',seed);send({...metadata,backend,gpu_check:check});send(snapshot());
}
self.onmessage=({data:m})=>{
  queue=queue.then(async()=>{
    if(m.type==='init'){await initialize(m.assetBase,m.backend??'auto');return;}
    if(!brain)throw Error('Load the brain first');
    if(m.run_id!==runId)throw Error('Stale episode command; wait for the current state');
    if(m.command==='cook_recipe'){await reset(m.recipe_id??kitchen.recipe.id,m.seed??seed);running=true;}
    else if(m.command==='start'){if(kitchen.world.outcome)throw Error('Start a new plov after this completed episode');running=true;}
    else if(m.command==='pause'){running=false;clearTimeout(timer);}
    else if(m.command==='reset')await reset(m.recipe_id??kitchen.recipe.id,m.seed??seed);
    else if(m.command==='sensory'){sensoryEnabled=!!m.enabled;interventions.push({time:telemetry.simulated_seconds,command:m.command,enabled:sensoryEnabled});}
    else if(m.command==='silence_outputs'){transmissionOff=!!m.enabled;interventions.push({time:telemetry.simulated_seconds,command:'disable_recurrent_transmission',enabled:transmissionOff});}
    else if(m.command==='export_log'){send({type:'export',report:report()});return;}
    else throw Error('This command is not supported by the browser engine');
    send(snapshot());schedule();
  }).catch(fail);
};
self.addEventListener('close',()=>{disposed=true;clearTimeout(timer);if('destroy' in (brain??{}))(brain as BrainGPU).destroy();});
