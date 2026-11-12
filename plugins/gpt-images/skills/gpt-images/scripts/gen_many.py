"""Generate several images in parallel from a JSON spec and write a manifest.

Review tier: plumbing

Usage: gen_many.py spec.json OUT_DIR [--jobs 4]
spec.json: [{"id": "A1", "prompt": "...", "refs": ["style.png"]}, ...]  (refs optional)
Writes OUT_DIR/<id>.png for each item and OUT_DIR/manifest.json with id, file, prompt, refs and status.
Items whose image already exists are skipped, so a rerun only retries the failures.
"""
import argparse
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

GEN = Path(__file__).with_name("gen_image.sh")


def run(item, out_dir):
    """Generate one item unless its image already exists.

    Args:
        item: Spec entry with id, prompt and optional refs.
        out_dir: Output directory.

    Returns:
        The manifest entry for this item.
    """
    out = out_dir / f"{item['id']}.png"
    entry = {"id": item["id"], "file": out.name, "prompt": item["prompt"], "refs": item.get("refs", [])}
    if out.exists():
        return {**entry, "status": "ok"}
    p = subprocess.run(["bash", str(GEN), str(out), item["prompt"], *entry["refs"]], capture_output=True, text=True)
    return {**entry, "status": "ok" if p.returncode == 0 else "failed: " + p.stderr.strip()[-300:]}


def main():
    """Parse arguments, generate all items, and write the manifest."""
    ap = argparse.ArgumentParser()
    ap.add_argument("spec")
    ap.add_argument("out_dir")
    ap.add_argument("--jobs", type=int, default=4)
    a = ap.parse_args()
    spec = json.loads(Path(a.spec).read_text())
    out_dir = Path(a.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(a.jobs) as ex:
        manifest = list(ex.map(lambda it: run(it, out_dir), spec))
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=1))
    for m in manifest:
        print(m["id"], m["status"])


if __name__ == "__main__":
    main()
