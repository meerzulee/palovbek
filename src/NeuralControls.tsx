import { useLanguage } from './i18n';
import { useState } from 'react';
import { Beef, Check, ChevronDown, CookingPot, ExternalLink, Flame, Infinity as InfinityIcon, Pause, Play, RotateCcw, Save, Settings2, Slice, Thermometer, Utensils, Wheat, Wind } from 'lucide-react';
import type { NeuralConnection } from './useNeural';
import { RECIPES } from './recipes';
import { IngredientIllustration } from './illustrations';
import type { IngredientId } from './simulation';
const recipePictures:Record<string,IngredientId>={classic:'rice',quince:'quince',wedding:'egg',bedana:'quail'};
const stageIcons=[Flame,Beef,Slice,CookingPot,Wheat,Wind,Utensils];
const stageNames=['Heat','Brown','Carrots','Zirvak','Rice','Steam','Serve'];

export function NeuralControls({ connection, onStart, onLoad }: { connection: NeuralConnection; onStart: () => void; onLoad: () => void }) {
  const { t } = useLanguage();
  const { snapshot: state, status, error, send } = connection;
  const [seed, setSeed] = useState('17');
  const [selected, setSelected] = useState<string | null>(null);
  const online = status === 'connected' && !!state;
  const validSeed = /^\d+$/.test(seed) && Number(seed) <= 2147483647;
  const running = online && state.running;
  const browser = connection.runtime==='browser';
  const recipeMode = state?.controller !== 'neural';
  const recipeId = selected ?? state?.recipe?.recipe_id ?? 'classic';
  const recipe = RECIPES.find(item => item.id === recipeId)!;
  const activeRecipe = state?.recipe?.recipe_id === recipeId;
  const started = !!state && state.world.elapsed > 0 && !state.world.outcome;
  const cook = (continuous = false) => { onStart(); send('cook_recipe', { recipe_id: recipeId, seed: Number(seed), continuous }); setSelected(null); };
  const primaryLabel = running && (!recipeMode || activeRecipe) ? recipeMode ? 'Pause cooking' : 'Pause experiment' : !recipeMode ? 'Run neural experiment' : started && activeRecipe ? 'Continue cooking' : 'Cook this plov';
  return <section className="controls-card neural-controls" aria-label={t("Neural experiment controls")}>
    <div className="section-heading"><h2>{t("Choose your plov")}</h2></div>
    {error && <p className="neural-error" role="alert">{t(error)}</p>}
    <div className="recipe-menu" role="group" aria-label={t("Plov recipes")}>{RECIPES.map(item => <button key={item.id} aria-pressed={recipeId === item.id} aria-label={t(`Select ${item.name}`)} onClick={() => setSelected(item.id)}><IngredientIllustration type={recipePictures[item.id]}/><span><strong>{t(item.name)}</strong></span>{recipeId === item.id && <Check size={18}/>}</button>)}</div>
    {!recipeMode && <button className="switch-controller" disabled={!online || !validSeed} onClick={() => { send('reset', {controller:'recipe', recipe_id:recipeId, seed:Number(seed)}); }}>{t("Use this recipe")}</button>}
    {(!browser || (online && !activeRecipe)) && <div className="cook-buttons"><button className="cook-button" disabled={!online || !validSeed || (!recipeMode && !!state?.world.outcome)} onClick={() => { if (recipeMode && !activeRecipe) cook(); else if (running) send('pause'); else if (recipeMode && !started) cook(); else { onStart(); send('start'); } }}>{running && (!recipeMode || activeRecipe) ? <Pause size={16}/> : <Play size={16}/>} {t(primaryLabel)}</button></div>}
    {recipeMode && !browser && <button className={`continuous-button ${state?.continuous ? 'is-on' : ''}`} disabled={!online || !validSeed} onClick={() => state?.continuous ? send('pause') : cook(true)}><InfinityIcon size={17}/><span>{state?.continuous ? t('Stop continuous kitchen') : t('Start 24/7 kitchen')}<small>{state?.continuous ? t('Cycles recipes · keeps cooking without viewers') : t('Starts a fresh batch, then cycles all four recipes')}</small></span></button>}
    <details className="model-settings detail-panel"><summary><Settings2 size={18}/>  {t("Settings & recipe")} <ChevronDown size={18}/></summary>
    <p className="recipe-description">{t(recipe.description)} <a href={recipe.source} target="_blank" rel="noreferrer" aria-label={t(`${recipe.name} recipe source`)} title={t(recipe.source_label)}>{t("Recipe source")} <ExternalLink size={10}/></a></p>
    <div className="neural-connection" role="status"><span className={`live-dot ${!online || !running ? 'resting' : ''}`}/>{online ? `${state.running ? t('Running') : t('Paused')} · ${browser ? state.performance.backend==='gpu'?t('browser WebGPU'):t('browser CPU') : t('local CPU')}` : status === 'connecting' ? browser ? t('Loading browser brain…') : t('Connecting to local brain…') : browser ? t('Browser brain ready to load') : t('Local brain offline')}{state?.continuous && <span className="continuous-badge">24/7</span>}</div>
    {!online && (browser ? <div className="browser-setup">{status==='connecting'?<><p>{t(connection.loading)}</p><progress aria-label={t("Brain download progress")} max="1" value={connection.progress}/><small>{Math.round(connection.progress*100)}{t("% of connectivity chunks verified")}</small><button className="text-button" onClick={onLoad}>{t("View loading progress")}</button></>:<><p>{t("166,700 neurons · 25.6 million connections. About 79 MB on first load; verified files are cached.")}</p><button className="cook-button" onClick={onLoad}>{t("Load browser brain")}</button><small>{t("Runs on your device. WebGPU with a CPU fallback.")}</small></>}</div>:<div className="neural-offline"><code>npm run dev:local</code><button onClick={connection.reconnect}>{t("Reconnect")}</button></div>)}
    <p className="neural-note controller-disclosure">{recipeMode ? browser ? t('Recipe rules keep the order. Measured output spikes influence portions (±20%) and brief pauses. Whole bulbs, eggs, and birds keep their recipe count. This readout is engineered, not learned.') : t('Recipe rules choose the actions. The live neural model senses the kitchen; it has not learned this recipe.') : t('No recipe teacher or rescue. Simulated output spikes choose actions through an untrained readout.')}</p>
    <div className="neural-seed"><label htmlFor="neural-seed">{t("Episode seed")}</label><input id="neural-seed" inputMode="numeric" value={seed} onChange={event => setSeed(event.target.value)}/><button disabled={!online || !validSeed} onClick={() => send('reset', { seed: Number(seed), recipe_id: recipeId })}><RotateCcw size={13}/>  {t("Reset")}</button></div>
    {online && <>
      <div className="neural-stats"><div><span>{t("Neural time")}</span><strong data-testid="neural-time">{state.neural.simulated_seconds.toFixed(2)}  {t("s")}</strong></div><div><span>{t("Kitchen time")}</span><strong>{state.world.elapsed.toFixed(1)} / {state.world.time_limit}  {t("s")}</strong></div><div><span>{t("Simulation speed")}</span><strong>{state.performance.simulation_speed.toFixed(2)}{t("× real time")}</strong></div><div><span>{browser ? t('Engine arrays (est.)') : t('Model memory')}</span><strong>{(state.performance.rss_bytes / 2 ** 20).toFixed(0)}  {t("MiB")}</strong></div></div>
      <details className="neural-interventions"><summary>{t("Test the neural connection")}</summary><p>{recipeMode ? browser?t('These controls alter simulated spikes and subsequent portion choices. Recipe order and readiness checks still apply.'):t('These controls change neural activity. The recipe instructions continue independently.') : t('A started action finishes; later decisions use the changed activity.')}</p><label><input type="checkbox" checked={state.sensory_enabled} onChange={event => send('sensory', { enabled: event.target.checked })}/>  {t("Sensory input enabled")}</label><label><input type="checkbox" checked={state.output_silenced} onChange={event => send('silence_outputs', { enabled: event.target.checked })}/> {browser?t('Disable recurrent transmission'):t('Silence output neurons')}</label></details>
      {!browser && <div className="neural-save"><button onClick={() => send('checkpoint')}><Save size={13}/>  {t("Save checkpoint")}</button><button disabled={!state.checkpoint_available} onClick={() => send('restore')}>{t("Restore saved state")}</button></div>}
      {state.checkpoint_available && <p className="neural-note">{t("Checkpoint saved locally. Restore pauses at the saved state.")}</p>}
      {recipeMode && !browser && <button className="switch-controller" onClick={() => send('reset', {controller:'neural', seed:Number(seed) || 17})}>{t("Free neural experiment →")}</button>}
    </>}
    {browser ? <p className="neural-note"><a href="/browser-brain/data/manifest.json" target="_blank" rel="noreferrer">{t("Connectome provenance ↗")}</a> · <a href="/browser-brain/LICENSE.txt" target="_blank" rel="noreferrer">{t("Licenses ↗")}</a><br/>{t("A fresh session per visit. This tab must stay open to cook. Weights are fixed; a neural readout adjusts portions. No training or server required.")}</p> : <p className="neural-note"><a href="/api/neural/manifest" target="_blank" rel="noreferrer">{t("Graph provenance ↗")}</a> · <a href="/api/neural/report" target="_blank" rel="noreferrer">{t("Validation reports ↗")}</a></p>}
    </details>
  </section>;
}

