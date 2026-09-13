// The page supplies the public asset root to its bundled worker. This keeps
// runtime downloads correct in development and under any production subpath.
let assetBase;
export const GRAPH_CACHE = 'malecns-verified-data-v1';
export function configureAssetBase(url) {
  assetBase = new URL(url).href;
}
export function assetURL(path) {
  if (!assetBase) throw Error('Asset base has not been configured');
  return new URL(path, assetBase).href;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const transient = new Set([408, 429, 500, 502, 503, 504]);

/** Retry the same file, honoring server cooldowns. Downloaded chunks survive retries/reloads. */
export async function requestBytes(
  url,
  { fetcher = fetch, wait = sleep, notice = () => {}, attempts = 6 } = {},
) {
  url = assetURL(url);
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    let delay = 0;
    try {
      const response = await fetcher(url, { signal: controller.signal });
      if (response.ok) return await response.arrayBuffer();
      const retryAfter = response.headers.get('Retry-After');
      const seconds = retryAfter === null ? NaN : Number(retryAfter);
      delay = Number.isFinite(seconds)
        ? seconds * 1000
        : Math.max(0, Date.parse(retryAfter) - Date.now()) || 0;
      await response.body?.cancel();
      if (!transient.has(response.status))
        throw Object.assign(
          Error(`Data download failed (HTTP ${response.status}). Please try again later.`),
          { permanent: true },
        );
      if (attempt === attempts - 1)
        throw Object.assign(
          Error(
            'The data server is still busy. Try loading again shortly; saved chunks will be reused.',
          ),
          { permanent: true },
        );
    } catch (error) {
      if (error.permanent) throw error;
      if (attempt === attempts - 1)
        throw Error(
          'The download was interrupted. Check your connection and try again; saved chunks will be reused.',
        );
    } finally {
      clearTimeout(timer);
    }
    delay = Math.max(delay, Math.min(30000, 1000 * 2 ** attempt));
    // Heartbeats keep the initialization watchdog informed during Retry-After waits.
    while (delay > 0) {
      notice(
        `Download paused · retrying in ${Math.ceil(delay / 1000)}s. Completed files are kept.`,
      );
      const step = Math.min(delay, 10000);
      await wait(step);
      delay -= step;
    }
  }
}

export async function loadGraph(progress = () => {}, notice = () => {}) {
  const manifestBytes = await requestBytes('./data/manifest.json', { notice });
  const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
  let cache;
  try {
    cache = await globalThis.caches?.open(GRAPH_CACHE);
  } catch {
    /* Private browsing or storage restrictions: proceed without persistent cache. */
  }
  const manifestHash = await digest(manifestBytes);
  let lastRequest = 0;
  const pacedFetch = async (...args) => {
    await sleep(Math.max(0, 250 - (Date.now() - lastRequest)));
    lastRequest = Date.now();
    return fetch(...args);
  };
  async function unpack(file, hash) {
    const url = './data/' + file,
      key = new URL(assetURL(url));
    key.searchParams.set('content', hash ?? manifestHash);
    let bytes;
    try {
      const saved = await cache?.match(key.href);
      if (saved) bytes = await saved.arrayBuffer();
    } catch {
      /* Cache is optional. */
    }
    if (bytes && hash && (await digest(bytes)) !== hash) {
      await cache?.delete(key.href).catch(() => {});
      bytes = null;
    }
    let unpacked;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (!bytes) bytes = await requestBytes(url, { notice, fetcher: pacedFetch });
        if (hash && (await digest(bytes)) !== hash) throw Error('Checksum mismatch');
        const magic = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 2));
        if (magic[0] !== 31 || magic[1] !== 139)
          throw Error('Expected stored gzip bytes; check that the host is not decoding this asset');
        unpacked = await new Response(
          new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),
        ).arrayBuffer();
        break;
      } catch (error) {
        try { await cache?.delete(key.href); } catch {}
        bytes = null;
        if (attempt === 2)
          throw Error(`Could not verify ${file}: ${error.message}. Completed downloads are saved; retry loading.`);
        notice(`Re-downloading ${file} after an integrity check failed (${attempt + 1}/2)…`);
        await sleep(300 * (attempt + 1));
      }
    }
    try {
      if (!(await cache?.match(key.href))) await cache?.put(key.href, new Response(bytes));
    } catch {
      /* Storage is optional. */
    }
    return unpacked;
  }
  notice('Loading saved files and downloading remaining connectivity…');
  const neurons = JSON.parse(new TextDecoder().decode(await unpack(manifest.metadata, manifest.metadata_sha256)));
  const graph = {
    n: manifest.neurons,
    neurons,
    manifest,
    sign: Int32Array.from(neurons, (row) => row[5]),
  };
  let done = 0;
  const total = manifest.arrays.reduce((sum, array) => sum + array.parts.length, 0);
  for (const array of manifest.arrays) {
    const values = new Uint32Array(array.length);
    let offset = 0;
    for (const part of array.parts) {
      const chunk = new Uint32Array(await unpack(part.file, part.sha256));
      values.set(chunk, offset);
      offset += chunk.length;
      progress(++done / total);
    }
    if (offset !== values.length) throw Error('Invalid data length for ' + array.name);
    graph[array.name] = values;
  }
  if (
    graph.offsets.length !== graph.n + 1 ||
    graph.offsets[graph.n] !== graph.sources.length ||
    graph.counts.length !== graph.sources.length
  )
    throw Error('Invalid CSR structure');
  return graph;
}
async function digest(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (x) =>
    x.toString(16).padStart(2, '0'),
  ).join('');
}
