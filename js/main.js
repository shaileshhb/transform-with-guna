/**
 * transform-with-guna — main.js
 *
 * Handles:
 *  1. Sticky nav (shadow on scroll) + active link highlighting
 *  2. Mobile hamburger menu
 *  3. Testimonial carousel (auto-advance, dots, prev/next)
 *  4. Contact form validation + n8n webhook submission
 *  5. Certificate lightbox
 *  6. Footer year
 */

/* ============================================================
   CONFIG
============================================================ */

// Replace with your actual n8n webhook URL when ready
// const N8N_WEBHOOK_URL = 'http://localhost:5678/webhook-test/c492ddf8-6591-4847-a0f5-fe22455c191c';
const N8N_WEBHOOK_URL = 'https://n8n-service-j0i0.onrender.com/webhook-test/c492ddf8-6591-4847-a0f5-fe22455c191c';

/* ============================================================
   1. STICKY NAV
============================================================ */
(function initStickyNav() {
  const header = document.getElementById('nav-header');
  if (!header) return;

  const onScroll = () => {
    header.classList.toggle('scrolled', window.scrollY > 10);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

/* ============================================================
   2. ACTIVE NAV LINK (IntersectionObserver)
============================================================ */
(function initActiveNav() {
  const sections = document.querySelectorAll('main [id]');
  const navLinks = document.querySelectorAll('.nav__link');

  if (!sections.length || !navLinks.length) return;

  const sectionMap = {};
  sections.forEach(s => { sectionMap[s.id] = s; });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          navLinks.forEach(link => {
            const href = link.getAttribute('href');
            link.classList.toggle('active', href === `#${entry.target.id}`);
          });
        }
      });
    },
    { rootMargin: '-40% 0px -55% 0px' }
  );

  sections.forEach(s => observer.observe(s));
})();

