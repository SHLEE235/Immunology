#!/usr/bin/env python3
"""Build book.js from chapter HTML files.

The chapter files remain the source of truth. The script reads their <title>,
visible part/kicker text, and h2-h4 headings. Existing heading ids are preserved;
headings without ids receive deterministic slugs.
"""
from __future__ import annotations

import html
import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "book.js"
EXCLUDE = {"index.html"}
TITLE_RE = re.compile(r"\s*·\s*")


def clean_text(value: str) -> str:
    value = html.unescape(value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def slugify(text: str) -> str:
    text = clean_text(text).lower()
    text = re.sub(r"[^\w\-가-힣]+", "-", text, flags=re.UNICODE)
    text = re.sub(r"-+", "-", text).strip("-")
    return text or "section"


class BookParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title_parts: list[str] = []
        self.kicker_parts: list[str] = []
        self.heading: dict | None = None
        self.headings: list[dict] = []
        self._capture_title = False
        self._capture_kicker = False
        self._capture_heading = False
        self._depth = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        attrs_dict = dict(attrs)
        if tag.lower() == "title":
            self._capture_title = True
        if tag.lower() in {"span", "div"} and "class" in attrs_dict:
            classes = set(attrs_dict["class"].split())
            if classes & {"kicker", "parttag"}:
                self._capture_kicker = True
        if tag.lower() in {"h2", "h3", "h4"}:
            self.heading = {
                "level": int(tag[1]),
                "text": [],
                "id": attrs_dict.get("id", ""),
            }
            self._capture_heading = True
            self._depth = 1

    def handle_startendtag(self, tag: str, attrs) -> None:
        pass

    def handle_endtag(self, tag: str) -> None:
        t = tag.lower()
        if t == "title":
            self._capture_title = False
        if t in {"span", "div"} and self._capture_kicker:
            self._capture_kicker = False
        if t in {"h2", "h3", "h4"} and self._capture_heading and self.heading:
            text = clean_text("".join(self.heading["text"]))
            # The page has a local contents heading that is not part of the book TOC.
            if text and text != "목차":
                self.heading["text"] = text
                self.headings.append(self.heading)
            self.heading = None
            self._capture_heading = False
            self._depth = 0

    def handle_data(self, data: str) -> None:
        if self._capture_title:
            self.title_parts.append(data)
        if self._capture_kicker:
            self.kicker_parts.append(data)
        if self._capture_heading and self.heading is not None:
            self.heading["text"].append(data)


def parse_file(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    parser = BookParser()
    parser.feed(text)
    title = clean_text("".join(parser.title_parts)) or path.stem
    section = ""
    part_match = re.search(r'<[^>]*class=[\"\'][^>]*\bparttag\b[^>]*>(.*?)</[^>]+>', text, re.I | re.S)
    if part_match:
        section = clean_text(re.sub(r'<[^>]+>', ' ', part_match.group(1)))
    if not section:
        section = clean_text("".join(parser.kicker_parts))
    if not section:
        section = "Janeway's Immunobiology"

    # Preserve existing IDs. Create IDs for headings that lack them and update the HTML
    # in-place so links remain valid in both the current release and future generated TOCs.
    used_ids: set[str] = set(re.findall(r'\bid=["\']([^"\']+)["\']', text))
    heading_iter = iter(parser.headings)
    substitutions: list[tuple[int, int, str]] = []
    # Re-parse heading tags directly so we can inject missing IDs without touching body text.
    heading_pattern = re.compile(r'<h([234])(?P<attrs>[^>]*)>(?P<body>.*?)</h\1>', re.I | re.S)
    def replace(match: re.Match[str]) -> str:
        raw = re.sub(r"<[^>]+>", " ", match.group("body"))
        heading_text = clean_text(raw)
        if not heading_text or heading_text == "목차":
            return match.group(0)
        attrs = match.group("attrs")
        if re.search(r'\bid=["\']', attrs, re.I):
            return match.group(0)
        base = slugify(heading_text)
        candidate = base
        n = 2
        while candidate in used_ids:
            candidate = f"{base}-{n}"
            n += 1
        used_ids.add(candidate)
        return f'<h{match.group(1)}{attrs} id="{candidate}">{match.group("body")}</h{match.group(1)}>'

    updated_text = heading_pattern.sub(replace, text)
    if updated_text != text:
        path.write_text(updated_text, encoding="utf-8")
        # Re-read so the generated IDs reflect the actual source.
        parser = BookParser()
        parser.feed(updated_text)

    headings = []
    for h in parser.headings:
        headings.append({"level": h["level"], "title": h["text"], "id": h["id"] or slugify(h["text"])})

    # Chapter ordering: numeric chapter prefix first; exercises follow their chapter.
    m = re.match(r"ch(\d+)(?:-(.*))?\.html$", path.name, re.I)
    chapter_num = int(m.group(1)) if m else 10**9
    suffix = m.group(2) or ""
    is_exercises = "exercise" in suffix.lower()
    return {
        "id": path.stem,
        "section": section,
        "title": title,
        "sub": title.split("·", 1)[1].strip() if "·" in title else "",
        "file": path.name,
        "sections": headings,
        "_sort": (chapter_num, 1 if is_exercises else 0, suffix),
    }


def js_data(pages: list[dict]) -> str:
    """Emit the table-of-contents data only.

    The navigation behaviour lives in the hand-maintained book-nav.js so that
    regenerating this file never clobbers it.
    """
    data = json.dumps(pages, ensure_ascii=False, separators=(",", ":"))
    return (
        "// AUTO-GENERATED by scripts/build_book.py. Do not edit manually.\n"
        "// Behaviour lives in book-nav.js, which is NOT generated.\n"
        f"window.BOOK_PAGES = {data};\n"
    )




def main() -> None:
    files = [p for p in ROOT.glob("*.html") if p.name not in EXCLUDE]
    pages = [parse_file(p) for p in files if re.match(r"ch\d+(?:-.*)?\.html$", p.name, re.I)]
    pages.sort(key=lambda p: p.pop("_sort"))
    OUT.write_text(js_data(pages), encoding="utf-8")
    print(f"Generated {OUT} from {len(pages)} chapter files")


if __name__ == "__main__":
    main()
