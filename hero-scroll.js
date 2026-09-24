/* Newsocapis — scroll-scrubbed hero choreography.
   Pins the hero ~160vh while a scrub timeline drives:
   - the WebGL "card burst" via NewsocHero.scrollBurst(p),
   - DOM parallax-out of the hero content (deep layered rates).
   Native scroll stays native — no wheel hijacking. Requires GSAP +
   ScrollTrigger (CDN); without them the page simply scrolls normally. */

(function () {
  'use strict';

  if (typeof window.gsap !== 'function' || typeof window.ScrollTrigger === 'undefined') return;
  var gsap = window.gsap;
  var hero = document.getElementById('hero');
  if (!hero) return;
  gsap.registerPlugin(window.ScrollTrigger);

  var tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: hero,
      start: 'top top',
      end: '+=160%',
      scrub: 1,
      toggleActions: 'play none none reverse',
      invalidateOnRefresh: true,
      onUpdate: function (self) {
        var p = self.progress;
        if (window.NewsocHero && window.NewsocHero.scrollBurst) window.NewsocHero.scrollBurst(p);
      }
    }
  });

  /* content parallax-out — the whole hero block drifts up and away while
     the WebGL formation bursts; layers move at different rates */
  tl.fromTo('.hero-inner', { yPercent: 0, scale: 1, opacity: 1 }, { yPercent: -26, scale: 0.96, opacity: 0.25 }, 0)
    .fromTo('.hero-sub', { yPercent: 0 }, { yPercent: -40 }, 0)
    .fromTo('.hero-paths', { yPercent: 0 }, { yPercent: -70 }, 0.05);

  /* re-measure once fonts settle so char masks & pin don't shift */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { window.ScrollTrigger.refresh(); });
  }
  window.addEventListener('load', function () { window.ScrollTrigger.refresh(); }, { once: true });
})();