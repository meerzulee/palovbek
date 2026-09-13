"""A deterministic, action-driven toy kitchen. No recipe scheduler or corrective helper."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field

INGREDIENTS = ("oil", "onion", "lamb", "carrot", "spice", "garlic", "rice")
ACTIONS = ("go_prep", "go_qazan", "go_yard", *(f"pick_{i}" for i in INGREDIENTS), "chop", "add", "stir", "add_water", "heat_up", "heat_down", "cover", "uncover", "drop", "wait", "serve")
DURATIONS = {"go_prep": 3.0, "go_qazan": 3.0, "go_yard": 3.0, "chop": 2.0, "stir": 2.0, "add": 1.5}


@dataclass
class Kitchen:
    time_limit: float = 240.0
    required_ingredients: list[str] = field(default_factory=lambda: list(INGREDIENTS))
    station: str = "prep"
    held: str | None = None
    available: list[str] = field(default_factory=lambda: list(INGREDIENTS))
    added: list[str] = field(default_factory=list)
    carrot_chops: int = 0
    temperature: float = 22.0
    heat: float = .55
    water: float = 0.0
    browning: float = 0.0
    hydration: float = 0.0
    burn: float = 0.0
    covered: bool = False
    elapsed: float = 0.0
    outcome: str | None = None
    pending: dict | None = None
    last_action: str = "wait"
    last_result: str = "The ingredients are on the table. No recipe has been supplied to the controller."
    action_serial: int = 0
    reward: float = 0.0
    mistakes: int = 0
    events: list[dict] = field(default_factory=list)

    def begin(self, action: str):
        if action not in ACTIONS and not (action.startswith("pick_") and action[5:] in self.required_ingredients):
            raise ValueError(f"Unknown action {action}")
        if self.pending or self.outcome:
            raise ValueError("Cannot start a new action during another action or a finished episode")
        self.action_serial += 1
        self.pending = {"id": self.action_serial, "name": action, "from": self.station,
                        "to": action[3:] if action.startswith("go_") else self.station,
                        "elapsed": 0.0, "duration": DURATIONS.get(action, 1.0), "held": self.held}

    def advance(self, seconds: float):
        if not 0 < seconds <= 1:
            raise ValueError("Advance in positive steps of at most one toy-kitchen second")
        if self.outcome:
            return
        self.elapsed += seconds
        target = 22 + self.heat * 235
        self.temperature += (target - self.temperature) * seconds / 25
        if self.water > 0 and self.temperature > 99:
            self.temperature = 99 + (self.temperature - 99) * .6
            self.water = max(0, self.water - seconds * (.0015 if self.covered else .0035))
        if "lamb" in self.added and self.temperature > 115 and self.water < .05:
            self.browning = min(1, self.browning + seconds * .012)
        if "rice" in self.added and self.water > 0 and self.temperature > 85:
            self.hydration = min(1, self.hydration + seconds * (.014 if self.covered else .008))
        if self.added and self.temperature > 155 and self.water < .03:
            self.burn = min(1, self.burn + seconds * (self.temperature - 155) / 1800)
        if self.burn >= 1:
            self.outcome = "burned"
            self._record("The food burned. This attempt has ended.", False)
            self.pending = None
        elif self.elapsed >= self.time_limit:
            self.outcome = "timed_out"
            self._record("The experiment timed out with an unfinished dish.", False)
            self.pending = None
        elif self.pending:
            self.pending["elapsed"] = min(self.pending["duration"], self.pending["elapsed"] + seconds)
            if self.pending["elapsed"] >= self.pending["duration"]:
                action = self.pending["name"]
                self.pending = None
                self._resolve(action)

    def _record(self, result: str, success: bool, reward: float = 0):
        self.last_result = result
        self.reward += reward if success else -.1
        self.mistakes += not success
        self.events.append({"time": round(self.elapsed, 3), "action": self.last_action, "result": result,
                            "success": success, "reward": reward if success else -.1})
        self.events = self.events[-100:]

    def _resolve(self, action: str):
        self.last_action = action
        if action.startswith("go_"):
            self.station = action[3:]
            self._record(f"Arrived at {self.station}.", True)
        elif action.startswith("pick_"):
            ingredient = action[5:]
            if self.station != "prep" or self.held is not None or ingredient not in self.available:
                self._record(f"Could not pick up {ingredient}: it must be nearby, with free forelegs.", False)
            else:
                self.available.remove(ingredient)
                self.held = ingredient
                self._record(f"Picked up {ingredient}.", True)
        elif action == "chop":
            if self.station != "prep" or self.held != "carrot":
                self._record("The knife has no held carrot to chop at the prep table.", False)
            else:
                before = self.carrot_chops
                self.carrot_chops = min(3, self.carrot_chops + 1)
                self._record("Chopped the carrot into matchsticks.", True, .1 if before < 3 else 0)
        elif action == "drop":
            if self.held is None:
                self._record("Nothing to drop.", False)
            else:
                dropped, self.held = self.held, None
                self._record(f"Dropped {dropped}. This portion is lost for the episode.", False)
        elif action == "wait":
            self._record("Waited and sensed the kitchen.", True)
        elif self.station != "qazan":
            self._record(f"Cannot {action.replace('_', ' ')} away from the qazan.", False)
        elif action == "add":
            if self.held is None or self.covered:
                self._record("Could not add an ingredient: hands are empty or the lid is closed.", False)
            else:
                item, self.held = self.held, None
                self.added.append(item)
                self._record(f"Added {item} to the qazan.", True, .1)
        elif action == "add_water":
            if self.covered:
                self._record("The lid blocks the water.", False)
            else:
                self.water = min(1, self.water + .45)
                self._record("Added water.", True)
        elif action == "stir":
            if self.covered or not self.added or self.held:
                self._record("Cannot stir a covered or empty qazan, or with occupied forelegs.", False)
            else:
                self.burn = max(0, self.burn - .01)
                self._record("Stirred the food.", True)
        elif action in ("heat_up", "heat_down"):
            self.heat = max(0, min(1, self.heat + (.15 if action == "heat_up" else -.15)))
            self._record(f"Fire adjusted to {self.heat:.0%}.", True)
        elif action in ("cover", "uncover"):
            self.covered = action == "cover"
            self._record("Lid closed." if self.covered else "Lid opened.", True)
        elif action == "serve":
            ready = set(self.added) == set(self.required_ingredients) and self.carrot_chops == 3 and self.browning >= .6 and self.hydration >= .9 and self.burn < .25
            self.outcome = "served" if ready else "failed_recipe"
            self._record("Osh tayyor! The dish met the toy kitchen's serving criteria." if ready else "Served an unfinished or damaged dish. This attempt failed.", ready, 5 if ready else 0)

    def observe(self) -> dict[str, float]:
        """Physical cues only. No recipe step, reward, readiness score, or correct action."""
        cues = {f"odor_{item}": (1.0 if item in self.available else .1) * (1 if self.station == "prep" else .25) for item in INGREDIENTS}
        cues.update({"heat": self.temperature / 260, "contact": float(self.held is not None),
                     "prep_view": 1.0 if self.station == "prep" else .2,
                     "qazan_view": 1.0 if self.station == "qazan" else .2,
                     "moisture": self.water, "smoke": self.burn})
        return cues

    def snapshot(self) -> dict:
        return asdict(self)

    @classmethod
    def restore(cls, data: dict) -> Kitchen:
        return cls(**data)
