/* MANNORR — shared behaviour for the inner pages.
   Builds the pill nav from each page's own top-bar links (same words, same
   destinations) and keeps the theme in step with the homepage. */
(function () {
  var root = document.documentElement;

  /* Theme: a saved choice wins; otherwise follow the device, like the homepage */
  var saved = null;
  try { saved = localStorage.getItem('nifemi-theme'); } catch (e) {}
  if (!saved) {
    var sys = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    root.setAttribute('data-theme', sys);
    var t = document.getElementById('themeToggle');
    if (t) t.textContent = sys === 'dark' ? '☀' : '☾';
  }

  var bar = document.querySelector('.top-bar');
  if (!bar) return;

  var nav = document.createElement('header');
  nav.className = 'mn';
  nav.innerHTML =
    '<div class="mn-bar">' +
      '<button class="mn-btn" type="button" aria-label="Switch light or dark theme">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path></svg>' +
      '</button>' +
      '<a class="mn-mark" href="./index.html">MANNORR<i aria-hidden="true"></i></a>' +
      '<button class="mn-btn mn-menu-btn" type="button" aria-expanded="false" aria-label="Open menu"><span class="mn-burger" aria-hidden="true"><i></i><i></i></span></button>' +
    '</div>' +
    '<nav class="mn-menu" aria-label="Site"></nav>';

  var menu = nav.querySelector('.mn-menu');
  bar.querySelectorAll('.top-bar-right a').forEach(function (a) {
    var link = document.createElement('a');
    link.href = a.getAttribute('href');
    link.textContent = a.textContent;
    menu.appendChild(link);
  });
  document.body.insertBefore(nav, document.body.firstChild);

  var themeBtn = nav.querySelector('.mn-btn');
  themeBtn.addEventListener('click', function () {
    if (typeof window.toggleTheme === 'function') { window.toggleTheme(); return; }
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('nifemi-theme', next); } catch (e) {}
  });

  var menuBtn = nav.querySelector('.mn-menu-btn');
  function setMenu(open) {
    nav.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', open);
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  menuBtn.addEventListener('click', function () { setMenu(!nav.classList.contains('open')); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  document.addEventListener('click', function (e) { if (!nav.contains(e.target)) setMenu(false); });
})();
