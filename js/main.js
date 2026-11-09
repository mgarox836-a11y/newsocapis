/* Newsocapis — boot, smooth scroll, progress and anchor routing.
   Lenis is optional: without it the page falls back to native scrolling and
   every link still works. Motion is always on, regardless of OS settings. */

(function () {
  'use strict';

  var lenis = null;
  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;

  if (window.Lenis) {
    lenis = new window.Lenis({
      duration: 1.1,
      easing: function (t) {
        return Math.min(1, 1.001 - Math.pow(2, -10 * t));
      },
      smoothWheel: true
    });

    if (ScrollTrigger) {
      lenis.on('scroll', ScrollTrigger.update);
    }

    if (gsap) {
      gsap.ticker.add(function (time) {
        lenis.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0);
    } else {
      var raf = function (time) {
        lenis.raf(time);
        window.requestAnimationFrame(raf);
      };
      window.requestAnimationFrame(raf);
    }
  }

  /* ---------- Scroll progress ---------- */
  var progressBar = document.querySelector('#scroll-progress span');

  function updateProgress() {
    if (!progressBar) return;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var ratio = max > 0 ? window.scrollY / max : 0;
    progressBar.style.transform = 'scaleX(' + Math.min(1, Math.max(0, ratio)) + ')';
  }

  if (lenis) lenis.on('scroll', updateProgress);
  window.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();

  /* ---------- Anchor routing ---------- */
  function scrollTo(hash) {
    var target = hash === '#top' ? document.body : document.querySelector(hash);
    if (!target) return;

    if (lenis) {
      lenis.start();
      lenis.scrollTo(target === document.body ? 0 : target, {
        offset: target === document.body ? 0 : -88,
        duration: 1.1
      });
    } else if (target === document.body) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    if (window.history.pushState) {
      window.history.pushState(null, '', hash);
    }
  }

  document.addEventListener('click', function (event) {
    var link = event.target.closest ? event.target.closest('a[href^="#"]') : null;
    if (!link) return;

    /* The menu handles its own links so it can close and unlock first. */
    if (document.body.classList.contains('menu-open')) return;

    var hash = link.getAttribute('href');
    if (!hash || hash === '#') return;

    var target = document.querySelector(hash);
    if (!target) return;

    event.preventDefault();
    scrollTo(hash);
  });

  /* ---------- Public handle ---------- */
  window.NEWSOCAPIS = {
    lenis: lenis,
    scrollTo: scrollTo
  };

  /* ---------- Small housekeeping ---------- */
  var year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  function refresh() {
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(refresh);
  }
  window.addEventListener('load', function () {
    refresh();
    window.setTimeout(refresh, 600);
  });
})();
