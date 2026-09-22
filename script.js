/* Newsocapis — plain JS. No frameworks, no build step.
   Honors OS prefers-reduced-motion unless html[data-motion="always"] is
   present (the switch overrides the OS preference — single source of truth). */

var LOADER_MIN_MS = 4000;
var LOADER_MAX_MS = 7000;
var HERO_START_OFFSET_MS = 450;
var SKIP_IF_SEEN_THIS_SESSION = false;
var SHOW_SKIP = false;

/* START_AT_TOP_ON_LOAD=true: every fresh open/refresh starts at the hero,
   the URL hash is ignored on first load, and the browser's scroll
   restoration is suppressed (scrollRestoration manual is set inline in
   <head>). In-page links still smooth-scroll and fill the hash; back/forward
   still restores position (bfcache). false = old hash-as-target behavior. */
var START_AT_TOP_ON_LOAD = true;
var startAtTopFresh = true; /* true unless this is a back_forward restore */
if (START_AT_TOP_ON_LOAD) {
  try {
    var startAtTopNav = performance.getEntriesByType('navigation')[0];
    startAtTopFresh = !startAtTopNav || startAtTopNav.type !== 'back_forward';
  } catch (e) { startAtTopFresh = true; }
}
if (START_AT_TOP_ON_LOAD && startAtTopFresh) {
  if (window.location.hash && history.replaceState) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}

