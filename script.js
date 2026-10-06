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
      if (window.__heroIntroInit) return;
      window.__heroIntroInit = true;

      if (!gsapAvailable()) {
        /* pure-CSS keyframe entrance — same choreography, no library */
        docEl.classList.add('css-entrance');
        /* let the CSS keyframes play (latest delay ≈1.2s + 0.7s), then pin */
        window.setTimeout(cleanup, 1900);
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
              cleanup();
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
        /* curtain clears; GSAP onComplete / CSS timeout will call cleanup */
      }

      /* hard failsafe — never leaves the overlay locked in place (extended for GSAP timeline) */
      window.setTimeout(cleanup, 4000);

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

      /* Skip indicator positioning on mobile (below 1024px) — the panel uses
         .is-active class on the link itself for the active pill, no JS sliding
         needed. This prevents the indicator from jumping to the CTA button on
         hover/focus and covering it. */
      if (wide && !wide.matches) {
        indicator.classList.remove('is-shown');
        indicator.style.setProperty('--nav-w', '0px');
        return;
      }

      var target = menu.querySelector('.nav-link.is-active');

      if (!target) {
        indicator.classList.remove('is-shown');
        indicator.style.setProperty('--nav-w', '0px');
        return;
      }

      var m = menu.getBoundingClientRect();
      var a = target.getBoundingClientRect();

      if (wide && wide.matches) {
        indicator.style.setProperty('--nav-w', a.width + 'px');
        indicator.style.setProperty('--nav-h', a.height + 'px');
        indicator.style.setProperty('--nav-x', (a.left - m.left) + 'px');
        indicator.style.setProperty('--nav-y', '0px');
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
    if (wide && wide.addEventListener) {
      wide.addEventListener('change', function (e) {
        if (e.matches) {
          /* Re-measure when crossing back to desktop */
          positionIndicator();
        } else {
          /* Hide indicator on mobile */
          indicator.classList.remove('is-shown');
          indicator.style.setProperty('--nav-w', '0px');
        }
      });
    }

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
     Hero elements (inside [data-no-reveal]) are excluded — they have their
     own choreographed entrance via GSAP/CSS fallback, not the generic scroll reveal.
     --------------------------------------------------------------- */
  (function () {
    var allEls = document.querySelectorAll('[data-reveal]');
    var els = [];
    for (var i = 0; i < allEls.length; i++) {
      if (!allEls[i].closest('[data-no-reveal]')) els.push(allEls[i]);
    }
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
    btns = Array.prototype.filter.call(btns, function (b) {
      var navEl = document.getElementById('nav');
      if (navEl && navEl.contains(b)) return false;
      if (b.classList.contains('nav-contact')) return false;
      return true;
    });
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
     Feature card proximity — [data-card-interactive].

     A soft Cerulean wash that tracks the cursor, a small 3D tilt, a lift,
     and a magnetised arrow. Four constraints shape the code:

     1. ONE pointermove listener and ONE rAF loop for the whole section,
        not one per card. Proximity has to be measured before the cursor
        arrives, so the listener sits on the section — but the work it
        does is one target pass, and one loop commits it.
     2. NO READS INSIDE THE FRAME. getBoundingClientRect() forces layout,
        so every rect — card and arrow — is cached in page space and only
        invalidated on scroll, resize, and font load. The frame itself is
        arithmetic plus style writes, so it cannot thrash.
     3. ONE INVALIDATION PATH. Scrolling moves the cards but not the
        cursor, so the cached cursor position is re-solved against the new
        geometry. Without that the spotlight would smear as the page moves
        under a still cursor.
     4. GSAP quickTo when available, rAF lerp otherwise, matching the
        magnetic-button treatment above. Both paths write the same custom
        properties, so the stylesheet never has to know which one ran.

     prefers-reduced-motion drops the tilt, lift and magnet and keeps only
     the wash — a colour change rather than travel.
     --------------------------------------------------------------- */
  (function () {
    var cards = document.querySelectorAll('[data-card-interactive]');
    if (!cards.length || !finePointer.matches) return;

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

    var WASH_MAX = 0.10;   /* peak alpha of the Cerulean wash             */
    var TILT_MAX = 3.2;    /* deg — enough to catch light, not to wobble  */
    var LIFT_MAX = 4;      /* px                                          */
    var REACH = 140;       /* px outside the card where the wash begins   */
    var MAGNET = 6;        /* px the arrow travels toward the pointer     */
    var MAGNET_ZONE = 90;  /* px radius around the arrow for the pull    */
    var ARROW_SCALE = 1.14;

    var OFFSCREEN = -1e5;  /* cursor sentinel: far enough to be outside every REACH */

    /* Smoothstep rather than linear, so the wash leaves and arrives with no
       visible seam at the edge of the reach radius. */
    function smoothstep(x) { return x * x * (3 - 2 * x); }
    function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

    var tiles = [];
    Array.prototype.forEach.call(cards, function (card) {
      var arrow = card.querySelector('.tile-arrow');
      tiles.push({
        el: card,
        arrow: arrow,
        /* page-space rects, refreshed only by measure() */
        x: 0, y: 0, w: 0, h: 0,
        ax: 0, ay: 0,                    /* arrow centre, page space */
        /* targets, written by solve() */
        wash: 0, tiltX: 0, tiltY: 0, lift: 0,
        arrowX: 0, arrowY: 0, arrowScale: 1,
        mouseX: 0, mouseY: 0,
        /* current values, for the lerp backend */
        cWash: 0, cTiltX: 0, cTiltY: 0, cLift: 0,
        cArrowX: 0, cArrowY: 0, cArrowScale: 1,
        cMouseX: 0, cMouseY: 0,
        active: false
      });
    });

    var scrollX = 0;
    var scrollY = 0;
    var px = OFFSCREEN;   /* last known cursor, viewport space */
    var py = OFFSCREEN;

    /* Cache geometry in page space. Reading is expensive; this is the only
       place it happens. */
    function measure() {
      scrollX = window.pageXOffset || 0;
      scrollY = window.pageYOffset || 0;
      for (var i = 0; i < tiles.length; i++) {
        var t = tiles[i];
        var r = t.el.getBoundingClientRect();
        t.x = r.left + scrollX;
        t.y = r.top + scrollY;
        t.w = r.width;
        t.h = r.height;

        if (t.arrow) {
          var a = t.arrow.getBoundingClientRect();
          t.ax = a.left + a.width / 2 + scrollX;
          t.ay = a.top + a.height / 2 + scrollY;
        } else {
          /* No arrow is still a well-defined rest state. */
          t.ax = t.x + t.w / 2;
          t.ay = t.y + t.h / 2;
        }

        /* Seed the current values on first measure so a card revealed from
           blur does not animate in from the top-left corner. */
        if (!t.seeded) {
          t.seeded = true;
          t.mouseX = t.cMouseX = t.w / 2;
          t.mouseY = t.cMouseY = t.h / 2;
        }
      }
    }

    /* Compute every card's target state from one cursor position. Pure
       arithmetic over the cached rects — no DOM access at all. */
    function solve(cx, cy) {
      var still = reduceMotion && reduceMotion.matches;

      for (var i = 0; i < tiles.length; i++) {
        var t = tiles[i];

        var inside = cx >= t.x && cx <= t.x + t.w && cy >= t.y && cy <= t.y + t.h;

        var prox;
        if (inside) {
          prox = 1;
        } else {
          var dx = Math.max(t.x - cx, 0, cx - (t.x + t.w));
          var dy = Math.max(t.y - cy, 0, cy - (t.y + t.h));
          var dist = Math.sqrt(dx * dx + dy * dy);
          prox = dist >= REACH ? 0 : 1 - smoothstep(dist / REACH);
        }

        t.active = prox > 0.001;
        t.wash = prox;

        /* Clamped so the gradient centre never sits outside the surface. */
        t.mouseX = clamp(cx - t.x, 0, t.w);
        t.mouseY = clamp(cy - t.y, 0, t.h);

        if (still) {
          t.tiltX = t.tiltY = t.lift = 0;
          t.arrowX = t.arrowY = 0;
          t.arrowScale = 1;
          continue;
        }

        /* Normalised offset from the card centre, saturated at ±1. Because it
           saturates, the tilt is fullest at a corner rather than at the middle
           — which is where the cursor actually is. */
        var nx = t.w ? clamp((cx - (t.x + t.w / 2)) / (t.w / 2), -1, 1) : 0;
        var ny = t.h ? clamp((cy - (t.y + t.h / 2)) / (t.h / 2), -1, 1) : 0;

        /* tiltX is negated so a cursor near the top tips the top edge away,
           the way a real card resting on a table would react. */
        t.tiltX = ny * TILT_MAX * prox;
        t.tiltY = -nx * TILT_MAX * prox;
        t.lift = LIFT_MAX * prox;

        if (t.arrow) {
          var adx = cx - t.ax;
          var ady = cy - t.ay;
          var adist = Math.sqrt(adx * adx + ady * ady);
          if (inside && adist < MAGNET_ZONE) {
            var k = 1 - smoothstep(adist / MAGNET_ZONE);
            t.arrowX = (adx / MAGNET_ZONE) * MAGNET * k;
            t.arrowY = (ady / MAGNET_ZONE) * MAGNET * k;
            t.arrowScale = 1 + (ARROW_SCALE - 1) * k;
          } else {
            t.arrowX = t.arrowY = 0;
            t.arrowScale = 1;
          }
        }
      }
    }

    function rest() {
      px = py = OFFSCREEN;
      for (var i = 0; i < tiles.length; i++) {
        var t = tiles[i];
        t.active = false;
        t.wash = t.tiltX = t.tiltY = t.lift = 0;
        t.arrowX = t.arrowY = 0;
        t.arrowScale = 1;
      }
    }

    /* --- backend: GSAP quickTo, or rAF lerp --------------------------
       Both expose the same step(): commit the current targets, and keep a
       rAF alive only while GSAP does not own the easing. */

    var raf = null;
    var step;

    /* Probe GSAP from window, not from the reveal IIFE's gsapAvailable() helper:
       that helper is declared in a sibling closure, so calling it from here threw
       a ReferenceError that killed the rest of this script -- including the hero
       video IIFE below. This block only ever calls gsap.quickTo, so probe that. */
    if (!window.__gsapFailed && window.gsap && typeof window.gsap.quickTo === 'function') {
      var setMouseX = tiles.map(function (t) { return gsap.quickTo(t.el, '--mouse-x', { duration: 0.22, ease: 'power2.out' }); });
      var setMouseY = tiles.map(function (t) { return gsap.quickTo(t.el, '--mouse-y', { duration: 0.22, ease: 'power2.out' }); });
      var setWash = tiles.map(function (t) { return gsap.quickTo(t.el, '--spot-opacity', { duration: 0.32, ease: 'power2.out' }); });
      var setTiltX = tiles.map(function (t) { return gsap.quickTo(t.el, '--tilt-x', { duration: 0.55, ease: 'power3.out' }); });
      var setTiltY = tiles.map(function (t) { return gsap.quickTo(t.el, '--tilt-y', { duration: 0.55, ease: 'power3.out' }); });
      var setLift = tiles.map(function (t) { return gsap.quickTo(t.el, '--lift', { duration: 0.55, ease: 'power3.out' }); });
      var setArrowX = tiles.map(function (t) { return t.arrow ? gsap.quickTo(t.arrow, '--arrow-x', { duration: 0.4, ease: 'power3.out' }) : null; });
      var setArrowY = tiles.map(function (t) { return t.arrow ? gsap.quickTo(t.arrow, '--arrow-y', { duration: 0.4, ease: 'power3.out' }) : null; });
      var setArrowScale = tiles.map(function (t) { return t.arrow ? gsap.quickTo(t.arrow, '--arrow-scale', { duration: 0.4, ease: 'power3.out' }) : null; });

      step = function () {
        /* GSAP drives its own ticker, so this runs once per pointer event and
           the easing happens from there. */
        for (var i = 0; i < tiles.length; i++) {
          var t = tiles[i];
          setMouseX[i](t.mouseX.toFixed(1) + 'px');
          setMouseY[i](t.mouseY.toFixed(1) + 'px');
          setWash[i](t.wash.toFixed(3));
          setTiltX[i](t.tiltX.toFixed(2) + 'deg');
          setTiltY[i](t.tiltY.toFixed(2) + 'deg');
          setLift[i](t.lift.toFixed(2) + 'px');
          if (setArrowX[i]) {
            setArrowX[i](t.arrowX.toFixed(2) + 'px');
            setArrowY[i](t.arrowY.toFixed(2) + 'px');
            setArrowScale[i](t.arrowScale.toFixed(3));
          }
        }
      };
    } else {
      var EASE = 0.18;
      var EPS = 0.05;   /* px / deg / alpha: below this, call it settled */

      function follow(cur, target) {
        var next = cur + (target - cur) * EASE;
        if (Math.abs(target - next) > EPS) settling = true;
        return next;
      }

      var settling = false;

      step = function () {
        settling = false;

        for (var i = 0; i < tiles.length; i++) {
          var t = tiles[i];

          t.cMouseX = follow(t.cMouseX, t.mouseX);
          t.cMouseY = follow(t.cMouseY, t.mouseY);
          t.cWash = follow(t.cWash, t.wash);
          t.cTiltX = follow(t.cTiltX, t.tiltX);
          t.cTiltY = follow(t.cTiltY, t.tiltY);
          t.cLift = follow(t.cLift, t.lift);
          t.cArrowX = follow(t.cArrowX, t.arrowX);
          t.cArrowY = follow(t.cArrowY, t.arrowY);
          t.cArrowScale = follow(t.cArrowScale, t.arrowScale);

          var s = t.el.style;
          s.setProperty('--mouse-x', t.cMouseX.toFixed(1) + 'px');
          s.setProperty('--mouse-y', t.cMouseY.toFixed(1) + 'px');
          s.setProperty('--spot-opacity', (t.cWash * WASH_MAX).toFixed(3));
          s.setProperty('--tilt-x', t.cTiltX.toFixed(2) + 'deg');
          s.setProperty('--tilt-y', t.cTiltY.toFixed(2) + 'deg');
          s.setProperty('--lift', t.cLift.toFixed(2) + 'px');

          if (t.arrow) {
            var a = t.arrow.style;
            a.setProperty('--arrow-x', t.cArrowX.toFixed(2) + 'px');
            a.setProperty('--arrow-y', t.cArrowY.toFixed(2) + 'px');
            a.setProperty('--arrow-scale', t.cArrowScale.toFixed(3));
          }
        }

        /* Keep looping only while something is still converging, so an idle
           cursor costs no frames at all. */
        raf = settling ? requestAnimationFrame(step) : null;
      };
    }

    function schedule() {
      if (!raf) raf = requestAnimationFrame(step);
    }

    /* --- pointer input ------------------------------------------------
       One listener on the section, not one per card: proximity by
       definition has to be measured before the cursor arrives. */

    var section = document.getElementById('features') || document.body;

    section.addEventListener('pointermove', function (e) {
      px = e.clientX;
      py = e.clientY;
      solve(px + scrollX, py + scrollY);
      schedule();
    }, { passive: true });

    /* Leaving the section is the reliable signal that the cursor has left the
       card field entirely, so it is what ramps everything back to rest. */
    section.addEventListener('pointerleave', function () {
      rest();
      schedule();
    });

    /* --- rect cache invalidation --------------------------------------
       The cards move with the page; the cursor does not. Re-measuring and
       re-solving together is what keeps the wash pinned to the surface
       instead of smearing as the layout moves underneath a still pointer. */

    function invalidate() {
      measure();
      if (px > OFFSCREEN) solve(px + scrollX, py + scrollY);
      schedule();
    }

    window.addEventListener('scroll', invalidate, { passive: true });
    window.addEventListener('resize', invalidate, { passive: true });

    if (typeof ResizeObserver === 'function') {
      var ro = new ResizeObserver(function () { invalidate(); });
      for (var i = 0; i < tiles.length; i++) ro.observe(tiles[i].el);
    }

    /* Font loading reflows the tiles, which invalidates every cached rect. */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(invalidate);
    }

    measure();
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

    /* Failure path. The plate must stay visible on every state where playback
       never lands -- otherwise the plate's own opacity:0 hides the poster too
       and the visitor is left with the bare gradient. Hiding the button is
       honest here: there is nothing to pause or resume. */
    function fallback() {
      video.classList.add('is-fallback');
      paint(false);
      if (toggle) toggle.hidden = true;
    }

    /* Deliberate no-autoplay paths. Same visible result as fallback() -- the
       poster is the hero -- but the button stays, because the visitor is still
       allowed to start the clip by hand. Only a genuine failure hides it. */
    function showPoster() {
      video.classList.add('is-fallback');
      paint(false);
    }

    function start() {
      var attempt = video.play();
      if (attempt && typeof attempt.then === 'function') {
        attempt.then(function () {
          reveal();
          paint(true);
        }).catch(function () {
          /* Autoplay refused, or the codec is unsupported: the poster stays. */
          fallback();
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

    if (reduceMotion && reduceMotion.matches) { showPoster(); return; }
    if (saveData()) { showPoster(); return; }

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
    video.addEventListener('error', fallback, { once: true });

    /* A <source> that 404s or has an undecodable codec does not always surface
       on the video element. Listen on the sources too, otherwise the failure is
       silent and the safety timer below is the only thing that catches it. */
    Array.prototype.forEach.call(video.querySelectorAll('source'), function (src) {
      src.addEventListener('error', fallback, { once: true });
    });

    /* Safety net. canplay can be slow or never arrive on a stalled connection,
       and until it does the plate is at opacity 0 -- so the visitor would stare
       at the bare gradient for as long as the wait lasts. Three seconds is
       enough for a first frame on any connection worth serving video on; after
       that the poster becomes the hero and the video, if it ever arrives, still
       fades in over it. */
    setTimeout(function () {
      if (video.readyState >= 2) start();
      else fallback();
    }, 3000);

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