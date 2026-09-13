import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({headless:true, executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? (existsSync(chrome)?chrome:undefined)});
try {
  const page = await browser.newPage();
  await page.goto(process.env.AUDIT_URL ?? 'http://127.0.0.1:5173');
  const report = await page.evaluate(async ({modules,assets}) => {
    const {configureAssetBase,loadGraph} = await import(modules+'data-loader.js');
    const {BrainCPU} = await import(modules+'brain.js');
    configureAssetBase(new URL(assets,location.href).href);
    const graph = await loadGraph();
    for(let i=0;i<graph.n;i++) if(['dopamine','octopamine','serotonin'].includes(graph.neurons[i][4])) graph.sign[i]=1;
    const rates=new Float32Array(graph.n);
    graph.neurons.forEach((row,i)=>{if(row[1]==='LC9') rates[i]=180;});
    const rows=[]; const arrays=[];
    for(const condition of ['rest','LC9','LC9_no_recurrence']) {
      const cpu=new BrainCPU(graph), input=condition==='rest'?new Float32Array(graph.n):rates;
      const start=performance.now();
      let total=0; const sum=new Uint32Array(graph.n);
      for(let i=0;i<5;i++){const result=cpu.batch(100,input,condition==='LC9_no_recurrence');total+=result.total;result.counts.forEach((v,j)=>sum[j]+=v);}
      rows.push({condition,spikes:total,active:sum.reduce((a,v)=>a+(v>0),0),downstream:sum.reduce((a,v,i)=>a+(rates[i]===0?v:0),0),neural_seconds:.05,wall_seconds:(performance.now()-start)/1000,finite:cpu.v.every(Number.isFinite)&&cpu.g.every(Number.isFinite)});
      arrays.push(sum);
    }
    let gpu={available:!!navigator.gpu};
    if(navigator.gpu) {
      try {
        const {BrainGPU}=await import(modules+'brain-gpu.js');const {checkGPU}=await import(modules+'gpu-check.js');
        gpu.self_check=await checkGPU(g=>BrainGPU.create(g));
        const engine=await BrainGPU.create(graph);const sum=new Uint32Array(graph.n);const start=performance.now();
        for(let i=0;i<5;i++){const result=await engine.batch(100,rates);result.counts.forEach((v,j)=>sum[j]+=v);}
        gpu.full_graph={wall_seconds:(performance.now()-start)/1000,neural_seconds:.05,spikes:sum.reduce((a,v)=>a+v,0),mismatched_neuron_counts:sum.reduce((a,v,i)=>a+(v!==arrays[1][i]),0)};
        engine.destroy();
      } catch(error){gpu.error=String(error);}
    }
    return {utc:new Date().toISOString(),commit:'776d115ee5aa934578a87fd6d260d138084f59c1',module_path:modules,asset_path:assets,user_agent:navigator.userAgent,neurons:graph.n,edges:graph.sources.length,synapses:graph.counts.reduce((a,v)=>a+v,0),stimulated_neurons:rates.reduce((a,v)=>a+(v>0),0),cpu:rows,gpu};
  },{modules:process.env.AUDIT_MODULES??'/src/vendor/xenova/',assets:process.env.AUDIT_ASSETS??'/browser-brain/'});
  await writeFile(process.env.AUDIT_OUTPUT??'docs/results/browser-engine-audit.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  if(report.cpu[0].spikes!==0 || report.cpu[1].downstream===0 || report.cpu[2].downstream!==0 || report.cpu.some(row=>!row.finite)) process.exitCode=1;
  if(report.gpu.error)process.exitCode=1;
} finally {await browser.close();}
