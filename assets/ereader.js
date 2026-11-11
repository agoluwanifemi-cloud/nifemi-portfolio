/* Our Space e-reader: paginated, swipeable, reflowing text.
   The book text ships encrypted (/assets/book/our-space.bin). The key comes from the
   Apps Script only for a paid reading code, so the text can't be read without buying. */
(function () {
  'use strict';
  var BOOK_URL = '/assets/book/our-space.bin?v=1';
  var PREFS = 'mn_eb_prefs';
  function $(s, r) { return (r || document).querySelector(s); }
  function ls(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function esc(x) { return String(x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function decrypt(keyB64) {
    var raw = Uint8Array.from(atob(keyB64), function (c) { return c.charCodeAt(0); });
    return Promise.all([
      fetch(BOOK_URL).then(function (r) { if (!r.ok) throw new Error('book'); return r.arrayBuffer(); }),
      crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt'])
    ]).then(function (res) {
      var buf = new Uint8Array(res[0]);
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, res[1], buf.slice(12));
    }).then(function (plain) { return JSON.parse(new TextDecoder().decode(plain)); });
  }

  function blockHTML(b, i) {
    var a = ' data-i="' + i + '"';
    switch (b.t) {
      case 'cover': case 'img':
        return '<figure class="eb-fig' + (b.t === 'cover' ? ' eb-cover' : '') + '"' + a + '><img src="' + b.src + '" alt="" width="' + b.w + '" height="' + b.h2 + '" decoding="async"></figure>';
      case 'h1': return '<h1' + a + '><span class="eb-chn">Chapter ' + b.n + '</span>' + b.h + '</h1>';
      case 'h2': return '<h2' + a + '>' + b.h + '</h2>';
      case 'h3': return '<h3' + a + '>' + b.h + '</h3>';
      case 'q': return '<aside class="eb-q eb-' + b.k + '"' + a + '>' + (b.l ? '<span class="eb-ql">' + b.l + '</span>' : '') + '<p>' + b.h + '</p></aside>';
      case 'ul': case 'ol': return '<' + b.t + a + '>' + b.items.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</' + b.t + '>';
      default: return '<p' + a + '>' + b.h + '</p>';
    }
  }

  function start(opts) {
    var code = opts.code || '', KEY = 'mn_eb_' + code.slice(0, 16);
    var prefs = Object.assign({ size: window.innerWidth < 600 ? 18 : 20, theme: 'paper', font: 'serif' }, ls(PREFS) || {});
    var root = document.createElement('div');
    root.className = 'eb';
    root.innerHTML =
      '<header class="eb-top">' +
        '<a class="eb-ic eb-back" href="/our-space" aria-label="Close the book">←</a>' +
        '<div class="eb-head"><span class="eb-title">Our Space</span><span class="eb-ch" aria-live="polite"></span></div>' +
        '<div class="eb-actions"><button type="button" class="eb-ic" data-sheet="toc" aria-label="Contents">☰</button><button type="button" class="eb-ic" data-sheet="find" aria-label="Search">⌕</button><button type="button" class="eb-ic eb-aa" data-sheet="aa" aria-label="Text settings">Aa</button></div>' +
      '</header>' +
      '<div class="eb-stage" tabindex="0" aria-label="Book pages. Swipe or use arrow keys to turn the page."><div class="eb-vp"><div class="eb-book" lang="en"></div></div><div class="eb-loading">Opening your book…</div></div>' +
      '<footer class="eb-bottom">' +
        '<input class="eb-scrub" type="range" min="1" max="1" value="1" aria-label="Page">' +
        '<div class="eb-prog"><span class="eb-pg"></span><span class="eb-left"></span></div>' +
        '<div class="eb-wm"></div>' +
      '</footer>' +
      '<div class="eb-sheet" data-s="toc" hidden><div class="eb-sh-head"><span>Contents</span><button type="button" class="eb-ic" data-close aria-label="Close">×</button></div><ol class="eb-list eb-toc"></ol></div>' +
      '<div class="eb-sheet" data-s="find" hidden><div class="eb-sh-head"><span>Search</span><button type="button" class="eb-ic" data-close aria-label="Close">×</button></div>' +
        '<form class="eb-find"><input type="search" placeholder="Search the book, or type a page number" autocomplete="off" aria-label="Search the book"><button type="submit">Search</button></form><p class="eb-note"></p><ol class="eb-list eb-hits"></ol></div>' +
      '<div class="eb-sheet eb-sheet-sm" data-s="aa" hidden><div class="eb-sh-head"><span>Text</span><button type="button" class="eb-ic" data-close aria-label="Close">×</button></div>' +
        '<div class="eb-row"><span>Size</span><div class="eb-seg"><button type="button" data-size="-1" aria-label="Smaller text">A−</button><button type="button" data-size="1" aria-label="Larger text">A+</button></div></div>' +
        '<div class="eb-row"><span>Page</span><div class="eb-seg eb-themes"><button type="button" data-theme="paper">Paper</button><button type="button" data-theme="sepia">Sepia</button><button type="button" data-theme="night">Night</button></div></div>' +
        '<div class="eb-row"><span>Font</span><div class="eb-seg"><button type="button" data-font="serif">Serif</button><button type="button" data-font="sans">Sans</button></div></div>' +
      '</div>';
    document.body.appendChild(root);
    document.documentElement.classList.add('eb-open');

    var stage = $('.eb-stage', root), vp = $('.eb-vp', root), book = $('.eb-book', root), scrub = $('.eb-scrub', root);
    var data = null, els = [], pageOf = [], pages = 1, cur = 0, W = 0, H = 0, chapters = [], texts = null;
    $('.eb-wm', root).textContent = opts.email ? 'Reading copy for ' + opts.email : '';

    function applyPrefs() {
      root.dataset.theme = prefs.theme; root.dataset.font = prefs.font;
      root.style.setProperty('--eb-size', prefs.size + 'px');
      root.querySelectorAll('[data-theme]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.theme === prefs.theme); });
      root.querySelectorAll('[data-font]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.font === prefs.font); });
      var mc = document.querySelector('meta[name=theme-color]'); if (mc) mc.content = getComputedStyle(root).getPropertyValue('--eb-bg').trim() || '#111';
    }
    applyPrefs();

    /* ---------- layout ---------- */
    function anchor() {
      var i = 0; for (var k = 0; k < pageOf.length; k++) { if (pageOf[k] <= cur) i = k; else break; }
      return { i: i, off: cur - (pageOf[i] || 0) };
    }
    function layout(keep) {
      var r = vp.getBoundingClientRect();
      W = Math.round(r.width); H = Math.round(r.height);
      var pad = W < 600 ? 22 : 40;
      book.style.cssText = 'height:' + H + 'px;width:' + (W - 2 * pad) + 'px;margin:0 ' + pad + 'px;column-width:' + (W - 2 * pad) + 'px;column-gap:' + (2 * pad) + 'px;';
      root.style.setProperty('--eb-h', H + 'px');
      book.style.transition = 'none';
      book.style.transform = 'translate3d(0,0,0)';
      var left = book.getBoundingClientRect().left - pad;
      pageOf = els.map(function (el) { return Math.max(0, Math.floor((el.getBoundingClientRect().left - left + 2) / W)); });
      pages = Math.max(1, Math.floor((book.lastElementChild.getBoundingClientRect().left - left + 2) / W) + 1);
      chapters = data.blocks.map(function (b, i) { return b.t === 'h1' ? { i: i, n: b.n, title: b.h, page: pageOf[i] } : null; }).filter(Boolean);
      chapters.forEach(function (c) { var pi = c.i - 1; if (pi >= 0 && data.blocks[pi].t === 'img') c.page = pageOf[pi]; });
      scrub.max = pages;
      buildToc();
      if (keep && typeof keep.i === 'number' && pageOf[keep.i] != null) cur = Math.min(pages - 1, pageOf[keep.i] + (keep.off || 0));
      go(cur, false);
    }
    function chapterAt(p) { var c = null; chapters.forEach(function (x) { if (x.page <= p) c = x; }); return c; }
    function go(p, animate) {
      cur = Math.max(0, Math.min(pages - 1, p));
      book.style.transition = animate === false ? 'none' : '';
      book.style.transform = 'translate3d(' + (-cur * W) + 'px,0,0)';
      scrub.value = cur + 1;
      $('.eb-pg', root).textContent = 'Page ' + (cur + 1) + ' of ' + pages;
      var c = chapterAt(cur), nx = c ? chapters[chapters.indexOf(c) + 1] : chapters[0];
      $('.eb-ch', root).innerHTML = c ? c.title : '&nbsp;';
      var left = nx ? nx.page - cur - 1 : pages - cur - 1;
      $('.eb-left', root).textContent = left > 0 ? left + (left === 1 ? ' page' : ' pages') + ' left in ' + (nx ? 'chapter' : 'book') : (nx ? 'Next: ' + nx.title.replace(/<[^>]+>/g, '') : 'The end');
      ls(KEY, anchor());
    }
    function next() { if (cur < pages - 1) go(cur + 1); }
    function prev() { if (cur > 0) go(cur - 1); }

    /* ---------- input: swipe, tap, keys, wheel ---------- */
    var sx = 0, sy = 0, dx = 0, drag = false, moved = false, t0 = 0;
    stage.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      sx = e.clientX; sy = e.clientY; dx = 0; drag = true; moved = false; t0 = Date.now();
      book.style.transition = 'none';
    });
    stage.addEventListener('pointermove', function (e) {
      if (!drag) return;
      dx = e.clientX - sx;
      if (!moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - sy)) { moved = true; try { stage.setPointerCapture(e.pointerId); } catch (x) {} }
      if (moved) {
        var edge = (cur === 0 && dx > 0) || (cur === pages - 1 && dx < 0) ? 0.3 : 1;
        book.style.transform = 'translate3d(' + (-cur * W + dx * edge) + 'px,0,0)';
      }
    });
    function end(e) {
      if (!drag) return; drag = false;
      if (moved) {
        var fast = Math.abs(dx) / Math.max(1, Date.now() - t0) > 0.4;
        if ((dx < -W * 0.18 || (fast && dx < -30)) && cur < pages - 1) go(cur + 1);
        else if ((dx > W * 0.18 || (fast && dx > 30)) && cur > 0) go(cur - 1);
        else go(cur);
        return;
      }
      if (e.type !== 'pointerup') return go(cur);
      if (e.target.closest && e.target.closest('a')) return;
      var x = e.clientX / window.innerWidth;
      if (x < 0.3) prev(); else if (x > 0.7) next(); else root.classList.toggle('eb-calm');
    }
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    stage.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    var wheelLock = 0;
    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      var d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(d) < 12 || Date.now() < wheelLock) return;
      wheelLock = Date.now() + 450; d > 0 ? next() : prev();
    }, { passive: false });
    document.addEventListener('keydown', function (e) {
      if (!root.isConnected || /input|textarea/i.test((e.target.tagName || ''))) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
      else if (e.key === 'Escape') sheet(null);
    });
    scrub.addEventListener('input', function () { $('.eb-pg', root).textContent = 'Page ' + scrub.value + ' of ' + pages; });
    scrub.addEventListener('change', function () { go(+scrub.value - 1, false); });

    /* ---------- sheets: contents, search, text settings ---------- */
    function sheet(name) {
      root.querySelectorAll('.eb-sheet').forEach(function (s) { s.hidden = s.dataset.s !== name || !s.hidden; });
      var open = root.querySelector('.eb-sheet:not([hidden])');
      root.classList.toggle('eb-sheet-open', !!open);
      if (open && name === 'find') setTimeout(function () { $('.eb-find input', root).focus(); }, 40);
    }
    root.querySelectorAll('[data-sheet]').forEach(function (b) { b.addEventListener('click', function () { sheet(b.dataset.sheet); }); });
    root.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', function () { sheet(null); }); });
    function item(label, page, html, cls) {
      var li = document.createElement('li'), bt = document.createElement('button'); bt.type = 'button';
      if (cls) li.className = cls;
      bt.innerHTML = '<span class="eb-l">' + label + '</span><span class="eb-t">' + html + '</span>' + (page != null ? '<span class="eb-p">' + (page + 1) + '</span>' : '');
      li.appendChild(bt); return { li: li, bt: bt };
    }
    function buildToc() {
      var ol = $('.eb-toc', root); ol.innerHTML = '';
      chapters.forEach(function (c) {
        var it = item(String(c.n).padStart(2, '0'), c.page, c.title, c === chapterAt(cur) ? 'on' : '');
        it.bt.addEventListener('click', function () { sheet(null); go(c.page, false); });
        ol.appendChild(it.li);
      });
    }
    $('.eb-find', root).addEventListener('submit', function (e) {
      e.preventDefault();
      var q = $('.eb-find input', root).value.trim(), ol = $('.eb-hits', root), note = $('.eb-note', root);
      ol.innerHTML = '';
      if (!q) { note.textContent = ''; return; }
      if (/^\d+$/.test(q)) { sheet(null); go(+q - 1, false); return; }
      if (!texts) texts = data.blocks.map(function (b) { return (b.h && b.t !== 'img' && b.t !== 'cover' ? b.h : (b.items || []).join(' ')).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&'); });
      var ql = q.toLowerCase(), n = 0;
      texts.forEach(function (t, i) {
        var tl = t.toLowerCase(), at = tl.indexOf(ql);
        while (at > -1 && n < 100) {
          var a = Math.max(0, at - 45), z = Math.min(t.length, at + q.length + 60);
          var snip = (a ? '…' : '') + esc(t.slice(a, at)) + '<mark>' + esc(t.slice(at, at + q.length)) + '</mark>' + esc(t.slice(at + q.length, z)) + (z < t.length ? '…' : '');
          var c = chapterAt(pageOf[i]);
          var it = item(c ? 'Ch ' + c.n : '—', pageOf[i], snip);
          (function (idx) { it.bt.addEventListener('click', function () { sheet(null); go(pageOf[idx], false); flash(els[idx]); }); })(i);
          ol.appendChild(it.li); n++;
          at = tl.indexOf(ql, at + q.length);
        }
      });
      note.textContent = n ? n + (n === 100 ? '+' : '') + (n === 1 ? ' result' : ' results') : 'No results for “' + q + '”.';
    });
    function flash(el) { if (!el) return; el.classList.add('eb-flash'); setTimeout(function () { el.classList.remove('eb-flash'); }, 1800); }
    root.querySelectorAll('[data-size]').forEach(function (b) { b.addEventListener('click', function () {
      var keep = anchor(); prefs.size = Math.max(14, Math.min(28, prefs.size + 2 * +b.dataset.size)); ls(PREFS, prefs); applyPrefs(); layout(keep);
    }); });
    root.querySelectorAll('[data-theme]').forEach(function (b) { b.addEventListener('click', function () { prefs.theme = b.dataset.theme; ls(PREFS, prefs); applyPrefs(); }); });
    root.querySelectorAll('[data-font]').forEach(function (b) { b.addEventListener('click', function () {
      var keep = anchor(); prefs.font = b.dataset.font; ls(PREFS, prefs); applyPrefs(); layout(keep);
    }); });

    var rt, lastW = 0, lastH = 0;
    function maybeRelayout() {
      clearTimeout(rt);
      rt = setTimeout(function () {
        if (!data) return;
        var r = vp.getBoundingClientRect();
        if (Math.abs(r.width - lastW) < 2 && Math.abs(r.height - lastH) < 2) return;
        lastW = r.width; lastH = r.height; layout(anchor());
      }, 150);
    }
    window.addEventListener('resize', maybeRelayout);
    if (window.ResizeObserver) new ResizeObserver(maybeRelayout).observe(vp);

    /* ---------- load ---------- */
    return decrypt(opts.key).then(function (d) {
      data = d;
      book.innerHTML = d.blocks.map(blockHTML).join('') + '<div class="eb-end" aria-hidden="true"></div>';
      els = Array.prototype.slice.call(book.querySelectorAll('[data-i]'));
      return (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve());
    }).then(function () {
      root.classList.add('eb-ready');
      var r = vp.getBoundingClientRect(); lastW = r.width; lastH = r.height;
      layout(ls(KEY));
      if (cur > 0) { var c = chapterAt(cur); toast('Picked up where you left off' + (c ? ': ' + c.title.replace(/<[^>]+>/g, '') : '')); }
      stage.focus({ preventScroll: true });
    });
    function toast(msg) {
      var t = document.createElement('div'); t.className = 'eb-toast'; t.textContent = msg; root.appendChild(t);
      setTimeout(function () { t.classList.add('out'); }, 2600); setTimeout(function () { t.remove(); }, 3200);
    }
  }
  window.MNReader = { start: start };
})();
