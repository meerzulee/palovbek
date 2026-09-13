"""Persistent sparse LIF engine. Units: mV and ms; no synthetic activity generator."""
from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np
from numba import njit

from .connectome import Connectome


@dataclass(frozen=True)
class Parameters:
    dt_ms: float = .1
    rest_mv: float = -52
    reset_mv: float = -52
    threshold_mv: float = -45
    membrane_ms: float = 20
    synapse_ms: float = 5
    refractory_ms: float = 2.2
    delay_ms: float = 1.8
    weight_mv: float = .275
    input_factor: float = 250


@njit(cache=True, nogil=True)
def integrate(indptr, posts, weights, voltage, current, last_spike, refractory, queue,
              inputs, events, first_step, membrane_decay, current_decay, coupling,
              rest, reset, threshold, weight_mv, input_mv, delay, output_silenced, output_mask, trace):
    """Match Brian's groups → thresholds → synapses/input → resets schedule."""
    n = len(voltage)
    counts = np.zeros(n, dtype=np.int64)
    fired = np.empty(n, dtype=np.int32)
    for offset in range(events.shape[0]):
        step = first_step + offset
        fired_count = 0
        slot = step % len(queue)
        for i in range(n):
            if step - last_spike[i] >= refractory[i]:
                voltage[i] = rest + (voltage[i] - rest) * membrane_decay + current[i] * coupling
                current[i] *= current_decay
                if voltage[i] > threshold and not (output_silenced and output_mask[i]):
                    fired[fired_count] = i
                    fired_count += 1
                    counts[i] += 1
                    if trace.shape[0] > 0:
                        trace[offset, i] = 1
        # Arrivals are delivered after threshold detection, and refractory g is clamped.
        for i in range(n):
            if step - last_spike[i] >= refractory[i]:
                current[i] += queue[slot, i]
            queue[slot, i] = 0
        for event in range(fired_count):
            i = fired[event]
            arrival = (step + delay) % len(queue)
            for edge in range(indptr[i], indptr[i + 1]):
                queue[arrival, posts[edge]] += weights[edge] * weight_mv
        for j in range(len(inputs)):
            if events[offset, j]:
                voltage[inputs[j]] += input_mv
        for event in range(fired_count):
            i = fired[event]
            voltage[i] = reset
            current[i] = 0
            last_spike[i] = step
    return counts


