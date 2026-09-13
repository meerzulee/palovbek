import manifest from './vendor/xenova/browser-manifest.json' with { type: 'json' };

// Match the largest storage buffer used by BrainGPU, without allocating the graph.
export const BRAIN_GPU_LIMITS = {
  maxBufferSize: (2 * manifest.neurons + 1 + manifest.edges) * 4,
  maxStorageBufferBindingSize: (2 * manifest.neurons + 1 + manifest.edges) * 4,
  maxStorageBuffersPerShaderStage: 8,
  maxComputeInvocationsPerWorkgroup: 128,
  maxComputeWorkgroupSizeX: 128,
};
type ProbeDevice = { destroy(): void };
export type ProbeGPU = {
  requestAdapter(): Promise<{
    limits: Record<keyof typeof BRAIN_GPU_LIMITS, number>;
    requestDevice(options: { requiredLimits: typeof BRAIN_GPU_LIMITS }): Promise<ProbeDevice>;
  } | null>;
};

export async function supportsBrainGPU(gpu: ProbeGPU | undefined, timeoutMs = 4000): Promise<boolean> {
  if (!gpu) return false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let expired = false;
  const check = async () => {
    try {
      const adapter = await gpu.requestAdapter();
      if (!adapter || expired) return false;
      for (const key of Object.keys(BRAIN_GPU_LIMITS) as (keyof typeof BRAIN_GPU_LIMITS)[]) {
        if (!(adapter.limits[key] >= BRAIN_GPU_LIMITS[key])) return false;
      }
      // An exposed API is insufficient: actually request a device with our limits.
      const device = await adapter.requestDevice({ requiredLimits: BRAIN_GPU_LIMITS });
      device.destroy(); // Also release a device that arrives after the timeout.
      return !expired;
    } catch { return false; }
  };
  try {
    return await Promise.race([check(), new Promise<boolean>(resolve => {
      timeout = setTimeout(() => { expired = true; resolve(false); }, timeoutMs);
    })]);
  } finally { clearTimeout(timeout); }
}

export function checkBrowserBrainSupport(): Promise<boolean> {
  if (!globalThis.isSecureContext || !globalThis.crypto?.subtle || typeof Worker === 'undefined' || typeof DecompressionStream === 'undefined') return Promise.resolve(false);
  return supportsBrainGPU((navigator as Navigator & { gpu?: ProbeGPU }).gpu);
}
