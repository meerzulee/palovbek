"""Pinned public inputs. Large data stays outside version control."""
from __future__ import annotations

import argparse
import hashlib
import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
RUNS = ROOT / "runs"
LOCK = ROOT / "sources.lock.json"
REFERENCE_COMMIT = "91bdd1e7dcf193f3e7ca5a8933497fcef63b7960"
REFERENCE_BASE = f"https://raw.githubusercontent.com/philshiu/Drosophila_brain_model/{REFERENCE_COMMIT}/"
MALE_BASE = "https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/"
SOURCES = {
    "annotations": ("male-cns/body-annotations.feather", MALE_BASE + "body-annotations-male-cns-v1.0-minconf-0.5.feather"),
    "neurotransmitters": ("male-cns/body-neurotransmitters.feather", MALE_BASE + "body-neurotransmitters-male-cns-v1.0.feather"),
    "connections": ("male-cns/connectome-weights.feather", MALE_BASE + "connectome-weights-male-cns-v1.0-minconf-0.5.feather"),
    "reference_neurons": ("reference/completeness.csv", REFERENCE_BASE + "2023_03_23_completeness_630_final.csv"),
    "reference_connections": ("reference/connectivity.parquet", REFERENCE_BASE + "2023_03_23_connectivity_630_final.parquet"),
    "reference_model": ("reference/model.py", REFERENCE_BASE + "model.py"),
    "reference_notebook": ("reference/example.ipynb", REFERENCE_BASE + "example.ipynb"),
    "reference_license": ("reference/LICENSE", REFERENCE_BASE + "LICENSE"),
}


def sha256(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def download(record: bool = False, only: str | None = None) -> dict:
    previous = json.loads(LOCK.read_text()) if LOCK.exists() else {}
    if not previous and not record:
        raise RuntimeError("Missing sources.lock.json; an initial maintainer download needs --record.")

    def fetch(item):
        name, (relative, url) = item
        path = DATA / relative
        expected = previous.get(name, {})
        if expected and expected["url"] != url:
            raise RuntimeError(f"Source URL changed for {name}; review the source lock before updating it.")
        if path.exists():
            digest = sha256(path)
            if expected.get("sha256") == digest:
                print(f"Verified {name}: {path.stat().st_size:,} bytes", flush=True)
                return name, expected
            if not record:
                raise RuntimeError(f"Checksum mismatch: {path}. Remove this cached file and download again.")
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + ".partial")
        print(f"Downloading {name} from {url}", flush=True)
        digest = hashlib.sha256()
        size, next_report = 0, 128 * 1024**2
        with urllib.request.urlopen(url, timeout=90) as response, temporary.open("wb") as output:
            while chunk := response.read(4 * 1024**2):
                output.write(chunk)
                digest.update(chunk)
                size += len(chunk)
                if size >= next_report:
                    print(f"{name}: {size / 1024**2:.0f} MiB downloaded", flush=True)
                    next_report += 128 * 1024**2
        result = {"url": url, "path": relative, "bytes": size, "sha256": digest.hexdigest()}
        if expected.get("sha256") and result["sha256"] != expected["sha256"] and not record:
            temporary.unlink()
            raise RuntimeError(f"Checksum mismatch for downloaded source {name}")
        temporary.replace(path)
        print(f"Ready {name}: {size:,} bytes · SHA256 {result['sha256']}", flush=True)
        return name, result

    selected = [(name, source) for name, source in SOURCES.items() if only is None or name.startswith(only)]
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = dict(pool.map(fetch, selected))
    if record:
        previous.update(results)
        LOCK.write_text(json.dumps(previous, indent=2) + "\n")
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--record", action="store_true", help="Maintainer only: record new source hashes")
    parser.add_argument("--only", help="Download only source keys with this prefix")
    args = parser.parse_args()
    download(args.record, args.only)
