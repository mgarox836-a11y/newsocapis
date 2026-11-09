/* Newsocapis — floating nav, fullscreen menu and active-section marker. */

(function () {
  'use strict';

  var overlay = document.getElementById('menuOverlay');
  var toggle = document.getElementById('navToggle');
  if (!overlay || !toggle) return;

  var closeButton = overlay.querySelector('[data-menu-close]');
  var lastFocus = null;
  var closeTimer = null;

  function focusableItems() {
    return Array.prototype.filter.call(
      overlay.querySelectorAll('a[href], button:not([disabled])'),
      function (el) {
        return el.offsetParent !== null;
      }
    );
  }

  function openMenu() {
    window.clearTimeout(closeTimer);
    lastFocus = document.activeElement === document.body ? toggle : document.activeElement;
    overlay.hidden = false;
    window.requestAnimationFrame(function () {
      overlay.classList.add('is-open');
      overlay.getBoundingClientRect();
      if (closeButton) closeButton.focus();
    });
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
    document.body.classList.add('menu-open');
    if (window.NEWSOCAPIS && window.NEWSOCAPIS.lenis) window.NEWSOCAPIS.lenis.stop();
  }

  function closeMenu(restoreFocus) {
    overlay.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    document.body.classList.remove('menu-open');
    if (window.NEWSOCAPIS && window.NEWSOCAPIS.lenis) window.NEWSOCAPIS.lenis.start();
    if (restoreFocus !== false && lastFocus && lastFocus.focus) lastFocus.focus();
    closeTimer = window.setTimeout(function () {
      overlay.hidden = true;
    }, 430);
  }

  toggle.addEventListener('click', function () {
    if (overlay.hidden) openMenu();
    else closeMenu();
  });

  if (closeButton) {
    closeButton.addEventListener('click', function () {
      closeMenu();
    });
  }

  overlay.addEventListener('click', function (event) {
    if (event.target === overlay) closeMenu();
  });

  document.addEventListener('keydown', function (event) {
    if (overlay.hidden) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      return;
    }

    if (event.key !== 'Tab') return;

    var items = focusableItems();
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  /* Menu links close the overlay, then hand scrolling to the Lenis router. */
  Array.prototype.forEach.call(overlay.querySelectorAll('[data-menu-link]'), function (link) {
    link.addEventListener('click', function (event) {
      var hash = link.getAttribute('href');
      if (hash && hash.charAt(0) === '#') {
        event.preventDefault();
        closeMenu(false);
        window.requestAnimationFrame(function () {
          if (window.NEWSOCAPIS) window.NEWSOCAPIS.scrollTo(hash);
          else {
            var target = document.querySelector(hash);
            if (target) target.scrollIntoView();
          }
        });
      } else {
        closeMenu(false);
      }
    });
  });

  /* ---------- Active nav link ---------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-link'));

  function setActive(hash) {
    navLinks.forEach(function (link) {
      if (link.getAttribute('href') === hash) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }

  var sections = ['overview', 'features', 'flow', 'clarity'].map(function (id) {
    return document.getElementById(id);
  }).filter(Boolean);

  var hero = document.getElementById('hero');
  var visit = document.getElementById('visit');

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        if (entry.target === hero || entry.target === visit) {
          setActive(null);
        } else {
          setActive('#' + entry.target.id);
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    if (hero) observer.observe(hero);
    sections.forEach(function (section) {
      observer.observe(section);
    });
    if (visit) observer.observe(visit);
  }
})();
