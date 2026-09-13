"""One persistent neural episode, with explicit resets and complete state checkpoints."""
from __future__ import annotations

import json
import time
import uuid
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import psutil

from .connectome import Connectome
from .decoder import Decoder
from .kitchen import ACTIONS, Kitchen
from .model import Brain
from .recipe import RECIPES, RecipeChef
from .sources import RUNS

ENGINE_VERSION = "male-cns-lif-v1"
BRAIN_WINDOW = .05
WORLD_WINDOW = .25


class Session:
    def __init__(self, graph: Connectome, seed: int = 17, directory: Path | None = None, controller: str = "neural", recipe_id: str = "classic"):
        self.graph = graph
        self.directory = directory or RUNS
        self.directory.mkdir(parents=True, exist_ok=True)
        self.brain = Brain(graph, seed)
        self.running = False
        self.continuous = False
        self.completed_episodes = 0
        self.last_checkpoint: Path | None = None
        self.reset(seed, controller, recipe_id)

    def reset(self, seed: int, controller: str | None = None, recipe_id: str | None = None):
        selected = controller or getattr(self, "controller", "neural")
        chosen_recipe = recipe_id or getattr(self, "recipe_id", "classic")
        if selected not in ("neural", "recipe") or chosen_recipe not in RECIPES:
            raise ValueError("Unknown controller or recipe")
        self.controller = selected
        self.recipe_id = chosen_recipe
        self.recipe = RecipeChef(chosen_recipe)
        self.running = False
        self.continuous = False
        self.cooking_log = []
        self.finished_at = None
        self.started_at = datetime.now(timezone.utc).isoformat()
        self.run_id = str(uuid.uuid4())
        self.sequence = 0
        self.seed = seed
        self.world = Kitchen()
        if self.controller == "recipe":
            self.world = Kitchen(time_limit=360, available=self.recipe.ingredients.copy(), required_ingredients=self.recipe.ingredients.copy(), last_result="The ingredients are prepared. Palov has a recipe to follow.")
        self.brain.reset(seed)
        self.decoder = Decoder(self.graph.outputs, seed)
        self.sensory_enabled = True
        self.output_silenced = False
        self.last_decision = None
        self.wall_seconds = 0.0
        self.last_window_wall = 0.0
        log_directory = self.directory / "recipe-logs" if self.controller == "recipe" else self.directory
        log_directory.mkdir(exist_ok=True)
        self.log_path = log_directory / f"episode-{self.run_id}.jsonl"
        self.record("reset", {"seed": seed, "model_version": ENGINE_VERSION, "controller": self.controller, "recipe_id": self.recipe_id})

    def record(self, event: str, detail: dict):
        with self.log_path.open("a") as stream:
            stream.write(json.dumps({"event": event, "run_id": self.run_id, "sequence": self.sequence, "brain_seconds": self.brain.seconds, **detail}) + "\n")

    def step(self) -> dict:
        if not self.running or self.world.outcome:
            return self.snapshot()
        start = time.perf_counter()
        self.brain.advance(BRAIN_WINDOW, self.world.observe(), self.sensory_enabled, self.output_silenced)
        if self.world.pending is None:
            self.last_decision = self.recipe.choose(self.world) if self.controller == "recipe" else self.decoder.choose(self.brain.counts, BRAIN_WINDOW)
            if self.last_decision.get("blocked"):
                self.running = False
                self.world.last_result = self.last_decision["reason"]
                self.continuous = False
                self.last_window_wall = time.perf_counter() - start
                self.wall_seconds += self.last_window_wall
                self.sequence += 1
                self.record("recipe_blocked", self.last_decision)
                return self.snapshot()
            self.world.begin(self.last_decision["action"])
            self.record("decision", self.last_decision)
        pending_id = self.world.pending["id"]
        self.world.advance(WORLD_WINDOW)
        if self.world.pending is None and self.world.events:
            entry = {**self.world.events[-1], "id": pending_id, "neural_seconds": round(self.brain.seconds, 3),
                     "instruction": self.last_decision["reason"], "ingredients": self.world.added.copy(),
                     "temperature": round(self.world.temperature, 1), "heat": round(self.world.heat, 2),
                     "hydration": round(self.world.hydration, 3), "browning": round(self.world.browning, 3),
                     "burn": round(self.world.burn, 3), "covered": self.world.covered,
                     "spikes": int(self.brain.total_spikes)}
            self.cooking_log.append(entry)
            self.record("action_completed", entry)
        if self.controller == "recipe":
            self.recipe.sync(self.world)
        self.last_window_wall = time.perf_counter() - start
        self.wall_seconds += self.last_window_wall
        self.sequence += 1
        if self.world.outcome:
            self.running = False
            self.finished_at = time.monotonic()
            self.completed_episodes += 1
            self.archive()
        snapshot = self.snapshot()
        if self.controller == "neural":
            self.record("step", {"world": snapshot["world"], "neural": snapshot["neural"], "wall_seconds": self.last_window_wall})
        return snapshot

    def snapshot(self) -> dict:
        return {"type": "snapshot", "protocol": 1, "run_id": self.run_id, "sequence": self.sequence,
                "model_version": ENGINE_VERSION, "seed": self.seed, "running": self.running,
                "sensory_enabled": self.sensory_enabled, "output_silenced": self.output_silenced,
                "controller": self.controller, "recipe": self.recipe.snapshot(self.world) if self.controller == "recipe" else None,
                "continuous": self.continuous, "completed_episodes": self.completed_episodes,
                "cooking_log": self.cooking_log[-40:], "log_count": len(self.cooking_log),
                "world": self.world.snapshot(), "neural": self.brain.telemetry(BRAIN_WINDOW),
                "decision": self.last_decision,
                "performance": {"window_wall_seconds": self.last_window_wall, "simulation_speed": self.brain.seconds / self.wall_seconds if self.wall_seconds else 0, "rss_bytes": psutil.Process().memory_info().rss},
                "checkpoint_available": self.last_checkpoint is not None}

    def metadata(self) -> dict:
        return {"type": "metadata", "protocol": 1, "model_version": ENGINE_VERSION,
                "dataset": self.graph.manifest["dataset"], "neurons": self.graph.size,
                "connections": int(len(self.graph.posts)), "synapse_weight_sum": self.graph.manifest["retained_synapse_weight_sum"],
                "parameters": asdict(self.brain.parameters), "decoder": self.decoder.version,
                "actions": list(ACTIONS), "output_pools": {action: self.graph.ids[pool].astype(str).tolist() for action, pool in zip(ACTIONS, self.decoder.pools)}, "sample_cells": self.graph.cells,
                "controllers": ["recipe", "neural"], "recipes": list(RECIPES.values()),
                "input_channels": self.graph.channels, "selection": self.graph.manifest["selection"],
                "notice": "Recipe chef uses authored cooking rules; neural activity is observational in recipe mode. Free experiment uses the untrained neural readout. Simplified connectome LIF model, engineered sensory mapping, untrained action readout. No claim of learned cooking or a complete biological mind.",
                "brain_window_seconds": BRAIN_WINDOW, "world_window_seconds": WORLD_WINDOW}

    def cooking_report(self):
        return {"format": "plov-cooking-log-v1", "run_id": self.run_id, "started_at": self.started_at,
                "seed": self.seed, "controller": self.controller, "engine": ENGINE_VERSION,
                "recipe": self.recipe.recipe if self.controller == "recipe" else None,
                "recipe_version": self.recipe.version if self.controller == "recipe" else None,
                "outcome": self.world.outcome, "world_seconds": self.world.elapsed,
                "neural_seconds": self.brain.seconds, "total_spikes": int(self.brain.total_spikes),
                "mistakes": self.world.mistakes, "ingredients": self.world.added.copy(),
                "graph_files": self.graph.manifest.get("files", {}), "actions": self.cooking_log.copy(),
                "note": "Authored recipe rules choose cooking actions in recipe mode. Neural activity is observational, not learned cooking. Times and readiness are toy physics."}

    def archive(self):
        folder = self.directory / "cooking-history"
        folder.mkdir(exist_ok=True)
        path = folder / f"cook-{time.time_ns()}-{self.run_id}.json"
        path.write_text(json.dumps(self.cooking_report(), indent=2) + "\n")
        # Only these generated archives and recipe traces are retained automatically.
        # Named checkpoints, downloaded data, and legacy neural experiment logs are untouched.
        for pattern, directory in (("cook-*.json", folder), ("episode-*.jsonl", self.directory / "recipe-logs")):
            paths = sorted(directory.glob(pattern), key=lambda item: item.stat().st_mtime, reverse=True)
            for old in paths[200:]:
                old.unlink()

    def next_recipe_if_due(self, now=None):
        if not self.continuous or not self.world.outcome or self.finished_at is None:
            return False
        if (time.monotonic() if now is None else now) - self.finished_at < 8:
            return False
        ids = list(RECIPES)
        next_id = ids[(ids.index(self.recipe_id) + 1) % len(ids)]
        self.reset((self.seed + 1) % (2**31), "recipe", next_id)
        self.continuous = self.running = True
        self.record("continuous_next", {"recipe_id": next_id})
        return True

    def save(self) -> str:
        name = f"checkpoint-{self.run_id}-{self.sequence}-{time.time_ns()}"
        folder = self.directory / name
        folder.mkdir()
        arrays, metadata = self.brain.export()
        np.savez_compressed(folder / "brain.npz", **arrays)
        state = {"engine_version": ENGINE_VERSION, "graph_files": self.graph.manifest.get("files", {}), "brain": metadata,
                 "controller": self.controller, "recipe_id": self.recipe_id, "recipe": self.recipe.export(),
                 "continuous": self.continuous, "cooking_log": self.cooking_log, "started_at": self.started_at, "completed_episodes": self.completed_episodes,
                 "world": self.world.snapshot(), "decoder": self.decoder.export(), "seed": self.seed,
                 "sequence": self.sequence, "origin_run_id": self.run_id, "wall_seconds": self.wall_seconds,
                 "last_decision": self.last_decision, "sensory_enabled": self.sensory_enabled, "output_silenced": self.output_silenced}
        temporary = folder / "state.json.partial"
        temporary.write_text(json.dumps(state, indent=2) + "\n")
        temporary.replace(folder / "state.json")
        self.last_checkpoint = folder
        self.record("checkpoint", {"name": name})
        return name

    def restore(self, folder: Path | None = None):
        folder = folder or self.last_checkpoint
        if folder is None:
            raise ValueError("No checkpoint has been saved in this server session")
        state = json.loads((folder / "state.json").read_text())
        if state["engine_version"] != ENGINE_VERSION or state["graph_files"] != self.graph.manifest.get("files", {}):
            raise ValueError("Checkpoint model or graph differs from the loaded model")
        with np.load(folder / "brain.npz", allow_pickle=False) as arrays:
            self.brain.restore(arrays, state["brain"])
        self.decoder.restore(state["decoder"])
        self.controller = state.get("controller", "neural")
        self.recipe_id = state.get("recipe_id", "classic")
        self.recipe = RecipeChef(self.recipe_id)
        if state.get("recipe"):
            self.recipe.restore(state["recipe"])
        self.world = Kitchen.restore(state["world"])
        self.cooking_log = state.get("cooking_log", [])
        self.started_at = state.get("started_at", datetime.now(timezone.utc).isoformat())
        self.completed_episodes = state.get("completed_episodes", 0)
        self.continuous = False
        self.finished_at = None
        self.seed = state["seed"]
        self.sequence = state["sequence"]
        self.wall_seconds = state["wall_seconds"]
        self.last_window_wall = 0.0
        self.last_decision = state["last_decision"]
        self.sensory_enabled = state["sensory_enabled"]
        self.output_silenced = state["output_silenced"]
        self.running = False
        self.run_id = str(uuid.uuid4())
        self.log_path = self.directory / f"episode-{self.run_id}.jsonl"
        self.last_checkpoint = folder
        self.record("restore", {"checkpoint": folder.name, "origin_run_id": state["origin_run_id"]})
