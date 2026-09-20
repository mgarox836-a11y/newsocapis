document.documentElement.classList.add('js');

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================
  // MOBILE NAVIGATION TOGGLE
  // ==========================================
  const header = document.getElementById('nav');
  const toggle = document.getElementById('navToggle');

  if (toggle && header) {
    toggle.addEventListener('click', () => {
      const open = header.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu');
    });

    header.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        header.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ==========================================
  // DYNAMIC FOOTER YEAR
  // ==========================================
  document.querySelectorAll('[data-year]').forEach(el => {
    el.textContent = String(new Date().getFullYear());
  });

  // ==========================================
  // SCROLL PROGRESS + NAV STATE
  // ==========================================
  const progress = document.getElementById('progress');
  let ticking = false;

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (progress) {
          const max = document.documentElement.scrollHeight - window.innerHeight;
          progress.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')';
        }
        if (header) header.classList.toggle('is-scrolled', y > 12);
        ticking = false;
      });
    }
  }

  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;

  // ==========================================
  // SCROLL REVEAL (IntersectionObserver)
  // ==========================================
  const reveals = document.querySelectorAll('[data-reveal]');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach(el => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(el => io.observe(el));
  }

  // ==========================================
  // 3D TILT CARDS (pointer only)
  // ==========================================
  const tilts = document.querySelectorAll('[data-tilt]');

  if (!reduceMotion && !coarsePointer) {
    const tilt = (el, e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rx = (0.5 - py) * 9;
      const ry = (px - 0.5) * 9;
      el.style.transform = 'perspective(1000px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
      el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
      el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
    };

    const reset = el => {
      el.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
    };

    tilts.forEach(el => {
      el.addEventListener('pointermove', e => tilt(el, e));
      el.addEventListener('pointerleave', () => reset(el));
    });
  }

  // ==========================================
  // ACTIVE HUB 3D TILT (pointer only)
  // ==========================================
  const hub = document.querySelector('.active-hub-3d');

  if (hub && !reduceMotion && !coarsePointer) {
    const tiltHub = e => {
      const r = hub.getBoundingClientRect();
      if (r.width === 0) return;
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rx = (0.5 - py) * 12;
      const ry = (px - 0.5) * 12;
      hub.style.transform = 'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
      hub.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
      hub.style.setProperty('--my', (py * 100).toFixed(1) + '%');
    };

    const resetHub = () => {
      hub.style.transform = 'rotateX(0deg) rotateY(0deg)';
    };

    hub.addEventListener('pointermove', tiltHub);
    hub.addEventListener('pointerleave', resetHub);
  }

  // ==========================================
  // MAGNETIC BUTTONS (pointer only)
  // ==========================================
  const magnets = document.querySelectorAll('[data-magnetic]');

  if (!reduceMotion && !coarsePointer) {
    const strength = 0.28;
    magnets.forEach(btn => {
      btn.addEventListener('pointermove', e => {
        const r = btn.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) * strength;
        const dy = (e.clientY - (r.top + r.height / 2)) * strength;
        btn.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(1.05)';
      });
      btn.addEventListener('pointerleave', () => {
        btn.style.transform = '';
      });
    });
  }
});