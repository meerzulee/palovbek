import { useLanguage } from './i18n';
import { useEffect, useState } from 'react';
import { ArrowDownToLine, Check, CircleAlert, CookingPot, Download, Flame, History, Slice } from 'lucide-react';
import type { CookingReport, NeuralConnection } from './useNeural';
import { actionLabel } from './neural';

type Archive = {run_id: string; started_at: string; recipe: {name: string} | null; outcome: string; mistakes: number; world_seconds: number};
const timestamp = (time: number) => `${Math.floor(time / 60).toString().padStart(2,'0')}:${Math.floor(time % 60).toString().padStart(2,'0')}`;
const actionIcon=(action:string,success:boolean)=>!success?CircleAlert:action==='chop'?Slice:action==='add'?ArrowDownToLine:action.includes('heat')?Flame:action==='serve'?Check:CookingPot;
export default function CookingLog({ connection }: { connection: NeuralConnection }) {
  const { t, locale } = useLanguage();
  const state = connection.snapshot;
  const [showWaits, setShowWaits] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archives, setArchives] = useState<Archive[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!archiveOpen || connection.status !== 'connected' || connection.runtime==='browser') return;
    const abort = new AbortController();
    fetch('/api/neural/history', {signal:abort.signal}).then(response => { if (!response.ok) throw new Error('History unavailable'); return response.json(); }).then(data => { setArchives(data.episodes); setError(''); }).catch(cause => { if (!abort.signal.aborted) setError(String(cause)); });
    return () => abort.abort();
  }, [archiveOpen, connection.status, connection.runtime, state?.completed_episodes]);
  const browser=connection.runtime==='browser';
  const displayedArchives=browser?connection.history:archives;
  const entries = (state?.cooking_log ?? []).filter(entry => showWaits || entry.action !== 'wait').slice().reverse();
  return <section className="cooking-log lab-panel" aria-label={t("Cooking log")}>
    <div className="section-heading"><h2><CookingPot size={20}/>  {t("Cooking log")}</h2><button className="log-download" aria-label={t("Full log · JSON")} title={t("Download the full cooking log")} disabled={!state} onClick={()=>connection.downloadLog()}><Download size={20}/><span>{t("Download")}</span></button></div>
    <div className="log-toolbar"><span>{t(`${state?.log_count ?? 0} actions`)}</span><label><input type="checkbox" checked={showWaits} onChange={event => setShowWaits(event.target.checked)}/>  {t("Include pauses")}</label></div>
    <div className="cooking-log-rows" tabIndex={0} aria-label={t("Recent completed cooking actions")}>{entries.length ? entries.map(entry => {
      const Icon=actionIcon(entry.action,entry.success);
      return <div className={`cooking-log-row ${!entry.success ? 'failed' : ''}`} key={entry.id}><span className="log-event-icon"><Icon size={20}/></span><p>{t(entry.result)}</p><time>{timestamp(entry.time)}</time></div>;
    }) : <p className="log-empty">{t("Every chop and pour will appear here.")}</p>}</div>
    <button className="history-toggle" aria-expanded={archiveOpen} onClick={() => setArchiveOpen(value => !value)}><History size={20}/>  {t("Previous cooks")} <span>{archiveOpen ? '−' : '+'}</span></button>
    {archiveOpen && <div className="cook-history">{error && <p role="alert">{t(error)}</p>}{!error && displayedArchives.length === 0 && <p>{t("No completed cooks yet.")}</p>}{displayedArchives.map(episode => <button key={episode.run_id} onClick={()=>browser?connection.downloadLog(episode as CookingReport):window.open(`/api/neural/history/${episode.run_id}`,'_blank','noopener')}><span><strong>{t(episode.recipe?.name ?? 'Free experiment')}</strong><small>{new Date(episode.started_at).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US')}</small></span><span className={episode.outcome === 'served' ? 'outcome-ok' : ''}>{t(actionLabel(episode.outcome??'unfinished'))} · {episode.mistakes}  {t("mistakes")}</span><Download size={18}/></button>)}<p className="neural-note">{browser?t('The latest 10 completed cooks are saved in this browser. Download a log to share it.'):t('The server retains the latest 200 completed cooking logs.')}</p></div>}
  </section>;
}
