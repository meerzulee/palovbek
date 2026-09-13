"""Run the authors' sugar-sensory experiment on their pinned FlyWire v630 data."""
from __future__ import annotations

import argparse
import importlib.util
import json
import platform
import time
from pathlib import Path

import brian2 as b2
import numpy as np
import pandas as pd
import psutil

from .sources import DATA, LOCK, REFERENCE_COMMIT, RUNS, SOURCES, sha256

# Exact sugar neuron IDs and MN9 from the pinned example.ipynb.
SUGAR_IDS = [720575940624963786, 720575940630233916, 720575940637568838, 720575940638202345,
             720575940617000768, 720575940630797113, 720575940632889389, 720575940621754367,
             720575940621502051, 720575940640649691, 720575940639332736, 720575940616885538,
             720575940639198653, 720575940620900446, 720575940617937543, 720575940632425919,
             720575940633143833, 720575940612670570, 720575940628853239, 720575940629176663,
             720575940611875570]
MN9_ID = 720575940660219265


def run_reference(seconds: float = 1.0, trials: int = 3, output: Path | None = None) -> dict:
    if seconds <= 0 or trials < 1:
        raise ValueError("Positive duration and at least one trial required")
    locked = json.loads(LOCK.read_text())
    for key in ("reference_model", "reference_neurons", "reference_connections", "reference_notebook"):
        if sha256(DATA / SOURCES[key][0]) != locked[key]["sha256"]:
            raise ValueError(f"Reference source hash mismatch: {key}")
    path = DATA / "reference/model.py"
    spec = importlib.util.spec_from_file_location("upstream_fly_model", path)
    upstream = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(upstream)
    b2.prefs.codegen.target = "cython"
    neurons = pd.read_csv(DATA / "reference/completeness.csv", index_col=0)
    indices = {int(body): index for index, body in enumerate(neurons.index)}
    inputs = [indices[body] for body in SUGAR_IDS]
    outputs = []
    for condition, hz, silenced in [("no_input", 0, []), ("sugar_100Hz", 100, []), ("sugar_outputs_silenced", 100, inputs)]:
        for trial in range(trials):
            b2.start_scope()
            b2.seed(1000 + trial)
            params = dict(upstream.default_params, t_run=seconds * b2.second, r_poi=hz * b2.Hz)
            start = time.perf_counter()
            spikes = upstream.run_trial(inputs, [], silenced, DATA / "reference/completeness.csv", DATA / "reference/connectivity.parquet", params)
            elapsed = time.perf_counter() - start
            mn9 = len(spikes.get(indices[MN9_ID], [])) / seconds
            record = {"condition": condition, "seed": 1000 + trial, "mn9_hz": mn9, "total_spikes": sum(len(s) for s in spikes.values()), "active_neurons": len(spikes), "wall_seconds": elapsed, "rss_bytes": psutil.Process().memory_info().rss}
            outputs.append(record)
            print(json.dumps(record), flush=True)
    report = {"experiment": "Pinned upstream sugar sensory stimulation and outgoing-synapse silencing", "dataset": "FlyWire v630", "reference_commit": REFERENCE_COMMIT, "reference_model_sha256": sha256(path), "upstream_code_modified": False, "python": platform.python_version(), "platform": platform.platform(), "brian2": b2.__version__, "neurons": len(neurons), "simulated_seconds_per_trial": seconds, "trials_per_condition": trials, "results": outputs, "scope": "Reproduction of the example stimulation protocol; not a reproduction of all paper figures or validation of MaleCNS/cooking."}
    report["checks"] = {
        "no_input_is_silent": all(row["total_spikes"] == 0 for row in outputs if row["condition"] == "no_input"),
        "sugar_reaches_mn9": bool(np.mean([r["mn9_hz"] for r in outputs if r["condition"] == "sugar_100Hz"]) > 0),
        "silencing_reduces_mn9": bool(np.mean([r["mn9_hz"] for r in outputs if r["condition"] == "sugar_outputs_silenced"]) < np.mean([r["mn9_hz"] for r in outputs if r["condition"] == "sugar_100Hz"])),
    }
    RUNS.mkdir(parents=True, exist_ok=True)
    destination = output or RUNS / "reference.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(report, indent=2) + "\n")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seconds", type=float, default=1)
    parser.add_argument("--trials", type=int, default=3)
    parser.add_argument("--output", type=Path, help="Write a separate report instead of brain/runs/reference.json")
    args = parser.parse_args()
    result = run_reference(args.seconds, args.trials, args.output)
    if not all(result["checks"].values()):
        raise SystemExit("A reference check failed; inspect brain/runs/reference.json")
