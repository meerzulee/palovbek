"""Build a sparse full annotated-neuron graph without loading all fragment edges into RAM."""
from __future__ import annotations

import json
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.feather as feather
import pyarrow.ipc as ipc
from scipy.sparse import coo_matrix

from .sources import DATA, LOCK, sha256

PROCESSED = DATA / "processed"
IMPORT_VERSION = 1
INPUT_TYPES = {
    "odor_oil": "ORN_DM1", "odor_onion": "ORN_DM2", "odor_lamb": "ORN_DM3",
    "odor_carrot": "ORN_DM4", "odor_spice": "ORN_DL1", "odor_garlic": "ORN_VA2",
    "odor_rice": "ORN_VM2", "heat": "TRN_VP1m", "contact": "BM",
    "prep_view": "R7p", "qazan_view": "R8p", "moisture": "ORN_VP4", "smoke": "ORN_DC4",
}


@dataclass
class Connectome:
    indptr: np.ndarray
    posts: np.ndarray
    weights: np.ndarray
    ids: np.ndarray
    sensory: np.ndarray
    outputs: np.ndarray
    sample: np.ndarray
    manifest: dict
    channels: dict
    cells: list[dict]

    @property
    def size(self):
        return len(self.ids)


def prepare() -> dict:
    started = time.perf_counter()
    sources = json.loads(LOCK.read_text())
    for key in ("annotations", "neurotransmitters", "connections"):
        if sha256(DATA / sources[key]["path"]) != sources[key]["sha256"]:
            raise ValueError(f"Source verification failed: {key}")
    annotations = feather.read_feather(DATA / sources["annotations"]["path"])
    # Keep every explicitly traced body and every body given a neuronal superclass.
    # No task-specific circuit crop and no edge-weight threshold beyond source minconf=0.5.
    included = (annotations.status == "Traced") | annotations.superclass.notna()
    neurons = annotations.loc[included].sort_values("bodyId").reset_index(drop=True)
    ids = neurons.bodyId.to_numpy(np.int64)
    if len(np.unique(ids)) != len(ids):
        raise ValueError("Duplicate neuron IDs")
    lookup = pd.Index(ids)
    neurotransmitters = feather.read_feather(DATA / sources["neurotransmitters"]["path"])
    nt = neurotransmitters.set_index("body").reindex(ids)["consensus_nt"].fillna("unknown")
    sign = nt.map({"acetylcholine": 1, "gaba": -1, "GABA": -1, "glutamate": -1}).fillna(0).to_numpy(np.float64)
    rows, columns, counts = [], [], []
    source_rows, retained_rows, source_weight, retained_weight = 0, 0, 0, 0
    with pa.memory_map(str(DATA / sources["connections"]["path"]), "r") as source:
        reader = ipc.open_file(source)
        for number in range(reader.num_record_batches):
            batch = reader.get_batch(number)
            pre = lookup.get_indexer(batch.column("body_pre").to_numpy())
            post = lookup.get_indexer(batch.column("body_post").to_numpy())
            weight = batch.column("weight").to_numpy()
            keep = (pre >= 0) & (post >= 0) & (weight > 0)
            source_rows += len(weight)
            source_weight += int(weight.sum())
            retained_rows += int(keep.sum())
            retained_weight += int(weight[keep].sum())
            rows.append(pre[keep].astype(np.int32))
            columns.append(post[keep].astype(np.int32))
            counts.append(weight[keep].astype(np.float64))
            if number % 200 == 0:
                print(f"Import {number}/{reader.num_record_batches}: {retained_rows:,} neuron-pair edges retained", flush=True)
    pre = np.concatenate(rows)
    post = np.concatenate(columns)
    count = np.concatenate(counts)
    zero_sign_edges = int(np.count_nonzero(sign[pre] == 0))
    graph = coo_matrix((count * sign[pre], (pre, post)), shape=(len(ids), len(ids))).tocsr()
    graph.sort_indices()
    PROCESSED.mkdir(parents=True, exist_ok=True)
    for name, array in {"indptr": graph.indptr.astype(np.int64), "posts": graph.indices.astype(np.int32), "weights": graph.data.astype(np.float64), "ids": ids}.items():
        np.save(PROCESSED / f"{name}.npy", array, allow_pickle=False)
    sensory_mask = neurons.superclass.fillna("").str.contains("sensory")
    output_mask = neurons.superclass.isin(["descending_neuron", "vnc_motor", "cb_motor"])
    sensory = np.flatnonzero(sensory_mask).astype(np.int32)
    outputs = np.flatnonzero(output_mask).astype(np.int32)
    channels = {}
    for name, cell_type in INPUT_TYPES.items():
        selected = np.flatnonzero(neurons.type.eq(cell_type) & sensory_mask)
        if len(selected) == 0:
            # An explicit class-based fallback is recorded, never silently substituted.
            fallback_class = "thermosensory" if name == "heat" else "olfactory" if name.startswith("odor_") or name in ("moisture", "smoke") else "visual" if name.endswith("view") else "mechanosensory"
            selected = np.flatnonzero(neurons["class"].eq(fallback_class) & sensory_mask)[:32]
            selection = f"class={fallback_class}; first 32 by bodyId (requested type {cell_type} unavailable)"
        else:
            selection = f"type={cell_type}"
        if len(selected) == 0:
            raise ValueError(f"No input cells for {name}")
        channels[name] = {"indices": selected.tolist(), "body_ids": ids[selected].astype(str).tolist(), "selection": selection,
                          "meaning": "Engineered kitchen-to-stimulation assignment; not a biological tuning claim."}
    has_soma = neurons.somaLocation.map(lambda value: value is not None and len(value) == 3)
    rng = np.random.default_rng(17)
    sample = []
    for mask, count_sample in [(sensory_mask, 400), (output_mask, 400), (~sensory_mask & ~output_mask, 1248)]:
        choices = np.flatnonzero(mask & has_soma)
        sample.extend(rng.choice(choices, min(count_sample, len(choices)), replace=False).tolist())
    sample = np.array(sample, dtype=np.int32)
    positions = np.stack(neurons.iloc[sample].somaLocation.to_numpy()).astype(float)
    # Coordinates are soma locations in source EM voxels, not synthetic neuron paths.
    center = (positions.min(axis=0) + positions.max(axis=0)) / 2
    scale = float(np.max(np.ptp(positions, axis=0)) / 2.4)
    normalized = (positions - center) / scale
    cells = []
    for index, point in zip(sample, normalized):
        row = neurons.iloc[index]
        cells.append({"body_id": str(ids[index]), "type": row.type if pd.notna(row.type) else "untyped",
                      "superclass": row.superclass if pd.notna(row.superclass) else "unclassified",
                      "position": [float(point[0]), float(-point[2]), float(point[1])],
                      "source_soma_voxels": [int(n) for n in row.somaLocation],
                      "region": 1 if sensory_mask.iloc[index] else 2 if output_mask.iloc[index] else 0})
    for name, array in {"sensory": sensory, "outputs": outputs, "sample": sample}.items():
        np.save(PROCESSED / f"{name}.npy", array, allow_pickle=False)
    (PROCESSED / "channels.json").write_text(json.dumps(channels, indent=2) + "\n")
    (PROCESSED / "cells.json").write_text(json.dumps(cells) + "\n")
    manifest = {"import_version": IMPORT_VERSION, "dataset": "MaleCNS v1.0", "license": "CC-BY-4.0", "source": "https://male-cns.janelia.org/download/", "source_lock": sources,
                "selection": "status == Traced OR superclass is not null; all edges with both selected endpoints and weight > 0; no task-specific graph crop",
                "neurons": len(ids), "annotated_bodies": len(annotations), "excluded_annotated_bodies": int((~included).sum()),
                "selected_status_counts": neurons.status.fillna("unlabelled").value_counts().to_dict(),
                "source_pair_rows": source_rows, "retained_pair_rows": retained_rows, "csr_edges": int(graph.nnz),
                "source_synapse_weight_sum": source_weight, "retained_synapse_weight_sum": retained_weight,
                "zero_fast_current_edges": zero_sign_edges, "transmitter_counts": nt.value_counts().to_dict(),
                "fast_current_signs": {"acetylcholine": 1, "gaba": -1, "glutamate": -1, "all_other_or_unknown": 0},
                "sensory_neurons": len(sensory), "output_neurons": len(outputs), "sample_neurons": len(sample),
                "soma_transform": {"source_units": "8 nm EM voxels", "center": center.tolist(), "scale": scale, "display_axes": "x,-z,y"},
                "wall_seconds": time.perf_counter() - started,
                "files": {p.name: {"bytes": p.stat().st_size, "sha256": sha256(p)} for p in PROCESSED.iterdir() if p.name != "manifest.json"}}
    (PROCESSED / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({k: v for k, v in manifest.items() if k not in ("source_lock", "files")}, indent=2), flush=True)
    return manifest


def load(path: Path = PROCESSED, verify: bool = True) -> Connectome:
    manifest = json.loads((path / "manifest.json").read_text())
    if manifest["import_version"] != IMPORT_VERSION:
        raise ValueError("Processed graph version mismatch; run prepare again")
    if verify:
        for name, metadata in manifest["files"].items():
            if sha256(path / name) != metadata["sha256"]:
                raise ValueError(f"Processed graph checksum mismatch: {name}")
    arrays = {name: np.load(path / f"{name}.npy", mmap_mode="r", allow_pickle=False) for name in ("indptr", "posts", "weights", "ids", "sensory", "outputs", "sample")}
    return Connectome(**arrays, manifest=manifest, channels=json.loads((path / "channels.json").read_text()), cells=json.loads((path / "cells.json").read_text()))


if __name__ == "__main__":
    prepare()
