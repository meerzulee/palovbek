import manifest from './vendor/xenova/browser-manifest.json';
import { GRAPH_CACHE } from './vendor/xenova/data-loader.js';

// Inspect the real cache, including this model revision's content hashes.
// The worker rechecks every cached payload before using it for simulation.
export async function hasCachedBrowserBrain(): Promise<boolean> {
  try {
    if (!await caches.has(GRAPH_CACHE)) return false;
    const cache = await caches.open(GRAPH_CACHE);
    const available = new Set((await cache.keys()).map(request => request.url));
    const files = [
      { file: manifest.metadata, sha256: manifest.metadata_sha256 },
      ...manifest.arrays.flatMap(array => array.parts),
    ];
    const base = new URL('browser-brain/data/', document.baseURI);
    return files.every(({file, sha256}) => {
      const key = new URL(file, base);
      key.searchParams.set('content', sha256);
      return available.has(key.href);
    });
  } catch {
    // A blocked or evicted cache needs the normal first-visit loader.
    return false;
  }
}
