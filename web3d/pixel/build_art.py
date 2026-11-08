# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Rebuild all the art from the committed picks, in order: the tower's floors, the city, the Library, the radio and post
rooms, Workshop Row, the walkers and cats, and the holidays' props. No model runs.

Run: npm run art [-- OUT]   # or: uv run web3d/pixel/build_art.py [OUT]; OUT defaults to static/building/pixel

CI runs it into a scratch folder and compares the result with the committed art (compare_art.py). Each script runs in
its own PEP 723 environment, so first every script's header must pin the same version of each package: they move together.
"""
import argparse
import re
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
STEPS = [["gen_floors.py"], ["gen_city.py", "build"], ["gen_library.py", "build"], ["gen_rooms.py", "build"],
         ["gen_workshop.py", "build"], ["gen_walkers.py", "bake"], ["gen_props.py", "bake"]]


def pins():
    """Every package's pinned version in the scripts' headers, failing when two scripts pin it differently."""
    seen = {}
    for script in sorted(HERE.glob("*.py")):
        header = re.search(r"^# dependencies = \[(.*)\]$", script.read_text(), re.M)
        for name, version in re.findall(r'"([\w-]+)==([^"]+)"', header.group(1) if header else ""):
            seen.setdefault(name, {}).setdefault(version, []).append(script.name)
    split = {name: v for name, v in seen.items() if len(v) > 1}
    assert not split, f"the scripts pin different versions: {split}"
    return {name: next(iter(v)) for name, v in seen.items()}


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Rebuild all the art from the committed picks.")
    ap.add_argument("out", nargs="?", help="where it goes (each script's default: static/building/pixel)")
    a = ap.parse_args()
    out = [a.out] if a.out else []
    print("pins:", pins())
    for script, *cmd in STEPS:
        print("==", script, *cmd, *out, flush=True)
        subprocess.run(["uv", "run", str(HERE / script), *cmd, *out], check=True)
