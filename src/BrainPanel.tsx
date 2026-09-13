import { observeViewport } from './viewport';
import { useLanguage } from './i18n';
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Expand, RotateCcw, X } from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { CookingState } from './simulation';
import { chefCue } from './chefPerformance';
import type { ChefAction, MotionClock } from './chefPerformance';

type Props = { cooking: CookingState; chefAction: ChefAction; clock: RefObject<MotionClock> };

function renderBrain(host: HTMLDivElement, state: () => Props, resetButton: HTMLButtonElement) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('tabindex', '0');
  renderer.domElement.setAttribute('aria-label', 'Stylized 3D fly brain with cyan and orange demo activity. This is a cooking-driven visualization, not a neural simulation. Drag to rotate.');
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 30); camera.position.set(0, .05, 4.7);
  const controls = new OrbitControls(camera, renderer.domElement); controls.enablePan = false; controls.enableZoom = false;
  controls.enableDamping = true; controls.dampingFactor = .08; controls.minPolarAngle = .3; controls.maxPolarAngle = Math.PI - .3;
  let seed = 108;
  const random = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
  const count = 22000;
  const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3), phases = new Float32Array(count), regions = new Float32Array(count);
  const point = new THREE.Vector3();
  const palette = [new THREE.Color('#91e8ef'), new THREE.Color('#fa9a49'), new THREE.Color('#8cafb4')];
  for (let i = 0; i < count; i++) {
    const part = i % 10, side = i % 2 ? -1 : 1;
    const region = part < 4 ? 1 : part < 8 ? 0 : 2;
    const theta = random() * Math.PI * 2, cosPhi = random() * 2 - 1, sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
    const radius = Math.pow(random(), .32);
    point.set(Math.cos(theta) * sinPhi * radius, cosPhi * radius, Math.sin(theta) * sinPhi * radius);
    if (region === 1) { point.multiply(new THREE.Vector3(.37, .53, .32)); point.x += side * .92; point.y += .13; }
    else if (region === 0) { point.multiply(new THREE.Vector3(.53, .48, .39)); point.x += side * .31; point.y += .41; point.y -= Math.abs(point.x) * .07; }
    else { point.multiply(new THREE.Vector3(.39, .54, .25)); point.y -= .60; point.x += Math.sin(point.y * 8) * .04; }
    positions.set(point.toArray(), i * 3);
    const shade = palette[region].clone().multiplyScalar(.65 + random() * .65);
    if (region === 2 && random() > .67) shade.set('#cb8a4f').multiplyScalar(.85);
    colors.set(shade.toArray(), i * 3); phases[i] = random(); regions[i] = region;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(phases, 1)); geometry.setAttribute('aRegion', new THREE.BufferAttribute(regions, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    uniforms: { uTime: { value: 0 }, uEnergy: { value: .25 }, uSignals: { value: new THREE.Vector3(.18,.12,.1) }, uBeat: { value: 0 }, uRatio: { value: renderer.getPixelRatio() }, uScale: { value: 1 } },
    vertexShader: `attribute float aSeed; attribute float aRegion; uniform float uTime; uniform float uEnergy; uniform vec3 uSignals; uniform float uBeat; uniform float uRatio; uniform float uScale; varying vec3 vColor; varying float vAlpha;
      void main(){
        float wave=sin(uTime*2.3-length(position.xy)*5.0+position.z*4.0);
        float pulse=pow(max(0.0,sin(uTime*(1.2+aSeed*.8)+aSeed*120.0)),22.0);
        float focus=aRegion<.5?uSignals.x:(aRegion<1.5?uSignals.y:uSignals.z);
        float glow=pulse*(.12+uEnergy*.65)*focus+max(0.0,wave)*focus*uEnergy*.45+uBeat*focus*.28;
        vColor=color*(.8+glow*1.15); vAlpha=.3+glow*.35;
        vec4 mvPosition=modelViewMatrix*vec4(position,1.0);
        gl_Position=projectionMatrix*mvPosition;
        gl_PointSize=uRatio*uScale*(1.8+aSeed*1.8+glow*1.5)*(4.7/-mvPosition.z);
      }`,
    fragmentShader: `varying vec3 vColor; varying float vAlpha; void main(){vec2 p=gl_PointCoord-.5;float r=dot(p,p);if(r>.25)discard;float soft=exp(-r*17.0);gl_FragColor=vec4(vColor,vAlpha*soft);}`,
  });
  const brain = new THREE.Group(); scene.add(brain);
  brain.add(new THREE.Points(geometry, material));
  const paths: number[] = [];
  for (let i = 0; i < 270; i++) {
    const a = Math.floor(random() * count), b = Math.floor(random() * count);
    const pa = new THREE.Vector3().fromArray(positions, a * 3), pb = new THREE.Vector3().fromArray(positions, b * 3);
    if (pa.distanceTo(pb) < .55) paths.push(...pa.toArray(), ...pb.toArray());
  }
  const linesGeometry = new THREE.BufferGeometry(); linesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(paths, 3));
  const linesMaterial = new THREE.LineBasicMaterial({ color: '#91dfe5', transparent: true, opacity: .04, depthWrite: false, blending: THREE.AdditiveBlending });
  brain.add(new THREE.LineSegments(linesGeometry, linesMaterial));
  const reset = () => { camera.position.set(0, .05, 4.7); controls.target.set(0, 0, 0); controls.update(); };
  resetButton.addEventListener('click', reset);
  const onKey = (event: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if (event.key === 'ArrowLeft') spherical.theta -= .15;
    if (event.key === 'ArrowRight') spherical.theta += .15;
    if (event.key === 'ArrowUp') spherical.phi = Math.max(.3, spherical.phi - .12);
    if (event.key === 'ArrowDown') spherical.phi = Math.min(Math.PI - .3, spherical.phi + .12);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical)); controls.update();
  };
  renderer.domElement.addEventListener('keydown', onKey);
  const resize = () => { const width = host.clientWidth, height = host.clientHeight; if (!width || !height) return; renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix(); material.uniforms.uScale.value = Math.max(.85, Math.min(4, height / 240)); };
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  const intersection = observeViewport(host);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let last = performance.now(), sampleTime = -1;
  const trace = host.parentElement?.querySelector<SVGPathElement>('.activity-wave path');
  const fills = host.parentElement?.querySelectorAll<HTMLElement>('.signal-fill');
  const history = Array.from({length:64},()=>.12);
  const signalTarget = new THREE.Vector3();
  renderer.setAnimationLoop(() => {
    const now = performance.now(), dt = Math.min((now - last) / 1000, .05); last = now;
    if (!intersection.canRender()) return;
    const { cooking, chefAction, clock } = state();
    const cue=chefCue(cooking,chefAction,clock.current.elapsed), time=clock.current.time;
    const beat=cue.action==='chopping'?Math.pow(Math.max(0,Math.cos(time*7.5)),8):cue.action==='stirring'?(1+Math.sin(time*1.65))*.5:cue.action==='flying'?(1+Math.sin(time*9))*.5:.2;
    host.dataset.chefAction=cue.action;host.dataset.animationTime=time.toFixed(2);host.dataset.active=String(cue.active);
    material.uniforms.uTime.value = reducedMotion.matches ? 0 : time;
    material.uniforms.uBeat.value = reducedMotion.matches ? 0 : beat;
    material.uniforms.uEnergy.value = cue.active ? .95 : .22;
    const signalVector=material.uniforms.uSignals.value as THREE.Vector3;
    signalVector.lerp(signalTarget.set(...cue.signals),1-Math.exp(-dt*5));
    brain.rotation.y = reducedMotion.matches ? 0 : Math.sin(time * .12) * .08;
    if(time<sampleTime){history.fill(.12);sampleTime=-1;}
    if(time-sampleTime>.055){
      sampleTime=time;
      const strength=Math.max(...cue.signals);
      history.shift();history.push(.12+strength*(.22+beat*.65));
      if(trace)trace.setAttribute('d',history.map((value,i)=>`${i?'L':'M'}${i*3},${27-value*23}`).join(' '));
    }
    fills?.forEach((fill,i)=>{fill.style.transform=`scaleX(${cue.signals[i]*(cue.active?.65+beat*.35:.3)})`;});
    controls.update(); renderer.render(scene, camera);
  });
  return () => { renderer.setAnimationLoop(null); observer.disconnect(); intersection.disconnect(); resetButton.removeEventListener('click', reset); renderer.domElement.removeEventListener('keydown', onKey); controls.dispose(); geometry.dispose(); material.dispose(); linesGeometry.dispose(); linesMaterial.dispose(); renderer.dispose(); renderer.domElement.remove(); };
}

