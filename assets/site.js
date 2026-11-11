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
    fd.append('form', formKey); fd.append('page', location.pathname + location.hash); fd.append('t', String(Date.now() - openedAt));
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
          location.href = '/thank-you?f=' + key + (r.ref ? '&ref=' + encodeURIComponent(r.ref) : '');
        } else { note.className = 'formnote is-error'; note.textContent = (r && r.error) || "That didn't send. Please try again, or email " + EMAIL + '.'; }
      }).catch(function () { note.className = 'formnote is-error'; note.textContent = "That didn't send. Please try again, or email " + EMAIL + '.'; })
        .then(function () { btn.disabled = false; btn.classList.remove('is-busy'); btn.textContent = label; });
    });
  });

  /* ---------- In You waitlist ---------- */
  var notify = $('notify');
  if (notify) notify.addEventListener('submit', function (e) {
    e.preventDefault();
    var note = $('notifynote'), btn = notify.querySelector('button[type=submit]'), label = btn.textContent;
    if ((notify.querySelector('[name=mn_trap_x]') || {}).value) { note.textContent = "You're on the list."; return; }
    var em = notify.querySelector('[name=email]').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { note.textContent = 'Please check your email address.'; return; }
    var fd = new FormData(); fd.append('email', em); fd.append('interest', 'In You release');
    btn.disabled = true; btn.textContent = 'Adding you…'; note.textContent = '';
    send(fd, 'updates').then(function (r) {
      note.textContent = r && r.ok ? "You're on the list. Check your inbox for a confirmation." : ((r && r.error) || "That didn't work. Please try again.");
      if (r && r.ok) notify.reset();
    }).catch(function () { note.textContent = "That didn't work. Please try again."; })
      .then(function () { btn.disabled = false; btn.textContent = label; });
  });

  /* ---------- thank-you page ---------- */
  var THANKS = {
    design: { kicker: 'Design enquiry', title: 'Your project enquiry is in.', intro: 'Thank you for thinking of me for your project. I read every brief myself and will come back to you with questions or a time to talk.', steps: ['I review your brief', 'A short discovery call', 'A proposal, timeline and next steps'] },
    ministry: { kicker: 'Ministry booking', title: 'Your booking request is in.', intro: "Thank you for inviting me. I'll pray over it, check the date, and get back to you to confirm the details.", steps: ['I check the date and pray over it', 'We confirm the brief and logistics', 'The ministration'] },
    'book-digital': { kicker: 'Our Space · Digital', title: 'Your book is ready to read.', intro: 'Thank you for getting Our Space. Your personal reading link is in your email, and you can start reading right now.', steps: ['Tap Start reading, or use the link in your email', 'Read on any phone, tablet or computer', 'Keep the email so you can come back any time'] },
    'book-paperback': { kicker: 'Our Space · Paperback', title: 'Your copy is on its way.', intro: 'Thank you for ordering Our Space. Your payment is confirmed and your paperback will be delivered to the address you gave.', steps: ['We pack your copy', 'We send it to your address', "You'll get a message when it's on its way"] },
    'book-pending': { kicker: 'Our Space', title: "We're confirming your payment.", intro: "Your payment went through to Flutterwave and we're waiting for the final confirmation. You'll get an email as soon as it lands, usually within a few minutes.", steps: ['Watch your inbox (and spam) for an email from MANNORR', 'Nothing after 15 minutes? Email hellomannorr@gmail.com with your reference'] },
    learn: { kicker: 'Student application', title: 'Your application is in.', intro: "Thank you for wanting to learn design with me. I'll go through your application and reach out on WhatsApp about the next steps.", steps: ['I review your application', 'A short call on WhatsApp', 'We confirm your place and schedule'] }
  };
  if (page === 'thank-you') {
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
    publicKey: '',   /* Flutterwave PUBLIC key (FLWPUBK-…). Leave empty until payments are set up. */
    prices: { digital: 7000, paperback: 10000 },
    delivery: { Lagos: 2500, other: 5000 },
    selar: 'https://selar.com/y66o74u5n5'
  };
  function naira(n) { return '₦' + Number(n).toLocaleString('en-NG'); }
  function post(fields) {
    var fd = new FormData(); Object.keys(fields).forEach(function (k) { fd.append(k, fields[k]); });
    return fetch(DB_ENDPOINT, { method: 'POST', body: fd }).then(function (r) { return r.json(); });
  }
  var buy = $('buy-form');
  if (buy) (function () {
    var fmt = 'digital', state = $('b-state'), payBtn = $('b-pay'), note = $('b-note');
    function totals() {
      var price = BOOK.prices[fmt], fee = fmt === 'paperback' ? (state.value ? (state.value === 'Lagos' ? BOOK.delivery.Lagos : BOOK.delivery.other) : null) : 0;
      return { price: price, fee: fee, total: price + (fee || 0) };
    }
    function render() {
      var t = totals();
      $('b-summary').innerHTML = '<li>Our Space · ' + (fmt === 'paperback' ? 'Paperback' : 'Digital edition') + ' <span class="mono">' + naira(t.price) + '</span></li>' +
        (fmt === 'paperback' ? '<li>Delivery' + (state.value ? ' to ' + state.value : '') + ' <span class="mono">' + (t.fee === null ? 'Choose your state' : naira(t.fee)) + '</span></li>' : '') +
        '<li class="total">Total <span class="mono">' + naira(t.total) + (fmt === 'paperback' && t.fee === null ? ' + delivery' : '') + '</span></li>';
      $('b-price').textContent = naira(BOOK.prices[fmt]);
      $('b-price-note').textContent = fmt === 'paperback' ? 'Paperback · plus delivery' : 'Digital edition · read instantly';
      if (!BOOK.publicKey) payBtn.textContent = fmt === 'digital' ? 'Buy on Selar →' : 'Order by email →';
      else payBtn.textContent = 'Pay ' + naira(t.total) + (fmt === 'paperback' && t.fee === null ? ' + delivery' : '') + ' →';
    }
    function setFmt(f) {
      fmt = f;
      $('fmt-digital').setAttribute('aria-pressed', f === 'digital'); $('fmt-paperback').setAttribute('aria-pressed', f === 'paperback');
      $('info-digital').hidden = f !== 'digital'; $('info-paperback').hidden = f !== 'paperback';
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
    function busy(on, label) { payBtn.disabled = on; payBtn.classList.toggle('is-busy', on); if (label) payBtn.textContent = label; if (!on) render(); }
    function loadCheckout() {
      return new Promise(function (ok, bad) {
        if (window.FlutterwaveCheckout) return ok();
        var sc = document.createElement('script'); sc.src = 'https://checkout.flutterwave.com/v3.js'; sc.onload = ok; sc.onerror = bad; document.head.appendChild(sc);
      });
    }
    function finish(order, who) {
      note.className = 'formnote is-info'; note.textContent = 'Confirming your payment…';
      var tries = 0;
      (function attempt() {
        post({ form: 'order-confirm', tx_ref: order.tx_ref }).then(function (r) {
          if (r && r.ok) {
            store('mn_sent', { form: 'book-' + r.format, name: who.name, email: who.email, ref: r.ref, code: r.code || '' });
            location.href = '/thank-you?f=book-' + r.format + '&ref=' + encodeURIComponent(r.ref);
          } else if (++tries < 5) setTimeout(attempt, 3000);
          else { store('mn_sent', { form: 'book-pending', name: who.name, email: who.email, ref: order.ref }); location.href = '/thank-you?f=book-pending&ref=' + encodeURIComponent(order.ref); }
        }).catch(function () {
          if (++tries < 5) setTimeout(attempt, 3000);
          else { store('mn_sent', { form: 'book-pending', name: who.name, email: who.email, ref: order.ref }); location.href = '/thank-you?f=book-pending&ref=' + encodeURIComponent(order.ref); }
        });
      })();
    }
    buy.addEventListener('submit', function (e) {
      e.preventDefault();
      if ((buy.querySelector('[name=mn_trap_x]') || {}).value) return;
      if (!BOOK.publicKey) {
        if (fmt === 'digital') { location.href = BOOK.selar; return; }
        location.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('Our Space paperback order') + '&body=' + encodeURIComponent('Hello, I would like to order a paperback copy of Our Space.\n\nName:\nPhone:\nState:\nCity:\nAddress:');
        return;
      }
      var v = function (id) { return $(id).value.trim(); };
      var who = { name: v('b-name'), email: v('b-email'), phone: v('b-phone') };
      if (!who.name || !who.email) return err('Please add your name and email.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(who.email)) return err('Please check your email address.');
      if (fmt === 'paperback' && (!state.value || !v('b-city') || !v('b-address') || !who.phone)) return err('Please add your phone number, state, city and delivery address.');
      busy(true, 'Preparing checkout…'); note.className = 'formnote is-info'; note.textContent = 'Preparing a secure checkout. This takes a few seconds.';
      Promise.all([
        post({ form: 'order-start', format: fmt, name: who.name, email: who.email, phone: who.phone, state: state.value, city: v('b-city'), address: v('b-address') }),
        loadCheckout()
      ]).then(function (res) {
        var order = res[0];
        if (!order || !order.ok) { busy(false); return err((order && order.error) || "Checkout couldn't start. Please try again."); }
        note.textContent = ''; note.className = 'formnote';
        var paid = false;
        var modal = window.FlutterwaveCheckout({
          public_key: BOOK.publicKey, tx_ref: order.tx_ref, amount: order.amount, currency: order.currency || 'NGN',
          payment_options: 'card, banktransfer, ussd',
          customer: { email: who.email, name: who.name, phone_number: who.phone },
          customizations: { title: 'Our Space', description: (fmt === 'paperback' ? 'Paperback with delivery' : 'Digital edition') + ' · ' + order.ref, logo: 'https://mannorr.com/images/our-space-mockup.jpg' },
          callback: function () { paid = true; try { modal && modal.close && modal.close(); } catch (x) {} finish(order, who); },
          onclose: function () { if (!paid) { busy(false); note.className = 'formnote'; note.textContent = 'Checkout closed. Your order is saved; you can try again.'; } }
        });
      }).catch(function () { busy(false); err("Checkout couldn't start. Please check your connection and try again."); });
    });
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
    function draw() {
      reader.innerHTML = '';
      var width = Math.min(reader.clientWidth || 800, 880) * scale;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var el = en.target;
          if (!en.isIntersecting || el.dataset.done) return;
          el.dataset.done = '1';
          pdf.getPage(+el.dataset.n).then(function (pg) {
            var vp1 = pg.getViewport({ scale: 1 }), s = width / vp1.width, dpr = Math.min(window.devicePixelRatio || 1, 2);
            var vp = pg.getViewport({ scale: s * dpr }), c = document.createElement('canvas');
            c.width = vp.width; c.height = vp.height; el.style.aspectRatio = vp1.width + '/' + vp1.height;
            el.insertBefore(c, el.firstChild);
            pg.render({ canvasContext: c.getContext('2d'), viewport: vp });
          });
        });
      }, { rootMargin: '600px 0px', threshold: 0.01 });
      var counter = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) $('r-page').textContent = en.target.dataset.n + ' / ' + pdf.numPages; });
      }, { rootMargin: '-45% 0px -45% 0px' });
      for (var i = 1; i <= pdf.numPages; i++) {
        var d = document.createElement('div'); d.className = 'rpage'; d.dataset.n = i; d.style.width = width + 'px'; d.style.aspectRatio = '1/1.414';
        d.innerHTML = '<div class="wm" aria-hidden="true"><span>' + email.replace(/[<>&"]/g, '') + ' · mannorr.com</span></div><span class="pn">' + i + '</span>';
        reader.appendChild(d); io.observe(d); counter.observe(d);
      }
    }
    $('r-in').addEventListener('click', function () { scale = Math.min(scale + 0.15, 1.6); draw(); });
    $('r-out').addEventListener('click', function () { scale = Math.max(scale - 0.15, 0.6); draw(); });
    fetch(DB_ENDPOINT + '?action=read&code=' + encodeURIComponent(code)).then(function (r) { return r.json(); }).then(function (r) {
      if (!r || !r.ok) return showMsg("This link didn't open", (r && r.error ? r.error + ' ' : '') + 'Enter the email you used to buy the book and we will send you a fresh link.');
      email = r.email || '';
      $('r-who').textContent = 'Reading as ' + (r.name || email);
      var bin = atob(r.data), bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var lib = window.pdfjsLib;
      lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      return lib.getDocument({ data: bytes }).promise.then(function (doc) { pdf = doc; $('r-tools').hidden = false; draw(); });
    }).catch(function () { showMsg("This link didn't open", "We couldn't load the book just now. Please refresh, or enter your email for a fresh link."); });
    var rt; window.addEventListener('resize', function () { if (!pdf) return; clearTimeout(rt); rt = setTimeout(draw, 250); });
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
