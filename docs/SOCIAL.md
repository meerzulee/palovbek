# Palovbek launch kit

Attach the **vertical MP4** to the post as a native video. The opening line is already burned into the clip: **“166,700 neurons. One qazan.”** The video is silent so it also works in muted feeds. No third-party music is included.

The clip shows actual output from the browser model, cut into short highlights at normal playback speed. It is an edited cooking session, not one continuous 30-second recipe. Neuron counters were recorded from the running model, not added in editing.

## Files

- `artifacts/social/palovbek-vertical.mp4` — 1080 × 1920, H.264, 30 fps, YUV 4:2:0, fast-start MP4.
- `artifacts/social/palovbek-cover.png` — vertical cover image.
- `artifacts/social/full-cook.webm` — complete source recording; includes setup time.
- `artifacts/social/capture.json` — timestamped cooking observations.
- `artifacts/social/media-report.json` — exact cuts, encode details, and neural result.
- [`social/x_en.txt`](social/x_en.txt), [`social/x_ru.txt`](social/x_ru.txt), [`social/threads_en.txt`](social/threads_en.txt), [`social/threads_ru.txt`](social/threads_ru.txt) — copy-ready posts.

Videos and raw captures are excluded from Git. Published launch media are attached to the repository’s [v1.0.0 release](https://github.com/meerzulee/palovbek/releases/tag/v1.0.0).

## X — English

```text
166,700 neurons. Six legs. One qazan.

Meet Palovbek: a fly in a do‘ppi cooking Uzbek plov in your browser. 🪰🍚

Recipe sets the order. Simulated brain activity nudges portions + pauses.

Would your oshpaz approve?
https://plov.mrz.sh
```

## X — Русский

```text
166 700 нейронов. Шесть лапок. Один казан.

Это Паловбек: муха в тюбетейке готовит плов прямо в браузере. 🪰🍚

Рецепт задаёт порядок, активность модели мозга влияет на порции и паузы.

Ваш ошпаз одобрил бы?
https://plov.mrz.sh
```

## Threads — English

```text
I gave a simulated fly brain a do‘ppi and a qazan. Meet Palovbek. 🪰🍚

He chops carrots, stirs zirvak, rubs his little hands while waiting, and takes plov very seriously.

166,700 modeled neurons, running in your browser. The recipe sets the order; measured spikes influence portions and pauses. He hasn’t learned to cook. Yet my cousins already want fourteen portions.

Would you let him cook at your wedding?
https://plov.mrz.sh
```

## Threads — Русский

```text
Дал симуляции мозга мухи тюбетейку и казан. Знакомьтесь: Паловбек. 🪰🍚

Режет морковь, мешает зирвак, потирает лапки в ожидании. К плову относится серьёзнее, чем я к дедлайнам.

166 700 нейронов модели работают в браузере. Порядок задаёт рецепт, спайки влияют на порции и паузы. Готовить нейросеть не училась. Но родственники уже просят четырнадцать порций.

Доверили бы ему плов на той?
https://plov.mrz.sh
```

## Optional source-code reply

English:

```text
Source + setup: https://github.com/meerzulee/palovbek

Built on Xenova’s browser engine and MaleCNS connectome data. WebGPU when available, CPU fallback. No training run or paid model API. Includes source pins, attribution, numerical checks, and cooking logs.
```

Русский:

```text
Код и запуск: https://github.com/meerzulee/palovbek

В основе — браузерный движок Xenova и коннектом MaleCNS. WebGPU или CPU. Без обучения и платного API модели. В репозитории — источники, лицензии, численные проверки и журнал приготовления.
```

## Record it again

Install `ffmpeg` and `ffprobe` with your package manager, and use the Chrome installation detected on macOS or `npx playwright install chromium` elsewhere.

```sh
npm ci
npm run build
npm run preview -- --port 4173
# In another terminal:
npm run media:record
npm run media:edit
```

The recording script uses a separate fresh browser context, downloads verified weights, waits for a complete recipe, and captures a 1080 × 1920 presentation. It changes only layout CSS; simulation timesteps, cooking pace, weights, and readouts are unchanged. The edit script finds chopping, stirring, layering, covering, and serving from the captured observations, then joins those moments without speeding them up. Allow around six minutes for recording, plus encoding time.

Environment overrides: `PALOVBEK_URL`, `PALOVBEK_MEDIA_DIR`, and `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Use a stable production preview while recording so source edits do not trigger development reloads.
