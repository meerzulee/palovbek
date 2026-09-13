import { useLanguage, LanguageSwitcher } from './i18n';
import { useEffect, useRef } from 'react';
import { ArrowRight, BrainCircuit, Check, Cpu, Download, LoaderCircle, RotateCcw, X } from 'lucide-react';
import type { NeuralConnection } from './useNeural';

export default function BrainLoadDialog({ open, connection, onClose }: {
  open: boolean;
  connection: NeuralConnection;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const loading = connection.status === 'connecting';
  const ready = connection.status === 'connected' && !!connection.snapshot;
  const failed = !loading && !ready && !!connection.error;
  const percent = Math.min(100, Math.max(0, Math.round(connection.progress * 100)));
  const backend = connection.snapshot?.performance.backend === 'gpu' ? 'WebGPU' : 'CPU';
  useEffect(() => {
    const element = dialog.current;
    if (open) element?.showModal(); else element?.close();
  }, [open]);

  return <dialog ref={dialog} className="brain-load-dialog" aria-labelledby="brain-load-title" aria-describedby="brain-load-description" onCancel={onClose}>
    <div className="load-dialog-topline"><span><i className="live-dot"/>  {t("Meet your chef")}</span><LanguageSwitcher/><button onClick={onClose} aria-label={t("Close model loader")}><X size={18}/></button></div>
    <div className={`load-brain-icon ${loading ? 'is-loading' : ''}`}><BrainCircuit size={42} strokeWidth={1.1}/></div>
    <h2 id="brain-load-title">{ready ? t('Do‘ppi on. Brain ready.') : failed ? t('Let’s try that again.') : loading ? t('A little brain. A big appetite.') : t('Wake up, Palovbek.')}</h2>
    <p id="brain-load-description">{ready ? t('Your fly is ready. Cooking starts automatically; pause or change the recipe in the kitchen.') : t('Give our tiny chef his brain. He’ll start cooking as soon as it’s ready.')}</p>
    <dl className="load-model-specs"><div><dt>{t("Neurons")}</dt><dd>{t("166,700")}</dd></div><div><dt>{t("Connections")}</dt><dd>{t("25.6M")}</dd></div><div><dt>{t("Download size")}</dt><dd>{t("79 MB")}</dd></div></dl>
    <div className="load-model-status" aria-live="polite">
      {loading ? <><div className="load-progress-label"><span><LoaderCircle className="load-spinner" size={14}/>{percent === 100 ? t('Initializing engine') : t('Verifying connectivity')}</span><strong>{percent}%</strong></div><progress aria-label={t("Model weights download")} max={100} value={percent}/><p>{t(connection.loading || 'Preparing the neural engine…')}</p></> : ready ? <p className="load-success"><Check size={17}/>  {t("Connectivity verified ·")} {backend}  {t("engine ready")}</p> : failed ? <p className="load-error" role="alert">{t(connection.error)}</p> : <p><Cpu size={16}/>  {t("Runs on your device")}</p>}
    </div>
    <div className="load-dialog-actions">
      {ready ? <button className="cook-button" onClick={onClose}>{t("Enter the kitchen")} <ArrowRight size={16}/></button> : loading ? <><button className="cook-button" onClick={onClose}>{t("Continue loading in background")} <ArrowRight size={16}/></button><button className="load-secondary" onClick={connection.cancelLoad}>{t("Cancel download")}</button></> : <><button className="cook-button" onClick={connection.reconnect}>{failed ? <RotateCcw size={16}/> : <Download size={16}/>} {failed ? t('Retry loading weights') : t('Load weights · 79 MB')}</button><button className="load-secondary" onClick={onClose}>{t("Explore the kitchen first")}</button></>}
    </div>
    <p className="load-dialog-note">{t("A simulated brain, a recipe, and a little Uzbek soul. Downloads are saved for your next visit.")}</p>
  </dialog>;
}
