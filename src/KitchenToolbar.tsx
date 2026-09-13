import { useLanguage } from './i18n';
import { BrainCircuit, CookingPot, LoaderCircle, Pause, Play, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import type { NeuralConnection } from './useNeural';

export function DemoToolbar({ running, finished, onToggle, children }: {
  running: boolean; finished: boolean; onToggle: () => void; children: ReactNode;
}) {
  const { t } = useLanguage();
  const label = running ? 'Pause cooking' : finished ? 'Cook another plov' : 'Continue cooking';
  return <section className="kitchen-toolbar" aria-label={t('Quick cooking controls')}>
    <div className="toolbar-summary"><div><h1>{t('Choyxona plov')}</h1></div></div>
    {children}
    <button className="cook-button" aria-label={t(`${label} from toolbar`)} title={t(label)} onClick={onToggle}>
      {running ? <Pause size={18}/> : finished ? <RotateCcw size={18}/> : <Play size={18}/>}
      <span>{t(running ? 'Pause' : finished ? 'Cook again' : 'Resume')}</span>
    </button>
  </section>;
}

export default function KitchenToolbar({ connection, onLoad, onStart, children }: {
  connection: NeuralConnection;
  onLoad: () => void;
  onStart: () => void;
  children?: ReactNode;
}) {
  const { t } = useLanguage();
  const state = connection.snapshot;
  const online = connection.status === 'connected' && !!state;
  const loading = connection.status === 'connecting';
  const running = online && state.running;
  const finished = !!state?.world.outcome;
  const label = running ? 'Pause cooking' : finished ? 'Cook another plov' : 'Continue cooking';
  const toggle = () => {
    if (!state) return;
    if (running) connection.send('pause');
    else {
      onStart();
      if (finished) connection.send('cook_recipe', {recipe_id:state.recipe?.recipe_id??'classic',seed:(state.seed+1)%2147483648});
      else connection.send('start');
    }
  };
  return <section className="kitchen-toolbar" aria-label={t("Quick cooking controls")}>
    <div className="toolbar-summary"><CookingPot size={20}/><div><h1>{online ? t(state.recipe?.name ?? 'Palovbek’s kitchen') : t('Let Palovbek cook.')}</h1><span>{online ? finished ? state.world.outcome==='served' ? t('Osh tayyor!') : t('Try another plov') : running ? t('Cooking') : t('Paused') : loading ? t(`Loading · ${Math.round(connection.progress*100)}%`) : t('A tiny chef. A big appetite.')}</span></div></div>
    {children}
    {online ? <button className="cook-button" aria-label={t(`${label} from toolbar`)} title={t(label)} onClick={toggle}>{running ? <Pause size={18}/> : finished ? <RotateCcw size={18}/> : <Play size={18}/>}<span>{running ? t('Pause') : finished ? t('Cook again') : t('Resume')}</span></button> : <button className="cook-button" aria-label={t(loading ? 'View loading progress' : 'Initialize brain · 79 MB')} title={t(loading ? 'View loading progress' : 'Initialize brain · 79 MB')} onClick={onLoad}>{loading ? <LoaderCircle size={18} className="load-spinner"/> : <BrainCircuit size={18}/>}<span>{loading ? t('View loading progress') : t('Initialize brain · 79 MB')}</span></button>}
  </section>;
}