(function () {
  'use strict';

  document.documentElement.classList.add('js');

  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var motionAlways = document.documentElement.dataset.motion === 'always';
  var reduceMotion = function () { return !motionAlways && mqReduce.matches; };

  /* ---------------------------------------------------------------
     Reduced-motion: the hero background is a VIDEO, so CSS cannot
     pause it. Paused it holds its first frame (the poster). Live matcher.
     --------------------------------------------------------------- */
  (function () {
    var v = document.querySelector('.prism-video');
    if (!v) return;
    function sync() {
      if (reduceMotion()) { try { v.pause(); } catch (e) {} }
      else { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    }
    sync();
    var hasListener = mqReduce.addEventListener;
    if (hasListener) mqReduce.addEventListener('change', sync);
    else mqReduce.addListener(sync);
  })();

  /* ---------------------------------------------------------------
     Entrance retire: pure CSS. Once the last tween ends, pin is-entered
     so a later breakpoint change can never replay it. Counted from the
     release point (loader holds it off), never from page load.
     --------------------------------------------------------------- */
  var armEntranceRetire = (function () {
    var doneFired = false;
    var timer = null;
    function done() {
      if (doneFired) return;
      doneFired = true;
      if (timer) { window.clearTimeout(timer); timer = null; }
      document.documentElement.classList.add('is-entered');
    }
    return function () {
      var last = document.querySelector('.footer-links li');
      if (last && !document.documentElement.classList.contains('is-entered') && !reduceMotion()) {
        last.addEventListener('animationend', done, { once: true });
        timer = window.setTimeout(done, 4000);
      } else {
        done();
      }
    };
  })();

  /* ---------------------------------------------------------------
     Loader intro — preloader + cinematic shutter into the hero entrance.
     Gates: LOADER_MIN_MS + document.fonts.ready + hero video ready, hard
     cap LOADER_MAX_MS. Releases is-loading HERO_START_OFFSET_MS after the
     exit begins; never relies on animationend alone (safety timers).
     --------------------------------------------------------------- */
  (function () {
    var loader = document.getElementById('loader');
    if (!loader) { armEntranceRetire(); return; }

    var docEl = document.documentElement;
    var start = Date.now();
    var shown = 0;
    var statusTimer = null;
    var exiting = false;
    var released = false;
    var finished = false;

    var seen = false;
    if (SKIP_IF_SEEN_THIS_SESSION) {
      try { seen = sessionStorage.getItem('loader-seen') === '1'; } catch (e) { seen = false; }
      if (!seen) { try { sessionStorage.setItem('loader-seen', '1'); } catch (e) {} }
    }

    /* reduced motion without the data-motion switch, or JS session skip:
       never show the loader at all */
    if (reduceMotion() || seen) { finish(); return; }

    /* everything behind the loader is inert during the load phase */
    var inertEls = [];
    [].forEach.call(document.body.children, function (el) {
      if (el === loader || el.tagName === 'SCRIPT') return;
      inertEls.push(el);
      if ('inert' in el) el.inert = true;
    });

    var fill = loader.querySelector('.loader-fill');
    var counter = loader.querySelector('.loader-count');
    var status = loader.querySelector('.loader-status');
    var msgs = ['Loading links', 'Calm surface', 'Almost there'];
    var gi = 0;
    if (status) {
      status.textContent = msgs[0];
      statusTimer = window.setInterval(function () {
        gi = (gi + 1) % msgs.length;
        status.textContent = msgs[gi];
      }, 1300);
    }

    /* readiness gates */
    var fontsReady = false;
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { fontsReady = true; }).catch(function () { fontsReady = true; });
    } else {
      fontsReady = true;
    }
    var video = document.querySelector('.prism-video');
    var videoReady = !video || video.readyState >= 2;
    if (video && !videoReady) {
      var onVideo = function () { videoReady = true; };
      video.addEventListener('loadeddata', onVideo, { once: true });
      video.addEventListener('canplay', onVideo, { once: true });
    }
    function ready() {
      return (Date.now() - start) >= LOADER_MIN_MS && fontsReady && videoReady;
    }

    function paint(p) {
      if (fill) fill.style.width = (p * 100).toFixed(2) + '%';
      if (counter) counter.textContent = String(Math.round(p * 100)).padStart(3, '0');
    }
    function easeIO(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

    function tick() {
      if (finished) return;
      var force = (Date.now() - start) >= LOADER_MAX_MS;
      var target = ready() || force ? 1
        : easeIO(Math.min(1, (Date.now() - start) / LOADER_MIN_MS)) * 0.9;
      shown += (target - shown) * 0.15;
      if (shown > 0.995 && target === 1) shown = 1;
      paint(shown);
      if (force) { exit(); return; }
      if (ready() && shown >= 0.995) { exit(); return; }
      window.requestAnimationFrame(tick);
    }

    function release() {
      if (released) return;
      released = true;
      docEl.classList.remove('is-loading');
      if (START_AT_TOP_ON_LOAD) {
        if (startAtTopFresh) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      } else if (window.location.hash) {
        var t = document.getElementById(window.location.hash.slice(1));
        if (t) t.scrollIntoView({ behavior: 'instant' });
      }
      armEntranceRetire();
      inertEls.forEach(function (el) { if ('inert' in el) el.inert = false; });
    }

    function exit() {
      if (exiting) return;
      exiting = true;
      if (START_AT_TOP_ON_LOAD && startAtTopFresh) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      docEl.classList.add('loader-exit');
      window.setTimeout(release, HERO_START_OFFSET_MS);
      loader.addEventListener('animationend', function (e) {
        if (e.animationName === 'ld-up' || e.animationName === 'ld-down') finish();
      });
      window.setTimeout(finish, 1500);
    }

    function finish() {
      if (finished) return;
      finished = true;
      docEl.classList.remove('is-loading');
      docEl.classList.add('is-loaded');
      if (statusTimer) window.clearInterval(statusTimer);
      if (loader.parentNode) loader.parentNode.removeChild(loader);
      release();
    }

    if (SHOW_SKIP) {
      var skip = loader.querySelector('.loader-skip');
      if (skip) {
        window.setTimeout(function () { skip.hidden = false; }, 1000);
        skip.addEventListener('click', function () { if (!exiting) exit(); });
      }
    }

    /* bfcache: never replay the loader on back/forward restore */
    window.addEventListener('pageshow', function (e) { if (e.persisted && !finished) finish(); });

    window.requestAnimationFrame(tick);
  })();

  /* ---------------------------------------------------------------
     Burger (button-driven): close the panel on link click and ESC.
     --------------------------------------------------------------- */
  (function () {
    var header = document.getElementById('nav');
    var toggle = document.getElementById('navToggle');
    if (!header || !toggle) return;

    var close = function () {
      header.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    };

    toggle.addEventListener('click', function () {
      var open = header.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });

    header.querySelectorAll('.nav-link').forEach(function (link) {
      link.addEventListener('click', close);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && header.classList.contains('is-open')) {
        close();
        toggle.focus();
      }
    });
  })();

  /* ---------------------------------------------------------------
     Scroll progress bar + back-to-top
     --------------------------------------------------------------- */
  (function () {
    var bar = document.getElementById('scroll-progress');
    var backToTop = document.getElementById('back-to-top');
    var ticking = false;

    function update() {
      var doc = document.documentElement;
      var total = doc.scrollHeight - doc.clientHeight;
      var p = total > 0 ? doc.scrollTop / total : 0;
      if (bar) bar.style.transform = 'scaleX(' + p + ')';
      if (backToTop) {
        var show = doc.scrollTop > 600;
        backToTop.classList.toggle('visible', show && !reduceMotion());
      }
      ticking = false;
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    if (backToTop) {
      backToTop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
      });
    }

    if (bar || backToTop) {
      update();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
    }
  })();

  /* ---------------------------------------------------------------
     Reveal-on-scroll — [data-reveal] / .is-in, honors reduced motion
     --------------------------------------------------------------- */
  (function () {
    var els = document.querySelectorAll('[data-reveal]');
    if (!els.length) return;
    var shown = new WeakSet();
    var show = function (el) {
      if (shown.has(el)) return;
      shown.add(el);
      el.classList.add('is-in');
    };
    if (reduceMotion() || !('IntersectionObserver' in window)) {
      els.forEach(show);
      return;
    }
    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { show(en.target); obs.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (el) { io.observe(el); });

    var passVisible = function () {
      els.forEach(function (el) {
        if (shown.has(el)) return;
        var r = el.getBoundingClientRect();
        if (r.top <= window.innerHeight && r.bottom > 0) show(el);
      });
    };
    window.addEventListener('load', function () { requestAnimationFrame(passVisible); }, { once: true });
    var onLayout = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { passVisible(); ticking = false; });
    };
    var ticking = false;
    window.addEventListener('scroll', onLayout, { passive: true });
    window.addEventListener('resize', onLayout, { passive: true });
  })();

  /* ---------------------------------------------------------------
     Footer year
     --------------------------------------------------------------- */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();