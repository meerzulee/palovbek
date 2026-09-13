import { observeViewport } from './viewport';
import { useLanguage } from './i18n';
import { useEffect, useRef, useState } from 'react';
import { Expand, RotateCcw, X } from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { NeuralConnection } from './useNeural';

export default function NeuralBrainPanel({ connection }: { connection: NeuralConnection }) {
  const { t } = useLanguage();
  const host = useRef<HTMLDivElement>(null), reset = useRef<HTMLButtonElement>(null), latest = useRef(connection);
  const [expanded, setExpanded] = useState(false), [error, setError] = useState(false);
  useEffect(() => { latest.current = connection; }, [connection]);
  const cells = connection.metadata?.sample_cells;
  useEffect(() => {
    if (!host.current || !cells?.length) return;
    const target = host.current;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' }); }
    catch { setError(true); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.domElement.setAttribute('role', 'img'); renderer.domElement.setAttribute('tabindex', '0');
    renderer.domElement.setAttribute('aria-label', 'MaleCNS neuron soma positions. Point brightness shows actual simulated spike counts, not recorded biological activity. Drag to rotate.');
    target.appendChild(renderer.domElement);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(38, 1, .01, 30);
    camera.position.set(0, 0, 3.2);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enablePan = false; controls.enableZoom = false; controls.enableDamping = true;
    const positions = new Float32Array(cells.flatMap(cell => cell.position));
    const colors = new Float32Array(cells.length * 3), counts = new Float32Array(cells.length);
    const palette = ['#8de6ed', '#ff9a49', '#ebc47a'].map(color => new THREE.Color(color));
    cells.forEach((cell, index) => colors.set(palette[cell.region].toArray(), index * 3));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('count', new THREE.BufferAttribute(counts, 1));
    const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, vertexColors: true, blending: THREE.AdditiveBlending,
      uniforms: { ratio: { value: renderer.getPixelRatio() } },
      vertexShader: `attribute float count; uniform float ratio; varying vec3 tint; varying float alpha;
        void main(){ float activity=min(1., log(1.+count)/2.4); tint=color*(.65+activity*1.1); alpha=.24+activity*.76;
          vec4 p=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*p; gl_PointSize=ratio*(2.4+activity*4.)*(4.2/-p.z); }`,
      fragmentShader: `varying vec3 tint; varying float alpha; void main(){float r=length(gl_PointCoord-.5); if(r>.5)discard; gl_FragColor=vec4(tint,alpha*exp(-r*r*12.));}`,
    });
    scene.add(new THREE.Points(geometry, material));
    const resize = () => { if (!target.clientWidth || !target.clientHeight) return; renderer.setSize(target.clientWidth, target.clientHeight); camera.aspect = target.clientWidth / target.clientHeight; camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(target); resize();
    const resetView = () => { camera.position.set(0, 0, 3.2); controls.target.set(0, 0, 0); controls.update(); };
    const button = reset.current; button?.addEventListener('click', resetView);
    const key = (event: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault(); const p = new THREE.Spherical().setFromVector3(camera.position);
      p.theta += event.key === 'ArrowLeft' ? -.15 : event.key === 'ArrowRight' ? .15 : 0;
      p.phi = THREE.MathUtils.clamp(p.phi + (event.key === 'ArrowUp' ? -.15 : event.key === 'ArrowDown' ? .15 : 0), .1, Math.PI - .1);
      camera.position.setFromSpherical(p); controls.update();
    };
    renderer.domElement.addEventListener('keydown', key);
    let previous: NeuralConnection['snapshot'] = null;
    const intersection = observeViewport(target);
    renderer.setAnimationLoop(() => {
      if (!intersection.canRender()) return;
      const { snapshot } = latest.current;
      if (snapshot && snapshot !== previous) {
        previous = snapshot;
        counts.set(snapshot.neural.sample_counts); geometry.attributes.count.needsUpdate = true;
        target.dataset.spikes = String(snapshot.neural.window_spikes);
        target.dataset.neuralTime = String(snapshot.neural.simulated_seconds);
        target.dataset.runId = snapshot.run_id;
      }
      controls.update(); renderer.render(scene, camera);
    });
    return () => { renderer.setAnimationLoop(null); observer.disconnect(); intersection.disconnect(); button?.removeEventListener('click', resetView); renderer.domElement.removeEventListener('keydown', key); controls.dispose(); geometry.dispose(); material.dispose(); renderer.dispose(); renderer.domElement.remove(); };
  }, [cells]);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false); };
    document.addEventListener('keydown', close);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', close); };
  }, [expanded]);
  return <section className={`brain-card measured-brain ${expanded ? 'brain-expanded' : ''}`} aria-label={t("Simulated neural activity")}>
    <div className="brain-heading"><h2>{t("Brain activity")}</h2><span className={`brain-live ${connection.snapshot?.running ? 'is-live' : ''}`}><i/>{connection.status !== 'connected' ? t('Standby') : connection.snapshot?.running ? t('Live') : t('Paused')}</span></div>
    <div className="brain-canvas" ref={host}>{error ? <p className="brain-error">{t("The brain view needs WebGL.")}</p> : !cells && <p className="brain-error">{t("Ready to light up.")}</p>}</div>
    <div className="brain-controls"><button ref={reset} title={t("Reset brain view")} aria-label={t("Reset brain view")}><RotateCcw size={19}/></button><button title={expanded ? t('Close brain view') : t('Expand brain view')} onClick={() => setExpanded(value => !value)} aria-label={expanded ? t('Close brain view') : t('Expand brain view')}>{expanded ? <X size={20}/> : <Expand size={20}/>}</button></div>
    <p className="brain-disclosure">{t("Simulated neural activity")}</p>
  </section>;
}
