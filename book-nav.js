/* ============================================================
   Janeway Web Book — navigation runtime (hand-maintained).

   book.js holds only the generated BOOK_PAGES data; this file holds the
   behaviour, so regenerating the table of contents never overwrites it.

   Provides:
     · home page  — part → chapter list, subsections collapsed by default
     · chapter    — slide-in sidebar for jumping to any other chapter
     · chapter    — Previous / Next pager beneath the content
   ============================================================ */
(function () {
  'use strict';

  var pages = window.BOOK_PAGES || [];
  if (!pages.length) return;

  var fileName = decodeURIComponent((location.pathname.split('/').pop() || 'index.html'));
  if (!fileName) fileName = 'index.html';
  var current = null;
  for (var i = 0; i < pages.length; i++) {
    if (pages[i].file === fileName) { current = pages[i]; break; }
  }
  var curIndex = current ? pages.indexOf(current) : -1;

  var BOOK_TITLE = "Janeway's Immunobiology";
  var SVG_CHEV = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>';
  var SVG_BOOK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  /* Each chapter page supplies its own part label, and the wording drifted
     between build sessions ("Part IV · adaptive immune response" vs
     "Part IV · 적응 면역 반응"). Group by the part numeral instead of the raw
     string so one part yields one heading. */
  var PART_NAMES = {
    I: 'Part I · Immunobiology와 innate immunity 입문',
    II: 'Part II · Antigen의 인식',
    III: 'Part III · 성숙한 lymphocyte receptor repertoire의 발달',
    IV: 'Part IV · Adaptive immune response',
    V: 'Part V · 건강과 질병에서의 immune system',
    VI: 'Part VI · immune response의 조작'
  };
  function partKey(p) {
    var m = /Part\s+([IVX]+)/i.exec(p.section || '');
    return m ? m[1].toUpperCase() : (p.section || '기타');
  }
  function partLabel(p) {
    var key = partKey(p);
    return PART_NAMES[key] || p.section || '기타';
  }

  /* A chapter page and its exercises page are one entry in the reader's mind,
     so present them together even though they are two files. */
  function isExercises(p) { return /-exercises$/i.test(p.id); }
  function baseId(p) { return p.id.replace(/-exercises$/i, ''); }

  function groupPages() {
    var groups = [];
    var byBase = {};
    pages.forEach(function (p) {
      if (isExercises(p)) return;
      var g = { main: p, exercises: null };
      byBase[p.id] = g;
      groups.push(g);
    });
    pages.forEach(function (p) {
      if (!isExercises(p)) return;
      var g = byBase[baseId(p)];
      if (g) g.exercises = p;
      else groups.push({ main: p, exercises: null });
    });
    return groups;
  }

  /* The generated title looks like "6장 · T Lymphocyte에 대한 Antigen Presentation".
     Split it so the chapter number can be styled as an eyebrow. */
  function splitTitle(title) {
    var parts = String(title).split(' · ');
    if (parts.length < 2) return { num: '', rest: title };
    return { num: parts[0], rest: parts.slice(1).join(' · ') };
  }

  /* ---------------- home page ---------------- */

  function makeHomeTOC() {
    var root = document.querySelector('#tocHome');
    if (!root) return;
    root.innerHTML = '';

    var groups = groupPages();
    var lastPart = null;
    var holder = null;

    groups.forEach(function (g) {
      var p = g.main;
      if (partKey(p) !== lastPart) {
        holder = document.createElement('section');
        holder.className = 'home-section';
        var h = document.createElement('div');
        h.className = 'home-section-title';
        h.textContent = partLabel(p);
        holder.appendChild(h);
        root.appendChild(holder);
        lastPart = partKey(p);
      }

      var card = document.createElement('div');
      card.className = 'home-chapter-card';

      var t = splitTitle(p.title);
      var a = document.createElement('a');
      a.className = 'home-chapter';
      a.href = p.file;
      a.innerHTML = '<span class="home-num">' + esc(t.num) + '</span>' +
        '<span class="home-title">' + esc(t.rest) + '</span>';
      card.appendChild(a);

      var meta = document.createElement('div');
      meta.className = 'home-meta';
      var count = document.createElement('span');
      count.className = 'home-count';
      count.textContent = (p.sections ? p.sections.length : 0) + '개 소절';
      meta.appendChild(count);
      if (g.exercises) {
        var ex = document.createElement('a');
        ex.className = 'home-exlink';
        ex.href = g.exercises.file;
        ex.textContent = '연습문제';
        meta.appendChild(ex);
      }
      card.appendChild(meta);

      if (p.sections && p.sections.length) {
        var det = document.createElement('details');
        det.className = 'home-details';
        var sum = document.createElement('summary');
        sum.innerHTML = SVG_CHEV + '<span>소절 목차 펼치기</span>';
        det.appendChild(sum);
        var wrap = document.createElement('div');
        wrap.className = 'home-subsections';
        p.sections.forEach(function (s) {
          var x = document.createElement('a');
          x.className = 'home-subsection level-' + s.level;
          x.href = p.file + '#' + encodeURIComponent(s.id);
          x.textContent = s.title;
          wrap.appendChild(x);
        });
        det.appendChild(wrap);
        det.addEventListener('toggle', function () {
          sum.querySelector('span').textContent =
            det.open ? '소절 목차 접기' : '소절 목차 펼치기';
        });
        card.appendChild(det);
      }

      holder.appendChild(card);
    });

    wireHomeToolbar(root);
  }

  function wireHomeToolbar(root) {
    var expandBtn = document.getElementById('homeExpandAll');
    if (expandBtn) {
      expandBtn.addEventListener('click', function () {
        var opening = expandBtn.getAttribute('aria-pressed') !== 'true';
        root.querySelectorAll('details.home-details').forEach(function (d) { d.open = opening; });
        expandBtn.setAttribute('aria-pressed', opening ? 'true' : 'false');
        expandBtn.querySelector('.lbl').textContent = opening ? '소절 모두 접기' : '소절 모두 펼치기';
      });
    }
  }

  /* Home has no reader chrome of its own, so it carries its own theme switch.
     Chapter pages keep using the toggle their own template already provides. */
  function wireHomeTheme() {
    var btn = document.getElementById('homeThemeBtn');
    if (!btn) return;
    var KEY = 'janewaybook_theme';
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { /* private mode */ }
    if (saved === 'dark' || saved === 'light') {
      document.documentElement.setAttribute('data-theme', saved);
    }
    function currentIsDark() {
      var t = document.documentElement.getAttribute('data-theme');
      if (t) return t === 'dark';
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    function sync() { btn.setAttribute('aria-label', currentIsDark() ? '밝은 테마로' : '어두운 테마로'); }
    btn.addEventListener('click', function () {
      var next = currentIsDark() ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem(KEY, next); } catch (e) { /* ignore */ }
      sync();
    });
    sync();
  }

  /* ---------------- chapter sidebar ---------------- */

  function makeSidebar() {
    var topInner = document.querySelector('header.top .top-inner');

    var btn = document.createElement('button');
    btn.id = 'bookNavBtn';
    btn.type = 'button';
    btn.className = 'bk-btn bk-iconbtn';
    btn.innerHTML = SVG_BOOK;
    btn.setAttribute('aria-label', '다른 장으로 이동');
    btn.setAttribute('title', '다른 장으로 이동');
    if (topInner) {
      var brand = topInner.querySelector('.brand');
      if (brand) topInner.insertBefore(btn, brand); else topInner.prepend(btn);
    } else {
      btn.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:90';
      document.body.appendChild(btn);
    }

    var scrim = document.createElement('div');
    scrim.id = 'bookScrim';

    var panel = document.createElement('aside');
    panel.id = 'bookPanel';
    panel.setAttribute('aria-label', '책 전체 목차');
    panel.setAttribute('aria-hidden', 'true');

    var head = document.createElement('div');
    head.className = 'book-head';
    var hwrap = document.createElement('div');
    hwrap.innerHTML = '<h2>' + esc(BOOK_TITLE) + '</h2><p>전체 ' + groupPages().length + '개 장</p>';
    var close = document.createElement('button');
    close.className = 'book-close';
    close.type = 'button';
    close.innerHTML = '&times;';
    close.setAttribute('aria-label', '목차 닫기');
    head.append(hwrap, close);

    var list = document.createElement('nav');
    list.className = 'book-list';
    var lastPart = null;

    groupPages().forEach(function (g) {
      var p = g.main;
      if (partKey(p) !== lastPart) {
        var sec = document.createElement('div');
        sec.className = 'book-part';
        sec.textContent = partLabel(p);
        list.appendChild(sec);
        lastPart = partKey(p);
      }

      var chapter = document.createElement('div');
      chapter.className = 'book-chapter';
      var row = document.createElement('div');
      row.className = 'book-row';

      var t = splitTitle(p.title);
      var link = document.createElement('a');
      link.className = 'book-link';
      link.href = p.file;
      link.innerHTML = '<span class="chapter-num">' + esc(t.num) + '</span>' +
        '<span class="chapter-title">' + esc(t.rest) + '</span>';
      var isCurrentChapter = !!current && baseId(current) === p.id;
      if (current && p.id === current.id) {
        link.classList.add('current');
        link.setAttribute('aria-current', 'page');
      }
      row.appendChild(link);

      var sublist = null;
      if (p.sections && p.sections.length) {
        var toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'book-subtoggle';
        toggle.innerHTML = SVG_CHEV;
        toggle.setAttribute('aria-label', t.num + ' 소절 목차');
        toggle.setAttribute('aria-expanded', isCurrentChapter ? 'true' : 'false');
        row.appendChild(toggle);

        sublist = document.createElement('div');
        sublist.className = 'book-sublist';
        if (isCurrentChapter) sublist.classList.add('expanded');
        p.sections.forEach(function (s) {
          var a = document.createElement('a');
          a.className = 'book-sublink level-' + s.level;
          a.href = p.file + '#' + encodeURIComponent(s.id);
          a.textContent = s.title;
          if (isCurrentChapter && decodeURIComponent(location.hash.slice(1)) === s.id) {
            a.classList.add('active-section');
          }
          sublist.appendChild(a);
        });

        toggle.addEventListener('click', function () {
          var open = sublist.classList.toggle('expanded');
          toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
      }

      chapter.appendChild(row);
      if (sublist) chapter.appendChild(sublist);

      if (g.exercises) {
        var ex = document.createElement('a');
        ex.className = 'book-exlink';
        ex.href = g.exercises.file;
        ex.textContent = '☆ 연습문제';
        if (current && g.exercises.id === current.id) {
          ex.classList.add('current');
          ex.setAttribute('aria-current', 'page');
        }
        chapter.appendChild(ex);
      }

      list.appendChild(chapter);
    });

    var foot = document.createElement('div');
    foot.style.cssText = 'padding:10px 12px 4px';
    var home = document.createElement('a');
    home.className = 'book-exlink book-homelink';
    home.href = 'index.html';
    home.textContent = '← 전체 목차 홈';
    foot.appendChild(home);
    list.appendChild(foot);

    panel.append(head, list);
    document.body.append(scrim, panel);

    var lastFocus = null;
    function open() {
      lastFocus = document.activeElement;
      panel.classList.add('show');
      scrim.classList.add('show');
      panel.setAttribute('aria-hidden', 'false');
      close.focus();
      var cur = panel.querySelector('.book-link.current, .book-exlink.current');
      if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'center' });
    }
    function shut() {
      panel.classList.remove('show');
      scrim.classList.remove('show');
      panel.setAttribute('aria-hidden', 'true');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    btn.addEventListener('click', open);
    close.addEventListener('click', shut);
    scrim.addEventListener('click', shut);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('show')) shut();
    });
  }

  /* ---------------- previous / next ---------------- */

  function makePager() {
    if (!current) return;
    var main = document.querySelector('main');
    if (!main) return;

    var prev = curIndex > 0 ? pages[curIndex - 1] : null;
    var next = curIndex >= 0 && curIndex < pages.length - 1 ? pages[curIndex + 1] : null;

    var pager = document.createElement('nav');
    pager.id = 'bookPager';
    pager.setAttribute('aria-label', '이전 / 다음 페이지');

    function make(p, cls, label, fallbackText) {
      var a = document.createElement('a');
      a.className = 'book-page-link ' + cls;
      if (p) {
        a.href = p.file;
      } else {
        a.href = 'index.html';
        a.classList.add('home');
      }
      a.innerHTML = '<span class="label">' + label + '</span>' +
        '<span class="title">' + esc(p ? p.title : fallbackText) + '</span>';
      return a;
    }

    pager.append(
      make(prev, 'prev', '← Previous', '전체 목차'),
      make(next, 'next', 'Next →', '전체 목차')
    );
    main.insertAdjacentElement('afterend', pager);
  }

  function init() {
    makeHomeTOC();
    wireHomeTheme();
    if (current) { makeSidebar(); makePager(); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
