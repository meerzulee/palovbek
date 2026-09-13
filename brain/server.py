"""Local WebSocket server. One authoritative model and kitchen, shared by connected viewers."""
from __future__ import annotations

import argparse
import asyncio
import contextlib
import ipaddress
import json
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

import uvicorn
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from .connectome import load
from .model import Brain
from .session import Session
from .sources import RUNS

logger = logging.getLogger("plov.brain")


class Command(BaseModel):
    model_config = ConfigDict(extra="forbid")
    command: Literal["start", "pause", "reset", "sensory", "silence_outputs", "checkpoint", "restore", "cook_recipe"]
    run_id: str = Field(max_length=64)
    seed: int | None = Field(default=None, ge=0, le=2**31-1)
    enabled: bool | None = None
    continuous: bool | None = None
    controller: Literal["neural", "recipe"] | None = None
    recipe_id: str | None = Field(default=None, max_length=32)


def allowed_origin(origin: str | None) -> bool:
    if origin is None:  # Non-browser clients are useful for local reproducibility checks.
        return True
    try:
        url = urlparse(origin)
        if url.scheme not in ("http", "https") or url.port not in (5173, 8001):
            return False
        return url.hostname == "localhost" or ipaddress.ip_address(url.hostname).is_private
    except (ValueError, TypeError):
        return False


