/* Newsocapis — fluid neon cursor.
   Two difference-blended layers: a fast dot (lerp .55) and a trailing ring
   (lerp .18). Rings swell (scale 2.6) over anything interactive. Classic-
   script, pointer:fine only — touch devices never see a dead cursor.
   Arms only after the preloader parts so the native cursor never vanishes
   behind the loading chevrons with nothing to replace it. */

(function () {
  'use strict';

  var fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (!fine.matches) return;

  var docEl = document.documentElement;
  var dot = null;
  var ring = null;
  var armed = false;

  var tx = -100, ty = -100;
  var px = -100, py = -100;
  var rx = -100, ry = -100;
  var raf = null;

  function onMove(e) {
    tx = e.clientX;
    ty = e.clientY;
    if (armed && raf === null) raf = window.requestAnimationFrame(loop);
  }

  function loop() {
    raf = null;
    if (!dot || !ring) return;
    px += (tx - px) * 0.55;
    py += (ty - py) * 0.55;
    rx += (tx - rx) * 0.18;
    ry += (ty - ry) * 0.18;
    dot.style.translate = px.toFixed(2) + 'px ' + py.toFixed(2) + 'px';
    ring.style.translate = rx.toFixed(2) + 'px ' + ry.toFixed(2) + 'px';
    if (Math.abs(tx - rx) > 0.4 || Math.abs(ty - ry) > 0.4 ||
        Math.abs(tx - px) > 0.2 || Math.abs(ty - py) > 0.2) {
      raf = window.requestAnimationFrame(loop);
    }
  }

  function arm() {
    if (armed) return;
    armed = true;
    docEl.classList.add('has-cursor');
    dot = document.createElement('div');
    ring = document.createElement('div');
    dot.className = 'cur-dot';
    ring.className = 'cur-ring';
    dot.setAttribute('aria-hidden', 'true');
    ring.setAttribute('aria-hidden', 'true');
    document.body.appendChild(dot);
    document.body.appendChild(ring);
  }

  window.addEventListener('pointermove', onMove, { passive: true });

  if (docEl.classList.contains('is-entered')) {
    arm();
  } else if (window.MutationObserver) {
    new MutationObserver(function () {
      if (docEl.classList.contains('is-entered')) arm();
    }).observe(docEl, { attributes: true, attributeFilter: ['class'] });
    window.setTimeout(arm, 3200);
  } else {
    window.setTimeout(arm, 2400);
  }

  var HOT = 'a, button, [data-magnet], .tile, .pill, .nav-contact';
  function nearest(el) {
    return el && el.closest ? el.closest(HOT) : null;
  }

  document.addEventListener('pointerover', function (e) {
    if (nearest(e.target)) docEl.classList.add('cursor-hot');
  }, { passive: true });

  document.addEventListener('pointerout', function (e) {
    if (!nearest(e.target)) docEl.classList.remove('cursor-hot');
  }, { passive: true });
})();