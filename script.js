/* Newsocapis — plain JS. No frameworks, no build step.
   Preloader (~2.2s total: brand glow + 1px line fills the first 1.5s, curtain
   slide-up over the final 0.7s) then hero reveal: GSAP 3 (CDN) if present,
   pure-CSS keyframes otherwise. If GSAP is present but its entrance throws, the
   reveal falls back to the CSS choreography. prefers-reduced-motion: reduce is
   honoured on both paths — the hero lands on its end state with no motion. */

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

  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  /* ---------------------------------------------------------------
     Preloader + Hero Reveal — minimal "Calm Surface" loading screen.
     ~2.2s: NEWSOCAPIS fades in with a soft glow, the 1px line fills 0→1
     over the first 1.5s (rAF, easeOutQuart), then the pane slides up
     (translateY(-100%), curtain curve) during the final 0.7s while the hero
     reveal — GSAP timeline or pure-CSS fallback — plays behind. Teardown
     removes the overlay from the DOM and unlocks scroll once the curtain
     clears. bfcache / back-forward never replay it.
     --------------------------------------------------------------- */
  (function () {
    var preloaderEl = document.querySelector('[data-preloader]');
    var fillEl = document.querySelector('[data-preloader-fill]');

    var entered = false;

    /* GSAP 3 publishes window.gsap as a plain OBJECT, not a function, so the
       old `typeof window.gsap === 'function'` test failed forever and the whole
       GSAP/SplitText entrance silently never ran — the CSS fallback covered
       for it and nobody noticed. Probe the API we actually call instead. */
    function gsapAvailable() {
      return !window.__gsapFailed &&
        !!window.gsap &&
        typeof window.gsap.timeline === 'function';
    }

    /* The entrance hides hero text by writing inline opacity/transform. If any
       part of that choreography dies mid-flight the headline would stay at
       opacity 0 forever, so every exit path funnels through here and strips
       the inline props back to their stylesheet rest state. Idempotent: on the
       happy path the tweens have already landed on those same values. */
    /* The entrance hides every element the timeline touches by writing inline
       opacity/transform. If the timeline is killed mid-flight those tweens
       freeze at partial values, so the rescue sweep has to cover all of its
       targets — hero text AND nav/footer chrome — or a failed entrance leaves
       an invisible navigation bar behind. */
    var ENTRANCE_TARGETS = [
      '.hero-display .block',
      '.hero-display .spl-char',
      '.hero-sub',
      '.hero-sub .spl-word',
      '.hero-paths li',
      '.nav-inner .brand',
      '.nav-menu .nav-link',
      '.nav-menu .nav-contact',
      '.burger',
      '.footer .brand',
      '.footer-links li'
    ];

    function settleEntranceTargets() {
      ENTRANCE_TARGETS.forEach(function (sel) {
        var els = document.querySelectorAll(sel);
        for (var i = 0; i < els.length; i++) {
          els[i].style.opacity = '';
          els[i].style.transform = '';
          els[i].style.filter = '';
          els[i].style.visibility = '';
        }
      });
    }

    function finish() {
      if (entered) return;
      entered = true;
      settleEntranceTargets();
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
      if (!gsapAvailable()) {
        /* pure-CSS keyframe entrance — same choreography, no library */
        docEl.classList.add('css-entrance');
        /* let the CSS keyframes play (latest delay ≈1.2s + 0.7s), then pin */
        window.setTimeout(finish, 1900);
        return;
      }

      docEl.classList.add('gsap-entrance');

      /* Reduced motion. The stylesheet's prefers-reduced-motion block strips
         the CSS keyframes, but it cannot touch this timeline — GSAP animates
         inline styles, which no media query in the CSS can veto. Honour the
         preference here or fixing the GSAP guard would have silently removed
         the site's only reduced-motion support. Land on the end state at once:
         no split, no tweens, same visible result. */
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        finish();
        return;
      }

      var splits = [];

      try {
        /* onComplete fires after GSAP's final render, but the preloader
           teardown below already called finish() ~900ms earlier — which
           un-gates is-entered while the timeline is still running. Settle the
           hero text one tick after the timeline truly ends so the last write is
           ours, not GSAP's leftover perspective/blur. */
        var tl = gsap.timeline({
          onComplete: function () {
            window.setTimeout(function () {
              settleEntranceTargets();
              finish();
            }, 0);
          }
        });

        /* chrome */
        tl.from('.nav-inner .brand', { y: -10, opacity: 0, duration: 0.6, ease: 'power3.out' }, 0.05);
        tl.from('.nav-menu .nav-link', { y: -8, opacity: 0, duration: 0.55, ease: 'power3.out', stagger: 0.06 }, 0.09);
        tl.from('.burger, .nav-menu .nav-contact', { y: -8, opacity: 0, duration: 0.55, ease: 'power3.out' }, 0.2);

        /* hero display — masked char reveal (SplitText 3D rise) when the plugin
           is present; seamless blur-rise otherwise */
        if (window.SplitText) {
          var blockSpans = gsap.utils.toArray('.hero-display .block').map(function (el) {
            return new window.SplitText(el, { type: 'chars', charsClass: 'spl-char' });
          });
          splits = splits.concat(blockSpans);
          var chars = blockSpans.reduce(function (acc, sp) { return acc.concat(sp.chars); }, []);
          gsap.set(chars, {
            yPercent: 115, rotateY: 14, opacity: 0, filter: 'blur(6px)',
            transformPerspective: 800, transformOrigin: '50% 100% 0'
          });
          tl.to(chars, {
            yPercent: 0, rotateY: 0, opacity: 1, filter: 'blur(0px)',
            duration: 0.9, ease: 'expo.out', stagger: 0.018
          }, 0.30);

          var subSp = new window.SplitText('.hero-sub', { type: 'words', wordsClass: 'spl-word' });
          splits.push(subSp);
          gsap.set(subSp.words, {
            yPercent: 60, rotateY: 8, opacity: 0, filter: 'blur(5px)',
            transformPerspective: 700, transformOrigin: '50% 100% 0'
          });
          tl.to(subSp.words, {
            yPercent: 0, rotateY: 0, opacity: 1, filter: 'blur(0px)',
            duration: 0.7, ease: 'power3.out', stagger: 0.045
          }, 0.80);
        } else {
          tl.fromTo(
            '.hero-display .block',
            { y: 20, opacity: 0, filter: 'blur(8px)' },
            { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.9, stagger: 0.12, ease: 'power3.out' },
            0.30
          );
          tl.from('.hero-sub', { y: 22, opacity: 0, filter: 'blur(6px)', duration: 0.7, ease: 'power3.out' }, 0.80);
        }

        tl.from('.hero-paths li', { y: 14, opacity: 0, duration: 0.55, ease: 'power3.out', stagger: 0.07 }, 0.90);
        tl.from('.footer .brand, .footer-links li', { y: 14, opacity: 0, duration: 0.5, ease: 'power3.out', stagger: 0.04 }, 1.12);
      } catch (err) {
        /* SplitText or the timeline threw. Undo any split, drop the dead
           timeline, and hand the page to the CSS choreography that has always
           been the safety net. Never swallow this silently — a quiet catch
           here is what hid this bug in the first place. */
        if (window.console && console.warn) {
          console.warn('[newsocapis] GSAP entrance failed, falling back to CSS:', err);
        }
        splits.forEach(function (sp) {
          try { sp.revert(); } catch (e2) { /* already gone */ }
        });
        tl && tl.kill && tl.kill();
        docEl.classList.remove('gsap-entrance');
        settleEntranceTargets();
        docEl.classList.add('css-entrance');
        window.setTimeout(finish, 1900);
      }
    }

    /* ---- the 1px line fills 0→1 over 1.5s (easeOutQuart), then 0.7s curtain ---- */
    function runPreloader() {
      var total = 1500;   /* line fill window */
      var curtain = 700;  /* curtain slide-up duration */
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
        /* curtain clears (~2.2s → ever-sooner teardown) → unlock */
        window.setTimeout(cleanup, curtain + 20);
      }

      /* hard failsafe — never leaves the overlay locked in place */
      window.setTimeout(cleanup, 2600);

      requestAnimationFrame(tick);
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
     ScrollTrigger is no longer used anywhere. It shipped with the retired
     hero pin (hero-scroll.js) and nothing else ever registered a trigger, so
     refresh() had nothing to re-measure — and the section reveals below are
     driven by IntersectionObserver + CSS, which never needed it. The <script>
     is still loaded in index.html so window.ScrollTrigger exists for any
     future pin, but there is deliberately no setup code here.
     --------------------------------------------------------------- */

  /* ---------------------------------------------------------------
     Burger (button-driven): close the panel on link click and ESC.
     --------------------------------------------------------------- */
  (function () {
    var header = document.getElementById('nav');
    var toggle = document.getElementById('navToggle');
    if (!header || !toggle) return;

    var menu = document.getElementById('navMenu');
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    var coarsePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)');

    function focusables() {
      if (!menu) return [];
      return Array.prototype.filter.call(
        menu.querySelectorAll('a[href], button:not([disabled])'),
        function (el) { return el.offsetParent !== null; }
      );
    }

    function close(returnFocus) {
      if (!header.classList.contains('is-open')) return;
      header.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      if (returnFocus) toggle.focus();
      /* Put the indicator back on the desktop row it was drawn for. */
      header.dispatchEvent(new CustomEvent('nav:state'));
    }

    function open() {
      header.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      /* The panel is display:none until this class lands, so its links have
         no measurable box while the indicator is being asked about them.
         Measuring one frame later is the first moment the stacked layout
         exists, which is what the indicator needs to slide down onto the
         active row instead of inheriting the collapsed desktop geometry. */
      requestAnimationFrame(function () {
        header.dispatchEvent(new CustomEvent('nav:state'));
      });
    }

    toggle.addEventListener('click', function () {
      if (header.classList.contains('is-open')) {
        close(false);
      } else {
        open();
      }
    });

    header.querySelectorAll('.nav-link').forEach(function (link) {
      link.addEventListener('click', function () { close(false); });
    });

    document.addEventListener('keydown', function (e) {
      if (!header.classList.contains('is-open')) return;

      /* Escape closes and hands focus back to the button that opened it. */
      if (e.key === 'Escape') {
        e.preventDefault();
        close(true);
        return;
      }

      /* Focus trap: Tab cycles inside the open panel rather than escaping to
         the page behind it. Without this, tabbing off the last item drops the
         user into content they cannot see is still scrolled past. */
      if (e.key === 'Tab') {
        var items = focusables();
        if (!items.length) return;
        var first = items[0];
        var last = items[items.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (!menu.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    /* Tap outside closes. capture:true so a tap that starts on the page counts
       even if it ends on the pill, and so this wins over the toggle's own
       handler on the way down. */
    /* A tap that dismisses the menu would otherwise fall straight through to
       whatever sits underneath it. On a phone that is usually the hero CTA,
       which opens an external site in a new tab — so the user asks to
       close a menu and gets navigated away instead. Swallow exactly one click.
       The flag expires on its own in case no click follows the pointerdown. */
    var swallowNextClick = false;
    var swallowTimer = 0;

    document.addEventListener('pointerdown', function (e) {
      if (!header.classList.contains('is-open')) return;
      if (header.contains(e.target)) return;
      close(false);
      swallowNextClick = true;
      window.clearTimeout(swallowTimer);
      swallowTimer = window.setTimeout(function () { swallowNextClick = false; }, 400);
    }, { capture: true });

    document.addEventListener('click', function (e) {
      if (!swallowNextClick) return;
      swallowNextClick = false;
      e.preventDefault();
      e.stopPropagation();
    }, { capture: true });

    /* Returning to a desktop width must not leave the panel stranded open. */
    if (window.matchMedia) {
      var wide = window.matchMedia('(min-width: 1024px)');
      var onWide = function (e) { if (e.matches) close(false); };
      if (wide.addEventListener) wide.addEventListener('change', onWide);
      else if (wide.addListener) wide.addListener(onWide);
    }
  })();

  /* ---------------------------------------------------------------
     Navbar liquid glass — pointer highlight and on-media / on-light theme

     The pill is glass, so its contrast depends entirely on what is behind it.
     A single observer watches the two surfaces that matter: the hero (media)
     and the paper band below it. Whichever one is winning at the nav's own
     y-position decides data-theme, which the stylesheet uses to thicken or
     thin the tint. Nothing here restyles the links themselves, so the WCAG
     colour work stays exactly as it was.
     --------------------------------------------------------------- */
  (function () {
    var nav = document.getElementById('nav');
    var pill = nav && nav.querySelector('.nav-inner');
    if (!nav || !pill) return;

    /* --- pointer-tracked highlight ------------------------------------ */
    var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)');
    var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

    function trackHighlight() {
      var enabled = !!(fine && fine.matches) && !(still && still.matches);
      nav.setAttribute('data-pointer', enabled ? 'fine' : 'coarse');
      if (!enabled) return;

      var pending = false;
      var x = 0;
      var y = 0;

      function apply() {
        pending = false;
        pill.style.setProperty('--lg-x', x + 'px');
        pill.style.setProperty('--lg-y', y + 'px');
      }

      pill.addEventListener('pointermove', function (e) {
        var r = pill.getBoundingClientRect();
        x = e.clientX - r.left;
        y = e.clientY - r.top;
        if (pending) return;
        pending = true;
        requestAnimationFrame(apply);
      }, { passive: true });
    }

    trackHighlight();

    if (fine && fine.addEventListener) fine.addEventListener('change', trackHighlight);
    if (still && still.addEventListener) still.addEventListener('change', trackHighlight);

/* --- theme: media vs light -----------------------------------------
       The old version watched two hardcoded elements (the hero and the
       atmospheric card) with an IntersectionObserver and a -110px rootMargin.
       That only ever knew about those two surfaces, so any other dark section
       that scrolled under the pill left it wearing the light tint, and
       "is the nav over media right now" answered from a magic offset instead
       of the real pill position.

       The page declares the answer instead: every section the glass should
       react to carries data-nav="media" or data-nav="light". Once per frame we
       ask the browser what is actually under the middle of the pill via
       elementsFromPoint, walk outward to the nearest ancestor that declares a
       data-nav, and write that value. One rule covers every surface, present
       and future, with no offset to tune and no per-surface registration. */
    var themeValue = nav.getAttribute('data-theme') || 'media';

    function applyTheme(next) {
      if (next === themeValue) return;
      themeValue = next;
      nav.setAttribute('data-theme', next);
    }

    function nearestNavTheme(node) {
      while (node && node !== document.documentElement) {
        var t = node.getAttribute && node.getAttribute('data-nav');
        if (t === 'media' || t === 'light') return t;
        node = node.parentNode;
      }
      return null;
    }

    /* A decorative band can sit between two declared sections without
       declaring itself -- the parchment margin below the hero does. The stack
       walk correctly finds nothing there, and returning without a decision
       would strand whatever theme was set last, which is how the pill kept
       wearing "media" while sitting on paper. Falling back to the nearest
       declared surface by distance, then to the document default, makes the
       answer total: every pixel resolves to a theme. */
    function nearestDeclaredTheme(y) {
      var best = null;
      var bestDistance = Infinity;
      var carriers = document.querySelectorAll('[data-nav="media"], [data-nav="light"]');
      for (var i = 0; i < carriers.length; i++) {
        var r = carriers[i].getBoundingClientRect();
        if (!r.height) continue;
        var t = carriers[i].getAttribute('data-nav');
        var distance = y < r.top ? r.top - y : (y > r.bottom ? y - r.bottom : 0);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = t;
        }
      }
      return best || 'light';
    }

    function themeFromPoint() {
      var r = pill.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var cx = r.left + r.width / 2;
      var cy = r.top + r.height / 2;
      var stack = document.elementsFromPoint(cx, cy);
      for (var i = 0; i < stack.length; i++) {
        var t = nearestNavTheme(stack[i]);
        if (t) { applyTheme(t); return; }
      }
      applyTheme(nearestDeclaredTheme(cy));
    }

    /* Coalesce to one hit test per frame: scroll fires far more often than the
       layout can actually change, and elementsFromPoint forces layout. */
    var themePending = false;
    function scheduleTheme() {
      if (themePending) return;
      themePending = true;
      requestAnimationFrame(function () {
        themePending = false;
        themeFromPoint();
      });
    }

    window.addEventListener('scroll', scheduleTheme, { passive: true });
    window.addEventListener('resize', scheduleTheme);
    themeFromPoint();

    /* --- sliding active indicator ---------------------------------------
       One absolutely positioned .nav-active lives inside .nav-menu. script.js
       only writes two custom properties -- the active link's offset and width
       measured against the menu -- and CSS transitions them, so the travel is
       a transform/width change rather than a relayout. The horizontal row
       (desktop) and the vertical stack (mobile panel) share the element; the
       stylesheet decides which axis the translate reads. */
    var indicator = nav.querySelector('[data-nav-active]');
    var menu = nav.querySelector('.nav-menu');
    var wide = window.matchMedia && window.matchMedia('(min-width: 1024px)');
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    var lockUntil = 0;

    function positionIndicator() {
      if (!indicator || !menu) return;

      /* While a smooth scroll is in flight the target link is still moving, so
         measuring it would park the indicator where the link is not. */
      if (Date.now() < lockUntil) return;

      var active = menu.querySelector('.nav-link.is-active');
      if (!active) {
        indicator.classList.remove('is-shown');
        indicator.style.setProperty('--nav-w', '0px');
        return;
      }

      var m = menu.getBoundingClientRect();
      var a = active.getBoundingClientRect();

      if (wide && wide.matches) {
        indicator.style.setProperty('--nav-w', a.width + 'px');
        indicator.style.setProperty('--nav-h', a.height + 'px');
        indicator.style.setProperty('--nav-x', (a.left - m.left) + 'px');
        indicator.style.setProperty('--nav-y', '0px');
      } else {
        /* Stacked rows have no horizontal track, so the pill spans the panel
           and travels on the vertical axis instead. The row height is measured
           too -- inheriting the panel's height would paint the whole stack. */
        indicator.style.setProperty('--nav-w', m.width + 'px');
        indicator.style.setProperty('--nav-h', a.height + 'px');
        indicator.style.setProperty('--nav-x', '0px');
        indicator.style.setProperty('--nav-y', (a.top - m.top) + 'px');
      }

      indicator.classList.add('is-shown');
    }

    /* A click on a nav link scrolls smoothly. Hold the indicator still until
       the browser reports the scroll settled, otherwise it snaps to the
       outgoing section and then jumps. scrollend is not universal and a
       cancelled smooth scroll never fires one, so a timeout always releases
       the lock. */
    function lockIndicator() {
      /* Reduced motion makes the jump instant, so there is nothing to wait
         out -- hold for a single frame and re-measure right away. */
      var hold = reduceMotion && reduceMotion.matches ? 32 : 900;
      lockUntil = Date.now() + hold;
      window.setTimeout(positionIndicator, hold);
    }

    /* The section observer below owns which link is active; these two events
       are how it hands the indicator over. nav:state = a section boundary
       was crossed, position now. nav:lock = a link was clicked, hold still
       until the smooth scroll settles. */
    nav.addEventListener('nav:state', positionIndicator);
    nav.addEventListener('nav:lock', lockIndicator);

    if ('onscrollend' in window) {
      window.addEventListener('scrollend', function () {
        /* scrollend landing inside the lock window means the scroll beat the
           timeout, so release early rather than idling out the remainder. */
        lockUntil = 0;
        positionIndicator();
      });
    }

    /* Web fonts land after first paint and change every link's measured width,
       so a first measurement taken against the fallback face slides the
       indicator onto the wrong spot a beat later. Re-measure when they are
       ready, on resize, and whenever the layout crosses the desktop/mobile
       breakpoint, since that changes which axis the indicator travels on. */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(positionIndicator);
    }
    window.addEventListener('resize', positionIndicator);
    if (wide && wide.addEventListener) wide.addEventListener('change', positionIndicator);

    /* First paint: the desktop row is laid out by the time this runs, so the
       indicator can be placed immediately. The mobile panel is display:none
       until the burger opens, so its first real measurement happens there. */
    positionIndicator();
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
        backToTop.classList.toggle('visible', show);
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
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    if (bar || backToTop) {
      update();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
    }
  })();

  /* ---------------------------------------------------------------
     Reveal-on-scroll — [data-reveal] / .is-in.
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
    if (!('IntersectionObserver' in window)) {
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
     Active nav section -> .is-active + the sliding indicator

     The observer here is only a cheap trigger. It fires when something
     crosses the reading band, which is a handful of times per page rather
     than once per scroll frame.

     The winner is recomputed from live rects instead of being taken from the
     callback's entry list. The old code picked the highest intersectionRatio
     among the entries in that one batch, and entries arrive per observed
     element, so a batch could easily contain only the elements that just left
     the band: after a smooth scroll to #clarity the final state was no link
     marked active at all, even though #clarity was sitting squarely in the
     band. Reading the rects of every tracked section sidesteps that entirely
     -- whatever the batch contained, the answer is the same.

     The band is the 5%-tall strip at 40-45% down the viewport: the line the
     reader's eye treats as "here". A section wins if it covers that strip,
     and the bottom-of-page case resolves to the last section, since the
     viewport centre can legitimately rest in a gap between bands.

     The decision is broadcast as nav:state and the navbar module listens for
     it, so the indicator moves in the same turn that sets the class. A click
     fires nav:lock, which holds the indicator still until the smooth scroll
     settles instead of letting it travel through every section on the way.
     --------------------------------------------------------------- */
  (function () {
    var nav = document.getElementById('nav');
    var sectionsByHref = { top: 'hero', features: 'features', flow: 'flow', clarity: 'clarity' };
    var links = {};
    [].forEach.call(document.querySelectorAll('.nav-link'), function (a) {
      var key = (a.getAttribute('href') || '').replace(/^#/, '');
      if (key in sectionsByHref) links[sectionsByHref[key]] = a;
    });

    var sections = [];
    Object.keys(sectionsByHref).forEach(function (key) {
      var el = document.getElementById(sectionsByHref[key]);
      if (el) sections.push(el);
    });

    var current = null;

    function set(sectionId) {
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
      if (nav) nav.dispatchEvent(new CustomEvent('nav:state'));
    }

    /* Whichever tracked section covers the reading band wins. Sections are not
       nested, so at most one can cover it. */
    function winner() {
      var top = window.innerHeight * 0.40;
      var bottom = window.innerHeight * 0.45;
      for (var i = 0; i < sections.length; i++) {
        var r = sections[i].getBoundingClientRect();
        if (r.top <= bottom && r.bottom >= top) return sections[i].id;
      }

      /* Past the last band -- either the bottom of the page or a bare stretch
         between two sections. The document order is the reading order, so the
         last section above the band is the one the reader is looking at. */
      var last = '';
      for (var j = 0; j < sections.length; j++) {
        if (sections[j].getBoundingClientRect().bottom <= top) last = sections[j].id;
      }
      return last;
    }

    function sync() { set(winner()); }

    if (!('IntersectionObserver' in window) || !links.hero) return;

    var band = new IntersectionObserver(sync, {
      rootMargin: '-40% 0px -55% 0px',
      threshold: 0
    });
    sections.forEach(function (el) { band.observe(el); });

    sync();

    /* A programmatic scrollIntoView or a restored scroll position can move the
       page without crossing the band from the observer's point of view, so the
       final resting state is re-read once the scroll has actually stopped. */
    if ('onscrollend' in window) window.addEventListener('scrollend', sync);

    if (!nav) return;

    [].forEach.call(document.querySelectorAll('.nav-link'), function (a) {
      a.addEventListener('click', function () {
        nav.dispatchEvent(new CustomEvent('nav:lock'));
      });
    });
  })();

  /* ---------------------------------------------------------------
     Magnetic buttons — [data-magnet]. Fish to the pointer, max ~14px.
     GSAP quickTo when available, rAF lerp otherwise. pointer:fine only.
     Active press uses the CSS `scale` property.
     --------------------------------------------------------------- */
  (function () {
    var btns = document.querySelectorAll('[data-magnet]');
    if (!btns.length || !finePointer.matches) return;

    function clampMag(dx, half) {
      var t = Math.max(-1, Math.min(1, dx / half));
      return t * 14;
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
     Hero video — decoration only, with a manual play/pause control.

     There is deliberately no autoplay attribute on the element. Playback is
     started from here, so a browser with JS disabled, a save-data connection,
     or prefers-reduced-motion never decodes a single frame and simply keeps
     the poster. That is also why the fade-in is class-driven rather than a
     CSS media query: the class only lands once play() has actually resolved,
     so a rejected autoplay promise leaves the gradient underneath visible
     instead of a black video plate.

     The button in the bottom strip is the one place a visitor can override
     that decision, so it has to work in every state the autoplay guard can
     leave behind -- poster only (save-data), poster only (reduced motion, where
     the media query above also stops the scroll cue), playing, paused by the
     visitor, and a file that never decoded at all. It is wired before the two
     early returns for exactly that reason: on the paths where they return, the
     video is present and paused, and a control claiming to pause something that
     is already paused would be a lie.
     --------------------------------------------------------------- */
  (function () {
    var video = document.querySelector('[data-hero-video]');
    if (!video) return;

    var toggle = document.querySelector('[data-video-toggle]');
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

    function saveData() {
      var c = navigator.connection;
      return !!(c && c.saveData);
    }

    /* --- the control --------------------------------------------------- */

    /* aria-label has to describe the action, not the state, so it flips with
       the button rather than describing what is currently on screen. */
    function paint(playing) {
      if (!toggle) return;
      toggle.classList.toggle('is-paused', !playing);
      toggle.setAttribute('aria-label', playing ? 'Pause background video' : 'Play background video');
      toggle.setAttribute('aria-pressed', playing ? 'false' : 'true');
    }

    function isPlaying() {
      return !video.paused && !video.ended && video.readyState > 2;
    }

    function reveal() {
      video.classList.add('is-ready');
    }

    function start() {
      var attempt = video.play();
      if (attempt && typeof attempt.then === 'function') {
        attempt.then(function () {
          reveal();
          paint(true);
        }).catch(function () {
          /* Autoplay refused, or the codec is unsupported: the poster stays. */
          paint(false);
        });
      } else {
        /* Older engines return undefined and either play or silently do not. */
        reveal();
        paint(isPlaying());
      }
    }

    if (toggle) {
      /* Pause is the resting icon, so anything that has not started yet — the
         poster-only paths and the failure path — is painted as paused. */
      paint(false);

      toggle.addEventListener('click', function () {
        if (isPlaying()) {
          video.pause();
          paint(false);
          return;
        }
        start();
      });

      /* Keep the icon honest when something outside this script pauses the
         video, e.g. a browser pausing background tabs. */
      ['play', 'pause', 'ended'].forEach(function (evt) {
        video.addEventListener(evt, function () { paint(isPlaying()); });
      });
    }

    /* --- autoplay gate -------------------------------------------------- */

    if (reduceMotion && reduceMotion.matches) return;
    if (saveData()) return;

    if (video.readyState >= 2) {
      start();
      return;
    }

    /* Wait until enough of the file has decoded before spending a play() call. */
    video.addEventListener('canplay', start, { once: true });
    /* A missing or undecodable file must not surface as an error state. The
       poster is a still of the same dusk scene, so it stays put and becomes
       the fallback — dropping it would leave the bare gradient, which is a
       worse picture than the frame the visitor would have got. The button
       hides itself in that case, because there is nothing to play. */
    video.addEventListener('error', function () {
      video.classList.add('is-fallback');
      if (toggle) toggle.hidden = true;
    }, { once: true });

    /* preload="none" in the markup is what makes the two early returns above
       worth having: nothing is fetched until we already know we are allowed
       to play, so a save-data visitor pays zero bytes for a video they will
       never see. Listeners are attached before load() so canplay cannot be
       missed. */
    video.load();
  })();

  /* ---------------------------------------------------------------
     Footer year
     --------------------------------------------------------------- */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();