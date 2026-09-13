import { useEffect, useRef } from 'react';
import type { CookingState } from './simulation';
import { TOTAL_DURATION } from './simulation';
import { DEFAULT_PLAYBACK_SPEED, demoTransferMultiplier } from './playback';
import type { ChefAction, MotionClock } from './chefPerformance';

// Both canvases read this clock. A pause freezes the gesture and its activity pulses.
export function useMotionClock(cooking: CookingState, manual: ChefAction) {
  const clock = useRef<MotionClock>({ time: 0, elapsed: 0 });
  const latest = useRef({ cooking, manual });
  useEffect(() => {
    if ((!cooking.started && manual === 'auto') || manual !== latest.current.manual || cooking.elapsed < latest.current.cooking.elapsed) clock.current.time = 0;
    clock.current.elapsed = cooking.elapsed;
    latest.current = { cooking, manual };
  }, [cooking, manual]);
  useEffect(() => {
    let previous = performance.now(), frame = 0;
    const update = (now: number) => {
      const dt = Math.min((now - previous) / 1000, .05); previous = now;
      const { cooking: state, manual: action } = latest.current;
      if (!document.hidden) {
        if (state.running || action !== 'auto') clock.current.time += dt * (state.running ? Math.min(state.speed, 2) * demoTransferMultiplier(state.elapsed) : DEFAULT_PLAYBACK_SPEED);
        if (state.running) clock.current.elapsed = Math.min(TOTAL_DURATION, clock.current.elapsed + dt * state.speed * demoTransferMultiplier(state.elapsed) * (.35 + state.heat / 100));
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, []);
  return clock;
}
