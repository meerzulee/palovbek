"""Measure this machine and test causal interventions on the complete imported graph."""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import platform
import resource
import time
from dataclasses import asdict
from datetime import datetime, timezone

import numpy as np
import psutil

from .connectome import load
from .decoder import Decoder
from .kitchen import Kitchen
from .model import Brain
from .session import ENGINE_VERSION, Session
from .sources import ROOT, RUNS, sha256


def environment():
    return {"utc": datetime.now(timezone.utc).isoformat(), "platform": platform.platform(),
            "machine": platform.machine(), "python": platform.python_version(), "cpu_count": psutil.cpu_count(),
            "ram_bytes": psutil.virtual_memory().total,
            "implementation_sha256": {str(path.relative_to(ROOT.parent)): sha256(path) for path in sorted(ROOT.glob("*.py"))},
            "versions": {name: importlib.metadata.version(name) for name in ("numpy", "numba", "brian2", "scipy", "pyarrow")}}


def benchmark(seconds=1.0):
    graph = load()
    brain = Brain(graph)
    start = time.perf_counter()
    brain.advance(.05, Kitchen().observe())
    first_window = time.perf_counter() - start
    brain.reset(17)
    start = time.perf_counter()
    windows = round(seconds / .05)
    if windows < 1 or abs(windows * .05 - seconds) > 1e-9:
        raise ValueError("Benchmark seconds must be a positive multiple of .05")
    timings = []
    for _ in range(windows):
        before = time.perf_counter()
        brain.advance(.05, Kitchen().observe())
        timings.append(time.perf_counter() - before)
    wall = time.perf_counter() - start
    rss = psutil.Process().memory_info().rss
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * (1 if platform.system() == "Darwin" else 1024)
    report = {"environment": environment(), "engine": ENGINE_VERSION, "seed": 17,
              "neurons": graph.size, "weighted_edges": len(graph.posts), "parameters": asdict(brain.parameters),
              "first_window_wall_seconds": first_window, "neural_seconds": brain.seconds, "wall_seconds": wall,
              "simulated_seconds_per_wall_second": brain.seconds / wall, "window_wall_seconds": timings,
              "rss_bytes": rss, "process_peak_rss_bytes": max(peak, rss),
              "finite_state": bool(np.isfinite(brain.voltage).all() and np.isfinite(brain.current).all()),
              "telemetry": {k: v for k, v in brain.telemetry(.05).items() if k != "sample_counts"},
              "graph_hashes": graph.manifest["files"], "note": "One CPU process; no GPU. Warm kernel, constant prep cues, no rendering. Not a hosting capacity guarantee."}
    RUNS.mkdir(exist_ok=True)
    (RUNS / "benchmark.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({k: v for k, v in report.items() if k not in ("graph_hashes", "window_wall_seconds")}, indent=2))
    return report


def causality():
    graph = load()
    rows = []
    for seed in (17, 29, 43):
        for condition in ("prep_cues", "no_sensory_input", "output_neurons_silenced", "qazan_cues"):
            brain = Brain(graph, seed)
            world = Kitchen(station="qazan", temperature=170, water=.3) if condition == "qazan_cues" else Kitchen()
            brain.advance(.5, world.observe(), condition != "no_sensory_input", condition == "output_neurons_silenced")
            decision = Decoder(graph.outputs, seed).choose(brain.counts, .5)
            rows.append({"seed": seed, "condition": condition, "total_spikes": brain.total_spikes,
                         "output_spikes": int(brain.counts[graph.outputs].sum()), "decision": decision,
                         "state_hash": hashlib.sha256(brain.voltage.tobytes()).hexdigest()})
    baseline = [row for row in rows if row["condition"] == "prep_cues"]
    silent = [row for row in rows if row["condition"] == "no_sensory_input"]
    blocked = [row for row in rows if row["condition"] == "output_neurons_silenced"]
    checks = {"input_propagates_to_outputs": all(row["output_spikes"] > 0 for row in baseline),
              "no_input_at_rest_is_silent": all(row["total_spikes"] == 0 and row["decision"]["action"] == "wait" for row in silent),
              "silenced_outputs_cannot_choose_active_action": all(row["total_spikes"] > 0 and row["output_spikes"] == 0 and row["decision"]["action"] == "wait" for row in blocked),
              "sensory_context_changes_output_distribution": all(a["decision"]["probabilities"] != b["decision"]["probabilities"] for a, b in zip(baseline, [row for row in rows if row["condition"] == "qazan_cues"]))}
    report = {"environment": environment(), "engine": ENGINE_VERSION, "duration_per_condition_seconds": .5,
              "checks": checks, "trials": rows, "note": "These are engineering causality checks, not biological validation or evidence of cooking skill. Conditions restart from rest with matched seeds."}
    (RUNS / "causality.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(checks, indent=2))
    if not all(checks.values()):
        raise RuntimeError("A causality check failed; inspect brain/runs/causality.json")


def episode(seed=17, checkpoint=None, controller="neural", recipe_id="classic"):
    session = Session(load(), seed, controller=controller, recipe_id=recipe_id)
    if checkpoint:
        from pathlib import Path
        session.restore(Path(checkpoint))
    session.running = True
    start = time.perf_counter()
    while session.running:
        session.step()
    path = session.save()
    report = {"environment": environment(), "seed": session.seed, "engine": ENGINE_VERSION,
              "decoder": session.decoder.version, "outcome": session.world.outcome, "mistakes": session.world.mistakes,
              "added": session.world.added, "neural_seconds": session.brain.seconds, "world_seconds": session.world.elapsed,
              "wall_seconds": time.perf_counter() - start, "action_count": session.world.action_serial,
              "total_spikes": session.brain.total_spikes, "log": session.log_path.name, "checkpoint": path,
              "controller": session.controller, "recipe_id": session.recipe_id, "cooking_log": session.cooking_log,
              "events": session.world.events, "note": "Authored recipe rules; the full neural model observes kitchen cues." if session.controller == "recipe" else "Untrained neural readout. No recipe teacher, correction, learning, or automatic success."}
    suffix = f"recipe-{session.recipe_id}-{session.seed}" if session.controller == "recipe" else str(session.seed)
    (RUNS / f"episode-summary-{suffix}.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seconds", type=float, default=1)
    parser.add_argument("--causality", action="store_true")
    parser.add_argument("--episode", action="store_true")
    parser.add_argument("--seed", type=int, default=17)
    parser.add_argument("--checkpoint")
    parser.add_argument("--controller", choices=("neural", "recipe"), default="neural")
    parser.add_argument("--recipe", choices=("classic", "quince", "wedding", "bedana"), default="classic")
    args = parser.parse_args()
    if args.episode:
        episode(args.seed, args.checkpoint, args.controller, args.recipe)
    elif args.causality:
        causality()
    else:
        benchmark(args.seconds)
