import { useCallback, useEffect, useRef, useState } from 'react';
import type { CookingLogEntry, NeuralCommand, NeuralMetadata, NeuralSnapshot } from './neural';
import { neuralCue } from './neural';
import { browserFrameDelay } from './playback';
import type { ChefCue, MotionClock } from './chefPerformance';
export type BrainRuntime = 'browser' | 'local';
export type CookingReport = {run_id:string;started_at:string;recipe:{id:string;name:string}|null;outcome:string|null;mistakes:number;world_seconds:number;actions:CookingLogEntry[];[key:string]:unknown};
const HISTORY_KEY='plov-browser-cooks-v1';
function savedCooks():CookingReport[]{try{return JSON.parse(localStorage.getItem(HISTORY_KEY)??'[]');}catch{return [];}}
function downloadReport(report:CookingReport){const blob=new Blob([JSON.stringify(report,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`plov-${report.recipe?.id??'experiment'}-${report.run_id}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

export function useNeural(enabled: boolean, runtime:BrainRuntime='local') {
  const [status, setStatus] = useState<'offline' | 'connecting' | 'connected'>('offline');
  const [snapshot, setSnapshot] = useState<NeuralSnapshot | null>(null);
  const [metadata, setMetadata] = useState<NeuralMetadata | null>(null);
  const [error, setError] = useState(''),[loading,setLoading]=useState(''),[progress,setProgress]=useState(0);
  const [unavailable, setUnavailable] = useState(false);
  const [attempt, setAttempt] = useState(0),[history,setHistory]=useState(savedCooks);
  const historyRef=useRef(history);
  const socket = useRef<WebSocket | null>(null),worker=useRef<Worker|null>(null);
  const latest = useRef<NeuralSnapshot | null>(null);
  const clock = useRef<MotionClock>({ time: 0, elapsed: 0 });
  const visualCue = useRef<ChefCue>(neuralCue(null));
  const transition = useRef({ from: 0, fromProgress: 0, received: 0, duration: .12, finishing: null as ChefCue | null });
  const connected = useRef(false);
  useEffect(() => {
    setSnapshot(null);setMetadata(null);latest.current=null;connected.current=false;setError('');setProgress(0);setLoading('');setUnavailable(false);
    if (!enabled || (runtime==='browser'&&attempt===0)) {setStatus('offline');return;}
    setStatus('connecting');
    let disposed=false,receivedMetadata=false,autoCookStarted=false,lastMessage=performance.now(),initializingGPU=true;
    const receive=(message:Record<string,unknown>)=>{
      if(disposed)return;lastMessage=performance.now();
      try {
        if(message.type==='progress'){setProgress(Number(message.value));return;}
        if(message.type==='stage'){if(message.phase)initializingGPU=message.phase==='engine';setLoading(String(message.message));return;}
        if(message.type==='unavailable'){setUnavailable(true);setError(String(message.message));setStatus('offline');connected.current=false;worker.current?.terminate();return;}
        if(message.type==='metadata'){
          if(message.protocol!==1||!Array.isArray(message.sample_cells))throw Error('Brain protocol mismatch.');
          receivedMetadata=true;connected.current=true;setMetadata(message as unknown as NeuralMetadata);setStatus('connected');setError('');setLoading('');
        }else if(message.type==='snapshot'&&receivedMetadata){
          const next=message as unknown as NeuralSnapshot,previous=latest.current;
          if(previous&&previous.run_id===next.run_id&&previous.sequence>next.sequence)return;
          const sameRun=previous?.run_id===next.run_id;
          const cadence = runtime === 'browser' && next.performance.frame_seconds !== undefined ? Math.max(next.performance.window_wall_seconds, next.performance.frame_seconds) : next.performance.window_wall_seconds + (runtime === 'browser' ? browserFrameDelay(next.performance.window_wall_seconds, next.performance.playback_speed) / 1000 : 0);
          const finishing = sameRun && previous?.world.pending && !next.world.pending && next.sequence > previous.sequence ? { ...neuralCue(previous), progress: 1 } : null;
          transition.current={from:sameRun?clock.current.time:next.world.elapsed,fromProgress:finishing || (sameRun&&previous?.world.pending?.id===next.world.pending?.id)?visualCue.current.progress:0,received:performance.now(),duration:Math.max(.08,Math.min(2,cadence)),finishing};
          latest.current=next;setSnapshot(next);
          if(runtime==='browser'&&!autoCookStarted){
            autoCookStarted=true;
            worker.current?.postMessage({command:'cook_recipe',run_id:next.run_id,recipe_id:next.recipe?.recipe_id??'classic',seed:next.seed});
          }
        }else if(message.type==='archive'){
          const report=message.report as CookingReport;
          const next=[report,...historyRef.current.filter(item=>item.run_id!==report.run_id)].slice(0,10);historyRef.current=next;setHistory(next);
          try{localStorage.setItem(HISTORY_KEY,JSON.stringify(next));}catch{setError('This browser could not save its history. Download the log to keep a copy.');}
        }else if(message.type==='export')downloadReport(message.report as CookingReport);
        else if(message.type==='error'){setError(String(message.message));if(!receivedMetadata){setStatus('offline');connected.current=false;worker.current?.terminate();}}
      }catch(cause){setError(cause instanceof Error?cause.message:'Invalid brain message.');connected.current=false;setStatus('offline');socket.current?.close();worker.current?.terminate();}
    };
    if(runtime==='browser'){
      setLoading('Loading the neural engine…');
      let localWorker: Worker;
      try { localWorker=new Worker(new URL('./browserBrain.worker.ts',import.meta.url),{type:'module'}); }
      catch { setUnavailable(true);setError('The browser could not start the neural engine.');setStatus('offline');return; }
      worker.current=localWorker;
      localWorker.onmessage=event=>receive(event.data);
      localWorker.onerror=event=>{if(!disposed){setUnavailable(true);setError(`Browser brain stopped: ${event.message||'worker failure'}. Reload the brain to retry.`);connected.current=false;setStatus('offline');localWorker.terminate();}};
      localWorker.postMessage({type:'init',assetBase:new URL('browser-brain/',document.baseURI).href});
      const foreground=()=>{lastMessage=performance.now();};
      document.addEventListener('visibilitychange',foreground);
      const watchdog=setInterval(()=>{
        if(document.hidden)return;
        const gpuStalled=(!receivedMetadata&&initializingGPU||receivedMetadata&&latest.current?.running)&&performance.now()-lastMessage>20000;
        if(gpuStalled||!receivedMetadata&&performance.now()-lastMessage>90000){localWorker.terminate();connected.current=false;setUnavailable(!!gpuStalled);setError('Loading stalled. Retry to reuse verified downloaded files.');setStatus('offline');}
      },2000);
      return ()=>{disposed=true;connected.current=false;clearInterval(watchdog);document.removeEventListener('visibilitychange',foreground);localWorker.terminate();worker.current=null;};
    }
    const connection=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/api/neural/ws`);socket.current=connection;
    const offline=()=>connection.close();window.addEventListener('offline',offline);
    const heartbeat=setInterval(()=>{if(performance.now()-lastMessage>15000)connection.close();},3000);
    const timeout=setTimeout(()=>{if(!receivedMetadata)connection.close();},15000);
    connection.onmessage=event=>{try{receive(JSON.parse(event.data));}catch{setError('Invalid backend message.');connection.close();}};
    connection.onclose=()=>{clearTimeout(timeout);clearInterval(heartbeat);connected.current=false;if(!disposed){setStatus('offline');setError('Local brain disconnected. The last received frame is frozen.');}};
    connection.onerror=()=>{if(!disposed)setError('Cannot reach the local brain. Start npm run dev:local, then reconnect.');};
    return ()=>{disposed=true;connected.current=false;window.removeEventListener('offline',offline);clearInterval(heartbeat);clearTimeout(timeout);connection.close();socket.current=null;};
  },[enabled,runtime,attempt]);
  useEffect(()=>{
    let frame=0;
    const update=(now:number)=>{
      const current=latest.current;
      if(current&&connected.current){
        const t=transition.current, blend=current.running?Math.min(1,(now-t.received)/(t.duration*1000)):1;
        const target=t.finishing&&blend<1?{...t.finishing}:neuralCue(current,true);
        const elapsed=t.from+(current.world.elapsed-t.from)*blend;clock.current={time:elapsed,elapsed};
        target.progress=t.fromProgress+(target.progress-t.fromProgress)*blend;visualCue.current=target;
      }
      else visualCue.current.active=false;
      frame=requestAnimationFrame(update);
    };frame=requestAnimationFrame(update);return ()=>cancelAnimationFrame(frame);
  },[]);
  const send=useCallback((command:NeuralCommand,options:{enabled?:boolean;seed?:number;controller?:'neural'|'recipe';recipe_id?:string;continuous?:boolean}={})=>{
    const current=latest.current;if(!current)return;setError('');
    const message={command,run_id:current.run_id,...options};
    if(runtime==='browser')worker.current?.postMessage(message);
    else if(socket.current?.readyState===WebSocket.OPEN)socket.current.send(JSON.stringify(message));
  },[runtime]);
  const downloadLog=useCallback((report?:CookingReport)=>{if(report)downloadReport(report);else if(runtime==='browser')send('export_log');else window.open('/api/neural/cooking-log','_blank','noopener');},[runtime,send]);
  const reconnect=useCallback(()=>setAttempt(value=>value+1),[]);
  const cancelLoad=useCallback(()=>{if(runtime==='browser')setAttempt(0);},[runtime]);
  return {runtime,status,snapshot,metadata,error,loading,progress,unavailable,history,downloadLog,clock,visualCue,send,reconnect,cancelLoad};
}
export type NeuralConnection = ReturnType<typeof useNeural>;
