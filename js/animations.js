/* Newsocapis — scroll choreography.
   Desktop (≥1024px) gets the pinned feature deck, blob morph and parallax.
   Below that the page uses simple fade/slide reveals. Reduced motion exits
   before any tween is created, leaving the static layout intact. */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || !window.gsap) return;

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  if (!ScrollTrigger) return;

  gsap.registerPlugin(ScrollTrigger);
  if (window.SplitText) gsap.registerPlugin(window.SplitText);
  if (window.MorphSVGPlugin) gsap.registerPlugin(window.MorphSVGPlugin);

  var mm = gsap.matchMedia();

  /* ---------- Hero entrance ---------- */
  var heroIntro = gsap.timeline({ defaults: { ease: 'power4.out' } });
  heroIntro
    .from('.nav-inner', { y: -28, opacity: 0, duration: 0.9 }, 0)
    .from('.hero-eyebrow', { y: 16, opacity: 0, duration: 0.7 }, 0.15)
    .from('.hero-line-inner', { yPercent: 110, duration: 1.15, stagger: 0.12 }, 0.2)
    .from('.hero-sub', { y: 18, opacity: 0, duration: 0.8 }, 0.65)
    .from('.hero-actions', { y: 18, opacity: 0, duration: 0.8 }, 0.75)
    .from('.hero-art', { y: 110, opacity: 0, duration: 1.2 }, 0.55)
    .from('.scroll-cue', { opacity: 0, duration: 0.8 }, 0.95);

  /* ---------- Overview ---------- */
  gsap.from('.overview-copy > :not(.overview-lead)', {
    y: 24,
    opacity: 0,
    duration: 0.9,
    stagger: 0.08,
    ease: 'power3.out',
    scrollTrigger: { trigger: '.overview-copy', start: 'top 78%', once: true }
  });

  gsap.from('.overview-art', {
    y: 48,
    opacity: 0,
    scale: 0.98,
    duration: 1,
    ease: 'power3.out',
    scrollTrigger: { trigger: '.overview-art', start: 'top 85%', once: true }
  });

  gsap.to('.overview-art svg', {
    y: -8,
    duration: 3.4,
    ease: 'sine.inOut',
    yoyo: true,
    repeat: -1,
    delay: 0.8
  });

  /* ---------- Feature head ---------- */
  gsap.from('.features-head > *', {
    y: 24,
    opacity: 0,
    duration: 0.9,
    stagger: 0.08,
    ease: 'power3.out',
    scrollTrigger: { trigger: '.features-head', start: 'top 80%', once: true }
  });

  /* ---------- Features · desktop pin ---------- */
  mm.add('(min-width: 1024px)', function () {
    var stage = document.querySelector('.features-stage');
    var cards = gsap.utils.toArray('.feature-card');
    var blob = document.getElementById('featureBlob');
    var dots = gsap.utils.toArray('.feature-progress span');
    if (!stage || cards.length < 3) return;

    stage.classList.add('gsap-ready');
    var originalD = blob ? blob.getAttribute('d') : '';
    var blobPaths = [
      originalD,
      'M520,60 C700,80 880,180 900,360 C920,540 830,700 690,800 C550,900 360,910 230,800 C100,690 60,520 110,360 C160,200 300,90 420,70 C460,62 490,58 520,60 Z',
      'M480,90 C640,50 820,120 890,280 C960,440 910,640 790,770 C670,900 480,950 330,870 C180,790 70,640 90,470 C110,300 210,150 350,110 C390,98 440,95 480,90 Z'
    ];

    gsap.set(cards, {
      yPercent: function (index) { return index === 0 ? 0 : 160; },
      opacity: 1,
      scale: 1
    });

    var deck = gsap.timeline({
      scrollTrigger: {
        trigger: '.features-pin',
        start: 'top top',
        end: '+=260%',
        pin: stage,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: function (self) {
          var index = self.progress < 0.38 ? 0 : self.progress < 0.72 ? 1 : 2;
          dots.forEach(function (dot, i) {
            dot.classList.toggle('is-active', i === index);
          });
        }
      }
    });

    deck
      .to(cards[0], { scale: 0.94, yPercent: -6, duration: 0.8, ease: 'power2.out' }, 0.9)
      .to(cards[1], { yPercent: 0, duration: 1, ease: 'power2.out' }, 0.9);

    if (window.MorphSVGPlugin && blob) {
      deck.to(blob, { morphSVG: blobPaths[1], duration: 1, ease: 'none' }, 0.9);
    }

    deck
      .to(cards[1], { scale: 0.94, yPercent: -6, duration: 0.8, ease: 'power2.out' }, 1.9)
      .to(cards[2], { yPercent: 0, duration: 1, ease: 'power2.out' }, 1.9);

    if (window.MorphSVGPlugin && blob) {
      deck.to(blob, { morphSVG: blobPaths[2], duration: 1, ease: 'none' }, 1.9);
    }

    cards.forEach(function (card) {
      var art = card.querySelector('.feature-card-art');
      if (!art) return;
      gsap.to(art, {
        y: -20,
        ease: 'none',
        scrollTrigger: {
          trigger: '.features-pin',
          start: 'top top',
          end: '+=260%',
          scrub: 1
        }
      });
    });

    return function () {
      stage.classList.remove('gsap-ready');
      gsap.set(cards, { clearProps: 'all' });
      if (blob && originalD) blob.setAttribute('d', originalD);
      dots.forEach(function (dot, i) {
        dot.classList.toggle('is-active', i === 0);
      });
    };
  });

  /* ---------- Features · mobile / tablet ---------- */
  mm.add('(max-width: 1023px)', function () {
    gsap.utils.toArray('.feature-card').forEach(function (card) {
      gsap.from(card, {
        y: 40,
        opacity: 0,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: { trigger: card, start: 'top 85%', once: true }
      });
    });
  });

  /* ---------- Flow ---------- */
  gsap.from('.flow-head > *', {
    y: 24,
    opacity: 0,
    duration: 0.9,
    stagger: 0.08,
    ease: 'power3.out',
    scrollTrigger: { trigger: '.flow-head', start: 'top 80%', once: true }
  });

  var flowLine = document.querySelector('.flow-line path');
  if (flowLine) {
    var lineLength = flowLine.getTotalLength();
    gsap.fromTo(flowLine,
      { strokeDasharray: lineLength, strokeDashoffset: lineLength },
      {
        strokeDashoffset: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: '.flow-track',
          start: 'top 78%',
          end: 'bottom 60%',
          scrub: true
        }
      }
    );
  }

  gsap.from('.flow-step', {
    y: 30,
    opacity: 0,
    duration: 0.9,
    stagger: 0.1,
    ease: 'power3.out',
    scrollTrigger: { trigger: '.flow-steps', start: 'top 82%', once: true }
  });

  /* ---------- Clarity ---------- */
  gsap.from('.clarity-copy > :not(.clarity-display)', {
    y: 24,
    opacity: 0,
    duration: 0.9,
    stagger: 0.08,
    ease: 'power3.out',
    scrollTrigger: { trigger: '.clarity', start: 'top 72%', once: true }
  });

  gsap.from('.clarity-art', {
    scale: 0.9,
    rotate: -2,
    opacity: 0,
    duration: 1,
    ease: 'power3.out',
    scrollTrigger: { trigger: '.clarity-art', start: 'top 85%', once: true }
  });

  /* ---------- Closing + footer ---------- */
  gsap.fromTo('.closing', { y: 32 }, {
    y: 0,
    ease: 'none',
    scrollTrigger: {
      trigger: '.closing',
      start: 'top bottom',
      end: 'top 45%',
      scrub: true
    }
  });

  gsap.from('.closing-inner > *', {
    y: 30,
    opacity: 0,
    duration: 0.9,
    stagger: 0.08,
    ease: 'power3.out',
    scrollTrigger: { trigger: '.closing', start: 'top 68%', once: true }
  });

  gsap.from('.footer-statement', {
    y: 40,
    opacity: 0,
    duration: 1,
    ease: 'power3.out',
    scrollTrigger: { trigger: '.footer', start: 'top 88%', once: true }
  });

  gsap.from('.footer-grid > *', {
    y: 24,
    opacity: 0,
    duration: 0.8,
    stagger: 0.1,
    ease: 'power3.out',
    scrollTrigger: { trigger: '.footer-grid', start: 'top 92%', once: true }
  });

  /* ---------- Desktop hero parallax ---------- */
  mm.add('(min-width: 1024px)', function () {
    gsap.to('.hero-copy', {
      yPercent: -10,
      ease: 'none',
      scrollTrigger: {
        trigger: '.hero',
        start: 'top top',
        end: 'bottom top',
        scrub: true
      }
    });

    gsap.to('.hero-art svg', {
      yPercent: 7,
      ease: 'none',
      scrollTrigger: {
        trigger: '.hero',
        start: 'top top',
        end: 'bottom top',
        scrub: true
      }
    });
  });

  /* ---------- Text splitting after the webfont lands ---------- */
  function splitText() {
    if (window.SplitText) {
      try {
        var lead = new window.SplitText('.overview-lead', {
          type: 'lines',
          mask: 'lines',
          linesClass: 'split-line'
        });
        gsap.from(lead.lines, {
          yPercent: 100,
          opacity: 0,
          duration: 0.9,
          stagger: 0.08,
          ease: 'power3.out',
          scrollTrigger: { trigger: '.overview-lead', start: 'top 82%', once: true }
        });
      } catch (error) {
        gsap.from('.overview-lead', {
          y: 24,
          opacity: 0,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: '.overview-lead', start: 'top 82%', once: true }
        });
      }

      try {
        var headline = new window.SplitText('.clarity-display', {
          type: 'words',
          wordsClass: 'split-word'
        });
        gsap.fromTo(headline.words,
          { color: '#80827f' },
          {
            color: '#2c2e2a',
            stagger: 0.06,
            ease: 'none',
            scrollTrigger: {
              trigger: '.clarity',
              start: 'top 68%',
              end: 'center 45%',
              scrub: true
            }
          }
        );
      } catch (error) {
        /* The heading stays in its default ink colour. */
      }
    }

    ScrollTrigger.refresh();
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(splitText);
  } else {
    splitText();
  }
})();
