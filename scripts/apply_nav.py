#!/usr/bin/env python3
"""Inline the book navigation layer into every chapter page.

The chapter readers are self-contained by design — figures are embedded as
data URIs so a single .html file works with no server and no sibling files.
Linking book.css / book.js / book-nav.js broke that: the nav silently does
nothing whenever a chapter is opened straight from disk, copied elsewhere,
or moved off this folder.

So book.css and book-nav.js stay the editable sources, and this script copies
them (plus the generated table of contents) into each chapter between marker
comments. Re-running replaces the old block instead of stacking a new one.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
START = "<!--BOOK-NAV-START-->"
END = "<!--BOOK-NAV-END-->"
BLOCK_RE = re.compile(re.escape(START) + r".*?" + re.escape(END) + r"\n?", re.S)
# the earlier external-file wiring, removed on sight
EXTERNAL_RE = re.compile(
    r'[ \t]*<link href="book\.css" rel="stylesheet">\n?'
    r'|[ \t]*<script src="book(?:-nav)?\.js"></script>\n?'
)


def read(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8")


def build_block() -> str:
    css = read("book.css")
    data = read("book.js")
    runtime = read("book-nav.js")
    # </style> or </script> inside the payload would end the tag early.
    for name, payload in (("book.css", css), ("book.js", data), ("book-nav.js", runtime)):
        if re.search(r"</\s*(style|script)", payload, re.I):
            raise SystemExit(f"{name} contains a closing style/script tag; cannot inline safely")
    return (
        f"{START}\n"
        f"<style>\n{css}\n</style>\n"
        f"<script>\n{data}\n{runtime}\n</script>\n"
        f"{END}\n"
    )


def main() -> None:
    block = build_block()
    targets = sorted(p for p in ROOT.glob("ch*.html"))
    if not targets:
        raise SystemExit("no chapter files found")
    index = ROOT / "index.html"
    if index.exists():
        targets.append(index)

    changed = 0
    for path in targets:
        text = path.read_text(encoding="utf-8")
        updated = EXTERNAL_RE.sub("", BLOCK_RE.sub("", text))
        if "</body>" in updated:
            # index.html is a full document; keep the block inside the body.
            updated = updated.replace("</body>", block + "</body>", 1)
        else:
            updated = updated.rstrip("\n") + "\n" + block
        if updated != text:
            path.write_text(updated, encoding="utf-8")
            changed += 1
    print(f"Inlined navigation into {changed}/{len(targets)} files")


if __name__ == "__main__":
    sys.exit(main())
