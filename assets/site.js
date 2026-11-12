/* mannorr.com: shared script for every page */
(function () {
  /* Google Apps Script web app (MANNORR Database). See apps-script/README.md. */
  var DB_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwkaHoaKJr2C98juyAmhcGF6GqiTQVnZ9B70Ezws0HBSpldg9Uod5BbwGTvxAGfidCeNQ/exec';
  var FALLBACK = 'https://formspree.io/f/mldqqvra';
  var EMAIL = 'hellomannorr@gmail.com';
  var openedAt = Date.now();
  var page = document.body.getAttribute('data-page');
  function $(id) { return document.getElementById(id); }
  function store(k, v) { try { if (v === undefined) return JSON.parse(sessionStorage.getItem(k) || 'null'); sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }

  /* ---------- analytics (Vercel Web Analytics) ----------
     Turn it on once in the Vercel dashboard: Project → Analytics → Enable.
     If the dashboard gives you a different script path, change ANALYTICS_SRC. */
  var ANALYTICS_SRC = '/_vercel/insights/script.js';
  var LIVE = /(^|\.)mannorr\.com$/.test(location.hostname);
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  if (LIVE && ['admin', 'content', 'studio'].indexOf(page) < 0) {
    var as = document.createElement('script'); as.defer = true; as.src = ANALYTICS_SRC; document.head.appendChild(as);
  }
  function track(name, data) { try { window.va('event', { name: name, data: data || {} }); } catch (e) {} }

  /* ---------- where the visitor came from ----------
     Kept from the first page of the visit and saved with every form and book order
     (the Source column in the sheet), so you can see what brings enquiries and sales. */
  var SOURCE = (function () {
    var had = store('mn_src'); if (had) return had;
    var q = new URLSearchParams(location.search), parts = [], ref = '';
    try { ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; } catch (e) {}
    if (ref === location.hostname.replace(/^www\./, '') || /flutterwave/.test(ref)) ref = '';
    var utm = [q.get('utm_source'), q.get('utm_medium'), q.get('utm_campaign')].filter(Boolean).join(' / ');
    if (utm) parts.push(utm);
    if (ref) parts.push('from ' + ref);
    if (!parts.length) parts.push('direct');
    parts.push('landed on ' + location.pathname);
    var v = parts.join(' · ').slice(0, 280);
    store('mn_src', v); return v;
  })();

  /* ---------- navbar ---------- */
  var menuBtn = $('menubtn'), menu = $('menu');
  function setMenu(open) {
    menu.hidden = !open;
    menuBtn.setAttribute('aria-expanded', open);
    menuBtn.querySelector('.menubtn-label').textContent = open ? 'Close' : 'Menu';
    document.body.classList.toggle('menu-open', open);
  }
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', function () { setMenu(menu.hidden); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  }
  function markNav() {
    var here = page;
    if (page === 'work-with-me' && location.hash === '#learn') here = 'learn';
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      var on = a.getAttribute('data-nav').split(' ').indexOf(here) > -1;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  markNav();
  window.addEventListener('hashchange', markNav);

  /* ---------- sending ---------- */
  function send(fd, formKey) {
    fd.append('form', formKey); fd.append('page', location.pathname + location.hash); fd.append('t', String(Date.now() - openedAt)); fd.append('source', SOURCE);
    if (DB_ENDPOINT) {
      var timer = new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, 20000); });
      return Promise.race([fetch(DB_ENDPOINT, { method: 'POST', body: fd }).then(function (r) { return r.json(); }), timer])
        .catch(function () {
          /* reply unreadable: send blind to the sheet and keep a copy in Formspree so nothing is lost */
          var copy = new FormData(); fd.forEach(function (v, k) { copy.append(k, v); }); copy.append('_subject', 'mannorr.com · ' + formKey + ' (backup)');
          return Promise.allSettled([
            fetch(DB_ENDPOINT, { method: 'POST', body: fd, mode: 'no-cors' }),
            fetch(FALLBACK, { method: 'POST', body: copy, headers: { 'Accept': 'application/json' } })
          ]).then(function () { return { ok: true, ref: '' }; });
        });
    }
    fd.append('_subject', 'mannorr.com · ' + formKey);
    return fetch(FALLBACK, { method: 'POST', body: fd, headers: { 'Accept': 'application/json' } }).then(function (r) { return { ok: r.ok }; });
  }

  /* ---------- Work With Me: lanes and forms ---------- */
  var LANES = {
    design: { lede: 'Brand identity and direction <span class="red">for teams that care.</span>',
      offer: [['Brand identity systems', 'Identity'], ['Creative direction', 'Direction'], ['Campaign development', 'Campaign'], ['Design systems', 'Systems']],
      steps: ['Send an enquiry', 'Discovery call', 'Proposal and timeline', 'Design and review', 'Handover and guidelines'] },
    ministry: { lede: 'Worship and teaching <span class="red">for your congregation.</span>',
      offer: [['Worship ministration', 'Song'], ['Teaching and apologetics talks', 'Word'], ['Design in ministry training', 'Workshop']],
      steps: ['Send a request', 'Confirm the date and brief', 'Logistics and travel', 'Ministration'] },
    learn: { lede: 'Learn design <span class="red">with me.</span>',
      offer: [['Two-month programme', '8 weeks'], ['Weekly hands-on session', '1:1 or small group'], ['Assignments between sessions', 'Real briefs'], ['Social and marketing graphics in Photoshop', 'Beginner friendly']],
      steps: ['Apply', 'A short call', 'Confirm your place and schedule', 'Weekly sessions and assignments'] }
  };
  function setLane(l, push) {
    var d = LANES[l]; if (!d) return;
    Object.keys(LANES).forEach(function (k) { var b = $('lane-' + k); if (b) b.setAttribute('aria-pressed', k === l); });
    $('lane-lede').innerHTML = d.lede;
    $('lane-offer').innerHTML = d.offer.map(function (o) { return '<li>' + o[0] + ' <span class="mono">' + o[1] + '</span></li>'; }).join('');
    $('lane-steps').innerHTML = d.steps.map(function (x) { return '<li>' + x + '</li>'; }).join('');
    $('lane-pkg').hidden = (l !== 'design');
    $('lane-note').hidden = (l !== 'learn');
    document.querySelectorAll('.lane-form').forEach(function (f) { f.hidden = (f.getAttribute('data-form') !== l); });
    if (push && history.replaceState) history.replaceState(null, '', l === 'design' ? location.pathname : '#' + l);
    markNav();
  }
  if ($('lane-design')) {
    Object.keys(LANES).forEach(function (k) { $('lane-' + k).addEventListener('click', function () { setLane(k, true); }); });
    var fromHash = function () { var h = location.hash.slice(1); setLane(LANES[h] ? h : 'design'); };
    fromHash();
    window.addEventListener('hashchange', fromHash);
  }

  /* Design budget: naira ranges for clients in Nigeria, euro ranges (matching /packages) for everyone else. */
  var BUDGETS = {
    ng: ['Under ₦300k', '₦300k – ₦1m', '₦1m+', 'Not sure yet'],
    intl: ['Under €1,200', '€1,200 – €3,500', '€3,500+', 'Not sure yet']
  };
  var region = $('d-region'), budget = $('d-budget');
  if (region && budget) {
    var inNigeria = false; try { inNigeria = /Lagos/.test(Intl.DateTimeFormat().resolvedOptions().timeZone || ''); } catch (e) {}
    var setRegion = function (r) {
      region.value = r;
      budget.innerHTML = BUDGETS[r].map(function (b) { return '<option>' + b + '</option>'; }).join('');
      var pk = $('lane-pkg-note'); if (pk) pk.textContent = r === 'ng' ? 'Projects in Nigeria are quoted in naira after a short call.' : 'Guide prices in EUR, USD and GBP.';
    };
    region.addEventListener('change', function () { setRegion(region.value); });
    setRegion(inNigeria ? 'ng' : 'intl');
  }

  var NAMES = { name: 'name', email: 'email', phone: 'phone number' };
  document.querySelectorAll('.lane-form').forEach(function (f) {
    var btn = f.querySelector('button[type=submit]'), label = btn.textContent;
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var key = f.getAttribute('data-form'), note = f.querySelector('.formnote');
      note.className = 'formnote';
      var trapped = !!(f.querySelector('[name=mn_trap_x]') || {}).value;
      var miss = Array.prototype.filter.call(f.querySelectorAll('[required]'), function (el) { return !el.value.trim(); });
      if (miss.length) { note.className = 'formnote is-error'; note.textContent = 'Please add your ' + miss.map(function (el) { return NAMES[el.name] || el.name; }).join(', ') + '.'; miss[0].focus(); return; }
      var fd = new FormData();
      Array.prototype.forEach.call(f.querySelectorAll('.field [name]'), function (el) { fd.append(el.name, el.value.trim()); });
      btn.disabled = true; btn.classList.add('is-busy'); btn.textContent = 'Sending…';
      note.className = 'formnote is-info'; note.textContent = 'Sending your details. This can take a few seconds.';
      var who = { name: f.querySelector('[name=name]').value.trim(), email: f.querySelector('[name=email]').value.trim() };
      (trapped ? Promise.resolve({ ok: true, ref: '' }) : send(fd, key)).then(function (r) {
        if (r && r.ok) {
          store('mn_sent', { form: key, name: who.name, email: who.email, ref: r.ref || '' });
          track('Enquiry sent', { lane: key });
          location.href = '/thank-you?f=' + key + (r.ref ? '&ref=' + encodeURIComponent(r.ref) : '');
        } else { note.className = 'formnote is-error'; note.textContent = (r && r.error) || "That didn't send. Please try again, or email " + EMAIL + '.'; }
      }).catch(function () { note.className = 'formnote is-error'; note.textContent = "That didn't send. Please try again, or email " + EMAIL + '.'; })
        .then(function () { btn.disabled = false; btn.classList.remove('is-busy'); btn.textContent = label; });
    });
  });

  /* ---------- sign-up forms (In You, The Opened Veil, Viral Church, Apologetics, paperback abroad) ----------
     Any <form class="notify" data-interest="…"> works. An optional [name=country] field is added to the interest. */
  document.querySelectorAll('form.notify:not(#resend)').forEach(function (notify) {
    notify.addEventListener('submit', function (e) {
      e.preventDefault();
      var note = notify.querySelector('.formnote'), btn = notify.querySelector('button[type=submit]'), label = btn.textContent;
      if ((notify.querySelector('[name=mn_trap_x]') || {}).value) { note.textContent = "You're on the list."; return; }
      var em = notify.querySelector('[name=email]').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { note.textContent = 'Please check your email address.'; return; }
      var interest = notify.getAttribute('data-interest') || 'In You release', country = notify.querySelector('[name=country]');
      if (country) { if (!country.value.trim()) { note.textContent = 'Please add your country.'; country.focus(); return; } interest += ' · ' + country.value.trim(); }
      var fd = new FormData(); fd.append('email', em); fd.append('interest', interest);
      btn.disabled = true; btn.textContent = 'Adding you…'; note.textContent = '';
      send(fd, 'updates').then(function (r) {
        note.textContent = r && r.ok ? "You're on the list. Check your inbox for a confirmation." : ((r && r.error) || "That didn't work. Please try again.");
        if (r && r.ok) { track('Signed up', { interest: notify.getAttribute('data-interest') || 'In You release' }); notify.reset(); }
      }).catch(function () { note.textContent = "That didn't work. Please try again."; })
        .then(function () { btn.disabled = false; btn.textContent = label; });
    });
  });

  /* ---------- thank-you page ---------- */
  var THANKS = {
    design: { kicker: 'Design enquiry', title: 'Your project enquiry is in.', intro: 'Thank you for thinking of me for your project. I read every brief myself and will come back to you with questions or a time to talk.', steps: ['I review your brief', 'A short discovery call', 'A proposal, timeline and next steps'] },
    ministry: { kicker: 'Ministry booking', title: 'Your booking request is in.', intro: "Thank you for inviting me. I'll pray over it, check the date, and get back to you to confirm the details.", steps: ['I check the date and pray over it', 'We confirm the brief and logistics', 'The ministration'] },
    'book-digital': { kicker: 'Our Space · Digital', title: 'Your book is ready to read.', intro: 'Thank you for getting Our Space. Your personal reading link is in your email, and you can start reading right now.', steps: ['Tap Start reading, or use the link in your email', 'Read on any phone, tablet or computer', 'Keep the email so you can come back any time'] },
    'book-paperback': { kicker: 'Our Space · Paperback', title: 'Your copy is on its way.', intro: 'Thank you for ordering Our Space. Your payment is confirmed and your paperback will be delivered to the address you gave.', steps: ['We pack your copy', 'We send it to your address', "You'll get a message when it's on its way"] },
    'book-pending': { kicker: 'Our Space', title: "Your payment is being confirmed.", intro: "Thank you for your payment. We're confirming it with Flutterwave, and you'll get an email as soon as it's done.", steps: ['Watch your inbox (and spam) for an email from MANNORR', 'Nothing within a few hours? Email hellomannorr@gmail.com with your reference'] },
    'book-cancelled': { kicker: 'Our Space', title: "Your payment wasn't completed.", intro: "No money was taken for this order. If something went wrong, you can try again, or pay by bank transfer and email hellomannorr@gmail.com.", steps: ['Go back to the book page', 'Choose your edition and pay again'] },
    learn: { kicker: 'Student application', title: 'Your application is in.', intro: "Thank you for wanting to learn design with me. I'll go through your application and reach out on WhatsApp about the next steps.", steps: ['I review your application', 'A short call on WhatsApp', 'We confirm your place and schedule'] }
  };
  if (page === 'thank-you' && !/[?&](status|transaction_id)=/.test(location.search)) {
    var q = new URLSearchParams(location.search), sent = store('mn_sent') || {};
    var key = q.get('f') || sent.form, t = THANKS[key];
    if (t) {
      var first = (sent.name || '').split(' ')[0], ref = q.get('ref') || sent.ref || '';
      $('ty-kicker').textContent = t.kicker;
      $('ty-hello').textContent = 'Thank you' + (first ? ', ' + first : '') + '.';
      $('ty-title').textContent = t.title;
      $('ty-intro').textContent = t.intro;
      var rf = $('ty-ref'); rf.hidden = !ref; rf.textContent = ref ? 'Reference ' + ref : '';
      $('ty-steps').innerHTML = t.steps.map(function (x) { return '<li>' + x + '</li>'; }).join('');
      $('ty-mail').textContent = 'A confirmation is on its way to ' + (sent.email || 'your inbox') + ". If you can't see it in a few minutes, check your spam or promotions folder.";
      if (key === 'book-digital' && sent.code && $('ty-read')) { $('ty-read').href = '/read?code=' + encodeURIComponent(sent.code); $('ty-read').hidden = false; }
    }
  }


  /* ---------- Book: Our Space ---------- */
  var BOOK = {
    prices: { digital: 7000, paperback: 13000 },   /* paperback includes delivery anywhere in Nigeria */
    links: { digital: 'https://flutterwave.com/pay/qlnbvtyva9gp', paperback: 'https://flutterwave.com/pay/wmu0epx7tldq' }
  };
  function naira(n) { return '₦' + Number(n).toLocaleString('en-NG'); }
  function post(fields) {
    var fd = new FormData(); Object.keys(fields).forEach(function (k) { fd.append(k, fields[k]); });
    return fetch(DB_ENDPOINT, { method: 'POST', body: fd }).then(function (r) { return r.json(); });
  }
  function keep(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (x) {} store(k, v); }
  function recall(k) { var v = store(k); if (v) return v; try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (x) { return null; } }
  function forget(k) { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (x) {} }

  var buy = $('buy-form');
  if (buy) (function () {
    var fmt = 'digital', state = $('b-state'), payBtn = $('b-pay'), note = $('b-note');
    function render() {
      var price = BOOK.prices[fmt];
      $('b-summary').innerHTML = '<li>Our Space · ' + (fmt === 'paperback' ? 'Paperback' : 'Digital edition') + ' <span class="mono">' + naira(price) + '</span></li>' +
        (fmt === 'paperback' ? '<li>Delivery' + (state.value ? ' to ' + state.value : ' in Nigeria') + ' <span class="mono">Included</span></li>' : '') +
        '<li class="total">Total <span class="mono">' + naira(price) + '</span></li>';
      $('b-price').textContent = naira(price);
      $('b-price-note').textContent = fmt === 'paperback' ? 'Paperback · delivery included' : 'Digital edition · read instantly';
      payBtn.textContent = 'Pay ' + naira(price) + ' →';
    }
    function setFmt(f) {
      fmt = f;
      $('fmt-digital').setAttribute('aria-pressed', f === 'digital'); $('fmt-paperback').setAttribute('aria-pressed', f === 'paperback');
      $('info-digital').hidden = f !== 'digital'; $('info-paperback').hidden = f !== 'paperback';
      if ($('abroad-digital')) { $('abroad-digital').hidden = f !== 'digital'; $('abroad-paperback').hidden = f !== 'paperback'; }
      buy.querySelectorAll('.paper').forEach(function (el) { el.hidden = f !== 'paperback'; });
      $('b-phone').required = f === 'paperback';
      note.textContent = ''; note.className = 'formnote';
      render();
    }
    $('fmt-digital').addEventListener('click', function () { setFmt('digital'); });
    $('fmt-paperback').addEventListener('click', function () { setFmt('paperback'); });
    state.addEventListener('change', render);
    setFmt(location.hash === '#paperback' ? 'paperback' : 'digital');

    function err(msg) { note.className = 'formnote is-error'; note.textContent = msg; }
    buy.addEventListener('submit', function (e) {
      e.preventDefault();
      if ((buy.querySelector('[name=mn_trap_x]') || {}).value) return;
      var v = function (id) { return $(id).value.trim(); };
      var who = { name: v('b-name'), email: v('b-email'), phone: v('b-phone') };
      if (!who.name || !who.email) return err('Please add your name and email.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(who.email)) return err('Please check your email address.');
      if (fmt === 'paperback' && (!state.value || !v('b-city') || !v('b-address') || !who.phone)) return err('Please add your phone number, state, city and delivery address.');
      payBtn.disabled = true; payBtn.classList.add('is-busy'); payBtn.textContent = 'Saving your order…';
      note.className = 'formnote is-info'; note.textContent = "You'll be taken to Flutterwave to pay securely. Use the same email there.";
      post({ form: 'order-start', format: fmt, name: who.name, email: who.email, phone: who.phone, state: state.value, city: v('b-city'), address: v('b-address'), source: SOURCE })
        .then(function (r) {
          if (!r || !r.ok) throw new Error((r && r.error) || '');
          keep('mn_order', { ref: r.ref, format: fmt, name: who.name, email: who.email, at: Date.now() });
          track('Checkout started', { format: fmt });
          payBtn.textContent = 'Opening Flutterwave…';
          location.href = r.pay_url || BOOK.links[fmt];
        })
        .catch(function (x) {
          payBtn.disabled = false; payBtn.classList.remove('is-busy'); render();
          err((x && x.message) || "We couldn't save your order. Please check your connection and try again.");
        });
    });
  })();

  /* Flutterwave sends buyers back to /thank-you?status=…&tx_ref=…&transaction_id=… */
  if (page === 'thank-you') (function () {
    var q = new URLSearchParams(location.search), status = q.get('status'), tid = q.get('transaction_id');
    if (!status && !tid) return;
    var order = recall('mn_order') || {}, first = (order.name || '').split(' ')[0];
    function show(key, extra) {
      var t = THANKS[key]; if (!t) return;
      $('ty-kicker').textContent = t.kicker;
      $('ty-hello').textContent = 'Thank you' + (first ? ', ' + first : '') + '.';
      $('ty-title').textContent = t.title; $('ty-intro').textContent = t.intro;
      var rf = $('ty-ref'), ref = (extra && extra.ref) || order.ref || '';
      rf.hidden = !ref; rf.textContent = ref ? 'Reference ' + ref : '';
      $('ty-steps').innerHTML = t.steps.map(function (x) { return '<li>' + x + '</li>'; }).join('');
      $('ty-mail').textContent = key === 'book-cancelled' ? 'Your order is saved. You can go back and pay whenever you are ready.' : 'An email is on its way to ' + (order.email || 'the address you paid with') + ". If you can't see it in a few minutes, check your spam or promotions folder.";
      if (extra && extra.code) { $('ty-read').href = '/read?code=' + encodeURIComponent(extra.code); $('ty-read').hidden = false; $('ty-read').textContent = 'Start reading →'; }
      if (key === 'book-cancelled') { $('ty-read').href = '/our-space#buy'; $('ty-read').hidden = false; $('ty-read').textContent = 'Try again →'; }
    }
    if (status === 'cancelled' || status === 'failed') { show('book-cancelled'); return; }
    $('ty-kicker').textContent = 'Our Space'; $('ty-hello').textContent = 'One moment.'; $('ty-title').textContent = 'Confirming your payment…';
    $('ty-intro').textContent = 'This takes a few seconds. Please keep this page open.'; $('ty-steps').innerHTML = '';
    var tries = 0;
    (function attempt() {
      post({ form: 'order-confirm', ref: order.ref || '', transaction_id: tid || '', status: status || '' }).then(function (r) {
        if (r && r.ok) { track('Book bought', { format: r.format }); forget('mn_order'); store('mn_sent', { form: 'book-' + r.format, name: order.name, email: order.email, ref: r.ref, code: r.code || '' }); show('book-' + r.format, r); }
        else if (r && r.cancelled) show('book-cancelled');
        else if (++tries < 3 && r && r.pending && !r.ref) setTimeout(attempt, 3000);
        else show('book-pending', r);
      }).catch(function () { if (++tries < 3) setTimeout(attempt, 3000); else show('book-pending'); });
    })();
  })();

  /* ---------- Reader: paid copies only ---------- */
  if (page === 'read') (function () {
    var code = new URLSearchParams(location.search).get('code') || '', reader = $('reader'), scale = 1, pdf = null, email = '';
    function showMsg(title, text) { $('r-msg').hidden = false; $('r-msg-title').textContent = title; if (text) $('r-msg-text').textContent = text; $('r-who').textContent = 'Private reader'; }
    reader.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    var rs = $('resend');
    rs.addEventListener('submit', function (e) {
      e.preventDefault();
      var em = $('r-email').value.trim(), n = $('r-note');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { n.textContent = 'Please check your email address.'; return; }
      n.textContent = 'Sending…';
      post({ form: 'order-resend', email: em }).then(function (r) { n.textContent = (r && r.message) || 'If that email bought the digital edition, a fresh link is on its way.'; })
        .catch(function () { n.textContent = "That didn't work. Please try again, or email " + EMAIL + '.'; });
    });
    if (!code) return showMsg('Find your book');
    var KEY = 'mn_read_' + code.slice(0, 16), cur = 1, ratio = 1.414, lastW = 0, texts = null, bar = document.querySelector('.reader-bar');
    function saved() { try { return +localStorage.getItem(KEY) || 1; } catch (x) { return 1; } }
    function setCur(n) { cur = n; if (document.activeElement !== $('r-num')) $('r-num').value = n; try { localStorage.setItem(KEY, n); } catch (x) {} }
    function pageEl(n) { return reader.querySelector('.rpage[data-n="' + n + '"]'); }
    function offset() { return ($('topbar') ? $('topbar').offsetHeight : 60) + (bar ? bar.offsetHeight : 60) + 12; }
    function go(n, flash) {
      n = Math.max(1, Math.min(pdf.numPages, Math.round(+n) || 1));
      var el = pageEl(n); if (!el) return;
      window.scrollTo(0, el.getBoundingClientRect().top + window.pageYOffset - offset());
      setCur(n);
      if (flash) { el.classList.add('hit'); setTimeout(function () { el.classList.remove('hit'); }, 1600); }
    }
    var io, counter;
    function draw() {
      var keep = cur;
      if (io) io.disconnect(); if (counter) counter.disconnect();
      reader.innerHTML = '';
      lastW = reader.clientWidth;
      var width = Math.min(lastW || 800, 880) * scale;
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var el = en.target;
          if (!en.isIntersecting || el.dataset.done) return;
          el.dataset.done = '1';
          pdf.getPage(+el.dataset.n).then(function (pg) {
            var vp1 = pg.getViewport({ scale: 1 }), s = width / vp1.width, dpr = Math.min(window.devicePixelRatio || 1, 2);
            var vp = pg.getViewport({ scale: s * dpr }), c = document.createElement('canvas');
            c.width = vp.width; c.height = vp.height;
            el.insertBefore(c, el.firstChild);
            pg.render({ canvasContext: c.getContext('2d'), viewport: vp });
          });
        });
      }, { rootMargin: '800px 0px', threshold: 0.01 });
      counter = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) setCur(+en.target.dataset.n); });
      }, { rootMargin: '-45% 0px -45% 0px' });
      var wm = email.replace(/[<>&"]/g, '');
      for (var i = 1; i <= pdf.numPages; i++) {
        var d = document.createElement('div'); d.className = 'rpage'; d.dataset.n = i; d.style.width = width + 'px'; d.style.aspectRatio = '1/' + ratio;
        d.innerHTML = '<div class="wm" aria-hidden="true"><span>' + wm + ' · mannorr.com</span></div><span class="pn">' + i + '</span>';
        reader.appendChild(d); io.observe(d); counter.observe(d);
      }
      go(keep);
    }
    $('r-in').addEventListener('click', function () { scale = Math.min(scale + 0.15, 1.6); draw(); });
    $('r-out').addEventListener('click', function () { scale = Math.max(scale - 0.15, 0.6); draw(); });
    /* phones fire "resize" when the address bar shows or hides; only redraw when the width really changes */
    var rt; window.addEventListener('resize', function () { if (!pdf) return; clearTimeout(rt); rt = setTimeout(function () { if (Math.abs(reader.clientWidth - lastW) > 40) draw(); }, 250); });

    /* go to page */
    $('r-go').addEventListener('submit', function (e) { e.preventDefault(); go($('r-num').value, true); $('r-num').blur(); });
    $('r-num').addEventListener('change', function () { go(this.value, true); });

    /* panels */
    function panel(which) {
      ['find', 'toc'].forEach(function (k) {
        var open = k === which && $('r-' + k).hidden;
        $('r-' + k).hidden = !open; $('r-' + k + '-btn').setAttribute('aria-expanded', open);
      });
      if (!$('r-find').hidden) setTimeout(function () { $('r-q').focus(); }, 30);
    }
    $('r-find-btn').addEventListener('click', function () { panel('find'); });
    $('r-toc-btn').addEventListener('click', function () { panel('toc'); });
    function closePanels() { panel(null); }
    function hitButton(n, html, sub) {
      var li = document.createElement('li'); if (sub) li.className = 'sub';
      var bt = document.createElement('button'); bt.type = 'button';
      bt.innerHTML = '<span class="pg">p. ' + n + '</span><span>' + html + '</span>';
      bt.addEventListener('click', function () { closePanels(); go(n, true); });
      li.appendChild(bt); return li;
    }
    function esc(x) { return String(x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    /* search */
    function loadTexts() {
      if (texts) return Promise.resolve(texts);
      var jobs = [];
      for (var i = 1; i <= pdf.numPages; i++) jobs.push(pdf.getPage(i).then(function (p) { return p.getTextContent(); }).then(function (tc) {
        return tc.items.map(function (it) { return it.str; }).join(' ').replace(/\s+/g, ' ');
      }));
      return Promise.all(jobs).then(function (a) { texts = a; return a; });
    }
    $('r-find-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var q = $('r-q').value.trim(), list = $('r-results'), note = $('r-find-note');
      list.innerHTML = '';
      if (!q) { note.textContent = ''; return; }
      if (/^\d+$/.test(q)) { closePanels(); go(+q, true); return; }
      note.textContent = 'Searching…';
      loadTexts().then(function (pages) {
        var ql = q.toLowerCase(), hits = 0;
        pages.forEach(function (t, i) {
          var tl = t.toLowerCase(), at = tl.indexOf(ql), shown = 0;
          while (at > -1 && shown < 3 && hits < 80) {
            var a = Math.max(0, at - 50), b = Math.min(t.length, at + q.length + 70);
            var snip = (a ? '…' : '') + esc(t.slice(a, at)) + '<mark>' + esc(t.slice(at, at + q.length)) + '</mark>' + esc(t.slice(at + q.length, b)) + (b < t.length ? '…' : '');
            list.appendChild(hitButton(i + 1, snip)); hits++; shown++;
            at = tl.indexOf(ql, at + q.length);
          }
        });
        note.textContent = hits ? hits + (hits === 80 ? '+' : '') + ' result' + (hits === 1 ? '' : 's') + '. Tap one to jump there.' : 'No results for "' + q + '".';
      });
    });

    /* contents, from the book's own chapter list */
    function buildToc() {
      pdf.getOutline().then(function (items) {
        if (!items || !items.length) return;
        var ul = $('r-toc-list');
        function resolve(dest) {
          return (typeof dest === 'string' ? pdf.getDestination(dest) : Promise.resolve(dest)).then(function (d) {
            return d && d[0] ? pdf.getPageIndex(d[0]).then(function (ix) { return ix + 1; }) : null;
          }).catch(function () { return null; });
        }
        var flat = [];
        items.forEach(function (it) { flat.push([it, false]); (it.items || []).forEach(function (s) { flat.push([s, true]); }); });
        Promise.all(flat.map(function (f) { return resolve(f[0].dest); })).then(function (pages) {
          flat.forEach(function (f, i) { if (pages[i]) ul.appendChild(hitButton(pages[i], esc(f[0].title), f[1])); });
          if (ul.children.length) $('r-toc-btn').hidden = false;
        });
      }).catch(function () {});
    }

    fetch(DB_ENDPOINT + '?action=read&mode=text&code=' + encodeURIComponent(code)).then(function (r) { return r.json(); }).then(function (r) {
      if (!r || !r.ok) return showMsg("This link didn't open", (r && r.error ? r.error + ' ' : '') + 'Enter the email you used to buy the book and we will send you a fresh link.');
      email = r.email || '';
      if (r.key && window.MNReader && window.crypto && crypto.subtle) {
        $('r-who').textContent = 'Reading as ' + (r.name || email);
        return window.MNReader.start({ code: code, key: r.key, email: email, name: r.name }).catch(function () {
          document.documentElement.classList.remove('eb-open'); var eb = document.querySelector('.eb'); if (eb) eb.remove();
          showMsg("This link didn't open", "We couldn't open the book just now. Please refresh the page.");
        });
      }
      if (!r.data) return showMsg("This link didn't open", "We couldn't load the book just now. Please refresh, or enter your email for a fresh link.");
      $('r-who').textContent = 'Reading as ' + (r.name || email);
      var bin = atob(r.data), bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var lib = window.pdfjsLib;
      lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      return lib.getDocument({ data: bytes }).promise.then(function (doc) {
        pdf = doc; $('r-tools').hidden = false; $('r-total').textContent = '/ ' + pdf.numPages; $('r-num').max = pdf.numPages;
        return pdf.getPage(1).then(function (p1) { var v = p1.getViewport({ scale: 1 }); ratio = v.height / v.width; });
      }).then(function () {
        var back = saved();
        cur = back > 1 && back <= pdf.numPages ? back : 1;
        draw();
        if (cur > 1) $('r-who').textContent += ' · picked up at page ' + cur;
        buildToc();
      });
    }).catch(function () { showMsg("This link didn't open", "We couldn't load the book just now. Please refresh, or enter your email for a fresh link."); });
  })();

  /* ---------- Design: live projects from the store the admin page manages ---------- */
  var box = $('dsWork');
  if (box) (function () {
    var API = 'https://api.jsonbin.io/v3/b', PROJ = '69c12f68c3097a1dd54fdec5', ARCH = '69a1b1b8d0ea881f40df36ba';
    var CATS = { brand: 'Brand Identity', visual: 'Visual Design', print: 'Print & Packaging', event: 'Events', web: 'Website Design' };
    function get(id) { return fetch(API + '/' + id + '/latest').then(function (r) { if (!r.ok) throw r.status; return r.json(); }).then(function (j) { return j.record; }); }
    function cld(u, t) { return typeof u === 'string' && u.indexOf('/upload/') > -1 ? u.replace('/upload/', '/upload/' + t + '/') : u; }
    function esc(x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    Promise.allSettled([get(PROJ), get(ARCH)]).then(function (res) {
      var hidden = res[1].status === 'fulfilled' ? (res[1].value && res[1].value.siteHidden) || [] : [];
      var list = res[0].status === 'fulfilled' ? ((res[0].value && res[0].value.projects) || res[0].value || []) : [];
      list = list.filter(function (p) { return p && p.visible !== false && hidden.indexOf(p.id) < 0 && p.media && p.media.length && p.media[0].type !== 'video'; });
      list.sort(function (a, b) { return (b.featured ? 1 : 0) - (a.featured ? 1 : 0); });
      var pick = list.slice(0, 4);
      if (!pick.length) { box.innerHTML = '<p class="mono dim">See the full portfolio for selected work.</p>'; return; }
      box.innerHTML = pick.map(function (p) {
        var img = cld(p.media[0].url, 'w_900,c_limit,q_auto,f_auto'), blur = cld(p.media[0].url, 'w_80,q_auto,f_auto');
        return '<a class="card" href="/portfolio"><div class="media fit"><img class="fit-bg" src="' + esc(blur) + '" alt="" aria-hidden="true" loading="lazy"><img class="fit-fg" src="' + esc(img) + '" alt="' + esc(p.title) + '" loading="lazy"><span class="chip">' + esc(CATS[p.cat] || p.cat) + '</span>' + (p.year ? '<span class="onimg">' + esc(p.year) + '</span>' : '') + '</div><h3>' + esc(p.title) + '</h3><p class="cdesc">' + esc(CATS[p.cat] || '') + '</p></a>';
      }).join('');
    }).catch(function () {});
  })();
})();
