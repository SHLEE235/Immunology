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


def js_runtime(pages: list[dict]) -> str:
    data = json.dumps(pages, ensure_ascii=False, separators=(",", ":"))
    return f'''// AUTO-GENERATED by scripts/build_book.py. Do not edit manually.\nconst BOOK_PAGES = {data};\nwindow.BOOK_PAGES = BOOK_PAGES;\n\n(function() {{\n  const pages = BOOK_PAGES;\n  const fileName = (location.pathname.split('/').pop() || 'index.html');\n  const current = pages.find(p => p.file === fileName) || null;\n  const curIndex = current ? pages.indexOf(current) : -1;\n\n  function esc(s) {{\n    return String(s).replace(/[&<>\"]/g, ch => ({{'&':'&amp;','<':'&lt;','>':'&gt;','\\"':'&quot;'}}[ch]));\n  }}\n\n  function makeBookPanel() {{\n    const btn = document.createElement('button');\n    btn.id = 'bookNavBtn'; btn.type = 'button'; btn.textContent = '☰ 책 목차';\n    btn.setAttribute('aria-label', '책 전체 목차');\n    const topInner = document.querySelector('header.top .top-inner');\n    if (topInner) {{ const brand = topInner.querySelector('.brand'); brand ? topInner.insertBefore(btn, brand) : topInner.prepend(btn); }}\n\n    const scrim = document.createElement('div'); scrim.id = 'bookScrim';\n    const panel = document.createElement('aside'); panel.id = 'bookPanel'; panel.setAttribute('aria-label','책 전체 목차');\n    const head = document.createElement('div'); head.className = 'book-head';\n    const hwrap = document.createElement('div'); hwrap.innerHTML = '<h2>Janeway\\'s Immunobiology</h2><p>전체 목차 · 장 · 소절</p>';\n    const close = document.createElement('button'); close.className='book-close'; close.type='button'; close.textContent='×'; close.setAttribute('aria-label','목차 닫기');\n    head.append(hwrap, close);\n    const list = document.createElement('nav'); list.className='book-list';\n    let lastSection='';\n    pages.forEach(p => {{\n      if (p.section !== lastSection) {{ const sec=document.createElement('div'); sec.className='book-section'; sec.textContent=p.section; list.appendChild(sec); lastSection=p.section; }}\n      const chapter=document.createElement('div'); chapter.className='book-chapter';\n      const row=document.createElement('a'); row.className='book-link chapter-link'; row.href=p.file;\n      const split = p.title.split(' · ');\n      row.innerHTML='<span class="chapter-num">'+esc(split[0])+'</span><span class="chapter-title">'+esc(split.slice(1).join(' · ') || p.title)+'</span>';\n      if (p.id===current?.id) {{ row.classList.add('current'); row.setAttribute('aria-current','page'); }}\n      chapter.appendChild(row);\n      if (p.sections?.length) {{\n        const sublist=document.createElement('div'); sublist.className='book-sublist'; sublist.classList.toggle('expanded', p.id===current?.id);\n        p.sections.forEach(s=>{{ const a=document.createElement('a'); a.className='book-sublink level-'+s.level; a.href=p.file+'#'+encodeURIComponent(s.id); a.textContent=s.title; if(p.id===current?.id && location.hash==='#'+s.id) a.classList.add('active-section'); sublist.appendChild(a); }});\n        chapter.appendChild(sublist);\n        row.addEventListener('click', e=>{{ if(p.id===current?.id) {{ e.preventDefault(); sublist.classList.toggle('expanded'); }} }});\n      }}\n      list.appendChild(chapter);\n    }});\n    panel.append(head,list); document.body.append(scrim,panel);\n    const open=()=>{{panel.classList.add('show');scrim.classList.add('show')}}; const closePanel=()=>{{panel.classList.remove('show');scrim.classList.remove('show')}};\n    btn.addEventListener('click',open); close.addEventListener('click',closePanel); scrim.addEventListener('click',closePanel); document.addEventListener('keydown',e=>{{if(e.key==='Escape')closePanel()}});\n  }}\n\n  function makeBreadcrumbAndPager() {{\n    if (!current) return;\n    const main=document.querySelector('main');\n    if(main) {{ const crumb=document.createElement('div'); crumb.className='book-breadcrumb'; crumb.innerHTML='<a href="index.html">Home</a><span>›</span><span>'+esc(current.section)+'</span><span>›</span><strong>'+esc(current.title)+'</strong>'; main.insertBefore(crumb, main.firstChild); }}\n    if(main) {{ const pager=document.createElement('nav'); pager.id='bookPager'; pager.setAttribute('aria-label','페이지 이동'); const mk=(p,cls,label)=>{{const a=document.createElement('a');a.className='book-page-link '+(cls||'');a.href=p?p.file:'index.html';a.innerHTML='<span class="label">'+label+'</span><span class="title">'+esc(p?p.title:'책 전체 목차')+'</span>';return a}}; pager.append(mk(pages[curIndex-1],'','← Previous'),mk(pages[curIndex+1],'next','Next →')); main.insertAdjacentElement('afterend',pager); }}\n  }}\n\n  function makeHomeTOC() {{\n    const root=document.querySelector('#tocHome'); if(!root) return; root.innerHTML=''; let lastSection='';\n    pages.forEach(p=>{{ if(p.section!==lastSection){{ const s=document.createElement('section'); s.className='home-section'; s.innerHTML='<div class="home-section-title">'+esc(p.section)+'</div>'; root.appendChild(s); lastSection=p.section; }} const sec=root.lastElementChild; const a=document.createElement('a'); a.className='home-chapter'; a.href=p.file; const split=p.title.split(' · '); a.innerHTML='<span class="home-num">'+esc(split[0])+'</span><span class="home-title">'+esc(split.slice(1).join(' · ')||p.title)+'</span><span class="home-sub">'+esc(p.sub||'')+'</span>'; sec.appendChild(a); if(p.sections?.length){{ const wrap=document.createElement('div'); wrap.className='home-subsections'; p.sections.forEach(s=>{{const x=document.createElement('a');x.className='home-subsection level-'+s.level;x.href=p.file+'#'+encodeURIComponent(s.id);x.textContent=s.title;wrap.appendChild(x)}}); sec.appendChild(wrap); }} }});\n  }}\n\n  makeHomeTOC();\n  if (current) {{ makeBookPanel(); makeBreadcrumbAndPager(); }}\n}})();\n'''
    return js_runtime


def main() -> None:
    files = [p for p in ROOT.glob("*.html") if p.name not in EXCLUDE]
    pages = [parse_file(p) for p in files if re.match(r"ch\d+(?:-.*)?\.html$", p.name, re.I)]
    pages.sort(key=lambda p: p.pop("_sort"))
    OUT.write_text(js_runtime(pages), encoding="utf-8")
    print(f"Generated {OUT} from {len(pages)} chapter files")


if __name__ == "__main__":
    main()
