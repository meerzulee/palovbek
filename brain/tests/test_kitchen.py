from brain.kitchen import Kitchen


def execute(world, action):
    world.begin(action)
    while world.pending:
        world.advance(.25)


def test_time_never_adds_ingredients_or_guarantees_a_recipe():
    world = Kitchen()
    for _ in range(240):
        world.advance(1)
    assert world.added == []
    assert world.outcome == "timed_out"


def test_interactions_require_proximity_and_held_objects():
    world = Kitchen()
    execute(world, "stir")
    assert world.mistakes == 1
    execute(world, "pick_carrot")
    execute(world, "chop")
    assert world.carrot_chops == 1
    execute(world, "add")
    assert world.added == []
    execute(world, "go_qazan")
    execute(world, "add")
    assert world.added == ["carrot"] and world.held is None


def test_wrong_serving_choice_can_end_the_episode_in_failure():
    world = Kitchen(station="qazan")
    execute(world, "serve")
    assert world.outcome == "failed_recipe"
    assert world.mistakes == 1


def test_repeated_chopping_does_not_farm_reward():
    world = Kitchen()
    execute(world, "pick_carrot")
    for _ in range(3):
        execute(world, "chop")
    reward = world.reward
    execute(world, "chop")
    assert world.reward == reward


def test_checkpoint_restores_in_flight_action_and_physical_state():
    world = Kitchen()
    world.begin("go_qazan")
    world.advance(.5)
    restored = Kitchen.restore(world.snapshot())
    for _ in range(10):
        world.advance(.25)
        restored.advance(.25)
    assert world.snapshot() == restored.snapshot()


def test_scorer_information_is_not_exposed_to_the_neural_encoder():
    observed = Kitchen().observe()
    assert not {"reward", "outcome", "correct_action", "recipe_step", "carrot_chops", "readiness"} & observed.keys()


def test_explicit_scripted_baseline_can_complete_the_same_physics():
    """An evaluation-only oracle proves the environment is solvable; never used by the neural session."""
    world = Kitchen()
    for ingredient in ("oil", "onion", "lamb", "carrot", "spice", "garlic"):
        if world.station != "prep":
            execute(world, "go_prep")
        execute(world, "pick_" + ingredient)
        if ingredient == "carrot":
            for _ in range(3):
                execute(world, "chop")
        execute(world, "go_qazan")
        execute(world, "add")
    while world.browning < .6 and not world.outcome:
        execute(world, "wait")
    for action in ("go_prep", "pick_rice", "go_qazan", "add", "add_water", "cover"):
        execute(world, action)
    while world.hydration < .9 and not world.outcome:
        execute(world, "wait")
    execute(world, "serve")
    assert world.outcome == "served"
    assert world.elapsed < 240
    assert world.mistakes == 0


def test_holding_food_leaves_no_forelegs_free_for_stirring():
    world = Kitchen(station="qazan", held="carrot", added=["oil"], burn=.1)
    execute(world, "stir")
    assert world.mistakes == 1
    assert world.burn == .1
