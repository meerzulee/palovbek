import { useLanguage, LanguageSwitcher } from './i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, AudioLines, BookOpen, Camera, Check, CircleHelp, Clock3, Coffee, Ellipsis, CookingPot, Expand, Grid2X2, House, Flame, Leaf, MoveUpRight, Pause, Play, RotateCcw, Settings2, Slice, Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import KitchenScene from './KitchenScene';
import BrainPanel from './BrainPanel';
import BrainLoadDialog from './BrainLoadDialog';
import { hasCachedBrowserBrain } from './browserBrainCache';
import { checkBrowserBrainSupport } from './browserSupport';
import KitchenToolbar, { DemoToolbar } from './KitchenToolbar';
import NeuralDashboard from './NeuralDashboard';
import { NeuralControls, NeuralEpisode } from './NeuralControls';
import CookingLog from './CookingLog';
import { ingredientsFor, RECIPES } from './recipes';
import { useNeural } from './useNeural';
import { neuralCooking, neuralCue } from './neural';
import { chefCue } from './chefPerformance';
import { DEFAULT_PLAYBACK_SPEED } from './playback';
import { useMotionClock } from './useMotionClock';
import type { CameraMode, ChefAction } from './KitchenScene';
import { FlyIllustration, IngredientIllustration } from './illustrations';
import { INGREDIENTS, INITIAL_STATE, STAGES, TOTAL_DURATION, stageAt, tick } from './simulation';
import type { CookingState, IngredientId } from './simulation';

