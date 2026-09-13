# Data and model attribution

## MaleCNS v1.0

The connectome, body annotations, transmitter predictions, and soma positions come from the MaleCNS collaboration, HHMI Janelia Research Campus, and collaborators. Source: [MaleCNS official download page](https://male-cns.janelia.org/download/).

The downloaded datasets are provided under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/). Preserve this attribution and the source/release identifiers when sharing derived graphs, coordinates, or visualizations. Changes made here include annotation-based cohort selection, index remapping, aggregate synaptic sign assignments, and coordinate normalization. Exact inputs and SHA-256 hashes are in `brain/sources.lock.json`; transformations are documented in `docs/NEURAL_IMPLEMENTATION.md`.

## Shiu and colleagues’ brain model

Scientific starting point: [Shiu et al., “A Drosophila computational brain model reveals sensorimotor processing,” Nature (2024)](https://www.nature.com/articles/s41586-024-07763-9).

Reference code and accompanying reference files: [philshiu/Drosophila_brain_model](https://github.com/philshiu/Drosophila_brain_model), pinned commit `91bdd1e7dcf193f3e7ca5a8933497fcef63b7960`. The pinned repository license is MIT, copyright © 2023 Philip Shiu and Nico Spiller. Its full notice is preserved at [docs/licenses/shiu-model-MIT.txt](docs/licenses/shiu-model-MIT.txt).

`brain/reference.py` runs the downloaded upstream implementation without modifying it. `brain/model.py` independently implements a persistent sparse integrator using that model’s simplified LIF equations and parameter choices. It adapts them to another specimen/dataset and an engineered kitchen interface; the original authors did not validate or endorse those adaptations. FlyWire reference data remain separate from MaleCNS.

## Software

JavaScript dependencies are pinned by `package-lock.json`; Python dependencies by `uv.lock`. Their distributions carry their respective licenses. This document does not replace those notices or apply a new license to third-party work.

This project is independent of Google, HHMI Janelia, the MaleCNS collaboration, and the reference model authors.


## Xenova browser engine and Hugging Face kernels

Browser source: [Xenova/fruit-fly-simulation](https://huggingface.co/spaces/Xenova/fruit-fly-simulation), commit `776d115ee5aa934578a87fd6d260d138084f59c1`. The root license explicitly grants MIT terms for original application code (copyright 2026), although the Space metadata tag says Apache 2.0. We preserve the complete root notice at `src/vendor/xenova/LICENSE` and distribute it at `/browser-brain/LICENSE.txt`.

Included JavaScript/WGSL comes from its brain engine, GPU check, loader and stimulus/readout helpers. Modifications: configurable GPU seed; pinned metadata integrity; retry/cache recovery; compressed asset filenames changed to `.dat` without changing payload bytes. The plov kitchen, ingredient readout, controls, speech and animated body are our own integration. This adaptation is not endorsed by the source authors. Full source hashes and changes: `src/vendor/xenova/sources.lock.json`.

The browser graph is a MaleCNS CC BY 4.0 derivative. Credit **FlyEM / HHMI Janelia, University of Cambridge, MRC Laboratory of Molecular Biology, Google Research, and the MaleCNS collaborators**. Its cohort, remapped indices and normalized display coordinates are documented in the distributed manifest and `docs/BROWSER_BRAIN.md`. Keep those credits and the [license link](https://creativecommons.org/licenses/by/4.0/) when redistributing.

`@huggingface/kernels` is pinned at `0.0.1-preview.1` and uses Apache 2.0. Local Identity and MatMul template revisions and their notices are included under `/browser-brain/kernels/` and `/browser-brain/licenses/`. Three.js is MIT. Upstream body/font/gait assets are not used. The distributed third-party notices are preserved with the site, including upstream supplementary notices; they do not relicense this project’s original code.
