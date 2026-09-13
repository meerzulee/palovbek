# Connecting a fly-brain model to plov.fly

Historical design plan, researched September 13, 2026. The local baseline is now implemented. Read [the implementation notes](docs/NEURAL_IMPLEMENTATION.md) and [README](README.md) for the actual architecture, reproduction commands, measurements, and limitations. The numbered sections below preserve the broader research roadmap; training, improved sensory physiology, comparative task evaluation, and hosting remain future work.

The first milestone is a measured causal loop: kitchen sensations stimulate a connectome-based neural model, its output selects a cooking action, and that action changes the kitchen. A successful first experiment could be finding the carrots and chopping them. Cooking a complete plov is a later training objective, with no guarantee that the chosen model will learn it.

Confirmed user decision: let Palov experiment and fail. Neural episodes permit wandering, mistakes, and failed recipes. No cooking assistant selects the correct next step, repairs mistakes, or forces completion. Assisted cooking is outside the scope of this version. The current scripted demonstration remains available as its own mode.

Failures remain visible and are recorded as episode outcomes. A new attempt begins only through an explicit reset or a logged training-episode reset; it must not silently replace a failed dish with success. Training rewards can guide learning, but must not override the controller's selected actions.

1. **Choose and verify the neural foundation.**

   Target MaleCNS v1.0 to connect this project to the recent Google/HHMI Janelia release. Use the official neuron annotations, neurotransmitter predictions, and aggregate connection table. Janelia lists those files at approximately 13 MB, 42 MB, and 1.1 GB, respectively, and provides bulk downloads under `gs://flyem-male-cns/v1.0/connectome-data/flat-connectome/`. The data is CC-BY. We do not need electron-microscopy image volumes for the controller. Record the exact source files, checksums, filters, and resulting graph counts rather than copying a headline neuron count into the UI. [Official MaleCNS downloads](https://male-cns.janelia.org/download/)

   Use Shiu and colleagues' leaky integrate-and-fire model as the numerical and scientific starting point. Their research addresses sensorimotor responses; it does not establish cooking ability or a complete reproduction of a fly's mind. [Research paper](https://www.nature.com/articles/s41586-024-07763-9)

   First reproduce an existing reference stimulation experiment using the reference model's own dataset and configuration. The official implementation uses Brian 2, supports neuron stimulation and silencing, and distinguishes the paper's FlyWire v630 data from the newer v783 files. This is a separate reference check, not validation of our MaleCNS adaptation. [Reference implementation](https://github.com/philshiu/Drosophila_brain_model)

   Then adapt the model to MaleCNS. Match populations through release-specific annotations; do not transfer individual neuron IDs between specimens. Document assumed synaptic signs, uncertain neurotransmitter predictions, delays, and cell dynamics. Start with a fixed connectivity graph and fixed model parameters. Verify index alignment, units, inhibition, refractoriness, and stable activity before connecting cooking rewards.

   Completion criterion: repeatable stimulus responses, a complete import manifest, and measured memory use and simulation throughput. Any reduced graph must be explicitly identified as a reduced model.

2. **Turn the kitchen into an environment with consequences.**

   Today, `src/simulation.ts` advances along a 90-second timeline and automatically adds ingredients. `src/KitchenScene.tsx` also derives movements and tool animations from time and recipe stage. Those mechanisms are appropriate for the demonstration, but cannot decide outcomes in neural mode.

   Introduce an authoritative kitchen state containing the fly's position, held item, ingredient locations and quantities, carrot preparation, pot temperature, water level, browning, rice hydration, burning, and serving state. Heat and time affect these quantities. Actions change objects and food; elapsed time alone never completes the recipe.

   Initial actions are deliberately small: approach a chosen station, pick up a nearby ingredient, chop once, add the held ingredient, stir briefly, increase/decrease fire, add water, cover/uncover, wait, and serve. An interaction can fail because the fly is too far away or lacks the required object. Wrong culinary choices remain possible. We must not restrict the action menu to the correct next recipe step.

   Existing animation code becomes the executor of a selected action. It provides the route to a selected station and the motion of the knife or spoon. It does not choose the station, ingredient, next recipe step, or recovery action. This is an interface to authored skills; it is not biological control of every leg or muscle.

   Create two controllers against the same environment contract: `ScriptedController` and `NeuralController`. Only one controller owns an episode. Keep today's demonstration working during this refactor.

   Completion criterion: a scripted controller can complete the new environment, and an intentionally wrong controller can produce a failed dish. Rendering and headless execution produce the same state transitions.

3. **Build the sensory and action bridge.**

   Proposed loop:

   ```mermaid
   flowchart LR
     K[Kitchen state] --> E[Sensory encoder]
     E --> N[Connectome-based neural model]
     N --> D[Action decoder]
     D --> A[Movement and cooking skills]
     A --> K
     K --> V[Three.js viewer]
     N --> V
   ```

   Begin with simple, inspectable sensory channels instead of a full biological eye model. Encode local ingredient cues, left/right target bearing, proximity, contact, heat, and food state into stimulation rates for documented input populations. These kitchen encodings are engineered assignments: we cannot claim a neuron naturally represents carrots or a qazan. The encoder must not receive a hidden instruction such as “step 3, add carrots.”

   Pool spikes over a declared simulated-time window and decode a small set of candidate output populations into an action and target. Preserve neural state between decisions. Record the mapping from neuron populations to each action, including choices made through calibration.

   The actor receives neural features, not a parallel copy of the kitchen state or a recipe planner's recommendation. Keep readout complexity small and report any memory or additional features supplied to it. This makes it possible to test whether neural computation contributes to decisions.

   Start with one question: can a changing sensory cue change Palov's target or trigger a chop through the neural path? Do not treat an arbitrary flicker-to-animation mapping as learned cooking.

4. **Connect a persistent backend to the existing viewer.**

   Run the neural model and authoritative kitchen in a Python process. Keep React/Three.js for rendering and user controls. Exchange action events and state snapshots over WebSocket. Stream summaries of neural activity and a selected neuron sample; do not send the full connectome on every frame.

   Proposed backend modules:

   ```text
   brain/data/          # Verified downloads, indexing, population manifests
   brain/model/         # Reference adapter and persistent simulation state
   brain/bridge/        # Sensory encoding and output decoding
   brain/kitchen/       # Headless world dynamics, actions, observations, scoring
   brain/training/      # Curriculum, decoder optimization, checkpoints
   brain/server/        # Session protocol and viewer snapshots
   brain/evaluation/    # Replays, numerical checks, baselines, interventions
   src/controllers/    # Scripted and neural controller interfaces
   src/brain/           # WebSocket client and neural telemetry UI
   ```

   Every snapshot identifies the run, sequence number, simulated time, controller/model version, active action and its progress, world state, and measured neural summaries. Separate simulated time from wall time. Smooth rendering between snapshots without inventing new actions. A slower simulation slows the experiment; it does not skip neural steps to keep the progress bar moving.

   Pause/reset must apply to world state and neural state together. Reject stale actions after reset or reconnect. Checkpoint the world, neural variables, pending delayed spikes, decoder, training state, and random generators. If the backend disconnects, freeze the neural episode and show the connection state; switching to the scripted demo must be explicit.

   Initially run one local session. This workspace's machine reports an Apple M5 with 24 GiB memory. Benchmark on it before choosing remote compute. GPU acceleration and a public shared stream are later deployment decisions; full-graph interactive speed is not yet established here.

5. **Train in small tasks, and say exactly what learns.**

   First measure a fixed decoder as a baseline. Then keep the neural graph fixed and train a small decoder on its activity, progressing through: choose a target; pick up an item; chop a carrot; carry and add it; control heat and stirring; combine these skills into a recipe. Describe this phase as a trained controller using a fixed fly-brain model.

   Define rewards from actual environment changes: a newly completed useful preparation, correct transfer, suitable cooking state, or successful serving. Penalize burning, spilling, wasting ingredients, and terminal failure. Award preparation rewards once; prevent repeated chopping, stirring, or dropping/retrieving from earning unbounded credit. Give timeouts finite episode costs. Log every reward component.

   Keep privileged recipe knowledge in the scorer, not the actor's inputs. At evaluation, freeze learning, remove training hints, vary layouts and starting conditions, and use seeds not seen in training. A good shaped reward score alone is insufficient: measure actual dish completion and quality.

   Supplying a reward or a “dopamine” stimulus does not by itself implement learning. If later experiments modify synaptic gains or add a plasticity rule, specify exactly what changes, preserve the measured topology, and evaluate that version separately. A trained decoder and a plastic neural model support different claims.

   Completion criterion: performance improves on held-out episodes against the untrained baseline. If it does not, keep the system labeled an exploratory neural controller rather than claim that Palov has learned plov.

6. **Prove the neural path matters and expose useful telemetry.**

   Compare the controller against random actions and a small policy with a comparable input/readout budget. Run matched interventions: zero sensory input, silence selected populations, time-shuffle neural outputs, and test a carefully matched rewired graph. Preserve activity and degree statistics where possible so gross changes in firing do not masquerade as evidence for a specific topology.

   An output change after silencing establishes a dependency. A repeatable loss of task performance supports usefulness. Neither establishes that natural flies cook or that the simulation reproduces their minds. Evaluate interventions over multiple seeds and report uncertainty.

   In the app, show controller mode, dataset/model version, episode, actual cooking outcome, selected action, reward history, recorded firing activity, and simulation speed. A neuron view should use documented coordinates when available. Decorative motion must not be described as measured neural data. Log manual user interventions and exclude those episodes from autonomous performance results.

   Save replayable episodes. The strongest first public demonstration is a short causal example: a cue changes, activity changes, Palov changes his action, and the kitchen records the result—with an intervention that disrupts the effect.

The recommended next implementation is steps 1 and 2, followed by a single neural action through the complete loop. The two unresolved feasibility questions are whether the imported model supplies useful task features and whether it runs fast enough on the available hardware. Resolve those before spending effort on full-recipe training or continuous hosting.