export default function BrainPanel(props: Props) {
  const { t } = useLanguage();
  const host = useRef<HTMLDivElement>(null), reset = useRef<HTMLButtonElement>(null), latest = useRef(props);
  const [expanded, setExpanded] = useState(false), [error, setError] = useState(false);
  useEffect(() => { latest.current = props; }, [props]);
  useEffect(() => {
    if (!host.current || !reset.current) return;
    try { return renderBrain(host.current, () => latest.current, reset.current); }
    catch { setError(true); }
  }, []);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false); };
    document.addEventListener('keydown', close);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', close); };
  }, [expanded]);
  const cue = chefCue(props.cooking, props.chefAction);
  const action = !cue.active && props.cooking.started && cue.action !== 'celebrating' ? `Paused · ${cue.label}` : cue.label;
  return <section className={`brain-card ${expanded ? 'brain-expanded' : ''}`} aria-label={t("Fly brain visualization")}>
    <div className="brain-heading"><span>{t("INSIDE PALOVBEK’S HEAD")}</span><span className="brain-demo">{t("DEMO ACTIVITY")}</span></div>
    <div className="brain-canvas" ref={host}>{error && <p className="brain-error">{t("The brain view needs WebGL.")}</p>}</div>
    <div className="brain-controls"><button ref={reset} aria-label={t("Reset brain view")} title={t("Reset brain view")}><RotateCcw size={13}/></button><button onClick={() => setExpanded(value => !value)} aria-label={expanded ? t('Close brain view') : t('Expand brain view')} title={expanded ? t('Close brain view') : t('Expand brain view')}>{expanded ? <X size={14}/> : <Expand size={14}/>}</button></div>
    <div className="brain-activity" aria-label={t("Illustrative activity channels")}><div className="activity-channels">{[t('Sense'),t('Focus'),t('Move')].map(label=><div key={label}><span>{label}</span><i><span className="signal-fill"/></i></div>)}</div><svg className="activity-wave" viewBox="0 0 189 30" aria-label={t("Cooking activity rhythm")}><path d="M0,24 L189,24" fill="none"/></svg></div>
    <div className="brain-readout"><span className="brain-pulse"/><span>{t(action)}</span></div>
    <p className="brain-disclosure">{t("Cooking-driven visualization · neural model not connected")}</p>
  </section>;
}
