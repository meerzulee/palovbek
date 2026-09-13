import json

import pytest
from fastapi.testclient import TestClient

from brain.kitchen import ACTIONS, Kitchen
from brain.recipe import RECIPES, RecipeChef
from brain.server import create_app
from brain.session import Session
from brain.tests.test_session import graph_fixture


@pytest.mark.parametrize('recipe_id', RECIPES)
def test_every_recipe_finishes_in_order_without_mistakes(recipe_id):
    chef = RecipeChef(recipe_id)
    world = Kitchen(time_limit=360, available=chef.ingredients.copy(), required_ingredients=chef.ingredients.copy())
    events = []
    for _ in range(1441):
        if world.outcome:
            break
        if world.pending is None:
            decision = chef.choose(world)
            assert not decision['blocked']
            action = decision['action']
            if action == 'add' and world.held == 'onion':
                assert world.temperature >= 115
            if action == 'add' and world.held == 'carrot':
                assert world.browning >= .62 and world.carrot_chops == 3
            if action == 'add_water':
                assert 'rice' not in world.added
            if action == 'stir':
                assert 'rice' not in world.added
            if action == 'cover':
                assert world.heat <= .4 + 1e-9
            if action == 'serve':
                assert world.heat == 0 and not world.covered
            world.begin(action)
        world.advance(.25)
        if not world.pending:
            events.append(world.events[-1])
        chef.sync(world)
    assert world.outcome == 'served'
    assert world.added == chef.ingredients
    assert world.mistakes == 0 and world.burn == 0
    assert chef.snapshot(world)['progress'] == 100
    assert sum(event['action'] == 'chop' for event in events) == 3
    assert 'serve' not in ACTIONS[:-1] and len(ACTIONS) == 21  # Legacy readout pool layout stays fixed.


def test_missing_ingredient_blocks_without_fabricating_success():
    chef = RecipeChef()
    world = Kitchen(available=[])
    assert chef.choose(world)['blocked']
    assert not world.outcome and not world.added


def test_recipe_checkpoint_restores_pending_action_and_log(tmp_path):
    session = Session(graph_fixture(), directory=tmp_path, controller='recipe', recipe_id='quince')
    session.running = True
    for _ in range(10):
        session.step()
    session.save()
    expected = session.step()
    session.restore()
    assert session.controller == 'recipe' and session.recipe_id == 'quince'
    session.running = True
    actual = session.step()
    for key in ('world', 'neural', 'recipe', 'cooking_log', 'decision'):
        assert actual[key] == expected[key]


def test_continuous_mode_rotates_and_archives_without_viewers(tmp_path):
    session = Session(graph_fixture(), directory=tmp_path, controller='recipe')
    session.running = session.continuous = True
    with TestClient(create_app(session)) as client:
        # Complete through the same Session.step used by the background loop; no WebSocket subscriber.
        session.running = False
        initial = session.sequence
        session.running = True
        import time
        time.sleep(.3)
        assert session.sequence > initial
        session.running = False
    # Use a separate session to avoid racing a background server while fast-forwarding.
    session = Session(graph_fixture(), directory=tmp_path, controller='recipe')
    session.running = session.continuous = True
    while session.running:
        session.step()
    assert session.world.outcome == 'served'
    report = session.cooking_report()
    assert report['actions'][-1]['action'] == 'serve'
    assert len(report['actions']) > 40
    assert json.loads(next((tmp_path / 'cooking-history').glob('*.json')).read_text())['outcome'] == 'served'
    assert not session.next_recipe_if_due(session.finished_at + 7)
    assert session.next_recipe_if_due(session.finished_at + 8)
    assert session.running and session.continuous and session.recipe_id == 'quince'
    assert session.world.elapsed == 0 and not session.cooking_log
    assert session.completed_episodes == 1
    with TestClient(create_app(session)) as client:
        session.running = False
        assert client.get('/api/neural/cooking-log').json()['recipe']['id'] == 'quince'
        history = client.get('/api/neural/history').json()['episodes']
        assert len(history) == 1
        archived = client.get('/api/neural/history/' + history[0]['run_id'])
        assert archived.json()['actions'][-1]['action'] == 'serve'
        assert client.get('/api/neural/history/not-a-uuid').status_code == 404


def test_invalid_recipe_does_not_reset_existing_episode(tmp_path):
    session = Session(graph_fixture(), directory=tmp_path)
    run_id = session.run_id
    with pytest.raises(ValueError):
        session.reset(17, 'recipe', 'unknown')
    assert session.run_id == run_id
