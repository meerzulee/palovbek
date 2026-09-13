"""An explicitly untrained, seeded readout of neural output populations."""
from __future__ import annotations

import numpy as np

from .kitchen import ACTIONS


class Decoder:
    version = "untrained-disjoint-output-pools-v1"

    def __init__(self, output_indices: np.ndarray, seed: int = 17):
        self.seed = seed
        self.rng = np.random.default_rng(seed + 10_000)
        # Pool membership is fixed across episode seeds, so episodes vary stochastic
        # activity and action sampling without quietly changing the controller wiring.
        permutation = np.random.default_rng(410).permutation(output_indices)
        self.pools = [np.asarray(pool, dtype=np.int32) for pool in np.array_split(permutation, len(ACTIONS))]

    def choose(self, counts: np.ndarray, seconds: float) -> dict:
        rates = np.asarray([np.log1p(counts[pool] / seconds).mean() if len(pool) else 0 for pool in self.pools])
        if not np.any(rates > 0):
            return {"action": "wait", "reason": "No output spikes in the decision window", "scores": rates.tolist(), "probabilities": [float(a == "wait") for a in ACTIONS]}
        centered = (rates - rates.mean()) / max(float(rates.std()), .05)
        exponent = np.exp((centered - centered.max()) / 1.5)
        probabilities = exponent / exponent.sum()
        chosen = int(self.rng.choice(len(ACTIONS), p=probabilities))
        return {"action": ACTIONS[chosen], "reason": "Sampled from neural output-pool activity; decoder is untrained",
                "scores": rates.tolist(), "probabilities": probabilities.tolist()}

    def export(self):
        return {"version": self.version, "seed": self.seed, "rng": self.rng.bit_generator.state}

    def restore(self, data):
        if data["version"] != self.version:
            raise ValueError("Decoder version mismatch")
        self.seed = data["seed"]
        self.rng.bit_generator.state = data["rng"]
