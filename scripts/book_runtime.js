/* Book navigation runtime.
   Injected into book.js by scripts/build_book.py, after the BOOK_PAGES data.
   Provides: left collapsible sidebar with the full table of contents,
   previous/next paging between chapters and exercise pages. */
(function () {
  'use strict';

  var pages = window.BOOK_PAGES || [];
  if (!pages.length) return;

  var STORE_KEY = 'janeway:book:sidebar';
  var DOCK_MIN = 1200;

  var fileName = (location.pathname.split('/').pop() || 'index.html');
  try { fileName = decodeURIComponent(fileName); } catch (e) { /* keep raw */ }
  if (!fileName) fileName = 'index.html';

  var current = null;
  for (var i = 0; i < pages.length; i++) {
    if (pages[i].file === fileName) { current = pages[i]; break; }
  }
  var curIndex = current ? pages.indexOf(current) : -1;
  var prevPage = curIndex > 0 ? pages[curIndex - 1] : null;
  var nextPage = curIndex >= 0 && curIndex < pages.length - 1 ? pages[curIndex + 1] : null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  /* "1장 · Immunology의 기본 개념" -> ["1장", "Immunology의 기본 개념"] */
  function splitTitle(page) {
    var parts = String(page.title || '').split(' · ');
    if (parts.length < 2) return ['', page.title || page.file];
    return [parts[0], parts.slice(1).join(' · ')];
  }

  function store(value) {
    try { localStorage.setItem(STORE_KEY, value); } catch (e) { /* private mode */ }
  }
  function stored() {
    try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; }
  }

  function hrefFor(page, section) {
    return page.file + (section ? '#' + encodeURIComponent(section.id) : '');
  }

  /* ---------------------------------------------------------------- sidebar */

  function buildSidebar() {
    var scrim = el('div');
    scrim.id = 'bookScrim';

    var panel = el('aside');
    panel.id = 'bookPanel';
    panel.setAttribute('aria-label', '책 전체 목차');

    var head = el('div', 'book-head');
    var hwrap = el('div', 'book-head-text');
    hwrap.appendChild(el('h2', null, "Janeway's Immunobiology"));
    hwrap.appendChild(el('p', null, '전체 목차 · 장 · 소절'));
    var close = el('button', 'book-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', '목차 닫기');
    head.appendChild(hwrap);
    head.appendChild(close);

    var tools = el('div', 'book-tools');
    var filter = el('input', 'book-filter');
    filter.type = 'search';
    filter.placeholder = '목차 검색';
    filter.setAttribute('aria-label', '목차 검색');
    tools.appendChild(filter);

    var list = el('nav', 'book-list');
    list.setAttribute('aria-label', '장 목록');

    var entries = [];
    var lastSection = '';
    var sectionEl = null;

    pages.forEach(function (page) {
      if (page.section !== lastSection) {
        sectionEl = el('div', 'book-section', page.section);
        list.appendChild(sectionEl);
        lastSection = page.section;
      }

      var isCurrent = !!current && page.id === current.id;
      var chapter = el('div', 'book-chapter');
      var row = el('div', 'book-row');

      var link = el('a', 'book-link');
      link.href = hrefFor(page, null);
      var parts = splitTitle(page);
      link.innerHTML = '<span class="chapter-num">' + esc(parts[0]) +
        '</span><span class="chapter-title">' + esc(parts[1]) + '</span>';
      if (isCurrent) {
        link.classList.add('current');
        link.setAttribute('aria-current', 'page');
      }
      row.appendChild(link);

      var sublist = null;
      var sublinks = [];

      if (page.sections && page.sections.length) {
        var caret = el('button', 'book-caret');
        caret.type = 'button';
        caret.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        caret.setAttribute('aria-label', page.title + ' 소절 펼치기');
        row.appendChild(caret);

        sublist = el('div', 'book-sublist');
        page.sections.forEach(function (section) {
          var a = el('a', 'book-sublink level-' + section.level, section.title);
          a.href = hrefFor(page, section);
          a.dataset.sectionId = section.id;
          sublist.appendChild(a);
          sublinks.push(a);
        });

        var setExpanded = function (open) {
          sublist.classList.toggle('expanded', open);
          caret.classList.toggle('open', open);
          caret.setAttribute('aria-expanded', open ? 'true' : 'false');
        };
        setExpanded(isCurrent);
        caret.addEventListener('click', function () {
          setExpanded(!sublist.classList.contains('expanded'));
        });
        chapter.appendChild(row);
        chapter.appendChild(sublist);
      } else {
        chapter.appendChild(row);
      }

      list.appendChild(chapter);
      entries.push({
        page: page,
        chapter: chapter,
        link: link,
        sublist: sublist,
        sublinks: sublinks,
        sectionEl: sectionEl,
        isCurrent: isCurrent
      });
    });

    panel.appendChild(head);
    panel.appendChild(tools);
    panel.appendChild(list);
    document.body.appendChild(scrim);
    document.body.appendChild(panel);

    /* ---- filtering ---- */
    filter.addEventListener('input', function () {
      var q = filter.value.trim().toLowerCase();
      var visibleSections = [];
      entries.forEach(function (entry) {
        if (!q) {
          entry.chapter.classList.remove('filtered-out');
          entry.sublinks.forEach(function (a) { a.classList.remove('filtered-out'); });
          if (entry.sublist) entry.sublist.classList.toggle('expanded', entry.isCurrent);
          if (visibleSections.indexOf(entry.sectionEl) < 0) visibleSections.push(entry.sectionEl);
          return;
        }
        var chapterHit = entry.page.title.toLowerCase().indexOf(q) >= 0;
        var subHit = 0;
        entry.sublinks.forEach(function (a) {
          var hit = chapterHit || a.textContent.toLowerCase().indexOf(q) >= 0;
          a.classList.toggle('filtered-out', !hit);
          if (hit) subHit++;
        });
        var show = chapterHit || subHit > 0;
        entry.chapter.classList.toggle('filtered-out', !show);
        if (entry.sublist) entry.sublist.classList.toggle('expanded', show && subHit > 0);
        if (show && visibleSections.indexOf(entry.sectionEl) < 0) visibleSections.push(entry.sectionEl);
      });
      entries.forEach(function (entry) {
        if (entry.sectionEl) {
          entry.sectionEl.classList.toggle('filtered-out', visibleSections.indexOf(entry.sectionEl) < 0);
        }
      });
    });

    return {
      panel: panel,
      scrim: scrim,
      close: close,
      list: list,
      filter: filter,
      entries: entries
    };
  }

  /* ------------------------------------------------------------ open/close */

  function wireSidebar(ui) {
    var btn = el('button', 'book-navbtn');
    btn.id = 'bookNavBtn';
    btn.type = 'button';
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg><span class="book-navbtn-text">목차</span>';
    btn.setAttribute('aria-label', '책 전체 목차 열기');
    btn.setAttribute('aria-controls', 'bookPanel');
    btn.setAttribute('aria-expanded', 'false');

    var topInner = document.querySelector('header.top .top-inner') || document.querySelector('.top-inner');
    if (topInner) topInner.insertBefore(btn, topInner.firstChild);
    else document.body.insertBefore(btn, document.body.firstChild);

    var open = false;
    var docked = false;

    function scrollCurrentIntoView() {
      var entry = null;
      for (var i = 0; i < ui.entries.length; i++) {
        if (ui.entries[i].isCurrent) { entry = ui.entries[i]; break; }
      }
      if (!entry) return;
      var target = entry.chapter.offsetTop - 80;
      ui.list.scrollTop = target > 0 ? target : 0;
    }

    function render() {
      ui.panel.classList.toggle('show', open);
      ui.panel.setAttribute('aria-hidden', open ? 'false' : 'true');
      ui.scrim.classList.toggle('show', open && !docked);
      document.body.classList.toggle('book-docked', open && docked);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? '책 전체 목차 닫기' : '책 전체 목차 열기');
      btn.classList.toggle('active', open);
    }

    function setOpen(value, remember) {
      open = !!value;
      if (remember) store(open ? 'open' : 'closed');
      render();
      if (open) scrollCurrentIntoView();
    }

    function syncMode() {
      var nextDocked = window.innerWidth >= DOCK_MIN;
      if (nextDocked === docked) return;
      docked = nextDocked;
      document.body.classList.toggle('book-dockable', docked);
      /* Docked layouts remember the user's choice, overlays always start closed. */
      open = docked ? stored() !== 'closed' : false;
      render();
      if (open) scrollCurrentIntoView();
    }

    btn.addEventListener('click', function () { setOpen(!open, true); });
    ui.close.addEventListener('click', function () { setOpen(false, true); });
    ui.scrim.addEventListener('click', function () { setOpen(false, false); });

    /* Overlay mode: following a link should not leave the drawer over the page. */
    ui.panel.addEventListener('click', function (event) {
      var link = event.target.closest && event.target.closest('a');
      if (link && !docked) setOpen(false, false);
    });

    var mode = { isDocked: function () { return docked; }, close: function () { setOpen(false, false); } };

    window.addEventListener('resize', syncMode);
    docked = !(window.innerWidth >= DOCK_MIN); /* force syncMode to run once */
    syncMode();

    return mode;
  }

  /* --------------------------------------------------------- scroll spy */

  function setupScrollSpy(ui) {
    if (!current || !current.sections || !current.sections.length) return;
    var entry = null;
    for (var i = 0; i < ui.entries.length; i++) {
      if (ui.entries[i].isCurrent) { entry = ui.entries[i]; break; }
    }
    if (!entry || !entry.sublinks.length) return;

    var byId = {};
    entry.sublinks.forEach(function (a) { byId[a.dataset.sectionId] = a; });

    var targets = [];
    current.sections.forEach(function (section) {
      var node = document.getElementById(section.id);
      if (node) targets.push(node);
    });
    if (!targets.length) return;

    var OFFSET = 120;
    var activeLink = null;

    function highlight(link) {
      if (link === activeLink) return;
      if (activeLink) activeLink.classList.remove('active-section');
      activeLink = link;
      if (!link) return;
      link.classList.add('active-section');
      /* Keep the active entry in sight, but never fight a user who is scrolling
         the sidebar itself: only nudge when the entry is out of view. */
      var list = ui.list;
      var top = link.offsetTop;
      var bottom = top + link.offsetHeight;
      if (top < list.scrollTop || bottom > list.scrollTop + list.clientHeight) {
        list.scrollTop = top - list.clientHeight / 2;
      }
    }

    /* Headings are in document order, so their offsets increase down the page:
       a binary search costs ~log2(n) rect reads per frame instead of one per heading. */
    function activeIndex() {
      var lo = 0;
      var hi = targets.length - 1;
      var found = -1;
      while (lo <= hi) {
        var mid = (lo + hi) >> 1;
        if (targets[mid].getBoundingClientRect().top <= OFFSET) { found = mid; lo = mid + 1; }
        else hi = mid - 1;
      }
      return found;
    }

    var ticking = false;
    function update() {
      ticking = false;
      var index = activeIndex();
      if (index < 0) { highlight(null); return; }
      highlight(byId[targets[index].id] || null);
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  /* --------------------------------------------------- breadcrumb + pager */

  function pageLink(page, kind) {
    var a = el('a', 'book-page-link ' + kind);
    a.href = page ? page.file : 'index.html';
    a.rel = kind === 'next' ? 'next' : 'prev';
    var label = kind === 'next' ? 'Next →' : '← Previous';
    var title = page ? page.title : '책 전체 목차';
    a.innerHTML = '<span class="label">' + esc(label) + '</span><span class="title">' + esc(title) + '</span>';
    return a;
  }

  function makeBreadcrumbAndPager() {
    var main = document.querySelector('main');
    if (!main) return;

    var crumb = el('div', 'book-breadcrumb');
    crumb.innerHTML = '<a href="index.html">Home</a><span>›</span><span>' + esc(current.section) +
      '</span><span>›</span><strong>' + esc(current.title) + '</strong>';
    main.insertBefore(crumb, main.firstChild);

    var pager = el('nav');
    pager.id = 'bookPager';
    pager.setAttribute('aria-label', '이전/다음 페이지 이동');
    pager.appendChild(pageLink(prevPage, 'prev'));
    pager.appendChild(pageLink(nextPage, 'next'));
    main.insertAdjacentElement('afterend', pager);
  }

  function makeTopPager() {
    var topInner = document.querySelector('header.top .top-inner') || document.querySelector('.top-inner');
    if (!topInner) return;
    var wrap = el('div', 'book-toppager');
    wrap.setAttribute('aria-label', '이전/다음 페이지 이동');

    function arrow(page, kind, glyph) {
      var node = page ? el('a', 'book-toparrow') : el('span', 'book-toparrow disabled');
      node.innerHTML = glyph;
      if (page) {
        node.href = page.file;
        node.rel = kind === 'next' ? 'next' : 'prev';
        node.title = (kind === 'next' ? '다음: ' : '이전: ') + page.title;
        node.setAttribute('aria-label', node.title);
      } else {
        node.setAttribute('aria-hidden', 'true');
      }
      return node;
    }

    wrap.appendChild(arrow(prevPage, 'prev', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'));
    wrap.appendChild(arrow(nextPage, 'next', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'));
    topInner.appendChild(wrap);
  }

  function setupKeyboard(mode) {
    document.addEventListener('keydown', function (event) {
      if (event.defaultPrevented) return;
      var target = event.target;
      if (target && (target.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName || ''))) {
        if (event.key === 'Escape' && target.classList.contains('book-filter')) target.blur();
        return;
      }
      if (event.key === 'Escape') { mode.close(); return; }
      if (event.ctrlKey || event.metaKey) return;

      var back = (event.altKey && event.key === 'ArrowLeft') || (!event.altKey && event.key === '[');
      var forward = (event.altKey && event.key === 'ArrowRight') || (!event.altKey && event.key === ']');
      if (back && prevPage) { event.preventDefault(); location.href = prevPage.file; }
      if (forward && nextPage) { event.preventDefault(); location.href = nextPage.file; }
    });
  }

  /* ------------------------------------------------------------ home page */

  function makeHomeTOC() {
    var root = document.querySelector('#tocHome');
    if (!root) return;
    root.innerHTML = '';
    var lastSection = '';
    var section = null;

    pages.forEach(function (page) {
      if (page.section !== lastSection) {
        section = el('section', 'home-section');
        var title = el('div', 'home-section-title', page.section);
        section.appendChild(title);
        root.appendChild(section);
        lastSection = page.section;
      }
      var a = el('a', 'home-chapter');
      a.href = page.file;
      var parts = splitTitle(page);
      a.innerHTML = '<span class="home-num">' + esc(parts[0]) + '</span><span class="home-title">' +
        esc(parts[1]) + '</span>' + (page.sub ? '<span class="home-sub">' + esc(page.sub) + '</span>' : '');
      section.appendChild(a);

      if (page.sections && page.sections.length) {
        var wrap = el('div', 'home-subsections');
        page.sections.forEach(function (sub) {
          var link = el('a', 'home-subsection level-' + sub.level, sub.title);
          link.href = hrefFor(page, sub);
          wrap.appendChild(link);
        });
        section.appendChild(wrap);
      }
    });
  }

  function init() {
    makeHomeTOC();
    if (!current) return;
    var ui = buildSidebar();
    var mode = wireSidebar(ui);
    setupScrollSpy(ui);
    makeBreadcrumbAndPager();
    makeTopPager();
    setupKeyboard(mode);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