type LogEntry = { id: number; text: string; time: string; type: 'start' | 'ingredient' | 'stage' | 'done' };
const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2,'0')}:${Math.floor(seconds % 60).toString().padStart(2,'0')}`;
const ingredientById = new Map(INGREDIENTS.map(item=>[item.id,item]));

function App() {
  const { t } = useLanguage();
  const [cooking, setCooking] = useState<CookingState>({ ...INITIAL_STATE, speed: DEFAULT_PLAYBACK_SPEED });
  const [cameraMode, setCameraMode] = useState<CameraMode>('yard');
  const [chefAction, setChefAction] = useState<ChefAction>('auto');
  const [follow, setFollow] = useState(false);
  const motionClock = useMotionClock(cooking, chefAction);
  const [neuralMode, setNeuralMode] = useState(true);
  const [browserSupport, setBrowserSupport] = useState<'checking' | 'supported' | 'unavailable'>('checking');
  const [demoFallback, setDemoFallback] = useState(false);
  const choseMode = useRef(false);
  const [brainRuntime,setBrainRuntime]=useState<'browser'|'local'>('browser');
  const neural = useNeural(neuralMode,brainRuntime);
  const recipeMode = neuralMode && neural.snapshot?.controller === 'recipe';
  const displayedIngredients = neuralMode ? ingredientsFor(neural.snapshot?.world.required_ingredients) : INGREDIENTS;
  const displayCooking = neuralMode ? neuralCooking(neural.snapshot, neural.status === 'connected') : cooking;
  const localTools=['localhost','127.0.0.1'].includes(location.hostname);
  const cue = neuralMode ? neuralCue(neural.snapshot, neural.status === 'connected') : chefCue(cooking, chefAction);
  if(neuralMode&&brainRuntime==='browser'&&!neural.snapshot){cue.label='Browser brain on standby';cue.thought='Do‘ppi on. Load my brain, and let’s make osh.';}
  const [resetView, setResetView] = useState(0);
  const [modal, setModal] = useState<'about' | 'recipe' | null>(null);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [sound, setSound] = useState(false);
  const [toast, setToast] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([{ id: 0, text: 'Apron on. Doppi on. Ready to cook.', time: '00:00', type: 'start' }]);
  const previous = useRef(cooking);
  const logCounter = useRef(1);
  const stage = stageAt(cooking.elapsed);
  const done = cooking.elapsed >= TOTAL_DURATION;
  const dishPreview = !cooking.started && cooking.added.length === 0;
  const currentStage = STAGES[stage];
  const progress = Math.round(cooking.elapsed / TOTAL_DURATION * 100);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headerMenuRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const compact = matchMedia('(max-width:700px)');
    const sync = () => { if (headerMenuRef.current) headerMenuRef.current.open = !compact.matches; };
    sync(); compact.addEventListener('change', sync);
    return () => compact.removeEventListener('change', sync);
  }, [neuralMode, brainRuntime]);
  const soundContext = useRef<AudioContext | null>(null);
  const soundGain = useRef<GainNode | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startDemo = useCallback((fallback = false) => {
    neural.cancelLoad();
    setNeuralMode(false);setBrainRuntime('browser');setLoadDialogOpen(false);setDemoFallback(fallback);
    setCooking({...INITIAL_STATE,added:[],started:true,running:true,speed:DEFAULT_PLAYBACK_SPEED});
    setChefAction('auto');setFollow(true);
  }, [neural.cancelLoad]);

  useEffect(() => {
    let disposed = false;
    void (async () => {
      const supported = await checkBrowserBrainSupport();
      if (disposed) return;
      setBrowserSupport(supported ? 'supported' : 'unavailable');
      if (choseMode.current) return;
      if (!supported) { startDemo(true); return; }
      const cached = await hasCachedBrowserBrain();
      if (disposed || choseMode.current) return;
      if (cached) neural.reconnect(); else setLoadDialogOpen(true);
    })();
    return () => { disposed = true; };
  }, [neural.reconnect, startDemo]);

  useEffect(() => {
    if (!neuralMode || brainRuntime !== 'browser') return;
    if (neural.unavailable) { setBrowserSupport('unavailable'); startDemo(true); return; }
    if (neural.status === 'connected') setLoadDialogOpen(false);
    else if (neural.status === 'offline' && neural.error) setLoadDialogOpen(true);
  }, [neuralMode, brainRuntime, neural.status, neural.error, neural.unavailable, startDemo]);

  useEffect(() => {
    if(neuralMode && neural.snapshot?.running) setFollow(true);
  }, [neuralMode, neural.snapshot?.run_id, neural.snapshot?.running]);

  useEffect(() => {
    let last = performance.now();
    const interval = setInterval(() => { const now = performance.now(); const seconds = Math.min((now - last) / 1000, .5); last = now; if (!document.hidden) setCooking(state => tick(state, seconds)); }, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const before = previous.current;
    const next: LogEntry[] = [];
    const add = (text: string, type: LogEntry['type']) => next.push({id: logCounter.current++, text, type, time: formatTime(cooking.elapsed)});
    if (cooking.started && !before.started) add('A little fire. A lot of ambition.', 'start');
    for (const id of cooking.added) if (!before.added.includes(id)) add(`${ingredientById.get(id)?.name ?? id} goes into the qazan.`, 'ingredient');
    if (stageAt(before.elapsed) !== stage) add(currentStage.action + '.', 'stage');
    if (done && before.elapsed < TOTAL_DURATION) add('Osh tayyor! Plov is ready. Everyone, gather round.', 'done');
    if (next.length) setLogs(items => [...items, ...next].slice(-30));
    previous.current = cooking;
  }, [cooking, currentStage.action, done, stage]);

  useEffect(() => {
    if (modal) dialogRef.current?.showModal(); else dialogRef.current?.close();
  }, [modal]);

  useEffect(() => {
    if (!expanded) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = (event: KeyboardEvent) => { if(event.key==='Escape') setExpanded(false); };
    document.addEventListener('keydown', close);
    return () => { document.body.style.overflow=old; document.removeEventListener('keydown',close); };
  }, [expanded]);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); void soundContext.current?.close(); }, []);
  useEffect(() => {
    const context=soundContext.current;
    if(context&&soundGain.current) soundGain.current.gain.setTargetAtTime(sound ? .018 + displayCooking.heat * .00028 : 0,context.currentTime,.25);
  }, [sound,displayCooking.heat]);

  const notify = (message: string) => { setToast(message); if(toastTimer.current)clearTimeout(toastTimer.current); toastTimer.current=setTimeout(()=>setToast(''),3300); };
  const toggleCooking = () => {
    if (!cooking.started || chefAction !== 'auto') setFollow(true);
    setChefAction('auto');
    if (done) { resetKitchen(true); return; }
    setCooking(state => ({ ...state, started: true, running: !state.running }));
  };
  const resetKitchen = (start = false) => {
    const initial = { ...INITIAL_STATE, added: [] as IngredientId[], started: start, running: start, speed: cooking.speed };
    previous.current = { ...INITIAL_STATE };
    setCooking(initial); setLogs([{id:logCounter.current++,text:'Apron on. Doppi on. Ready to cook.',time:'00:00',type:'start'}]);
    setChefAction('auto'); setFollow(start); setCameraMode('yard'); setResetView(value => value + 1);
    if(!start)notify('A fresh qazan. A fresh start.');
  };
  const addIngredient = (id: IngredientId) => {
    if(cooking.added.includes(id)||done)return;
    setCooking(state=>({...state,added:[...state.added,id]}));
    const item = ingredientById.get(id);
    if(item)notify(`${t(item.name)} added. ${item.note}`);
  };
  const selectCamera = (mode: CameraMode) => { setCameraMode(mode); setFollow(false); setResetView(value => value + 1); };
  const previewMove = (move: 'chop'|'stir') => {
    const active=chefAction===move;
    setChefAction(active?'auto':move);
    selectCamera(active?'yard':move==='chop'?'prep':'qazan');
    if(!active)setCooking(state=>({...state,running:false}));
  };
  const toggleSound = async () => {
    try {
      if(!soundContext.current) {
        const ctx=new AudioContext();soundContext.current=ctx;
        const buffer=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate);const data=buffer.getChannelData(0);let brown=0;
        for(let i=0;i<data.length;i++){brown=(brown+Math.random()*.04-.02)/1.02;data[i]=brown*3.5+(Math.random()>.9995?(Math.random()-.5)*.9:0);}
        const noise=ctx.createBufferSource();noise.buffer=buffer;noise.loop=true;
        const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1700;
        const gain=ctx.createGain();gain.gain.value=0;soundGain.current=gain;
        noise.connect(filter);filter.connect(gain);gain.connect(ctx.destination);noise.start();
      }
      await soundContext.current.resume();setSound(value=>!value);
    } catch { notify('Sound is unavailable in this browser.'); }
  };

  const navigation = <nav aria-label={t("Main navigation")}><details ref={headerMenuRef} className="header-menu"><summary aria-label={t("Menu")} title={t("Menu")}><Ellipsis size={22}/></summary><div className="header-links" onClick={event=>{if(matchMedia("(max-width:700px)").matches&&(event.target as HTMLElement).closest("button")&&!event.currentTarget.querySelector(".app-settings")?.contains(event.target as Node))event.currentTarget.closest("details")?.removeAttribute("open");}}>
        <button aria-label={t("The experiment")} onClick={()=>setModal('about')}><CircleHelp size={20}/><span>{t("About")}</span></button>
        <button aria-label={t("The recipe")} onClick={()=>setModal('recipe')}><BookOpen size={20}/><span>{t("Recipes")}</span></button>
        <details className="app-settings"><summary aria-label={t("Settings")}><Settings2 size={20}/><span>{t("Settings")}</span></summary>      <div className="experiment-modes" onClick={event=>{if((event.target as HTMLElement).closest('button'))event.currentTarget.closest('details')?.removeAttribute('open');}} role="group" aria-label={t("Experiment mode")}>
        <button aria-pressed={!neuralMode} onClick={() => { choseMode.current=true;neural.send('pause');setLoadDialogOpen(false);setNeuralMode(false); }}>{t("Scripted cooking demo")}</button>
        <button disabled={browserSupport!=='supported'} title={browserSupport==='unavailable'?t('The brain simulation is unavailable on this device.'):undefined} aria-pressed={neuralMode&&brainRuntime==='browser'} onClick={()=>{choseMode.current=true;neural.send('pause');setDemoFallback(false);setCooking(state=>({...state,running:false}));setChefAction('auto');setBrainRuntime('browser');setNeuralMode(true);}}>{t("Browser brain")}</button>
        {localTools && <button aria-pressed={neuralMode&&brainRuntime==='local'} onClick={() => { choseMode.current=true;neural.send('pause');setLoadDialogOpen(false);setBrainRuntime('local');setCooking(state => ({ ...state, running: false })); setChefAction('auto'); setNeuralMode(true); }}>{t("Live neural experiment")}</button>}
        <span>{neuralMode ? recipeMode || brainRuntime==='browser' ? t('Your own fly · recipe instructions · real simulated spikes') : t('Untrained neural readout · failure allowed') : t('A playful 90-second recipe, with illustrated brain activity')}</span>
      </div>
</details>
        </div></details><LanguageSwitcher/>
      </nav>;

  return <>
    <header className="site-header">
      <a className="brand" href="#" aria-label={t("Palovbek home")}><span className="brand-mark"><FlyIllustration/></span><span>Palovbek</span></a>
      {neuralMode&&brainRuntime==='browser' ? <KitchenToolbar connection={neural} onLoad={()=>{if(browserSupport==='supported')setLoadDialogOpen(true);}} onStart={()=>setFollow(true)}>{navigation}</KitchenToolbar> : !neuralMode&&demoFallback ? <DemoToolbar running={cooking.running} finished={done} onToggle={toggleCooking}>{navigation}</DemoToolbar> : navigation}
    </header>

    <main className={neuralMode?'lab-main minimal-main':'minimal-main'}>
      {!neuralMode&&demoFallback&&<p className="demo-notice" role="status"><Play size={18}/><span><strong>{t('Demo mode')}</strong> {t('The brain simulation is unavailable on this device.')}</span></p>}
      <div className={`dashboard ${neuralMode?'neural-lab':''}`}>
        <div className="kitchen-column">
          <section className={`kitchen-card ${expanded?'is-expanded':''}`} aria-label={t("The 3D plov yard")}>
            <div className="scene-topline"><div className="scene-title"><span className="live-dot"/> <CookingPot size={20}/>  <span>{t("Kitchen")}</span></div><div className="chef-moves">{!neuralMode && <><span>{t("TRY A MOVE")}</span><button aria-label={t('Chop carrots')} title={t('Chop carrots')} aria-pressed={chefAction==='chop'} className={chefAction==='chop'?'active':''} onClick={()=>previewMove('chop')}><Slice size={18}/><span>{t("Chop carrots")}</span></button><button aria-label={t('Stir the qazan')} title={t('Stir the qazan')} aria-pressed={chefAction==='stir'} className={chefAction==='stir'?'active':''} onClick={()=>previewMove('stir')}><CookingPot size={18}/><span>{t("Stir the qazan")}</span></button></>}<button className={`follow-button ${follow?'active':''}`} aria-label={t("Follow Palovbek")} aria-pressed={follow} onClick={()=>setFollow(value=>!value)} title={t("Automatically frame Palovbek and his tools. Drag the scene to take over.")}><Camera size={18}/><span>{follow?t('Following'):t('Follow Palovbek')}</span></button></div><div className="scene-tools"><button className="sound-button" onClick={toggleSound} aria-label={sound?t('Mute fire sounds'):t('Enable fire sounds')} title={sound?t('Mute fire sounds'):t('Enable fire sounds')}>{sound?<Volume2 size={16}/>:<VolumeX size={16}/>}</button><button onClick={()=>setExpanded(v=>!v)} aria-label={expanded?t('Exit expanded view'):t('Expand kitchen')} title={expanded?t('Exit expanded view'):t('Expand kitchen')}>{expanded?<X size={17}/>:<Expand size={17}/>}</button></div></div>
            <KitchenScene neural={neuralMode ? neural.snapshot : null} cueOverride={neuralMode ? neural.visualCue : undefined} cooking={displayCooking} cameraMode={cameraMode} chefAction={chefAction} resetView={resetView} thought={t(cue.thought)} clock={neuralMode ? neural.clock : motionClock} follow={follow} onManualCamera={()=>setFollow(false)}/>

            <div className="scene-caption"><span className="scene-caption-icon"><Flame size={16}/></span><div><strong>{neuralMode ? t(cue.label) : chefAction==='chop'?t('A little knife work. A lot of concentration.'):chefAction==='stir'?t('Keep calm and stir the qazan.'):done?t('A little masterpiece.'):cooking.running?t(cue.label):cooking.started?t('Taking a tiny breather.'):dishPreview?t('Golden rice. A generous qazan.'):t('Good things start with a little fire.')}</strong><span>{neuralMode ? (neural.status !== 'connected' ? brainRuntime==='browser'?'Initialize the model to begin · computation stays on your device':'Disconnected · last received state is frozen' : recipeMode ? brainRuntime==='browser'?'Recipe order · neural portions · measured kitchen state':'Recipe instructions control actions · neural activity is observed live' : 'Actions selected from neural output spikes · no cooking script') : chefAction!=='auto'?t('Practicing a move. The recipe timer is paused.'):done?t('Made with six legs and a whole lot of heart.'):cooking.running?(follow?t('Camera following Palovbek · drag to take over'):t('Palovbek is on it. Turn on Follow Palovbek for close-ups.')):dishPreview?t('A peek at the finished plov. Start a fresh batch below.'):t('The ingredients are ready. Our chef is… mostly ready.')}</span></div></div>
            <div className="scene-bottomline"><div className="view-tabs" aria-label={t("Camera view")}><button className={!follow&&cameraMode==='yard'?'active':''} aria-pressed={!follow&&cameraMode==='yard'} onClick={()=>selectCamera('yard')} title={t("The yard")} aria-label={t("The yard")}><House size={20}/><span>{t("The yard")}</span></button><button className={!follow&&cameraMode==='prep'?'active':''} aria-pressed={!follow&&cameraMode==='prep'} onClick={()=>selectCamera('prep')} title={t("Prep cam")} aria-label={t("Prep cam")}><Slice size={20}/><span>{t("Prep cam")}</span></button><button className={!follow&&cameraMode==='qazan'?'active':''} aria-pressed={!follow&&cameraMode==='qazan'} onClick={()=>selectCamera('qazan')} title={t("Qazan cam")} aria-label={t("Qazan cam")}><CookingPot size={20}/><span>{t("Qazan cam")}</span></button><button className={!follow&&cameraMode==='tandyr'?'active':''} aria-pressed={!follow&&cameraMode==='tandyr'} onClick={()=>selectCamera('tandyr')} title={t("Tandyr cam")} aria-label={t("Tandyr cam")}><Flame size={20}/><span>{t("Tandyr cam")}</span></button><button className={!follow&&cameraMode==='tea'?'active':''} aria-pressed={!follow&&cameraMode==='tea'} onClick={()=>selectCamera('tea')} title={t("Tea cam")} aria-label={t("Tea cam")}><Coffee size={20}/><span>{t("Tea cam")}</span></button><button className={!follow&&cameraMode==='top'?'active':''} aria-pressed={!follow&&cameraMode==='top'} onClick={()=>selectCamera('top')} title={t("Top view")} aria-label={t("Top view")}><Grid2X2 size={20}/><span>{t("Top view")}</span></button></div><span className="orbit-hint">{t("drag to orbit")} <span>·</span>  {t("scroll to zoom")}</span><button className="reset-view" aria-label={t("Reset camera")} title={t("Reset camera")} onClick={()=>selectCamera('yard')}><RotateCcw size={15}/></button></div>
          </section>

          <section className="ingredients-section" aria-labelledby="ingredients-title">
            <div className="section-heading"><h2 id="ingredients-title">{t("Ingredients")}</h2><span className="small-meta">{displayCooking.added.length} / {displayedIngredients.length}  {t("IN THE QAZAN")}</span></div>
            <div className="ingredients-grid">{displayedIngredients.map(item=>{
              const added=displayCooking.added.includes(item.id);
              return <button key={item.id} className={`ingredient ${added?'is-added':''}`} disabled={neuralMode||added||done} onClick={()=>addIngredient(item.id)} title={t(added?`${item.name} is in the qazan`:`Add ${item.name.toLowerCase()} to the qazan`)} aria-label={t(added?`${item.name}, added`:`Add ${item.amount} ${item.name.toLowerCase()}`)}><span className="ingredient-check">{added?<Check size={16}/>:<span>+</span>}</span><IngredientIllustration type={item.id}/><strong>{t(item.name)}</strong><span>{t(neuralMode&&neural.snapshot?.world.quantities?.[item.id]?`${neural.snapshot.world.quantities[item.id]!.value} ${neural.snapshot.world.quantities[item.id]!.unit}`:item.amount)}</span></button>;
            })}</div>
            <p className="ingredient-tip"><Leaf size={13}/><span>{t("Simple ingredients. Generations of know-how.")} <span className="tip-extra">{neuralMode ? t('Observe only: Palovbek handles the ingredients.') : t('Click to lend a hand, or let our fly cook.')}</span></span></p>
          </section>

          {neuralMode ? <><NeuralEpisode connection={neural}/><CookingLog connection={neural}/></> : <section className="journey" aria-labelledby="journey-title"><div className="section-heading"><h2 id="journey-title">{t("A little patience. A lot of plov.")}</h2><button className="text-button" onClick={()=>setModal('recipe')}>{t("See the recipe")} <ArrowRight size={14}/></button></div><div className="steps">{STAGES.map((step,i)=><div key={step.name} className={`step ${i<stage||done?'completed':''} ${i===stage&&!done?'current':''}`}><div className="step-top"><span>{i<stage||done?<Check size={12}/>:String(i+1).padStart(2,'0')}</span><i/></div><strong>{t(step.short)}</strong></div>)}</div></section>}
        </div>

        <aside className="chef-column">
          <>{neuralMode ? <NeuralDashboard connection={neural}/> : <BrainPanel cooking={cooking} chefAction={chefAction} clock={motionClock}/>}</>
          {!neuralMode && <section className="chef-card">
            <div className="card-eyebrow">{t("MEET YOUR OSHPAZ")} <Sparkles size={14}/></div>
            <div className="chef-profile"><div className="chef-avatar"><FlyIllustration/><span className="avatar-dot"/></div><div><h2>{t("Palovbek")} <span>{t("the fly")}</span></h2><p>{t("Small chef. Huge potential.")}</p><span className="chef-tag">{t("APPRENTICE OSHPAZ")}</span></div></div>
            <div className="chef-quote">“{recipeMode ? t('First zirvak, then rice. I have a plan.') : neuralMode ? t('I have no idea how to make plov. Yet.') : done?t('I would like to thank my six legs.'):t('They gave me a brain. I chose plov.')}”</div>
            <div className="chef-facts"><div><span>{t("Species")}</span><strong>D. melanogaster</strong></div><div><span>{t("Experience")}</span><strong>{recipeMode ? t('Recipe in hand') : neuralMode ? t('No training') : done?t('One legendary plov'):t('Absolutely none')}</strong></div><div><span>{t("Confidence")}</span><strong>{t("Unreasonably high")} <span className="confidence-dot"/></strong></div></div>
            <div className="chef-status"><span className={`live-dot ${!displayCooking.running?'resting':''}`}/><span>{neuralMode ? (neural.snapshot?.world.outcome ? t('Attempt ended. Another seed, another chance.') : displayCooking.running ? t('An experiment in progress.') : t('Waiting to experiment.')) : done?t('Proudly accepting compliments'):cooking.running?t('In the zone. Please don’t swat.'):cooking.started?t('A well-deserved micro-break'):t('Ready for his culinary debut')}</span></div>
          </section>}

          {neuralMode ? <NeuralControls connection={neural} onStart={() => setFollow(true)} onLoad={()=>setLoadDialogOpen(true)}/> : <section className="controls-card" aria-label={t("Cooking controls")}><div className="section-heading"><h2>{t("Let him cook.")}</h2><span className="servings">{t("4 GENEROUS PORTIONS")}</span></div>
            <div className="progress-label"><span>{done?t('Osh tayyor!'):cooking.started?t(currentStage.name):t('A masterpiece in the making')}</span><strong>{progress}<span>%</span></strong></div><div className="progress-track" role="progressbar" aria-label={t("Plov cooking progress")} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${progress}%`}}/></div>
            <div className="time-row"><span><Clock3 size={12}/>{formatTime(cooking.elapsed)} <span>{t("/ 01:30 recipe time")}</span></span><span>{done?t('Served with love'):`${String(stage+1).padStart(2,'0')} / 06`}</span></div>
            <div className="cook-buttons"><button className="cook-button" onClick={toggleCooking}>{done?<RotateCcw size={16}/>:cooking.running?<Pause size={16} fill="currentColor"/>:<Play size={16} fill="currentColor"/>}{done?t('Cook another plov'):cooking.running?t('Pause cooking'):cooking.started?t('Keep cooking'):t('Let’s make plov')}<span>{done?'↻':'→'}</span></button><button className="restart-button" title={t("Start over")} aria-label={t("Reset cooking")} onClick={()=>resetKitchen()}><RotateCcw size={17}/></button></div>
            <div className="heat-label"><label htmlFor="fire"><Flame size={15}/>  {t("Tend the fire")}</label><span>{cooking.heat<35?t('LOW & SLOW'):cooking.heat>78?t('ROARING'):t('NICE & STEADY')}</span></div>
            <input id="fire" aria-label={t("Fire intensity")} type="range" min="0" max="100" value={cooking.heat} style={{'--range-progress':`${cooking.heat}%`} as React.CSSProperties} onChange={event=>setCooking(state=>({...state,heat:Number(event.target.value)}))}/>
            <div className="heat-endpoints"><span>{t("A gentle glow")}</span><span>{t("A proper blaze")}</span></div>
            <div className="speed-row"><span>{t("Life in the fly lane")}</span><div role="group" aria-label={t("Cooking speed")}>{[.75,1,2,4].map(speed=><button key={speed} aria-pressed={cooking.speed===speed} className={cooking.speed===speed?'active':''} onClick={()=>setCooking(state=>({...state,speed}))}>{speed}×</button>)}</div></div>
          </section>}

          {!neuralMode && <section className="diary-card"><div className="section-heading"><h2>{t("A fly on the wall")}</h2><AudioLines size={16}/></div><p className="diary-description">{t("Field notes from a very small kitchen.")}</p><div className="diary-entries" aria-live="polite" aria-relevant="additions">{(neuralMode ? (neural.snapshot?.world.events ?? []).map((event, index) => ({id: index, text: event.result, time: formatTime(event.time)})) : logs).slice(-3).reverse().map((log,index)=><div className={`diary-entry ${index===0?'latest':''}`} key={log.id}><span className="log-dot"/><span className="log-time">{log.time}</span><p>{t(log.text)}</p></div>)}</div><div className="diary-footer"><span className="live-dot"/> {neuralMode ? t('OBSERVED ACTIONS · OUTCOMES RECORDED LOCALLY') : cooking.running?t('THE PLOT THICKENS. SO DOES THE ZIRVAK.'):done?t('A GOOD DAY TO BE A FLY.'):t('EVERY GREAT PLOV HAS A BEGINNING.')}</div></section>}
        </aside>
      </div>

      <footer className="site-footer"><button onClick={()=>setModal('about')}><CircleHelp size={13}/>  {t("What’s the buzz about?")}</button></footer>
    </main>

    <BrainLoadDialog open={loadDialogOpen&&neuralMode&&brainRuntime==='browser'&&browserSupport==='supported'} connection={neural} onClose={()=>setLoadDialogOpen(false)} onDemo={()=>{choseMode.current=true;startDemo();}}/>
    {toast&&<div className="toast" role="status"><Check size={16}/>{t(toast)}</div>}
    <dialog ref={dialogRef} onCancel={()=>setModal(null)} aria-label={modal==='about'?t('About the Palovbek experiment'):t('Uzbek plov recipe')} className="info-dialog"><button className="dialog-close" onClick={()=>setModal(null)} aria-label={t("Close dialog")}><X size={20}/></button>{modal==='about'?<><div className="eyebrow">{t("A LITTLE CONTEXT")}</div><h2>{t("A small fly.")}<br/>{t("An oversized idea.")}</h2><p>{t("Scientists mapped the wiring of a fruit fly’s nervous system. The internet gave flies video games and wild side quests. We thought: someone should teach one to make plov.")}</p><div className="about-callout"><FlyIllustration/><p><strong>{t("Two ways to meet Palovbek.")}</strong>{t("The scripted demo does not run a biological neural simulation. The browser brain runs the Xenova MaleCNS spiking model on your device. The optional local Python experiment uses a separate MaleCNS graph selection and an untrained action decoder. In free experiment mode, measured spikes drive decisions. Recipe chef follows authored cooking rules. In browser mode, simulated output spikes adjust ingredient portions and brief pauses; the local Python recipe mode observes activity only. It has not learned to cook and is not an uploaded mind.")}</p></div><p>{t("Plov is a dish built around rice, carrots, meat, and patience. An")} <em>{t("oshpaz")}</em>  {t("is a plov cook; a")} <em>{t("qazan")}</em>  {t("is the big, round cooking pot at the heart of it all.")}</p><a className="source-link" href="https://research.google/blog/a-connectomics-milestone-mapping-the-complete-male-fruit-fly-brain/" target="_blank" rel="noreferrer">{t("Read the Google Research announcement")} <MoveUpRight size={15}/></a><div className="dialog-bottom">{t("An independent experiment. Made with affection for Uzbek food.")}</div></>:<><div className="eyebrow">{t("FROM THE PLOV YARD")}</div><h2>{t("Good plov takes")}<br/>{t("a little patience.")}</h2><p>{t("A simplified Uzbek-style plov for four. Our 90-second kitchen is playtime; a real qazan takes much longer.")}</p><div className="recipe-list">{STAGES.map((step,i)=><div key={step.name}><span>{String(i+1).padStart(2,'0')}</span><div><h3>{t(step.name)}</h3><p>{t(step.description)}</p></div>{i<STAGES.length-1&&<ArrowDown size={13}/>}</div>)}</div><div className="recipe-source-list">{RECIPES.map(item => <a key={item.id} href={item.source} target="_blank" rel="noreferrer">{t(item.name)}  {t("· recipe reference ↗")}</a>)}</div><p className="recipe-note">{t("Recipe chef uses simplified versions of these researched dishes. Quince is pre-cut, chickpeas pre-soaked, quail pre-stuffed, and eggs and qazi pre-cooked. Also on hand: water and salt to taste. Regional recipes vary; this little kitchen celebrates the tradition, one qazan at a time.")}</p><button className="cook-button" onClick={()=>setModal(null)}><ArrowLeft size={15}/>  {t("Back to the kitchen")}</button></>}</dialog>
    <div className="sr-only" aria-live="polite">{neuralMode ? t(neural.snapshot?.world.last_result ?? 'Initialize the browser brain or explore the scripted demo.') : done?t('Plov is ready.'):cooking.started?t(`Stage ${stage+1}: ${currentStage.name}.`):t('Kitchen ready. Press Let’s make plov to begin.')}</div>
  </>;
}

export default App;
