document.addEventListener('DOMContentLoaded', () => {
  
  // ==========================================
  // 1. DYNAMIC PARTICLE CANVAS BACKGROUND
  // ==========================================
  const canvas = document.getElementById('particleCanvas');
  const ctx = canvas.getContext('2d');

  let particlesArray = [];
  const numberOfParticles = 45;

  function setCanvasSize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  setCanvasSize();
  window.addEventListener('resize', setCanvasSize);

  class Particle {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = Math.random() * 4 + 1.5;
      this.speedX = (Math.random() - 0.5) * 0.6;
      this.speedY = (Math.random() - 0.5) * 0.6;
      this.opacity = Math.random() * 0.5 + 0.2;
    }

    update() {
      this.x += this.speedX;
      this.y += this.speedY;

      if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
      if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
    }

    draw() {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
    }
  }

  function initParticles() {
    particlesArray = [];
    for (let i = 0; i < numberOfParticles; i++) {
      particlesArray.push(new Particle());
    }
  }

  function connectParticles() {
    for (let a = 0; a < particlesArray.length; a++) {
      for (let b = a; b < particlesArray.length; b++) {
        let dx = particlesArray[a].x - particlesArray[b].x;
        let dy = particlesArray[a].y - particlesArray[b].y;
        let distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 110) {
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.15 - distance / 1100})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
          ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
          ctx.stroke();
        }
      }
    }
  }

  function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particlesArray.length; i++) {
      particlesArray[i].update();
      particlesArray[i].draw();
    }
    connectParticles();
    requestAnimationFrame(animateParticles);
  }

  initParticles();
  animateParticles();

  // ==========================================
  // 2. HEADER TYPING TEXT ANIMATION
  // ==========================================
  const textElement = document.getElementById('typing-text');
  const phrases = ['welcome to my space', 'follow my socials', 'enhance your tiktok hd'];
  let phraseIndex = 0;
  let charIndex = 0;
  let isDeleting = false;

  function typeEffect() {
    const currentPhrase = phrases[phraseIndex];
    
    if (isDeleting) {
      textElement.textContent = currentPhrase.substring(0, charIndex - 1);
      charIndex--;
    } else {
      textElement.textContent = currentPhrase.substring(0, charIndex + 1);
      charIndex++;
    }

    let typeSpeed = isDeleting ? 40 : 80;

    if (!isDeleting && charIndex === currentPhrase.length) {
      typeSpeed = 2000;
      isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
      isDeleting = false;
      phraseIndex = (phraseIndex + 1) % phrases.length;
      typeSpeed = 400;
    }

    setTimeout(typeEffect, typeSpeed);
  }

  typeEffect();

  // ==========================================
  // 3. INTERACTIVE STATUS TOGGLE
  // ==========================================
  const statusPill = document.getElementById('statusPill');
  const statusText = statusPill.querySelector('.status-text');
  const statusDot = statusPill.querySelector('.status-dot');

  let isLive = true;
  statusPill.addEventListener('click', () => {
    isLive = !isLive;
    if (isLive) {
      statusText.textContent = 'SYSTEM ONLINE';
      statusDot.style.background = '#10b981';
      statusDot.style.boxShadow = '0 0 8px #10b981';
    } else {
      statusText.textContent = 'AFK MODE';
      statusDot.style.background = '#f59e0b';
      statusDot.style.boxShadow = '0 0 8px #f59e0b';
    }
  });

  // ==========================================
  // 4. EXIT ANIMATION & LINK HANDLING
  // ==========================================
  const socialLinks = document.querySelectorAll('.neu-btn, .quick-chip');

  socialLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      const targetUrl = this.getAttribute('href');
      
      if (targetUrl && targetUrl !== '#') {
        e.preventDefault(); // Tahan navigasi sementara

        // Efek visual tombol tertekan & ripple
        this.classList.add('is-leaving');
        createSoftRipple(e, this);

        // Panggil animasi exit transisi halaman
        document.body.classList.add('page-exit');

        // Buka link tujuan di tab baru setelah 450ms
        setTimeout(() => {
          window.open(targetUrl, '_blank');
          
          // Reset animasi setelah halaman baru terbuka
          document.body.classList.remove('page-exit');
          this.classList.remove('is-leaving');
        }, 450);
      }
    });
  });

  // Helper Ripple Effect
  function createSoftRipple(event, element) {
    const rect = element.getBoundingClientRect();
    const circle = document.createElement('span');
    const diameter = Math.max(rect.width, rect.height);
    const radius = diameter / 2;

    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - rect.left - radius}px`;
    circle.style.top = `${event.clientY - rect.top - radius}px`;
    circle.style.position = 'absolute';
    circle.style.borderRadius = '50%';
    circle.style.background = 'rgba(255, 255, 255, 0.7)';
    circle.style.transform = 'scale(0)';
    circle.style.animation = 'rippleGlass 0.6s linear';
    circle.style.pointerEvents = 'none';

    element.appendChild(circle);

    setTimeout(() => {
      circle.remove();
    }, 600);
  }

  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes rippleGlass {
      to {
        transform: scale(2.5);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
});