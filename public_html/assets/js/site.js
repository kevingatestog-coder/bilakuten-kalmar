(() => {
  'use strict';

  // Mobile menu toggle
  const header = document.querySelector('.header');
  const hamburger = document.querySelector('.hamburger');
  if (header && hamburger) {
    hamburger.addEventListener('click', () => {
      const open = header.classList.toggle('is-open');
      hamburger.setAttribute('aria-expanded', String(open));
    });
    document.querySelectorAll('.nav a').forEach(a => {
      a.addEventListener('click', () => header.classList.remove('is-open'));
    });
  }

  // Sticky-header shadow on scroll
  if (header) {
    const onScroll = () => header.classList.toggle('is-stuck', window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Hero slider (fade, autoplay)
  const heroTrack = document.querySelector('.hero-track');
  if (heroTrack) {
    const slides = Array.from(heroTrack.querySelectorAll('.hero-slide'));
    const pagination = document.querySelector('.hero-pagination');
    let idx = 0, timer;
    const dots = slides.map((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Bild ${i + 1}`);
      b.addEventListener('click', () => go(i, true));
      pagination && pagination.appendChild(b);
      return b;
    });
    const go = (n, manual) => {
      slides[idx].classList.remove('is-active');
      dots[idx] && dots[idx].classList.remove('is-active');
      idx = (n + slides.length) % slides.length;
      slides[idx].classList.add('is-active');
      dots[idx] && dots[idx].classList.add('is-active');
      if (manual) restart();
    };
    const next = () => go(idx + 1);
    const restart = () => { clearInterval(timer); timer = setInterval(next, 6000); };
    if (slides.length > 0) {
      slides[0].classList.add('is-active');
      dots[0] && dots[0].classList.add('is-active');
      if (slides.length > 1) restart();
      heroTrack.addEventListener('mouseenter', () => clearInterval(timer));
      heroTrack.addEventListener('mouseleave', restart);
    }
  }

  // Smooth scroll for in-page anchor links (offset for sticky header)
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    const href = a.getAttribute('href');
    if (href === '#' || href.length < 2) return;
    a.addEventListener('click', (e) => {
      const t = document.querySelector(href);
      if (!t) return;
      e.preventDefault();
      const top = t.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  // Form: simple client-side validation feedback
  document.querySelectorAll('form[data-validate]').forEach(form => {
    form.addEventListener('submit', (e) => {
      if (!form.checkValidity()) {
        e.preventDefault();
        form.querySelectorAll(':invalid').forEach(el => el.classList.add('is-invalid'));
        const first = form.querySelector(':invalid');
        first && first.focus();
      }
    });
    form.querySelectorAll('input, textarea, select').forEach(el => {
      el.addEventListener('input', () => el.classList.remove('is-invalid'));
    });
  });

  // Lazy-init Google Maps iframe
  document.querySelectorAll('.map-placeholder').forEach(el => {
    const src = el.getAttribute('data-src');
    if (!src) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          const iframe = document.createElement('iframe');
          iframe.src = src;
          iframe.className = 'map-frame';
          iframe.loading = 'lazy';
          iframe.referrerPolicy = 'no-referrer-when-downgrade';
          iframe.title = 'Karta till Bilakuten i Kalmar';
          el.replaceWith(iframe);
          observer.disconnect();
        }
      });
    }, { rootMargin: '200px' });
    observer.observe(el);
  });
})();

(() => {
  'use strict';
  const header = document.querySelector('.header');
  const hamburger = document.querySelector('.hamburger');
  const toggle = document.querySelector('.submenu-toggle');
  if (!header || !hamburger || !toggle) return;
  const item = toggle.closest('.nav-item');
  const mobile = window.matchMedia('(max-width: 768px)');
  const closeSubmenu = () => {
    item.classList.remove('is-submenu-open');
    toggle.setAttribute('aria-expanded', 'false');
  };
  const closeMenu = () => {
    header.classList.remove('is-open');
    hamburger.setAttribute('aria-expanded', 'false');
    closeSubmenu();
  };
  toggle.addEventListener('click', () => {
    const open = item.classList.toggle('is-submenu-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  // The original hamburger handler runs first; reset the nested menu on close.
  hamburger.addEventListener('click', () => {
    if (!header.classList.contains('is-open')) closeSubmenu();
  });
  header.querySelectorAll('.nav a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && header.classList.contains('is-open')) {
      closeMenu();
      hamburger.focus();
    }
  });
  document.addEventListener('click', event => {
    if (header.classList.contains('is-open') && !header.contains(event.target)) closeMenu();
  });
  mobile.addEventListener('change', closeMenu);
})();
