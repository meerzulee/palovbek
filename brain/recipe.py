"""An authored, state-driven plov cook. This is recipe knowledge, not learned neural behavior."""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path

from .kitchen import Kitchen


@dataclass(frozen=True)
class Step:
    stage: int
    label: str
    kind: str
    target: str | float


CATALOG = json.loads((Path(__file__).resolve().parent.parent / "shared/recipes.json").read_text())
RECIPES = {item["id"]: item for item in CATALOG["recipes"]}
EXTRA_INGREDIENTS = tuple(item["id"] for item in CATALOG["ingredients"])

STAGES = ("Heat the oil", "Brown onion & lamb", "Chop & fry carrots", "Make the zirvak", "Layer the rice", "Steam gently", "Rest & serve")
STEPS = (
    Step(0, "Bring the oil to the qazan", "ingredient", "oil"),
    Step(0, "Let the oil heat up", "temperature", 115),
    Step(1, "Add the onion to the hot oil", "ingredient", "onion"),
    Step(1, "Fry the onion", "action", "stir"),
    Step(1, "Add the lamb", "ingredient", "lamb"),
    Step(1, "Brown the lamb before adding vegetables", "browning", .62),
    Step(2, "Chop the carrots, then bring them over", "ingredient", "carrot"),
    Step(2, "Fold the carrots into the lamb", "action", "stir"),
    Step(3, "Add the cumin", "ingredient", "spice"),
    Step(3, "Add the garlic", "ingredient", "garlic"),
    Step(3, "Add water for the zirvak", "action", "add_water"),
    Step(3, "Let the zirvak simmer", "simmer", 6),
    Step(4, "Layer the rice gently", "ingredient", "rice"),
    Step(4, "Let the rice absorb broth without stirring", "hydration", .25),
    Step(5, "Lower the flame", "heat", .4),
    Step(5, "Cover the qazan", "action", "cover"),
    Step(5, "Steam until the rice is cooked", "hydration", .92),
    Step(6, "Turn off the fire", "heat", 0),
    Step(6, "Let the plov rest", "rest", 3),
    Step(6, "Lift the lid", "action", "uncover"),
    Step(6, "Osh tayyor! Serve the plov", "action", "serve"),
)


