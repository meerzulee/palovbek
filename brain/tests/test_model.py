from __future__ import annotations

import numpy as np
from scipy.sparse import coo_matrix

from brain.connectome import Connectome
from brain.model import Brain


def small_graph():
    matrix = coo_matrix(([400., 300., -150., 250.], ([0, 1, 2, 1], [1, 2, 1, 3])), shape=(4, 4)).tocsr()
    return Connectome(matrix.indptr.astype(np.int64), matrix.indices.astype(np.int32), matrix.data,
                       np.arange(4), np.array([0], np.int32), np.array([3], np.int32),
                       np.arange(4, dtype=np.int32), {"neurons": 4}, {"signal": {"indices": [0]}}, [])


def test_exact_integrator_matches_brian2_spikes_and_state():
    """Independent simulator comparison, including inhibition, delay, and refractory clamps."""
    import brian2 as b2
    b2.start_scope()
    b2.prefs.codegen.target = "numpy"
    b2.defaultclock.dt = .1 * b2.ms
    graph = small_graph()
    brain = Brain(graph)
    rng = np.random.default_rng(91)
    events = (rng.random((2000, 1)) < .018).astype(np.uint8)
    expected = brain.advance(.2, {}, events=events, record=True)
    eqs = """dv/dt = (-52*mV-v+g)/(20*ms) : volt (unless refractory)
             dg/dt = -g/(5*ms) : volt (unless refractory)
             rfc : second"""
    neurons = b2.NeuronGroup(4, eqs, method="linear", threshold="v > -45*mV", reset="v=-52*mV;g=0*mV", refractory="rfc")
    neurons.v = -52 * b2.mV
    neurons.rfc = 2.2 * b2.ms
    neurons.rfc[0] = 0 * b2.ms
    synapses = b2.Synapses(neurons, neurons, "w:volt", on_pre="g_post += w", delay=1.8 * b2.ms)
    synapses.connect(i=[0, 1, 2, 1], j=[1, 2, 1, 3])
    synapses.w = np.array([400., 300., -150., 250.]) * .275 * b2.mV
    monitor = b2.SpikeMonitor(neurons)
    neurons.namespace["external"] = b2.TimedArray(events[:, 0] * 68.75 * b2.mV, dt=.1 * b2.ms)
    inputs = neurons[:1].run_regularly("v += external(t)", dt=.1*b2.ms, when="synapses", order=1)
    network = b2.Network(neurons, synapses, monitor, inputs)
    network.run(.2 * b2.second)
    observed = np.zeros_like(expected)
    observed[np.rint(monitor.t / b2.defaultclock.dt).astype(int), np.asarray(monitor.i)] = 1
    assert np.all(expected.sum(axis=0) > 0), "All fixture neurons must fire to exercise delayed inhibition"
    np.testing.assert_array_equal(expected, observed)
    np.testing.assert_allclose(brain.voltage, neurons.v / b2.mV, atol=1e-9)
    np.testing.assert_allclose(brain.current, neurons.g / b2.mV, atol=1e-9)


def test_state_and_pending_delays_survive_checkpoint_and_chunk_boundaries():
    graph = small_graph()
    first = Brain(graph, seed=1)
    whole = Brain(graph, seed=1)
    first.advance(.031, {"signal": 1})
    arrays, metadata = first.export()
    restored = Brain(graph, seed=999)
    restored.restore(arrays, metadata)
    a = first.advance(.069, {"signal": 1}, record=True)
    b = restored.advance(.069, {"signal": 1}, record=True)
    whole.advance(.1, {"signal": 1})
    np.testing.assert_array_equal(a, b)
    np.testing.assert_array_equal(restored.voltage, whole.voltage)
    np.testing.assert_array_equal(restored.queue, whole.queue)


def test_no_input_is_silent_and_output_intervention_stops_output_spikes():
    graph = small_graph()
    graph.weights[:] *= 10  # Strong toy synapses ensure a downstream response in this short trial.
    brain = Brain(graph)
    assert brain.advance(.1, {}, sensory_enabled=False).sum() == 0
    assert brain.advance(.2, {"signal": 1})[3] > 0
    assert brain.advance(.1, {"signal": 1}, output_silenced=True)[3] == 0