def create_app(session: Session | None = None):
    subscribers: set[asyncio.Queue] = set()
    lock = asyncio.Lock()
    stopping = asyncio.Event()

    def publish(message: dict):
        # A slow viewer receives the newest snapshot; it cannot stall the model or grow an unbounded queue.
        for queue in subscribers:
            if queue.full():
                queue.get_nowait()
            queue.put_nowait(message)

    async def simulation():
        while not stopping.is_set():
            start = time.perf_counter()
            try:
                async with lock:
                    current: Session = app.state.session
                    if current.next_recipe_if_due():
                        publish(current.snapshot())
                    if current.running:
                        snapshot = await asyncio.to_thread(current.step)
                        publish(snapshot)
                await asyncio.sleep(max(.005, .12 - (time.perf_counter() - start)))
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Neural step failed")
                app.state.session.running = False
                app.state.session.continuous = False
                publish({"type": "error", "message": "Neural simulation stopped after a backend error. See the terminal log."})
                await asyncio.sleep(.2)

    @asynccontextmanager
    async def lifespan(app):
        app.state.session = session or await asyncio.to_thread(lambda: Session(load(), controller="recipe"))
        # Compile the kernel without advancing the episode that the user will see.
        warmup = Brain(app.state.session.graph, seed=0)
        await asyncio.to_thread(warmup.advance, .001, {}, False)
        del warmup
        task = asyncio.create_task(simulation())
        print(f"Ready: {app.state.session.graph.size:,} neurons. Open http://localhost:5173 and choose Live neural experiment.", flush=True)
        yield
        stopping.set()
        await task  # Finish a running kernel before saving its state.
        if app.state.session.sequence:
            await asyncio.to_thread(app.state.session.save)

    app = FastAPI(title="Palov local neural experiment", lifespan=lifespan)

    @app.get("/api/neural/health")
    async def health():
        current = app.state.session
        return {"ready": True, "neurons": current.graph.size, "model": current.metadata()["model_version"], "running": current.running}

    @app.get("/api/neural/manifest")
    async def manifest():
        return app.state.session.graph.manifest

    @app.get("/api/neural/report")
    async def report():
        documents = {}
        for name in ("reference", "benchmark", "causality"):
            path = RUNS / f"{name}.json"
            if path.exists():
                documents[name] = json.loads(path.read_text())
        return documents

    @app.get("/api/neural/cooking-log")
    async def cooking_log():
        async with lock:
            current = app.state.session
            return JSONResponse(current.cooking_report(), headers={"Content-Disposition": f'attachment; filename="plov-{current.recipe_id}-{current.run_id}.json"', "Cache-Control": "no-store"})

    @app.get("/api/neural/history")
    async def cooking_history():
        paths = sorted((app.state.session.directory / "cooking-history").glob("cook-*.json"), reverse=True)
        rows = []
        for path in paths[:200]:
            data = json.loads(path.read_text())
            rows.append({key: data[key] for key in ("run_id", "started_at", "recipe", "outcome", "world_seconds", "mistakes")})
        return {"episodes": rows, "retention": 200}

    @app.get("/api/neural/history/{run_id}")
    async def archived_cook(run_id: str):
        try:
            from uuid import UUID
            canonical = str(UUID(run_id))
        except ValueError:
            raise HTTPException(404, "Unknown cook") from None
        paths = list((app.state.session.directory / "cooking-history").glob(f"cook-*-{canonical}.json"))
        if not paths:
            raise HTTPException(404, "Cook not found in retained history")
        return JSONResponse(json.loads(paths[0].read_text()), headers={"Content-Disposition": f'attachment; filename="plov-{canonical}.json"'})

    @app.websocket("/api/neural/ws")
    async def websocket(socket: WebSocket):
        if not allowed_origin(socket.headers.get("origin")):
            await socket.close(code=1008, reason="This backend accepts local development origins only")
            return
        await socket.accept()
        queue: asyncio.Queue = asyncio.Queue(maxsize=1)
        async with lock:
            await socket.send_json(app.state.session.metadata())
            await socket.send_json(app.state.session.snapshot())
            subscribers.add(queue)

        async def sender():
            while True:
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=2)
                except TimeoutError:
                    message = {"type": "heartbeat"}
                await socket.send_json(message)

        task = asyncio.create_task(sender())
        try:
            while True:
                raw = await socket.receive_text()
                try:
                    if len(raw) > 2048:
                        raise ValueError("Command is too large")
                    command = Command.model_validate_json(raw)
                    async with lock:
                        current: Session = app.state.session
                        if command.run_id != current.run_id:
                            raise ValueError("Stale episode command rejected; reconnect or use the current run ID")
                        if command.command == "start":
                            if current.world.outcome:
                                raise ValueError("This episode has ended. Reset explicitly to begin another attempt.")
                            current.running = True
                        elif command.command == "pause":
                            current.running = False
                            current.continuous = False
                        elif command.command == "reset":
                            current.reset(current.seed if command.seed is None else command.seed, command.controller, command.recipe_id)
                        elif command.command == "cook_recipe":
                            current.reset(current.seed if command.seed is None else command.seed, "recipe", command.recipe_id)
                            current.running = True
                            current.continuous = bool(command.continuous)
                        elif command.command == "sensory":
                            if command.enabled is None:
                                raise ValueError("sensory requires enabled")
                            current.sensory_enabled = command.enabled
                        elif command.command == "silence_outputs":
                            if command.enabled is None:
                                raise ValueError("silence_outputs requires enabled")
                            current.output_silenced = command.enabled
                        elif command.command == "checkpoint":
                            await asyncio.to_thread(current.save)
                        elif command.command == "restore":
                            await asyncio.to_thread(current.restore)
                        current.record("command", command.model_dump())
                        current.sequence += 1
                        publish(current.snapshot())
                except (ValidationError, ValueError) as error:
                    if queue.full():
                        queue.get_nowait()
                    queue.put_nowait({"type": "error", "message": str(error)[:500]})
        except WebSocketDisconnect:
            pass
        finally:
            subscribers.discard(queue)
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError, WebSocketDisconnect, RuntimeError):
                await task
            # The server owns the clock. Closing a viewer does not stop a started cook.

    return app


app = create_app()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8001)
    parser.add_argument("--continuous", action="store_true", help="Cook all four recipes in rotation, without a browser")
    parser.add_argument("--recipe", default="classic", choices=("classic", "quince", "wedding", "bedana"))
    parser.add_argument("--checkpoint", type=Path, help="Restore this saved checkpoint and start paused")
    args = parser.parse_args()
    application = app
    if args.checkpoint or args.continuous:
        restored = Session(load(), controller="recipe", recipe_id=args.recipe)
        if args.checkpoint:
            restored.restore(args.checkpoint)
        if args.continuous:
            if restored.controller != "recipe" or restored.world.outcome:
                restored.reset(restored.seed, "recipe", args.recipe)
            restored.continuous = restored.running = True
        application = create_app(restored)
    uvicorn.run(application, host="127.0.0.1", port=args.port, ws_max_size=4096)