class Brain:
    def __init__(self, graph: Connectome, seed: int = 17, parameters: Parameters | None = None):
        self.graph = graph
        self.parameters = parameters or Parameters()
        if self.parameters.dt_ms <= 0 or self.parameters.delay_ms < self.parameters.dt_ms:
            raise ValueError("Positive timestep and at least one step of synaptic delay required")
        self.input_indices = np.array(sorted({i for channel in graph.channels.values() for i in channel["indices"]}), dtype=np.int32)
        self.input_lookup = {int(i): j for j, i in enumerate(self.input_indices)}
        self.output_mask = np.zeros(graph.size, dtype=np.bool_)
        self.output_mask[graph.outputs] = True
        intrinsic_mask = ~self.output_mask.copy()
        intrinsic_mask[graph.sensory] = False
        self.groups = [graph.sensory, np.flatnonzero(intrinsic_mask), graph.outputs]
        self.reset(seed)

    def reset(self, seed: int):
        p = self.parameters
        self.seed = seed
        self.rng = np.random.default_rng(seed)
        self.voltage = np.full(self.graph.size, p.rest_mv, dtype=np.float64)
        self.current = np.zeros(self.graph.size, dtype=np.float64)
        self.last_spike = np.full(self.graph.size, -1_000_000, dtype=np.int64)
        self.refractory = np.full(self.graph.size, round(p.refractory_ms / p.dt_ms), dtype=np.int64)
        self.refractory[self.input_indices] = 0
        self.queue = np.zeros((round(p.delay_ms / p.dt_ms) + 1, self.graph.size), dtype=np.float64)
        self.step = 0
        self.counts = np.zeros(self.graph.size, dtype=np.int64)
        self.total_spikes = 0

    @property
    def seconds(self):
        return self.step * self.parameters.dt_ms / 1000

    def rates(self, observations: dict[str, float], sensory_enabled: bool = True) -> np.ndarray:
        rates = np.zeros(len(self.input_indices), dtype=np.float64)
        if sensory_enabled:
            for name, channel in self.graph.channels.items():
                hz = max(0, min(1, float(observations.get(name, 0)))) * 140
                for index in channel["indices"]:
                    slot = self.input_lookup[index]
                    rates[slot] = min(200, rates[slot] + hz)
        return rates

    def advance(self, seconds: float, observations: dict[str, float], sensory_enabled=True, output_silenced=False, events: np.ndarray | None = None, record=False):
        p = self.parameters
        steps = int(round(seconds * 1000 / p.dt_ms))
        if steps <= 0 or abs(steps * p.dt_ms / 1000 - seconds) > 1e-10:
            raise ValueError("Duration must be a positive multiple of dt")
        if events is None:
            probabilities = self.rates(observations, sensory_enabled) * p.dt_ms / 1000
            events = (self.rng.random((steps, len(self.input_indices))) < probabilities).astype(np.uint8)
        if events.shape != (steps, len(self.input_indices)):
            raise ValueError("External event shape does not match steps and input population")
        trace = np.zeros((steps, self.graph.size), dtype=np.uint8) if record else np.empty((0, 0), dtype=np.uint8)
        membrane_decay, current_decay = np.exp(-p.dt_ms / p.membrane_ms), np.exp(-p.dt_ms / p.synapse_ms)
        coupling = p.synapse_ms / (p.membrane_ms - p.synapse_ms) * (membrane_decay - current_decay)
        self.counts = integrate(self.graph.indptr, self.graph.posts, self.graph.weights, self.voltage,
                                self.current, self.last_spike, self.refractory, self.queue,
                                self.input_indices, events, self.step, membrane_decay, current_decay, coupling,
                                p.rest_mv, p.reset_mv, p.threshold_mv, p.weight_mv,
                                p.weight_mv * p.input_factor, round(p.delay_ms / p.dt_ms),
                                output_silenced, self.output_mask, trace)
        self.step += steps
        self.total_spikes += int(self.counts.sum())
        return trace if record else self.counts

    def telemetry(self, seconds: float) -> dict:
        return {"simulated_seconds": self.seconds, "window_seconds": seconds,
                "total_spikes": self.total_spikes, "window_spikes": int(self.counts.sum()),
                "active_neurons": int(np.count_nonzero(self.counts)),
                "population_hz": [float(self.counts[group].mean() / seconds) if len(group) else 0 for group in self.groups],
                "sample_counts": self.counts[self.graph.sample].tolist()}

    def export(self) -> tuple[dict, dict]:
        arrays = {name: getattr(self, name) for name in ("voltage", "current", "last_spike", "queue", "counts")}
        metadata = {"step": self.step, "seed": self.seed, "total_spikes": self.total_spikes,
                    "rng": self.rng.bit_generator.state, "parameters": asdict(self.parameters)}
        return arrays, metadata

    def restore(self, arrays: dict, metadata: dict):
        if metadata["parameters"] != asdict(self.parameters):
            raise ValueError("Checkpoint neuron parameters differ")
        for name in ("voltage", "current", "last_spike", "queue", "counts"):
            incoming = arrays[name]
            if incoming.shape != getattr(self, name).shape or incoming.dtype != getattr(self, name).dtype:
                raise ValueError(f"Checkpoint array mismatch: {name}")
            setattr(self, name, incoming.copy())
        self.step = metadata["step"]
        self.seed = metadata["seed"]
        self.total_spikes = metadata["total_spikes"]
        self.rng.bit_generator.state = metadata["rng"]
