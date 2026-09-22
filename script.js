/* Newsocapis — plain JS. No frameworks, no build step.
   Preloader (≈2.3s: brand glow + 1px line, curtain slide-up) then hero
   reveal: GSAP 3 (CDN) if present, pure-CSS keyframes otherwise, none if
   prefers-reduced-motion (unless html[data-motion="always"]). */

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

  var docEl = document.documentElement;
  docEl.classList.add('js-runtime');

  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var motionAlways = docEl.dataset.motion === 'always';
  var reduceMotion = function () { return !motionAlways && mqReduce.matches; };

  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  /* ---------------------------------------------------------------
     Preloader + Hero Reveal — minimal "Calm Surface" loading screen.
     ≈2.3s: NEWSOCAPIS fades in with a soft glow, the 1px line fills
     0→1 over 1.5s (rAF, easeOutQuart), then the whole pane slides up
     (translateY(-100%), curtain curve) and the hero reveal — GSAP
     timeline or pure-CSS fallback — plays behind. Teardown removes
     the overlay from the DOM and unlocks scroll once the curtain
     clears. bfcache / back-forward and reduced-motion never replay it.
     --------------------------------------------------------------- */
  (function () {
    var preloaderEl = document.querySelector('[data-preloader]');
    var fillEl = document.querySelector('[data-preloader-fill]');

    var entered = false;

    function finish() {
      if (entered) return;
      entered = true;
      docEl.classList.remove('is-loading');
      docEl.classList.add('is-entered');
    }

    function removePreloader() {
      if (preloaderEl && preloaderEl.parentNode) {
        preloaderEl.parentNode.removeChild(preloaderEl);
      }
      preloaderEl = null;
    }

    /* teardown — never keeps the overlay in the layout or scroll locked */
    function cleanup() {
      removePreloader();
      finish();
      docEl.classList.remove('is-locked');
    }

    /* hero/reveal choreography — plays when the curtain starts to part */
    function reveal() {
      var gsapOk = typeof window.gsap === 'function' && !window.__gsapFailed;

      if (!gsapOk) {
        /* pure-CSS keyframe entrance — same choreography, no library */
        docEl.classList.add('css-entrance');
        window.setTimeout(function () {
          if (window.NewsocHero && window.NewsocHero.enter) window.NewsocHero.enter(1200);
        }, 250);
        /* let the CSS keyframes play (latest delay ≈1.2s + 0.7s), then pin */
        window.setTimeout(finish, 1900);
        return;
      }

      docEl.classList.add('gsap-entrance');

      var tl = gsap.timeline({ onComplete: finish });

      /* canvas settles from a gentle scale */
      tl.from('#hero-webgl', { scale: 1.06, duration: 1.7, ease: 'power2.out' }, 0.25);

      /* chrome */
      tl.from('.nav-inner .brand', { y: -10, opacity: 0, duration: 0.6, ease: 'power3.out' }, 0.05);
      tl.from('.nav-menu .nav-link', { y: -8, opacity: 0, duration: 0.55, ease: 'power3.out', stagger: 0.06 }, 0.09);
      tl.from('.burger, .nav-menu .nav-contact', { y: -8, opacity: 0, duration: 0.55, ease: 'power3.out' }, 0.2);

      /* hero display — seamless entrance: fade in + rise 20px, staggered */
      tl.fromTo(
        '.hero-display .block',
        { y: 20, opacity: 0, filter: 'blur(8px)' },
        { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.9, stagger: 0.12, ease: 'power3.out' },
        0.30
      );

      tl.from('.hero-sub', { y: 22, opacity: 0, filter: 'blur(6px)', duration: 0.7, ease: 'power3.out' }, 0.80);
      tl.from('.hero-paths li', { y: 14, opacity: 0, duration: 0.55, ease: 'power3.out', stagger: 0.07 }, 0.90);

      tl.from('.footer .brand, .footer-links li', { y: 14, opacity: 0, duration: 0.5, ease: 'power3.out', stagger: 0.04 }, 1.12);

      /* camera glide — hand to the WebGL module once the hero is in motion */
      tl.add(function () {
        if (window.NewsocHero && window.NewsocHero.enter) window.NewsocHero.enter(1200);
      }, 0.35);
    }

    /* ---- the 1px line fills 0→1 over 1.5s (easeOutQuart), then curtain ---- */
    function runPreloader() {
      var total = 1500;   /* line fill window */
      var curtain = 800;  /* curtain slide-up duration */
      var t0 = null;
      var handedOff = false;

      function easeOutQuart(t) {
        return 1 - Math.pow(1 - t, 4);
      }

      function tick(now) {
        if (t0 === null) t0 = now;
        var p = Math.min(1, (now - t0) / total);
        var v = easeOutQuart(p);
        if (fillEl) fillEl.style.transform = 'scaleX(' + v + ')';
        if (p < 1) { requestAnimationFrame(tick); return; }
        window.setTimeout(handoff, 0);
      }

      function handoff() {
        if (handedOff) return;
        handedOff = true;
        if (preloaderEl) preloaderEl.classList.add('is-done');
        window.requestAnimationFrame(reveal);
        /* curtain clears → full teardown + scroll unlock */
        window.setTimeout(cleanup, curtain + 120);
      }

      /* hard failsafe — never leaves the overlay locked in place */
      window.setTimeout(cleanup, 3000);

      requestAnimationFrame(tick);
    }

    /* reduced motion (OS, unless data-motion="always") and back/forward
       restores skip the preloader entirely */
    if (reduceMotion()) {
      cleanup();
      return;
    }

    docEl.classList.add('is-locked');
    try {
      runPreloader();
    } catch (e) {
      cleanup();
      reveal();
    }
  })();

  /* bfcache: never re-cue anything after a back/forward restore */
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      var stale = document.querySelector('.preloader');
      if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
      docEl.classList.add('is-entered');
      docEl.classList.remove('is-loading');
      docEl.classList.remove('is-locked');
    }
  });

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
     Reveal-on-scroll — [data-reveal] / .is-in, honors reduced motion.
     Tween is CSS (opacity/transform/filter) — off the main thread.
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
    var ticking = false;
    var onLayout = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { passVisible(); ticking = false; });
    };
    window.addEventListener('scroll', onLayout, { passive: true });
    window.addEventListener('resize', onLayout, { passive: true });
  })();

  /* ---------------------------------------------------------------
     Active nav section — IntersectionObserver center band -> .is-active
     --------------------------------------------------------------- */
  (function () {
    var sectionsByHref = { top: 'hero', features: 'features', flow: 'flow', clarity: 'clarity' };
    var links = {};
    [].forEach.call(document.querySelectorAll('.nav-link'), function (a) {
      var key = (a.getAttribute('href') || '').replace(/^#/, '');
      if (key in sectionsByHref) links[sectionsByHref[key]] = a;
    });

    var current = null;
    var set = function (sectionId) {
      if (sectionId === current) return;
      if (current && links[current]) {
        links[current].removeAttribute('aria-current');
        links[current].classList.remove('is-active');
      }
      current = sectionId;
      if (current && links[current]) {
        links[current].setAttribute('aria-current', 'true');
        links[current].classList.add('is-active');
      }
    };

    if (!('IntersectionObserver' in window) || !links.hero) return;

    var band = new IntersectionObserver(function (entries) {
      var top = entries
        .filter(function (en) { return en.isIntersecting; })
        .sort(function (a, b) { return b.intersectionRatio - a.intersectionRatio; })[0];
      if (top) { set(top.target.id); return; }
      var doc = document.documentElement;
      if (doc.scrollHeight - (doc.scrollTop + doc.clientHeight) < 120) set('clarity');
      else set('');
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });

    Object.keys(sectionsByHref).forEach(function (key) {
      var el = document.getElementById(sectionsByHref[key]);
      if (el) band.observe(el);
    });

    set('hero');
  })();

  /* ---------------------------------------------------------------
     Magnetic buttons — [data-magnet]. Fish to the pointer, max ~6px.
     GSAP quickTo when available, rAF lerp otherwise. pointer:fine +
     no reduced motion only. Active press uses the CSS `scale` property.
     --------------------------------------------------------------- */
  (function () {
    var btns = document.querySelectorAll('[data-magnet]');
    if (!btns.length || !finePointer.matches || reduceMotion()) return;

    function clampMag(dx, half) {
      var t = Math.max(-1, Math.min(1, dx / half));
      return t * 6;
    }

    if (window.gsap) {
      btns.forEach(function (b) {
        var qx = gsap.quickTo(b, 'x', { duration: 0.35, ease: 'power3.out' });
        var qy = gsap.quickTo(b, 'y', { duration: 0.35, ease: 'power3.out' });
        b.addEventListener('pointermove', function (e) {
          var r = b.getBoundingClientRect();
          var halfW = Math.max(1, r.width / 2);
          var halfH = Math.max(1, r.height / 2);
          qx(clampMag(e.clientX - (r.left + halfW), halfW));
          qy(clampMag(e.clientY - (r.top + halfH), halfH));
        });
        b.addEventListener('pointerleave', function () { qx(0); qy(0); });
      });
      return;
    }

    /* rAF lerp fallback */
    btns.forEach(function (b) {
      var tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
      function loop() {
        cx += (tx - cx) * 0.16;
        cy += (ty - cy) * 0.16;
        b.style.translate = cx.toFixed(2) + 'px ' + cy.toFixed(2) + 'px';
        if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) raf = requestAnimationFrame(loop);
        else raf = null;
      }
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        var halfW = Math.max(1, r.width / 2);
        var halfH = Math.max(1, r.height / 2);
        tx = clampMag(e.clientX - (r.left + halfW), halfW);
        ty = clampMag(e.clientY - (r.top + halfH), halfH);
        if (!raf) raf = requestAnimationFrame(loop);
      });
      b.addEventListener('pointerleave', function () { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(loop); });
    });
  })();

  /* ---------------------------------------------------------------
     Cursor spotlight on bento tiles — [data-spotlight].
     Writes --mx/--my consumed by a radial-gradient overlay.
     --------------------------------------------------------------- */
  (function () {
    var tiles = document.querySelectorAll('[data-spotlight]');
    if (!tiles.length || !finePointer.matches) return;
    tiles.forEach(function (tile) {
      tile.addEventListener('pointermove', function (e) {
        var r = tile.getBoundingClientRect();
        var px = ((e.clientX - r.left) / r.width) * 100;
        var py = ((e.clientY - r.top) / r.height) * 100;
        tile.style.setProperty('--mx', px.toFixed(2) + '%');
        tile.style.setProperty('--my', py.toFixed(2) + '%');
      });
    });
  })();

  /* ---------------------------------------------------------------
     Footer year
     --------------------------------------------------------------- */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();