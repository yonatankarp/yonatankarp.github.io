#!/usr/bin/env python3
"""
Strips kotlinbackend.com cruft from imported blog posts.

Junk pattern (appears at end of posts imported from kotlinbackend.com):
  - Tag links to kotlinbackend.com/tag/...
  - Gravatar author blocks
  - "Read Next" related post blocks
  - Comment forms, newsletter signup, category lists, footer

Detection: first line containing "kotlinbackend.com/tag/" marks the start.
Everything from that line onward (plus preceding blank lines) is removed.
"""

import re
import sys
from pathlib import Path

BLOG_DIR = Path(__file__).resolve().parent.parent / "content" / "blog"
TAG_PATTERN = re.compile(r"kotlinbackend\.com/tag/")


def clean_file(path: Path, dry_run: bool = False) -> bool:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines(keepends=True)

    # Find the first line with a kotlinbackend.com/tag/ link
    cut_index = None
    for i, line in enumerate(lines):
        if TAG_PATTERN.search(line):
            cut_index = i
            break

    if cut_index is None:
        return False

    # Walk backwards over blank/whitespace-only lines preceding the tag line
    while cut_index > 0 and lines[cut_index - 1].strip() == "":
        cut_index -= 1

    cleaned = "".join(lines[:cut_index]).rstrip() + "\n"

    if dry_run:
        removed_lines = len(lines) - cut_index
        print(f"  {path.name}: would remove {removed_lines} lines (from line {cut_index + 1})")
    else:
        path.write_text(cleaned, encoding="utf-8")
        removed_lines = len(lines) - cut_index
        print(f"  {path.name}: removed {removed_lines} lines")

    return True


def main():
    dry_run = "--dry-run" in sys.argv
    if dry_run:
        print("DRY RUN — no files will be modified\n")

    md_files = sorted(BLOG_DIR.glob("*.md"))
    cleaned = 0

    for f in md_files:
        if f.name.startswith("_index"):
            continue
        if clean_file(f, dry_run=dry_run):
            cleaned += 1

    if cleaned == 0:
        print("No files needed cleaning.")
    else:
        print(f"\n{'Would clean' if dry_run else 'Cleaned'} {cleaned} file(s).")


if __name__ == "__main__":
    main()
