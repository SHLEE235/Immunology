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
RUNTIME = Path(__file__).resolve().parent / "book_runtime.js"
EXCLUDE = {"index.html"}
TITLE_RE = re.compile(r"\s*·\s*")


def read_source(path: Path) -> str:
    """Read a chapter file without translating its line endings."""
    with path.open("r", encoding="utf-8", newline="") as fh:
        return fh.read()


def write_source(path: Path, text: str) -> None:
    """Write a chapter file back verbatim, so CRLF files stay CRLF."""
    with path.open("w", encoding="utf-8", newline="") as fh:
        fh.write(text)


def newline_of(text: str) -> str:
    return "\r\n" if "\r\n" in text else "\n"


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
    text = read_source(path)
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
        write_source(path, updated_text)
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
        "_chapter": chapter_num,
        "_is_extra": bool(suffix),
        "_sort": (chapter_num, 1 if is_exercises else 0, suffix),
    }


def js_runtime(pages: list[dict]) -> str:
    """Combine the generated page index with the hand-written runtime script."""
    data = json.dumps(pages, ensure_ascii=False, separators=(",", ":"))
    runtime = RUNTIME.read_text(encoding="utf-8")
    return (
        "// AUTO-GENERATED by scripts/build_book.py. Do not edit manually.\n"
        "// Runtime source: scripts/book_runtime.js\n"
        f"const BOOK_PAGES = {data};\n"
        "window.BOOK_PAGES = BOOK_PAGES;\n\n"
        f"{runtime}"
    )


def ensure_assets(path: Path) -> bool:
    """Link book.css/book.js from a chapter page so the shared navigation loads.

    The stylesheet goes before the page's own <style> block, so the chapter keeps
    control of the colour tokens; the script goes last so the DOM already exists.
    """
    text = read_source(path)
    original = text
    nl = newline_of(text)

    if 'href="book.css"' not in text:
        link = f'<link rel="stylesheet" href="book.css">{nl}'
        match = re.search(r"<style\b", text, re.I)
        if match:
            text = text[: match.start()] + link + text[match.start() :]
        else:
            text = link + text

    if 'src="book.js"' not in text:
        text = text.rstrip("\r\n") + f'{nl}<script src="book.js"></script>{nl}'

    if text != original:
        write_source(path, text)
        return True
    return False


def inherit_sections(pages: list[dict]) -> None:
    """Give every supplementary page the Part of its own chapter.

    Exercise pages have no .parttag of their own, so the fallback picks up their
    kicker (the chapter title) and would open a spurious Part group in the TOC.
    """
    parts = {p["_chapter"]: p["section"] for p in pages if not p["_is_extra"]}
    for page in pages:
        if page["_is_extra"] and page["_chapter"] in parts:
            page["section"] = parts[page["_chapter"]]


def main() -> None:
    files = [p for p in ROOT.glob("*.html") if p.name not in EXCLUDE]
    pages = [parse_file(p) for p in files if re.match(r"ch\d+(?:-.*)?\.html$", p.name, re.I)]
    inherit_sections(pages)
    pages.sort(key=lambda p: p["_sort"])
    for page in pages:
        page.pop("_sort", None)
        page.pop("_chapter", None)
        page.pop("_is_extra", None)
    OUT.write_text(js_runtime(pages), encoding="utf-8")

    linked = 0
    for page in pages:
        if ensure_assets(ROOT / page["file"]):
            linked += 1

    print(f"Generated {OUT} from {len(pages)} chapter files")
    if linked:
        print(f"Linked book.css/book.js into {linked} chapter files")


if __name__ == "__main__":
    main()
