// Only wall-clock playback changes. The LIF and toy-kitchen timesteps stay fixed.
export const DEFAULT_PLAYBACK_SPEED = .75;
export function cookingPlaybackSpeed(action = '', stage = 3) {
  const transfer = action.startsWith('go_') || action.startsWith('pick_') || action === 'add';
  return DEFAULT_PLAYBACK_SPEED * (stage < 3 && transfer ? .5 : 1);
}
export function browserFrameDelay(computeSeconds: number, speed = DEFAULT_PLAYBACK_SPEED) {
  return (60 + computeSeconds * 1000) / speed - computeSeconds * 1000;
}
export function demoTransferMultiplier(elapsed: number) {
  return elapsed < 2 || (elapsed >= 28 && elapsed < 30) || (elapsed >= 36 && elapsed < 38) ? .5 : 1;
}

// Spread the fixed neural/kitchen steps over a readable action, independently
// of device speed. Slow devices may take longer; physics never skips a step.
export function cookingFrameSeconds(action: string, duration: number, stepSeconds = .25) {
  const seconds = action.startsWith('go_') || action === 'chop' || action === 'stir' ? 1.8 : 1.5;
  return seconds / Math.max(1, Math.ceil(duration / stepSeconds));
}
export function taskFrameDelay(computeSeconds: number, frameSeconds: number) {
  return Math.max(0, (frameSeconds - computeSeconds) * 1000);
}