/* ============================================================
   3. MOBILE HAMBURGER MENU
============================================================ */
(function initBurger() {
  const burger = document.getElementById('nav-burger');
  const menu   = document.getElementById('nav-menu');
  if (!burger || !menu) return;

  const toggle = (force) => {
    const isOpen = force !== undefined ? force : !menu.classList.contains('open');
    menu.classList.toggle('open', isOpen);
    burger.classList.toggle('open', isOpen);
    burger.setAttribute('aria-expanded', String(isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';
  };

  burger.addEventListener('click', () => toggle());

  // Close on nav link click
  menu.querySelectorAll('.nav__link').forEach(link => {
    link.addEventListener('click', () => toggle(false));
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (menu.classList.contains('open') && !menu.contains(e.target) && !burger.contains(e.target)) {
      toggle(false);
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('open')) toggle(false);
  });
})();

/* ============================================================
   4. TESTIMONIAL CAROUSEL
============================================================ */
(function initCarousel() {
  const track    = document.getElementById('carousel-track');
  const dotsWrap = document.getElementById('carousel-dots');
  const prevBtn  = document.getElementById('carousel-prev');
  const nextBtn  = document.getElementById('carousel-next');
  if (!track) return;

  const slides = Array.from(track.children);
  const total  = slides.length;
  let current  = 0;
  let autoTimer;

  // Build dots
  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'carousel__dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
    dot.setAttribute('role', 'tab');
    dot.addEventListener('click', () => goTo(i));
    dotsWrap.appendChild(dot);
  });

  const dots = dotsWrap.querySelectorAll('.carousel__dot');

  // Set every slide to the exact pixel width of the visible track-wrap.
  // This avoids the circular-% problem where min-width:100% on slides
  // references the expanding track (= all slides combined), not the viewport.
  function setSlideWidths() {
    const w = track.parentElement.offsetWidth;
    slides.forEach(s => { s.style.width = w + 'px'; });
  }

  function goTo(index) {
    current = (index + total) % total;
    // Use pixels (offsetWidth) not %, because % on translateX is relative
    // to the element itself (the full track), not one slide width.
    track.style.transform = `translateX(-${current * track.parentElement.offsetWidth}px)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === current));
    resetTimer();
  }

  function resetTimer() {
    clearInterval(autoTimer);
    autoTimer = setInterval(() => goTo(current + 1), 5000);
  }

  prevBtn?.addEventListener('click', () => goTo(current - 1));
  nextBtn?.addEventListener('click', () => goTo(current + 1));

  // Touch/swipe support
  let touchStartX = 0;
  track.parentElement.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  track.parentElement.addEventListener('touchend', (e) => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) goTo(diff > 0 ? current + 1 : current - 1);
  }, { passive: true });

  // Pause on hover
  track.closest('.carousel')?.addEventListener('mouseenter', () => clearInterval(autoTimer));
  track.closest('.carousel')?.addEventListener('mouseleave', () => resetTimer());

  // Recalculate slide widths and re-position on resize
  window.addEventListener('resize', () => {
    setSlideWidths();
    goTo(current);
  }, { passive: true });

  // Initialise widths before first render
  setSlideWidths();
  resetTimer();
})();

/* ============================================================
   5. CONTACT FORM — VALIDATION + N8N SUBMISSION
============================================================ */
(function initContactForm() {
  const form       = document.getElementById('contact-form');
  const submitBtn  = document.getElementById('form-submit-btn');
  const feedback   = document.getElementById('form-feedback');
  if (!form) return;

  // Field-level validation config
  const validators = {
    name:    { required: true, minLength: 2, label: 'Name' },
    email:   { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, label: 'Email' },
    goal:    { required: true, label: 'Goal' },
    message: { required: true, label: 'Message' },
  };

  function validateField(name, value) {
    const rules = validators[name];
    if (!rules) return '';
    const v = value.trim();
    if (rules.required && !v)       return `${rules.label} is required.`;
    if (rules.minLength && v.length < rules.minLength) return `${rules.label} must be at least ${rules.minLength} characters.`;
    if (rules.pattern && !rules.pattern.test(v)) return `Please enter a valid ${rules.label.toLowerCase()}.`;
    return '';
  }

  function setFieldError(field, msg) {
    const group = field.closest('.form-group');
    const errEl = group?.querySelector('.form-error');
    field.classList.toggle('invalid', !!msg);
    if (errEl) errEl.textContent = msg;
  }

  // Live validation on blur
  Object.keys(validators).forEach(name => {
    const el = form.elements[name];
    if (!el) return;
    el.addEventListener('blur', () => setFieldError(el, validateField(name, el.value)));
    el.addEventListener('input', () => {
      if (el.classList.contains('invalid')) setFieldError(el, validateField(name, el.value));
    });
  });

  function validateAll() {
    let valid = true;
    Object.keys(validators).forEach(name => {
      const el = form.elements[name];
      if (!el) return;
      const err = validateField(name, el.value);
      setFieldError(el, err);
      if (err) valid = false;
    });
    return valid;
  }

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle('btn--loading', isLoading);
  }

  function showFeedback(type, msg) {
    feedback.className = 'form-feedback ' + type;
    feedback.textContent = msg;
    feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    feedback.className = 'form-feedback';

    if (!validateAll()) return;

    const payload = {
      name:    form.elements.name.value.trim(),
      email:   form.elements.email.value.trim(),
      goal:    form.elements.goal.value,
      message: form.elements.message.value.trim(),
    };

    // Guard: webhook not configured
    if (N8N_WEBHOOK_URL === 'YOUR_N8N_WEBHOOK_URL') {
      showFeedback('success',
        '✓ Message received! (n8n webhook not yet connected — replace N8N_WEBHOOK_URL in main.js to enable live submissions.)'
      );
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`Server responded with ${res.status}`);

      showFeedback('success', '✓ Message sent! I\'ll be in touch within 24 hours.');
      form.reset();
      Object.keys(validators).forEach(name => {
        const el = form.elements[name];
        if (el) setFieldError(el, '');
      });
    } catch (err) {
      console.error('Form submission error:', err);
      showFeedback('error', 'Something went wrong. Please try again or email me directly.');
    } finally {
      setLoading(false);
    }
  });
})();

/* ============================================================
   6. CERTIFICATE LIGHTBOX
============================================================ */
(function initCertLightbox() {
  const lightbox  = document.getElementById('cert-lightbox');
  const img       = document.getElementById('cert-lightbox-img');
  const closeBtn  = document.getElementById('cert-lightbox-close');
  const cards     = document.querySelectorAll('.cert__card');
  if (!lightbox || !img || !cards.length) return;

  function open(src, alt) {
    img.src = src;
    img.alt = alt;
    lightbox.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function close() {
    lightbox.classList.remove('is-open');
    document.body.style.overflow = '';
    // Return focus to the card that opened the lightbox
    if (lightbox._opener) lightbox._opener.focus();
  }

  cards.forEach(card => {
    const activate = () => {
      lightbox._opener = card;
      open(card.dataset.src, card.querySelector('img').alt);
    };
    card.addEventListener('click', activate);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
    });
  });

  // Close on button click
  closeBtn.addEventListener('click', close);

  // Close on backdrop click (not on the image itself)
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) close();
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('is-open')) close();
  });
})();

/* ============================================================
   7. FOOTER YEAR
============================================================ */
(function setYear() {
  const el = document.getElementById('footer-year');
  if (el) el.textContent = new Date().getFullYear();
})();