export function NeuralEpisode({ connection }: { connection: NeuralConnection }) {
  const { t } = useLanguage();
  const state = connection.snapshot, world = state?.world, recipe = state?.recipe;
  return <section className="neural-episode lab-panel" aria-label={t("Neural episode observations")}>
    <div className="section-heading"><h2>{t(recipe?.label ?? 'Ready to cook')}</h2><strong className="recipe-percent">{recipe?.progress ?? 0}%</strong></div>
    <div className="progress-track" role="progressbar" aria-label={t("Recipe progress")} aria-valuenow={recipe?.progress??0} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${recipe?.progress??0}%`}}/></div>
    <ol className="recipe-stages">{stageIcons.map((Icon,index)=>{
      const completed=!!recipe && (recipe.done || index<recipe.stage), current=!!recipe && !recipe.done && index===recipe.stage;
      return <li key={stageNames[index]} aria-current={current?'step':undefined} title={t(recipe?.stages[index]??stageNames[index])} className={completed?'complete':current?'current':''}><span>{completed?<Check size={21}/>:<Icon size={23}/>}</span><strong>{t(stageNames[index])}</strong></li>;
    })}</ol>
    {world && <div className="kitchen-gauges">
      <div className="gauge-temperature"><Thermometer size={22}/><span>{t("Qazan")}</span><strong>{Math.round(world.temperature)}<small>°C</small></strong><meter min={0} max={200} value={world.temperature} aria-label={t("Qazan temperature")}/></div>
      <div className="gauge-fire"><Flame size={22}/><span>{t("Fire")}</span><strong>{Math.round(world.heat*100)}<small>%</small></strong><meter min={0} max={1} value={world.heat} aria-label={t("Fire intensity")}/></div>
      <div className="gauge-rice"><Wheat size={22}/><span>{t("Rice hydration")}</span><strong>{Math.round(world.hydration*100)}<small>%</small></strong><meter min={0} max={1} value={world.hydration} aria-label={t("Rice hydration")}/></div>
    </div>}
    {!!world?.mistakes && <p className="cooking-mistakes">{world.mistakes} {world.mistakes===1?t('mistake'):t('mistakes')}  {t("so far")}</p>}
    <span className="sr-only" data-testid="neural-decision">{state?.decision?.action??t('none yet')}</span>
  </section>;
}
