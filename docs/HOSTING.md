# Hosting Palovbek

The current design is **a fresh fly per visitor**, with computation in the browser. Cooking starts automatically once the model is ready; visitors can pause it from the toolbar above the scene. The site can be available 24/7 while each cooking session exists only while that visitor’s tab remains open. Background/mobile tabs may be throttled or suspended. There is no shared brain that must remain awake on a server.

## Cloudflare: current browser build

Use Cloudflare Workers Static Assets with the included `wrangler.jsonc` for country-based language defaults. Plain static hosting of `dist/` also works, with browser-language defaults instead of country detection. No Python process, GPU server, Workers AI model, database, R2 bucket, or container is needed for this version. GPU/CPU inference happens on the visitor’s device. Cloudflare distributes the application and pinned connectome files. [Cloudflare Static Assets documentation](https://developers.cloudflare.com/workers/static-assets/).

```sh
npm ci
npm run assets:prepare
npm run dev
# Open http://localhost:5173, then Initialize brain → Load weights.
```

Build and validate:

```sh
npm run build
npm run check:static
npx wrangler deploy --dry-run
```

When deploying to your Cloudflare account:

First edit `wrangler.jsonc`: choose your own Worker `name`, and replace the `plov.mrz.sh` route with a custom domain in your account. To use a `workers.dev` address instead, remove `routes` and set `"workers_dev": true`.

```sh
npx wrangler login
npm run deploy
```

The production site is live at **[plov.mrz.sh](https://plov.mrz.sh)**. It was deployed on 2026-09-13 UTC (2026-09-14 in Bishkek), Worker version `a400901b-c6b1-41de-b06e-1938a9acd051`. This repository does not contain credentials. Wrangler authentication chooses your account. The deployment uploads static assets plus the small language-detection Worker. The Worker does not run the brain. `npm run deploy` rebuilds and verifies assets first.

The graph download is approximately 79 MB compressed, cached in the browser after verification. The largest file is well below **25 MiB**, Cloudflare’s current per-asset limit; the free Workers static-asset file limit is **20,000**. Build validation checks size and SHA-256 for the shipped model. [Current limits](https://developers.cloudflare.com/workers/platform/limits/).

The `.dat` extension is intentional: these are stored gzip bytes decoded by the app. Do not rename them to `.gz` or configure the host to transparently gunzip them. Transport compression of the entire stored byte response is fine if the browser receives the original gzip payload after HTTP decoding. The supplied `_headers` sets their type to `application/octet-stream`.

The static deployment contains the complete UI, worker modules, connectome, kernel templates and license notices. Browser mode makes no calls to `/api/neural`. The optional **Live neural experiment** tab requires the separate local server and will be offline on a static host; the default **Browser brain** tab is self-contained.

Device requirements: modern browser with module workers, WebGL2 and `DecompressionStream`; HTTPS or localhost is needed for WebGPU and checksums. WebGPU is preferred; the same graph has a JavaScript CPU fallback. Allow several hundred MB for graph arrays, metadata and GPU buffers. Low-memory/mobile devices may struggle; desktop validation and a responsive viewport are not a guarantee of mobile hardware performance. No installation, API key, or trained-weight upload is required for visitors.

## Production hostname and tunnel check

The live hostname is **plov.mrz.sh**. `wrangler.jsonc` declares it as a Worker Custom Domain; the deployment attached the hostname and Cloudflare manages its DNS and certificate. HTTPS and the country-language endpoint returned HTTP 200 after deployment. A dry run does not create DNS or certificates. [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

Before deployment, read-only checks on 2026-09-13 found:

- `mrz.sh` uses Cloudflare nameservers, and an authenticated zone lookup confirms it is active in the current account. Public DNS returned NXDOMAIN for `plov.mrz.sh`, `palov.mrz.sh`, and `fly.mrz.sh` at the time of checking. This is a point-in-time check, not a reservation.
- `cloudflared` 2026.7.3 is installed and its certificate can list tunnels. The CLI reports 2026.9.1 as the available newer version. Existing tunnels and the installation were left untouched. No tunnel named for this app was listed.
- Wrangler is authenticated and has Workers deployment and routing scopes. No deployment or DNS change was made during these checks.

The 24/7 browser version is deployed directly as a Worker with static assets. The application remains available when this Mac is off; each visitor still runs their own brain while their browser is open. `cloudflared` is useful for a temporary preview from this machine, but its local origin must remain running and reachable. A future tunnel preview could use `plov-dev.mrz.sh` to keep the production hostname separate. [Tunnel routing](https://developers.cloudflare.com/tunnel/concepts/routing/).

Country-based language selection runs at the production Worker edge. A tunnel to plain Vite only has browser-language fallback, and local Wrangler's test geolocation should not be treated as the visitor's location.

## Language routing

`worker/index.ts` reads Cloudflare’s trusted `request.cf.country` metadata at `/api/locale`. It returns only `{ "locale": "ru" }`, `{ "locale": "en" }`, or `{ "locale": null }`. No IP address or country is sent to the browser, persisted by application code, or looked up through another service. Responses use `Cache-Control: private, no-store` so visitors cannot inherit another country’s cached choice. [Cloudflare request metadata](https://developers.cloudflare.com/workers/runtime-apis/request/).

The explicit Russian-default list in `shared/locale.ts` is Armenia (AM), Azerbaijan (AZ), Belarus (BY), Kazakhstan (KZ), Kyrgyzstan (KG), Moldova (MD), Russia (RU), Tajikistan (TJ), Turkmenistan (TM), and Uzbekistan (UZ). This is an editable product language rule, not a claim about an individual visitor’s preferred language. All other known countries default to English.

Startup priority:

1. A saved manual EN/RU choice in `plov-language-v1`.
2. The country-derived response from `/api/locale`.
3. The primary browser language (Russian if `ru`, otherwise English), when the endpoint is missing, unknown, offline, or takes longer than 1.2 seconds.

Language is resolved before mounting the kitchen and model modal, avoiding a flash of the English modal for Russian visitors. Automatic defaults are not saved as manual preferences. Switching languages does not initialize another brain or restart a recipe. Blocked local storage limits the preference to that visit.

Only `/api/locale` is configured with `assets.run_worker_first`; weights, kernels, and app assets retain normal static serving. One lightweight Worker request is made on visits without a saved choice. The model still runs entirely on the visitor’s device. Plain Cloudflare Pages/static hosting needs an equivalent endpoint for country detection; otherwise browser-language fallback remains functional. [Selective Worker routing](https://developers.cloudflare.com/workers/static-assets/binding/#run_worker_first).

Test locally with `npx wrangler dev --local --port 8787`. `curl -i http://localhost:8787/api/locale` verifies the JSON route and its cache headers; local geolocation is not proof of a production visitor’s country. `npm test` checks country routing using synthetic trusted metadata, and `e2e/locale.spec.ts` checks startup, override persistence, mobile layout, and Russian download errors.

## Verify a published deployment

```sh
npm run check:production
# To check another deployment:
PALOVBEK_URL=https://your-host.example npm run check:production
```

This launches Chrome (or Playwright Chromium), checks the live locale endpoint, loads and verifies the full model in a fresh touch-enabled 390×844 browser, observes real simulated spikes and the first added ingredient, then checks that a cached reload skips the modal and starts a new cook without downloading model chunks again. It writes `docs/results/production-browser.json` and `artifacts/production-mobile.png`. The first production check passed with 166,700 neurons, 25,582,938 connections, GPU activity, 28 model chunk downloads, and zero chunk downloads on the cached reload. Cloudflare injected its analytics beacon; model and kernel files were served by the application origin. Allow the initial 79 MB download and local CPU/GPU memory usage. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` if needed; otherwise run `npx playwright install chromium` on a machine without the default browser.

The complete browser recipe regression is `npx playwright test e2e/browser.spec.ts`. With the deliberate 1.5–1.8 second action pacing, its wedding cook takes around six minutes on the validated M5. UI, grooming, fire, lid, speech, locale, and mobile checks can be run with `npx playwright test --grep-invert 'browser cooks a complete'`; optional Python tests remain skipped unless explicitly enabled.

## Optional shared server, if wanted again

For one shared Python fly, a provisional starting server is **2 dedicated vCPUs, 4 GB RAM and 20 GB SSD**, with a fast single core. No GPU is used by the current Numba engine. A more comfortable starting configuration is 4 vCPUs / 8 GB RAM. Source import/reference compilation needs extra headroom beyond steady inference. These are starting specifications to benchmark, not a throughput guarantee.

Our short Python benchmark measured about 442 MiB RSS and 0.389 neural seconds per wall second on the M5. A complete recipe with sustained activity took substantially longer per neural second than that short benchmark: the wedding episode ran 55.5 neural seconds / 277.5 kitchen seconds in approximately 380 wall seconds. CPU contention, activity, rendering and log work matter. More cores do not automatically accelerate the single-thread integration kernel.

Cloudflare Containers `standard-3` currently offers **2 vCPU, 8 GiB RAM and 16 GB disk** and could hold that workload; regular Workers have a 128 MB memory limit, too small for the Python process. [Container sizes](https://developers.cloudflare.com/containers/platform/limits/), [Worker limits](https://developers.cloudflare.com/workers/platform/limits/).

A server can independently cycle recipes with:

```sh
uv run --frozen python -m brain.server --continuous
```

It continues without viewers and waits eight seconds between completed recipes. Pausing stops continuous mode. Recipe archives and recipe traces retain the latest 200 completed cooks; manual checkpoints and legacy neural experiment logs are preserved separately. Use one application worker per shared session, a process supervisor for restart, persistent storage/backups for data and checkpoints, and authenticated command access before making the local API public. The current server deliberately binds loopback and restricts browser origins; the static deployment does not expose it.

Cloudflare container disks are ephemeral, so a shared version would need durable checkpoint storage and lifecycle management. [Container FAQ](https://developers.cloudflare.com/containers/faq/). Those server deployment changes are unnecessary for the current per-visitor browser design and are not provisioned here.
