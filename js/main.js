/* Page behaviour: theme, photo deck, project filters, lab tabs, coursework, gallery. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  root.classList.add('js');
  var $ = function (s, el) { return (el || doc).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || doc).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(tag, attrs, children) {
    var n = doc.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { n.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); });
    return n;
  }

  /* ── Theme ── */
  function currentTheme() {
    return root.dataset.theme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  $('#themeToggle').addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
    doc.dispatchEvent(new CustomEvent('themechange'));
  });

  /* ── Nav: border once scrolled, highlight the section in view ── */
  var nav = $('.nav');
  function onScroll() { nav.classList.toggle('is-stuck', window.scrollY > 8); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var navLinks = $$('.nav__links a');
  if ('IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        navLinks.forEach(function (a) { a.classList.toggle('is-here', a.getAttribute('href') === '#' + e.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('main section[id]').forEach(function (s) { spy.observe(s); });
  }

  /* ── Toronto clock ── */
  var clock = $('#clock');
  function tick() {
    try {
      clock.textContent = new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto' }).format(new Date()) + ' local time';
    } catch (e) { /* keep the coordinates */ }
  }
  tick();
  setInterval(tick, 30000);
  $('#year').textContent = new Date().getFullYear();

  /* ── Photographs (captions are the dates Mert gave them on VSCO) ── */
  var PHOTOS = [
    { f: 'marina-city', cap: '2024.06.15', alt: 'A marina full of sailing boats with a city skyline behind it, seen from the air' },
    { f: 'harbour-town', cap: '2024.06.16', alt: 'A breakwater sheltering small boats beside a hillside town and deep blue sea' },
    { f: 'sunset', cap: '2022.09.10', alt: 'Islands on the horizon just after sunset, the sea turning orange and violet' },
    { f: 'courtyard', cap: "2023.04.06 · SJ'24", alt: 'Red-roofed school buildings around a garden courtyard, with the sea in the distance' },
    { f: 'marina', cap: '2024.06.15', alt: 'Rows of moored boats in a marina under scattered clouds' },
    { f: 'promenade', cap: '2022.10.22', alt: 'A long seaside promenade lined with autumn trees, a single boat crossing the water' },
    { f: 'beach', cap: '2022.08.20', alt: 'Waves rolling onto a sandy beach dotted with umbrellas' },
    { f: 'circuit', cap: '2023.03.04 · @F1', alt: 'A racing circuit with empty grandstands on an overcast day' },
    { f: 'coast-road', cap: '2022.08.29', alt: 'A coastal road curving past a small harbour, with islands offshore' },
    { f: 'river-town', cap: '2022.08.20', alt: 'A town of red roofs along a winding river, under a bank of white cloud' }
  ];
  var src = function (p) { return 'assets/photos/' + p.f + '.jpg'; };

  /* ── Hero deck ── */
  var deck = $('#deck'), deckCap = $('#deckCaption');
  var order = PHOTOS.map(function (_, i) { return i; });
  var deckImgs = PHOTOS.map(function (p, i) {
    var img = el('img', { src: src(p), alt: i === 0 ? p.alt : '', width: 798, height: 530, decoding: 'async' });
    if (i > 2) img.loading = 'lazy';
    deck.appendChild(img);
    return img;
  });
  function layoutDeck() {
    order.forEach(function (photoIndex, pos) { deckImgs[photoIndex].dataset.pos = pos; });
    deckCap.textContent = PHOTOS[order[0]].cap;
    deckImgs.forEach(function (img, i) { img.alt = i === order[0] ? PHOTOS[i].alt : ''; });
  }
  var deckBusy = false;
  function nextPhoto() {
    if (deckBusy) return;
    var top = deckImgs[order[0]];
    if (reduceMotion) { order.push(order.shift()); layoutDeck(); return; }
    deckBusy = true;
    top.classList.add('is-leaving');
    setTimeout(function () {
      order.push(order.shift());
      top.classList.remove('is-leaving');
      layoutDeck();
      deckBusy = false;
    }, 380);
  }
  layoutDeck();
  deck.addEventListener('click', nextPhoto);
  deck.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nextPhoto(); }
  });

  /* ── Project filters ── */
  var projects = $('#projects'), cards = $$('.card', projects);
  $$('#projectFilters .chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var f = chip.dataset.filter;
      $$('#projectFilters .chip').forEach(function (c) {
        c.classList.toggle('is-on', c === chip);
        c.setAttribute('aria-pressed', c === chip);
      });
      projects.classList.toggle('is-filtered', f !== 'all');
      cards.forEach(function (card) { card.hidden = f !== 'all' && card.dataset.tags.split(' ').indexOf(f) < 0; });
    });
  });

  /* ── Lab tabs ── */
  var tabs = $$('.tab');
  function showLab(name, focus) {
    tabs.forEach(function (t) {
      var on = t.id === 'tab-' + name;
      t.classList.toggle('is-on', on);
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
      if (on && focus) t.focus();
    });
    doc.dispatchEvent(new CustomEvent('lab:show', { detail: name }));
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { showLab(t.id.slice(4)); });
    t.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      showLab(tabs[(i + d + tabs.length) % tabs.length].id.slice(4), true);
    });
  });
  $$('[data-lab]').forEach(function (a) {
    a.addEventListener('click', function () { showLab(a.dataset.lab); });
  });

  /* ── Coursework ── */
  var AREAS = {
    ai: 'AI & machine learning', sys: 'Systems', theory: 'Theory & algorithms', sw: 'Programming & design',
    stat: 'Statistics & probability', math: 'Mathematics', eco: 'Economics', breadth: 'Breadth'
  };
  // [code, title, area, academic year, term, status, linked project id]
  var COURSES = [
    ['CSC110Y1', 'Foundations of Computer Science I', 'sw', 1, 'Fall', 'done'],
    ['MAT223H1', 'Linear Algebra I', 'math', 1, 'Fall', 'done'],
    ['PHL205H1', 'Early Medieval Philosophy', 'breadth', 1, 'Fall', 'done'],
    ['MAT137Y1', 'Calculus with Proofs', 'math', 1, 'Full year', 'done'],
    ['ECO105Y1', 'Principles of Economics for Non-Specialists', 'eco', 1, 'Full year', 'done'],
    ['CSC111H1', 'Foundations of Computer Science II', 'sw', 1, 'Winter', 'done', 'p-harmonify'],
    ['MAT224H1', 'Linear Algebra II', 'math', 1, 'Winter', 'done'],
    ['PSY100H1', 'Introductory Psychology', 'breadth', 1, 'Winter', 'done'],

    ['CSC207H1', 'Software Design', 'sw', 2, 'Fall', 'done', 'p-indishisive'],
    ['CSC236H1', 'Introduction to the Theory of Computation', 'theory', 2, 'Fall', 'done'],
    ['CSC258H1', 'Computer Organization', 'sys', 2, 'Fall', 'done', 'p-columns'],
    ['STA257H1', 'Probability and Statistics I', 'stat', 2, 'Fall', 'done'],
    ['MAT257Y1', 'Analysis II', 'math', 2, 'Full year', 'done'],
    ['ECO200Y1', 'Microeconomic Theory', 'eco', 2, 'Full year', 'done'],
    ['CSC209H1', 'Software Tools and Systems Programming', 'sys', 2, 'Winter', 'done'],
    ['CSC263H1', 'Data Structures and Analysis', 'theory', 2, 'Winter', 'done'],
    ['CSC311H1', 'Introduction to Machine Learning', 'ai', 2, 'Winter', 'done'],
    ['CSC401H1', 'Natural Language Computing', 'ai', 2, 'Winter', 'done', 'p-nmt'],
    ['STA261H1', 'Probability and Statistics II', 'stat', 2, 'Winter', 'done'],

    ['CSC369H1', 'Operating Systems', 'sys', 3, 'Fall', 'now'],
    ['CSC373H1', 'Algorithm Design, Analysis and Complexity', 'theory', 3, 'Fall', 'now'],
    ['CSC458H1', 'Computer Networks', 'sys', 3, 'Fall', 'now'],
    ['MAT244H1', 'Ordinary Differential Equations', 'math', 3, 'Fall', 'now'],
    ['STA302H1', 'Methods of Data Analysis I', 'stat', 3, 'Fall', 'now'],
    ['STA355H1', 'Theory of Statistical Practice', 'stat', 3, 'Fall', 'now'],
    ['STA357H1', 'Theoretical Probability', 'stat', 3, 'Fall', 'now'],
    ['CSC320H1', 'Introduction to Visual Computing', 'ai', 3, 'Winter', 'next'],
    ['CSC384H1', 'Introduction to Artificial Intelligence', 'ai', 3, 'Winter', 'next'],
    ['CSC413H1', 'Neural Networks and Deep Learning', 'ai', 3, 'Winter', 'next'],
    ['STA303H1', 'Methods of Data Analysis II', 'stat', 3, 'Winter', 'next'],
    ['STA414H1', 'Statistical Methods for Machine Learning II', 'stat', 3, 'Winter', 'next'],
    ['STA457H1', 'Time Series Analysis', 'stat', 3, 'Winter', 'next']
  ].map(function (c) { return { code: c[0], title: c[1], area: c[2], year: c[3], term: c[4], status: c[5], project: c[6] }; });

  var YEARS = { 1: ['First year', '2024 to 2025'], 2: ['Second year', '2025 to 2026'], 3: ['Third year', '2026 to 2027'] };
  var STATUS_NOTE = { now: 'now', next: 'winter' };
  var courseView = 'term', courseArea = 'all';
  var grid = $('#courseGrid'), filterBox = $('#courseFilters'), countEl = $('#courseCount');

  function courseNode(c) {
    var inner = [
      el('span', { class: 'course__code' }, [c.code.replace(/([A-Z]{3})(\d{3})/, '$1 $2').slice(0, 7), el('em', { text: STATUS_NOTE[c.status] || '' })]),
      el('span', { class: 'course__title', text: c.title })
    ];
    var label = c.code.slice(0, 6) + ', ' + c.title + (c.status === 'now' ? ', in progress' : c.status === 'next' ? ', enrolled for winter' : '');
    var node = c.project
      ? el('a', { class: 'course', href: '#' + c.project, 'data-status': c.status, 'aria-label': label + '. Jump to the project it led to.' }, inner)
      : el('div', { class: 'course', 'data-status': c.status, 'aria-label': label }, inner);
    if (courseArea !== 'all' && c.area !== courseArea) node.classList.add('is-dim');
    if (c.project) node.addEventListener('click', function () { flashCard(c.project); });
    return el('li', {}, [node]);
  }
  function flashCard(id) {
    var card = doc.getElementById(id);
    if (!card) return;
    // Make sure the card is visible even if a project filter is hiding it.
    if (card.hidden) $('#projectFilters .chip[data-filter="all"]').click();
    card.classList.remove('is-flash');
    void card.offsetWidth;
    card.classList.add('is-flash');
  }
  function group(title, note, list) {
    return el('section', { class: 'cgroup' }, [
      el('div', {}, [el('h3', { class: 'cgroup__title', text: title }), el('p', { class: 'cgroup__note', text: note })]),
      el('ul', { class: 'cgroup__list' }, list.map(courseNode))
    ]);
  }
  function renderCourses() {
    grid.textContent = '';
    if (courseView === 'term') {
      [1, 2, 3].forEach(function (y) {
        var list = COURSES.filter(function (c) { return c.year === y; });
        grid.appendChild(group(YEARS[y][0], YEARS[y][1], list));
      });
    } else {
      Object.keys(AREAS).forEach(function (a) {
        var list = COURSES.filter(function (c) { return c.area === a; });
        if (courseArea !== 'all' && a !== courseArea) return;
        grid.appendChild(group(AREAS[a], list.length + (list.length === 1 ? ' course' : ' courses'), list));
      });
    }
    var shown = COURSES.filter(function (c) { return courseArea === 'all' || c.area === courseArea; });
    var done = shown.filter(function (c) { return c.status === 'done'; }).length;
    var now = shown.filter(function (c) { return c.status === 'now'; }).length;
    var next = shown.length - done - now;
    countEl.textContent = shown.length + (shown.length === 1 ? ' course' : ' courses') +
      (courseArea === 'all' ? '' : ' in ' + AREAS[courseArea].toLowerCase().replace(/^ai/, 'AI')) +
      ': ' + done + ' completed, ' + now + ' in progress, ' + next + ' enrolled for winter';
  }
  function areaChip(key, label, n) {
    var b = el('button', { class: 'chip' + (key === courseArea ? ' is-on' : ''), type: 'button', 'aria-pressed': key === courseArea }, [label, el('small', { text: String(n) })]);
    b.addEventListener('click', function () {
      courseArea = key;
      $$('.chip', filterBox).forEach(function (c) { c.classList.toggle('is-on', c === b); c.setAttribute('aria-pressed', c === b); });
      renderCourses();
    });
    return b;
  }
  filterBox.appendChild(areaChip('all', 'All', COURSES.length));
  Object.keys(AREAS).forEach(function (a) {
    filterBox.appendChild(areaChip(a, AREAS[a], COURSES.filter(function (c) { return c.area === a; }).length));
  });
  $$('.seg button').forEach(function (b) {
    b.addEventListener('click', function () {
      courseView = b.dataset.view;
      $$('.seg button').forEach(function (o) { o.classList.toggle('is-on', o === b); o.setAttribute('aria-pressed', o === b); });
      renderCourses();
    });
  });
  renderCourses();

  /* ── Gallery and lightbox ── */
  var gallery = $('#gallery'), box = $('#lightbox'), boxImg = $('#lightboxImg'), boxCap = $('#lightboxCap'), boxAt = 0;
  PHOTOS.forEach(function (p, i) {
    var b = el('button', { class: 'shot', type: 'button', 'aria-label': 'Enlarge: ' + p.alt }, [
      el('img', { src: src(p), alt: p.alt, width: 798, height: 530, loading: 'lazy', decoding: 'async' }),
      el('span', { text: p.cap })
    ]);
    b.addEventListener('click', function () { openBox(i); });
    gallery.appendChild(b);
  });
  function setBox(i) {
    boxAt = (i + PHOTOS.length) % PHOTOS.length;
    boxImg.src = src(PHOTOS[boxAt]);
    boxImg.alt = PHOTOS[boxAt].alt;
    boxCap.textContent = PHOTOS[boxAt].cap + '  ·  ' + (boxAt + 1) + ' / ' + PHOTOS.length;
  }
  function openBox(i) {
    setBox(i);
    if (box.showModal) box.showModal(); else box.setAttribute('open', '');
  }
  $('.lightbox__close').addEventListener('click', function () { box.close(); });
  $('.lightbox__nav--prev').addEventListener('click', function () { setBox(boxAt - 1); });
  $('.lightbox__nav--next').addEventListener('click', function () { setBox(boxAt + 1); });
  box.addEventListener('click', function (e) { if (e.target === box) box.close(); });
  box.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') setBox(boxAt - 1);
    if (e.key === 'ArrowRight') setBox(boxAt + 1);
  });

  /* ── Reveal on scroll ── */
  var revealables = $$('.section__head, .card, .panel, .tabs, .timeline li, .skills, .cgroup, .shot, .contact > *');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0 });   // any visible pixel reveals it, so nothing can stay hidden on screen
    revealables.forEach(function (n) { n.classList.add('reveal'); io.observe(n); });
  }
})();
