import numpy as np
import pytest
from fastapi.testclient import TestClient

from brain.decoder import Decoder
from brain.kitchen import ACTIONS
from brain.server import allowed_origin, create_app
from brain.session import Session
from brain.tests.test_model import small_graph


def graph_fixture():
    graph = small_graph()
    graph.manifest.update(dataset="test", retained_synapse_weight_sum=100, selection="test fixture", files={})
    return graph


def test_checkpoint_restores_brain_decoder_kitchen_and_random_generators(tmp_path):
    session = Session(graph_fixture(), directory=tmp_path)
    session.running = True
    for _ in range(3):
        session.step()
    session.save()
    expected = session.step()
    expected_arrays, _ = session.brain.export()
    session.restore()
    assert not session.running
    session.running = True
    actual = session.step()
    assert actual["world"] == expected["world"]
    assert actual["neural"] == expected["neural"]
    assert actual["decision"] == expected["decision"]
    for name, array in expected_arrays.items():
        np.testing.assert_array_equal(getattr(session.brain, name), array)


def test_readout_has_no_actions_without_output_and_uses_distinct_pools():
    decoder = Decoder(np.arange(210), seed=2)
    assert decoder.choose(np.zeros(210), .05)["action"] == "wait"
    assert len(np.unique(np.concatenate(decoder.pools))) == 210
    counts = np.zeros(210)
    counts[decoder.pools[ACTIONS.index("chop")]] = 10
    decision = decoder.choose(counts, .05)
    assert np.argmax(decision["probabilities"]) == ACTIONS.index("chop")
    state = decoder.export()
    next_choice = decoder.choose(counts, .05)
    decoder.restore(state)
    assert decoder.choose(counts, .05) == next_choice


def test_websocket_commands_pause_reset_and_reject_stale_epoch(tmp_path):
    session = Session(graph_fixture(), directory=tmp_path)
    with TestClient(create_app(session)) as client:
        assert client.get("/api/neural/health").json()["ready"]
        with client.websocket_connect("/api/neural/ws", headers={"origin": "http://localhost:5173"}) as socket:
            assert socket.receive_json()["type"] == "metadata"
            first = socket.receive_json()
            socket.send_json({"command": "start", "run_id": first["run_id"]})
            assert socket.receive_json()["running"]
            socket.send_json({"command": "pause", "run_id": first["run_id"]})
            paused = socket.receive_json()
            while paused["running"]:
                paused = socket.receive_json()
            socket.send_json({"command": "reset", "run_id": first["run_id"], "seed": 24})
            reset = socket.receive_json()
            assert reset["seed"] == 24 and reset["neural"]["simulated_seconds"] == 0
            assert reset["run_id"] != first["run_id"]
            socket.send_json({"command": "start", "run_id": first["run_id"]})
            assert socket.receive_json()["type"] == "error"
        assert not session.running


@pytest.mark.parametrize("origin,expected", [("https://evil.example", False), ("http://localhost:5173", True), ("http://192.168.1.4:5173", True), (None, True)])
def test_local_browser_origin_policy(origin, expected):
    assert allowed_origin(origin) is expected


def test_server_warmup_preserves_a_restored_session(tmp_path):
    session = Session(graph_fixture(), directory=tmp_path)
    session.running = True
    session.step()
    session.save()
    session.restore()
    expected = session.snapshot()
    with TestClient(create_app(session)) as client:
        with client.websocket_connect("/api/neural/ws") as socket:
            socket.receive_json()
            snapshot = socket.receive_json()
            assert snapshot["neural"] == expected["neural"]
            assert snapshot["world"] == expected["world"]
            assert not snapshot["running"]
