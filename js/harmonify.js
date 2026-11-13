/* Harmonify in the browser.
   A port of graph_functions.py from github.com/mertrassa/Harmonify-CSC111:
   same 200 songs, same 200 listeners, same similarity score, same tie-break
   (the first listener in the data file with the highest score wins). */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var listEl = $('#hzSongs'), chosenEl = $('#hzChosen'), searchEl = $('#hzSearch'),
      genreEl = $('#hzGenre'), goEl = $('#hzGo'), resultEl = $('#hzResult');
  if (!listEl) return;

  var songs = [], users = [], picks = [], genreTouched = false;
  var NEED = 5;

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function svg(tag, attrs) {
    var n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  /* ── the algorithm ── */
  function durationClass(ms) { return ms < 120000 ? 'short' : ms <= 480000 ? 'medium' : 'long'; }

  function similarity(myPicks, other, genre, duration) {
    var common = 0, sameGenre = 0, sameLength = 0;
    other.songs.forEach(function (id) {
      if (myPicks.indexOf(id) < 0) return;
      var s = songs[id - 1];
      common++;
      if (s.genre === genre) sameGenre++;
      if (durationClass(s.ms) === duration) sameLength++;
    });
    return { common: common, sameGenre: sameGenre, sameLength: sameLength, score: common * 3 + sameGenre * 2 + sameLength };
  }

  function findMatch(myPicks, genre, duration) {
    var best = null, ties = 0;
    users.forEach(function (u) {
      var r = similarity(myPicks, u, genre, duration);
      if (r.score <= 0) return;
      if (!best || r.score > best.result.score) { best = { user: u, result: r }; ties = 0; }
      else if (r.score === best.result.score) ties++;
    });
    if (!best) return null;
    best.ties = ties;
    best.shared = best.user.songs.filter(function (id) { return myPicks.indexOf(id) >= 0; });
    best.recs = best.user.songs.filter(function (id) { return myPicks.indexOf(id) < 0; });
    return best;
  }
  // Exposed so the port can be checked against the Python original.
  window.Harmonify = { findMatch: findMatch, ready: null };

  /* ── interface ── */
  function renderSongs() {
    var q = searchEl.value.trim().toLowerCase();
    listEl.textContent = '';
    var shown = 0;
    songs.forEach(function (s) {
      if (q && (s.title + ' ' + s.artist + ' ' + s.genre).toLowerCase().indexOf(q) < 0) return;
      shown++;
      var on = picks.indexOf(s.id) >= 0;
      var b = el('button', { type: 'button', 'aria-pressed': on }, [
        el('span', { class: 't', text: s.title }), el('span', { class: 'g', text: s.genre }), el('span', { class: 'a', text: s.artist })
      ]);
      b.addEventListener('click', function () { toggle(s.id); });
      listEl.appendChild(el('li', {}, [b]));
    });
    if (!shown) listEl.appendChild(el('li', { class: 'none', text: 'No song matches that search.' }));
  }

  function renderChosen() {
    chosenEl.textContent = '';
    picks.forEach(function (id) {
      var b = el('button', { type: 'button', 'aria-label': 'Remove ' + songs[id - 1].title, text: songs[id - 1].title });
      b.addEventListener('click', function () { toggle(id); });
      chosenEl.appendChild(b);
    });
    var left = NEED - picks.length;
    if (left > 0) chosenEl.appendChild(el('span', { class: 'slot', text: (picks.length ? left + ' more to go' : 'nothing picked yet') }));
    goEl.disabled = left > 0;
    goEl.textContent = left > 0 ? 'Pick ' + left + ' more song' + (left === 1 ? '' : 's') : 'Find my match';
    if (!genreTouched && picks.length) {
      // Default the genre to the most common one among the picks.
      var count = {}, top = null;
      picks.forEach(function (id) {
        var g = songs[id - 1].genre;
        count[g] = (count[g] || 0) + 1;
        if (!top || count[g] > count[top]) top = g;
      });
      genreEl.value = top;
    }
  }

  function toggle(id) {
    var at = picks.indexOf(id);
    if (at >= 0) picks.splice(at, 1);
    else if (picks.length < NEED) picks.push(id);
    else return;   // already five: remove one first
    renderSongs();
    renderChosen();
  }

  function songItem(id) {
    var s = songs[id - 1];
    return el('li', {}, [el('span', {}, [s.title + ' ', el('i', { text: s.artist })])]);
  }

  function drawGraph(m) {
    var W = 440, H = Math.max(120, 26 * Math.max(m.shared.length, m.recs.length) + 30);
    var g = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'You and your match joined through the songs you share', class: 'art-graph', style: 'width:100%;height:auto;margin:6px 0 2px' });
    var you = { x: 34, y: H / 2 }, them = { x: 262, y: H / 2 };
    function ys(n, i) { return H / 2 + (i - (n - 1) / 2) * 24; }
    var edges = svg('g', { class: 'art-graph__edges' }), nodes = svg('g', {});
    m.shared.forEach(function (id, i) {
      var y = ys(m.shared.length, i);
      edges.appendChild(svg('path', { class: 'hot', d: 'M' + you.x + ' ' + you.y + ' L148 ' + y + ' L' + them.x + ' ' + them.y }));
      nodes.appendChild(svg('rect', { x: 141, y: y - 7, width: 14, height: 14, rx: 3, fill: 'var(--warm)' }));
    });
    m.recs.forEach(function (id, i) {
      var y = ys(m.recs.length, i);
      edges.appendChild(svg('path', { d: 'M' + them.x + ' ' + them.y + ' L400 ' + y }));
      nodes.appendChild(svg('rect', { x: 393, y: y - 6, width: 12, height: 12, rx: 3, fill: 'var(--accent)' }));
    });
    g.appendChild(edges); g.appendChild(nodes);
    var u = svg('g', { class: 'art-graph__users' });
    u.appendChild(svg('circle', { cx: you.x, cy: you.y, r: 17, class: 'you' }));
    u.appendChild(svg('circle', { cx: them.x, cy: them.y, r: 17 }));
    g.appendChild(u);
    var t1 = svg('text', { x: you.x, y: you.y + 4, class: 'art-graph__you' }); t1.textContent = 'you';
    var t2 = svg('text', { x: them.x, y: them.y + 4, class: 'art-graph__you', style: 'fill:var(--ink)' }); t2.textContent = m.user.name.slice(0, 1);
    g.appendChild(t1); g.appendChild(t2);
    return g;
  }

  function showResult() {
    var duration = document.querySelector('input[name="hzDur"]:checked').value;
    var genre = genreEl.value;
    var m = findMatch(picks, genre, duration);
    resultEl.textContent = '';
    if (!m) {
      resultEl.appendChild(el('div', { class: 'empty' }, [
        el('p', { class: 'empty__big', text: 'Nobody shares any of those five.' }),
        el('p', { text: 'None of the 200 listeners has even one of your songs, so every score is zero. Swap a song or two and try again.' })
      ]));
      return;
    }
    var r = m.result, u = m.user;
    var box = el('div', { class: 'match' }, [
      el('div', { class: 'match__head' }, [
        el('div', { class: 'match__avatar', 'aria-hidden': 'true', text: u.name.slice(0, 1) }),
        el('div', {}, [
          el('p', { class: 'match__name', text: u.name }),
          el('p', { class: 'match__who', text: '@' + u.username + ' · ' + u.age + ' · ' + u.city })
        ]),
        el('div', { class: 'match__score' }, [el('b', { text: String(r.score) }), el('span', { text: 'match score' })])
      ]),
      el('pre', { class: 'hz__math', text:
        '3 × ' + r.common + ' in common            = ' + r.common * 3 + '\n' +
        '2 × ' + r.sameGenre + ' of them ' + genre + new Array(Math.max(1, 14 - genre.length)).join(' ') + '= ' + r.sameGenre * 2 + '\n' +
        '1 × ' + r.sameLength + ' of them ' + duration + new Array(Math.max(1, 14 - duration.length)).join(' ') + '= ' + r.sameLength }),
      drawGraph(m),
      el('h4', { text: 'Songs you both play' }),
      el('ul', { class: 'shared' }, m.shared.map(songItem)),
      el('h4', { text: u.name + ' also plays, so you might like' }),
      el('ul', {}, m.recs.map(songItem)),
      el('p', { class: 'match__runner', text: m.ties
        ? m.ties + ' other listener' + (m.ties === 1 ? '' : 's') + ' tied on ' + r.score + '. As in the original, the first one in the data wins.'
        : 'Scored against all 200 listeners; nobody else reached ' + r.score + '.' })
    ]);
    resultEl.appendChild(box);
    if (window.matchMedia('(max-width: 820px)').matches) resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function surprise() {
    // Three songs from one random listener plus two random others, so there is usually a clear match.
    var u = users[Math.floor(Math.random() * users.length)];
    var pool = u.songs.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 3);
    while (pool.length < NEED) {
      var id = 1 + Math.floor(Math.random() * songs.length);
      if (pool.indexOf(id) < 0) pool.push(id);
    }
    picks = pool;
    genreTouched = false;
    searchEl.value = '';
    renderSongs();
    renderChosen();
    showResult();
  }

  window.Harmonify.ready = fetch('data/harmonify.json').then(function (r) { return r.json(); }).then(function (data) {
    songs = data.songs.map(function (s, i) { return { id: i + 1, title: s[0], artist: s[1], ms: s[2], genre: s[3] }; });
    users = data.users.map(function (u) { return { username: u[0], name: u[1], age: u[2], city: u[3], songs: u[4] }; });
    var genres = {};
    songs.forEach(function (s) { genres[s.genre] = (genres[s.genre] || 0) + 1; });
    Object.keys(genres).sort().forEach(function (g) {
      genreEl.appendChild(el('option', { value: g, text: g + ' (' + genres[g] + ')' }));
    });
    genreEl.value = 'pop';
    renderSongs();
    renderChosen();
    searchEl.addEventListener('input', renderSongs);
    genreEl.addEventListener('change', function () { genreTouched = true; });
    goEl.addEventListener('click', showResult);
    $('#hzRandom').addEventListener('click', surprise);
  }).catch(function () {
    listEl.appendChild(el('li', { class: 'none', text: 'The song data could not be loaded. Try refreshing the page.' }));
  });
})();
