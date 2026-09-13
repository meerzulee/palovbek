import { useLanguage } from './i18n';
import { useEffect, useRef } from 'react';
import NeuralBrainPanel from './NeuralBrainPanel';
import type { NeuralConnection } from './useNeural';
import { actionLabel } from './neural';
import { Activity, ChevronDown, Zap } from 'lucide-react';

function SpikeRaster({connection}:{connection:NeuralConnection}) {
  const { t, locale } = useLanguage();
  const canvas=useRef<HTMLCanvasElement>(null),previous=useRef('');
  const data=connection.snapshot;
  useEffect(()=>{
    const node=canvas.current;if(!node||!data)return;
    const context=node.getContext('2d');if(!context)return;
    const key=`${data.run_id}:${data.sequence}`;if(previous.current===key)return;
    if(!previous.current.startsWith(data.run_id+':'))context.clearRect(0,0,node.width,node.height);
    previous.current=key;
    if(!data.sequence)return;
    context.drawImage(node,-3,0);context.clearRect(node.width-3,0,3,node.height);
    const counts=data.neural.sample_counts,rows=120;
    for(let i=0;i<rows;i++){
      const index=Math.floor(i*counts.length/rows),count=counts[index];
      if(!count)continue;
      const region=connection.metadata?.sample_cells[index]?.region??0;
      context.fillStyle=['#72cbd7','#e69c5e','#d3bd7e'][region];context.globalAlpha=Math.min(1,.4+count*.15);context.fillRect(node.width-3,i*2,2,2);
    }
    context.globalAlpha=1;
  },[data,connection.metadata]);
  return <section className="spike-raster" aria-label={t("Measured spike raster")}><div className="instrument-heading"><span>{t("Spike history")}</span><strong>{data?.neural.window_spikes.toLocaleString(locale)??'—'}  {t("/ window")}</strong></div><canvas ref={canvas} width="300" height="240" role="img" aria-label={t("Spike history of 120 sampled neurons. Each mark is a measured simulated spike count, newest at right.")}/><div className="raster-labels"><span>{t("120 sampled cells")}</span><span>{t("time →")}</span></div><p>{t("Each column:")} {Math.round((data?.neural.window_seconds??.01)*1000)}  {t("ms of neural time. Pauses add no marks.")}</p></section>;
}
export default function NeuralDashboard({connection}:{connection:NeuralConnection}) {
  const { t, locale } = useLanguage();
  const state=connection.snapshot,data=state?.neural,online=connection.status==='connected';
  const active=data?.active_cells??connection.metadata?.sample_cells.flatMap((cell,i)=>{const count=data?.sample_counts[i]??0;return count?[{body_id:cell.body_id,type:cell.type,count,hz:count/(data?.window_seconds??.05)}]:[]}).sort((a,b)=>b.count-a.count).slice(0,6)??[];
  return <section className="neural-dashboard" aria-label={t("Brain activity dashboard")}>
    <div className="brain-instruments"><NeuralBrainPanel connection={connection}/></div>
    <div className="neuron-telemetry">
      <div><span><Activity size={18}/>  {t("Active neurons")}</span><strong data-testid="active-neurons">{data?.active_neurons.toLocaleString(locale)??'—'}</strong></div>
      <div><span><Zap size={18}/>  {t("Spikes /")} {Math.round((data?.window_seconds??.01)*1000)}  {t("ms")}</span><strong>{data?.window_spikes.toLocaleString(locale)??'—'}</strong></div>
    </div>
    <details className="neuron-details detail-panel"><summary><Activity size={18}/>  {t("Neuron details")} <ChevronDown size={18}/></summary>
      <SpikeRaster connection={connection}/>
      <div className="detail-stats"><span>{t("Neurons in model")}<strong>{connection.metadata?.neurons.toLocaleString(locale)??t('166,700')}</strong></span><span>{t("Total spikes")}<strong>{data?.total_spikes.toLocaleString(locale)??'—'}</strong></span></div>
      <section className="motor-readout"><div className="instrument-heading"><span>{t("Action readout")}</span><span className={online&&state?.running?'status-firing':'status-quiet'}><i/>{!online?t('Offline'):!state?.running?t('Paused'):data?.window_spikes?t('Firing'):t('Silent')}</span></div><div className="action-instrument"><div><small>{t("Action")}</small><strong>{t(actionLabel(state?.world.pending?.name??state?.decision?.action??'standby'))}</strong><span>{state?.world.held?t(`Holding ${state.world.held_quantity?`${state.world.held_quantity.value} ${state.world.held_quantity.unit} `:''}${state.world.held}`):t('Forelegs free')}</span></div><div><small>{t("Output rate")}</small><strong>{(data?.population_hz[2]??0).toFixed(2)} <em>{t("Hz")}</em></strong></div></div></section>
      <section className="active-cells"><div className="instrument-heading"><span>{t("Active neurons")}</span><span>{t("Latest")} {Math.round((data?.window_seconds??.01)*1000)}  {t("ms")}</span></div><div className="active-cells-header"><span>{t("Cell / ID")}</span><span>{t("Spikes")}</span><span>{t("Rate")}</span></div>{active.slice(0,4).map(cell=><div className="active-cell-row" key={cell.body_id}><span><i className={state?.running?'firing-cell':''}/><strong>{cell.type}</strong><small>{cell.body_id}</small></span><span>{cell.count}</span><span>{cell.hz.toFixed(0)}  {t("Hz")}</span></div>)}{!active.length&&<p className="no-active-cells">{online?t('No cells fired in the latest window.'):t('Load the brain to see neuron activity.')}</p>}</section>
      <p className="detail-explanation">{t("The 3D view shows")} {connection.metadata?.sample_cells.length.toLocaleString(locale)??t('sampled')}  {t("neuron locations. Brightness comes from simulated spikes; pausing freezes the last measurement. Recipe rules set the order;")} {connection.runtime==='browser'?t('an engineered neural readout adjusts portions and brief pauses.'):t('the local recipe controller observes neural activity.')}  {t("The model has not learned cooking.")}</p>
    </details>
  </section>;
}
