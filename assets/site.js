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
    }
  }

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