class RecipeChef:
    version = "authored-plov-recipe-v1"

    def __init__(self, recipe_id="classic"):
        if recipe_id not in RECIPES:
            raise ValueError(f"Unknown recipe: {recipe_id}")
        self.recipe_id = recipe_id
        self.recipe = RECIPES[recipe_id]
        self.steps = []
        for step in STEPS:
            if step.target == "add_water":
                self.steps.extend(Step(3, f"Add {ingredient} to the zirvak", "ingredient", ingredient) for ingredient in self.recipe["extras"])
            if step.target == "serve":
                self.steps.extend(Step(6, f"Finish with {ingredient}", "ingredient", ingredient) for ingredient in self.recipe["garnishes"])
            self.steps.append(Step(step.stage, step.label, step.kind, self.recipe["simmer_seconds"]) if step.kind == "simmer" else step)
        self.ingredients = [str(step.target) for step in self.steps if step.kind == "ingredient"]
        self.index = 0
        self.entered_at = 0.0
        self.entered_serial = 0
        self.blocked: str | None = None

    def _completed(self, step: Step, world: Kitchen):
        if step.kind == "ingredient":
            return step.target in world.added
        if step.kind == "action":
            return (world.action_serial > self.entered_serial and world.last_action == step.target
                    and bool(world.events) and world.events[-1]["success"])
        if step.kind == "temperature":
            return world.temperature >= step.target
        if step.kind == "browning":
            return world.browning >= step.target
        if step.kind == "hydration":
            return world.hydration >= step.target
        if step.kind == "heat":
            return world.heat <= step.target + 1e-9
        if step.kind == "simmer":
            return world.temperature >= 95 and world.elapsed - self.entered_at >= step.target
        if step.kind == "rest":
            return world.elapsed - self.entered_at >= step.target
        raise ValueError(f"Unknown recipe step {step.kind}")

    def sync(self, world: Kitchen):
        if world.pending:
            return
        while self.index < len(self.steps) and self._completed(self.steps[self.index], world):
            self.index += 1
            self.entered_at = world.elapsed
            self.entered_serial = world.action_serial

    def choose(self, world: Kitchen):
        if world.pending or world.outcome:
            raise ValueError("Only choose a recipe action at an idle, unfinished boundary")
        self.sync(world)
        if world.added != self.ingredients[:len(world.added)]:
            self.blocked = "The ingredient order was changed. Reset for a fresh recipe."
        step = self.steps[min(self.index, len(self.steps) - 1)]
        if step.kind == "ingredient":
            ingredient = str(step.target)
            if ingredient not in world.available and world.held != ingredient and ingredient not in world.added:
                self.blocked = f"The {ingredient} portion is missing. Reset for a fresh recipe."
            elif world.held and world.held != ingredient:
                self.blocked = f"The forelegs hold {world.held}, but this step needs {ingredient}. Reset the recipe."
        if self.blocked:
            return {"action": "wait", "source": self.version, "reason": self.blocked, "blocked": True}
        if step.kind == "ingredient":
            ingredient = str(step.target)
            if world.held is None:
                action = "go_prep" if world.station != "prep" else f"pick_{ingredient}"
            elif ingredient == "carrot" and world.carrot_chops < 3:
                action = "go_prep" if world.station != "prep" else "chop"
            elif world.station != "qazan":
                action = "go_qazan"
            else:
                action = "uncover" if world.covered else "add"
        elif world.station != "qazan":
            action = "go_qazan"
        elif step.kind == "action":
            action = str(step.target)
        elif step.kind == "heat":
            action = "heat_down"
        elif step.kind in ("temperature", "browning"):
            # 55% approaches 151°C in this toy world: hot enough to brown, below its burn threshold.
            action = "heat_up" if world.heat < .5 else "heat_down" if world.heat > .6 else "stir" if step.kind == "browning" else "wait"
        elif step.kind in ("hydration", "simmer"):
            action = "heat_up" if world.temperature < 90 and world.heat < .4 else "wait"
        else:
            action = "wait"
        if action == "serve" and not (world.added == self.ingredients and world.carrot_chops == 3 and world.browning >= .6 and world.hydration >= .9 and world.burn < .25):
            self.blocked = "The dish does not meet the serving checks. Reset for a fresh recipe."
            return {"action": "wait", "source": self.version, "reason": self.blocked, "blocked": True}
        return {"action": action, "source": self.version, "reason": step.label, "recipe_step": self.index, "blocked": False}

    def snapshot(self, world: Kitchen):
        done = world.outcome == "served"
        step = self.steps[min(self.index, len(self.steps) - 1)]
        return {"version": self.version, "recipe_id": self.recipe_id, "name": self.recipe["name"], "stage": step.stage, "stages": list(STAGES), "step": self.index,
                "total_steps": len(self.steps), "progress": 100 if done else round(self.index / len(self.steps) * 100),
                "label": "Osh tayyor! Plov is served." if done else self.blocked or step.label,
                "blocked": self.blocked, "done": done}

    def export(self):
        return {"version": self.version, "recipe_id": self.recipe_id, "index": self.index, "entered_at": self.entered_at,
                "entered_serial": self.entered_serial, "blocked": self.blocked}

    def restore(self, state: dict):
        if state["version"] != self.version or state["recipe_id"] != self.recipe_id or not 0 <= state["index"] <= len(self.steps):
            raise ValueError("Recipe checkpoint version or step mismatch")
        self.index = state["index"]
        self.entered_at = state["entered_at"]
        self.entered_serial = state["entered_serial"]
        self.blocked = state["blocked"]

    def plan(self):
        return [asdict(step) for step in self.steps]
