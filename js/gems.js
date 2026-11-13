/* A browser port of the falling-gems game from github.com/mertrassa/Columns-CSC258.
   The original is MIPS assembly drawing on a 32 × 32 bitmap display (8 px units).
   This keeps its board (6 × 18 well), its six colours, the ghost marker,
   the matching rules (rows, columns, both diagonals) and chain reactions. */
(function () {
  'use strict';
  var canvas = document.getElementById('gemCanvas');
  var poster = document.getElementById('gemPoster');
  var U = 8, COLS = 6, ROWS = 18, OX = 11, OY = 11;
  var BG = '#000630', WHITE = '#ffffff', GHOST = '#777700';
  var COLORS = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
  var GRAVITY_MS = { 1: 800, 2: 400, 3: 200 };   // easy, medium, hard
  var FLASH_MS = 240;

  function unit(ctx, x, y, color) { ctx.fillStyle = color; ctx.fillRect(x * U, y * U, U, U); }

  /* ── poster on the project card: a still of the game ── */
  if (poster) {
    var p = poster.getContext('2d'), seed = 258;
    var rnd = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    p.fillStyle = BG; p.fillRect(0, 0, 400, 200);
    var x, y, wx = 21, wy = 2;
    for (x = 2; x < 48; x += 3) {               // loose columns, like the title screen
      if (x >= wx - 2 && x <= wx + 9) continue;
      var top = 2 + Math.floor(rnd() * 19);
      for (y = 0; y < 3; y++) unit(p, x, top + y, COLORS[Math.floor(rnd() * 6)]);
    }
    for (x = 0; x < 8; x++) { unit(p, wx + x, wy, WHITE); unit(p, wx + x, wy + 21, WHITE); }
    for (y = 0; y < 22; y++) { unit(p, wx, wy + y, WHITE); unit(p, wx + 7, wy + y, WHITE); }
    for (x = 0; x < 6; x++) {
      var h = 2 + Math.floor(rnd() * 6);
      for (y = 0; y < h; y++) unit(p, wx + 1 + x, wy + 20 - y, COLORS[Math.floor(rnd() * 6)]);
    }
    unit(p, wx + 3, wy + 5, COLORS[3]); unit(p, wx + 3, wy + 6, COLORS[5]); unit(p, wx + 3, wy + 7, COLORS[0]);
  }
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  var scoreEl = document.getElementById('gmScore'), chainEl = document.getElementById('gmChain');
  var board, piece, state = 'title', score = 0, bestChain = 0, chain = 0, flashing = null;
  var fallClock = 0, flashClock = 0, lastTime = 0, raf = 0, difficulty = 1;

  function emptyBoard() {
    var b = [], r, c;
    for (r = 0; r < ROWS; r++) { b.push([]); for (c = 0; c < COLS; c++) b[r].push(0); }
    return b;
  }
  function randomGem() { return 1 + Math.floor(Math.random() * 6); }
  function canPlace(c, r) {
    if (c < 0 || c >= COLS || r < 0 || r + 2 >= ROWS) return false;
    return !board[r][c] && !board[r + 1][c] && !board[r + 2][c];
  }
  function landingRow() {
    var r = piece.r;
    while (canPlace(piece.c, r + 1)) r++;
    return r;
  }
  function spawn() {
    piece = { c: 2, r: 0, gems: [randomGem(), randomGem(), randomGem()] };
    fallClock = 0;
    if (!canPlace(piece.c, piece.r)) { piece = null; state = 'over'; }
  }
  function reset() {
    board = emptyBoard(); score = 0; bestChain = 0; chain = 0; flashing = null;
    state = 'playing'; spawn(); stats(); start();
  }
  function stats() { scoreEl.textContent = score; chainEl.textContent = bestChain; }

  function lock() {
    for (var i = 0; i < 3; i++) board[piece.r + i][piece.c] = piece.gems[i];
    piece = null; chain = 0;
    resolve();
  }
  function findMatches() {
    var hit = {}, n = 0, dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var g = board[r][c];
      if (!g) continue;
      dirs.forEach(function (d) {
        var pr = r - d[0], pc = c - d[1];
        if (pr >= 0 && pc >= 0 && pc < COLS && board[pr][pc] === g) return;   // not the start of a run
        var len = 1, rr = r + d[0], cc = c + d[1];
        while (rr < ROWS && cc >= 0 && cc < COLS && board[rr][cc] === g) { len++; rr += d[0]; cc += d[1]; }
        if (len < 3) return;
        for (var k = 0; k < len; k++) {
          var key = (r + d[0] * k) + ',' + (c + d[1] * k);
          if (!hit[key]) { hit[key] = true; n++; }
        }
      });
    }
    return n ? { cells: hit, count: n } : null;
  }
  function resolve() {
    var m = findMatches();
    if (m) { flashing = m; flashClock = 0; chain++; state = 'clearing'; }
    else { state = 'playing'; spawn(); }
  }
  function collapse() {
    Object.keys(flashing.cells).forEach(function (key) {
      var rc = key.split(','); board[+rc[0]][+rc[1]] = 0;
    });
    score += flashing.count;
    bestChain = Math.max(bestChain, chain);
    flashing = null;
    for (var c = 0; c < COLS; c++) {               // everything above a gap falls
      var write = ROWS - 1;
      for (var r = ROWS - 1; r >= 0; r--) {
        if (!board[r][c]) continue;
        var g = board[r][c]; board[r][c] = 0; board[write][c] = g; write--;
      }
    }
    stats();
    resolve();
  }

  /* ── drawing ── */
  var DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
                '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
  function drawNumber(n) {
    var s = ('00000' + n).slice(-5);
    for (var i = 0; i < 5; i++) {
      var d = DIGITS[+s[i]];
      for (var k = 0; k < 15; k++) if (d[k] === '1') unit(ctx, 7 + i * 4 + (k % 3), 3 + Math.floor(k / 3), WHITE);
    }
  }
  function label(lines, yUnit) {
    ctx.font = 'bold 10px "IBM Plex Mono", Consolas, monospace';
    ctx.textAlign = 'center';
    lines.forEach(function (line, i) {
      var w = ctx.measureText(line).width + 12, y = yUnit * U + i * 16;
      ctx.fillStyle = BG; ctx.fillRect(128 - w / 2, y - 11, w, 15);
      ctx.fillStyle = WHITE; ctx.fillText(line, 128, y);
    });
  }
  function draw() {
    var r, c, i;
    ctx.fillStyle = BG; ctx.fillRect(0, 0, 256, 256);
    for (c = 10; c <= 17; c++) { unit(ctx, c, 10, WHITE); unit(ctx, c, 29, WHITE); }
    for (r = 11; r <= 28; r++) { unit(ctx, 10, r, WHITE); unit(ctx, 17, r, WHITE); }
    drawNumber(score);
    if (board) {
      var blink = flashing && Math.floor(flashClock / 60) % 2 === 0;
      for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
        if (!board[r][c]) continue;
        var lit = flashing && flashing.cells[r + ',' + c];
        unit(ctx, OX + c, OY + r, lit && blink ? WHITE : COLORS[board[r][c] - 1]);
      }
    }
    if (piece) {
      var land = landingRow();
      for (i = 0; i < 3; i++) if (land + i > piece.r + 2) unit(ctx, OX + piece.c, OY + land + i, GHOST);
      for (i = 0; i < 3; i++) unit(ctx, OX + piece.c, OY + piece.r + i, COLORS[piece.gems[i] - 1]);
    }
    var touch = window.matchMedia('(hover: none)').matches;
    if (state === 'title') label(touch ? ['TAP TO START'] : ['CLICK OR PRESS', 'SPACE TO START'], 16);
    if (state === 'paused') label(touch ? ['PAUSED', 'TAP TO RESUME'] : ['PAUSED', 'P TO RESUME'], 16);
    if (state === 'over') label(touch ? ['GAME OVER', 'TAP TO RESTART'] : ['GAME OVER', 'R TO RESTART'], 16);
  }

  /* ── loop ── */
  function frame(now) {
    var dt = Math.min(100, now - lastTime);
    lastTime = now;
    if (state === 'playing' && piece) {
      fallClock += dt;
      if (fallClock >= GRAVITY_MS[difficulty]) {
        fallClock = 0;
        if (canPlace(piece.c, piece.r + 1)) piece.r++; else lock();
      }
    } else if (state === 'clearing') {
      flashClock += dt;
      if (flashClock >= FLASH_MS) collapse();
    }
    draw();
    raf = (state === 'playing' || state === 'clearing') ? requestAnimationFrame(frame) : 0;
  }
  function start() {
    if (raf) return;
    lastTime = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function pause() {
    if (state === 'playing' || state === 'clearing') { state = 'paused'; draw(); }
  }

  /* ── input ── */
  function press(key) {
    key = key.toLowerCase();
    if (key === 'arrowleft') key = 'a';
    if (key === 'arrowright') key = 'd';
    if (key === 'arrowup') key = 'w';
    if (key === 'arrowdown') key = 's';
    if (state === 'title') { if (key === ' ' || key === 'enter') reset(); return key === ' '; }
    if (key === 'r') { reset(); return true; }
    if (state === 'over') { if (key === ' ' || key === 'enter') reset(); return key === ' '; }
    if (state === 'paused') {
      if (key === 'p' || key === ' ') { state = flashing ? 'clearing' : 'playing'; start(); }
      return key === ' ' || key === 'p';
    }
    if (key === 'p') { pause(); return true; }
    if (state !== 'playing' || !piece) return 'adws '.indexOf(key) >= 0;
    if (key === 'a' && canPlace(piece.c - 1, piece.r)) piece.c--;
    else if (key === 'd' && canPlace(piece.c + 1, piece.r)) piece.c++;
    else if (key === 'w') piece.gems.unshift(piece.gems.pop());
    else if (key === 's') { if (canPlace(piece.c, piece.r + 1)) { piece.r++; fallClock = 0; } else lock(); }
    else if (key === ' ') { piece.r = landingRow(); lock(); }
    else return false;
    draw();
    return true;
  }
  canvas.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (press(e.key)) e.preventDefault();
  });
  canvas.addEventListener('click', function () {
    canvas.focus();
    if (state === 'title' || state === 'over') reset();
    else if (state === 'paused') press('p');
  });
  canvas.addEventListener('blur', function (e) {
    // Moving to the on-screen buttons is still playing.
    if (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.gm__pad')) return;
    pause();
  });
  document.addEventListener('lab:show', function (e) { if (e.detail !== 'gems') pause(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); });
  Array.prototype.forEach.call(document.querySelectorAll('.gm__pad button'), function (b) {
    b.addEventListener('click', function () {
      if (state === 'title' || state === 'over') { reset(); return; }
      if (state === 'paused') { press('p'); return; }
      press(b.dataset.key);
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll('input[name="gmDiff"]'), function (input) {
    input.addEventListener('change', function () { difficulty = +input.value; });
  });

  board = emptyBoard();
  draw();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (state === 'title') draw(); });
})();
