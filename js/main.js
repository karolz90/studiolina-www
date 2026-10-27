/* studiolina v2: ruch i interakcje
   Wszystko jest progresywne: bez JS strona działa i jest w pełni widoczna,
   przy "ogranicz ruch" w systemie animacje są wyłączone. */
(function () {
  'use strict';
  window.__slReady = true;

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var supportsIO = 'IntersectionObserver' in window;

  /* ---------- pomocnicze ---------- */
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  var fontsReady = new Promise(function (res) {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(res);
      setTimeout(res, 900);
    } else res();
  });

  /* ---------- podział tekstu na słowa (maski) ---------- */
  function splitWords(el) {
    if (!el || el.classList.contains('is-split')) return;
    var sr = document.createElement('span');
    sr.className = 'sr';
    sr.textContent = el.textContent.replace(/\s+/g, ' ').trim();
    var vis = document.createElement('span');
    vis.setAttribute('aria-hidden', 'true');
    while (el.firstChild) vis.appendChild(el.firstChild);

    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var parts = child.textContent.split(/(\s+)/);
          var frag = document.createDocumentFragment();
          parts.forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span');
            w.className = 'w';
            var i = document.createElement('span');
            i.textContent = p;
            w.appendChild(i);
            frag.appendChild(w);
          });
          child.parentNode.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          walk(child);
        }
      });
    })(vis);

    el.appendChild(sr);
    el.appendChild(vis);
    el.classList.add('is-split');
  }

  /* opóźnienia liczone wierszami: tekst wychodzi linia po linii */
  function setWordDelays(el, base, perLine, perWord) {
    base = base || 0; perLine = perLine == null ? 0.09 : perLine; perWord = perWord == null ? 0.016 : perWord;
    var top = null, line = -1, idx = 0;
    $$('.w', el).forEach(function (w) {
      var t = w.offsetTop;
      if (top === null || Math.abs(t - top) > 6) { line++; top = t; idx = 0; }
      w.style.setProperty('--wd', (base + line * perLine + idx * perWord).toFixed(3) + 's');
      idx++;
    });
  }

  function splitLetters(el) {
    if (!el) return;
    var text = el.textContent;
    el.textContent = '';
    text.split('').forEach(function (ch, i) {
      var s = document.createElement('span');
      s.className = 'l';
      s.style.setProperty('--i', i);
      s.textContent = ch;
      el.appendChild(s);
    });
  }

  /* ---------- płynny scroll ---------- */
  var lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, autoRaf: true });
  }
  var easeInOut = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  /* ---------- nawigacja ---------- */
  var nav = $('[data-nav]');
  var burger = $('.nav__burger');

  function setMenu(open) {
    if (!nav) return;
    nav.classList.toggle('is-open', open);
    if (burger) burger.setAttribute('aria-expanded', String(open));
    if (lenis) { open ? lenis.stop() : lenis.start(); }
    document.body.style.overflow = open ? 'hidden' : '';
  }
  if (burger) {
    burger.addEventListener('click', function () { setMenu(!nav.classList.contains('is-open')); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); burger.focus(); }
    });
    $$('.nav__links a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  }

  /* kotwice: płynny przejazd + fokus dla czytników ekranu */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href');
    var target = id === '#' ? null : document.getElementById(id.slice(1));
    if (id !== '#' && !target) return;
    e.preventDefault();
    setMenu(false);
    if (lenis) {
      lenis.scrollTo(target || 0, { duration: 1.6, easing: easeInOut });
    } else if (target) {
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    }
    if (target) {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      history.replaceState(null, '', id);
    } else {
      history.replaceState(null, '', location.pathname + location.search);
    }
  });

  /* ---------- scroll: nav, paralaksa, hero ---------- */
  var lastY = window.scrollY;
  var heroEl = $('.hero');
  var heroSlides = $('[data-hero-parallax]');
  var heroContent = $('.hero__content');
  var parallax = $$('[data-parallax]');
  var ticking = false;

  function onScroll() {
    var y = window.scrollY;
    var vh = window.innerHeight;

    if (nav) {
      nav.classList.toggle('is-scrolled', y > 8);
      if (Math.abs(y - lastY) > 6) {
        var hide = y > lastY && y > 320 && !nav.classList.contains('is-open');
        nav.classList.toggle('is-hidden', hide);
        lastY = y;
      }
    }

    if (!reduce) {
      if (heroSlides && heroEl) {
        var h = heroEl.offsetHeight;
        if (y < h + 50) {
          heroSlides.style.setProperty('--hy', (y * 0.32).toFixed(1) + 'px');
          if (heroContent && heroEl.classList.contains('is-settled')) {
            var p = clamp(y / (h * 0.7), 0, 1);
            heroContent.style.opacity = (1 - p * 0.9).toFixed(3);
            heroContent.style.transform = 'translateY(' + (-y * 0.12).toFixed(1) + 'px)';
          }
        }
      }
      parallax.forEach(function (img) {
        var box = img.parentElement.getBoundingClientRect();
        if (box.bottom < -80 || box.top > vh + 80) return;
        var amount = parseFloat(img.getAttribute('data-parallax')) || 0.05;
        var progress = clamp((box.top + box.height / 2 - vh / 2) / (vh / 2 + box.height / 2), -1, 1);
        img.style.setProperty('--py', (-progress * amount * box.height).toFixed(1) + 'px');
      });
    }
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  window.addEventListener('resize', function () { requestAnimationFrame(onScroll); });

  /* ---------- odsłony przy przewijaniu ---------- */
  function reveal(el) {
    if (el.hasAttribute('data-split')) setWordDelays(el);
    el.classList.add('is-in');
  }

  var io = supportsIO ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target;
      io.unobserve(el);
      if (el.__onIn) el.__onIn(); else reveal(el);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0 }) : null;

  function watch(el, onIn) {
    if (!el) return;
    if (onIn) el.__onIn = onIn;
    if (io && !reduce) io.observe(el);
    else (onIn || function () { reveal(el); })();
  }

  // nagłówki sekcji
  $$('[data-split]').forEach(function (el) {
    if (el.closest('.hero') || el.hasAttribute('data-split-manual')) return;
    splitWords(el);
  });

  fontsReady.then(function () {
    $$('[data-split]').forEach(function (el) {
      if (el.closest('.hero') || el.hasAttribute('data-split-manual')) return;
      watch(el);
    });

    $$('[data-reveal]').forEach(function (el) {
      if (el.closest('.work') || el.hasAttribute('data-reveal-manual')) return;
      watch(el);
    });

    // projekty: kaskada w obrębie wiersza
    var works = $$('.work');
    var grid = $('.works');
    function workDelays() {
      if (!grid) return;
      var cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length || 1;
      works.forEach(function (w, i) { w.style.setProperty('--d', ((i % cols) * 0.14).toFixed(2) + 's'); });
    }
    workDelays();
    works.forEach(function (w) {
      watch(w, function () {
        w.classList.add('is-in');
        var m = $('.work__media', w);
        if (m) m.classList.add('is-in');
      });
    });

    // łańcuch wymiarowy
    $$('[data-chain]').forEach(function (c) { watch(c); });

    // metryczka projektu
    $$('.titleblock').forEach(function (tb) {
      $$('.titleblock__cell', tb).forEach(function (c, i) { c.style.setProperty('--i', i); });
      watch(tb);
    });

    // stopka: litery logotypu
    var footer = $('[data-footer]');
    if (footer) {
      splitLetters($('[data-letters]', footer));
      if (io && !reduce) {
        var fio = new IntersectionObserver(function (en) {
          en.forEach(function (e) {
            if (e.isIntersecting) { footer.classList.add('is-in'); fio.disconnect(); }
          });
        }, { threshold: 0.35 });
        fio.observe(footer);
      } else footer.classList.add('is-in');
    }

    onScroll();
  });

  /* ---------- proces: krok <-> odcinek łańcucha ---------- */
  $$('.step[data-step]').forEach(function (step) {
    var seg = $('.chain__seg[data-seg="' + step.getAttribute('data-step') + '"]');
    if (!seg) return;
    var on = function () { step.classList.add('is-hot'); seg.classList.add('is-hot'); };
    var off = function () { step.classList.remove('is-hot'); seg.classList.remove('is-hot'); };
    step.addEventListener('mouseenter', on);
    step.addEventListener('mouseleave', off);
    seg.addEventListener('mouseenter', on);
    seg.addEventListener('mouseleave', off);
  });

  /* ---------- HERO ---------- */
  if (heroEl) {
    var slides = $$('.hero__slide', heroEl);
    var sw = $('.hero__switch', heroEl);
    var title = $('.hero__title', heroEl);
    var current = 0;
    var intro = root.classList.contains('intro');

    function loadSlide(s) {
      $$('[data-srcset]', s).forEach(function (src) { src.srcset = src.getAttribute('data-srcset'); src.removeAttribute('data-srcset'); });
      $$('img[data-src]', s).forEach(function (img) { img.src = img.getAttribute('data-src'); img.removeAttribute('data-src'); });
    }
    window.addEventListener('load', function () {
      setTimeout(function () { slides.forEach(loadSlide); }, 1200);
    });

    var buttons = [];
    if (slides.length > 1 && sw) {
      slides.forEach(function (s, i) {
        var label = s.getAttribute('data-label') || ('zdjęcie ' + (i + 1));
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = label.split(' ').pop();
        b.setAttribute('aria-label', 'Pokaż: ' + label);
        b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
        b.addEventListener('click', function () { show(i); });
        sw.appendChild(b);
        buttons.push(b);
      });
    }

    function show(i) {
      if (i === current) return;
      loadSlide(slides[i]);
      slides[current].classList.remove('is-active');
      slides[i].classList.add('is-active');
      buttons[current].setAttribute('aria-pressed', 'false');
      buttons[i].setAttribute('aria-pressed', 'true');
      current = i;
    }

    splitWords(title);
    fontsReady.then(function () {
      setWordDelays(title, 0, 0.12, 0.03);
      var start = intro ? 1050 : 120;
      setTimeout(function () {
        title.classList.add('is-in');
        heroEl.classList.add('is-ready');
      }, reduce ? 0 : start);
      // po zakończeniu sekwencji: oddaj treść paralaksie i zdejmij tryb intro
      setTimeout(function () {
        heroEl.classList.add('is-settled');
        root.classList.remove('intro');
      }, reduce ? 0 : start + 2200);
    });
  }

  /* ---------- OPINIE ---------- */
  var qWrap = $('[data-quotes]');
  if (qWrap) {
    var quotes = $$('.quote', qWrap);
    var idxEl = $('[data-quote-index]', qWrap);
    var totEl = $('[data-quote-total]', qWrap);
    var qi = 0, busy = false;
    if (totEl) totEl.textContent = quotes.length;
    quotes.forEach(function (q) { splitWords($('.quote__text', q)); });

    fontsReady.then(function () {
      setWordDelays($('.quote__text', quotes[0]), 0.1, 0.08, 0.012);
      watch(qWrap, function () { qWrap.classList.add('is-in'); });
    });

    function go(dir) {
      if (busy || quotes.length < 2) return;
      busy = true;
      var old = quotes[qi];
      qi = (qi + dir + quotes.length) % quotes.length;
      var nw = quotes[qi];
      setWordDelays($('.quote__text', old), 0, 0.05, 0.006);
      setWordDelays($('.quote__text', nw), 0.42, 0.07, 0.01);
      old.classList.add('is-leaving');
      old.classList.remove('is-active');
      nw.classList.add('is-active');
      if (idxEl) idxEl.textContent = qi + 1;
      setTimeout(function () { old.classList.remove('is-leaving'); }, 1000);
      setTimeout(function () { busy = false; }, 750);
    }

    $$('.quotes__arrow', qWrap).forEach(function (b) {
      b.addEventListener('click', function () { go(parseInt(b.getAttribute('data-dir'), 10)); });
    });
    qWrap.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    });
    // przesunięcie palcem
    var track = $('.quotes__track', qWrap), sx = null, sy = null;
    if (track) {
      track.style.touchAction = 'pan-y';
      track.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; });
      track.addEventListener('pointerup', function (e) {
        if (sx === null) return;
        var dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
        sx = null;
      });
      track.addEventListener('pointercancel', function () { sx = null; });
    }
  }

  /* ---------- przejścia między stronami (View Transitions) ---------- */
  function fileOf(url) {
    try { return new URL(url, location.href).pathname.split('/').pop() || 'index.html'; } catch (e) { return ''; }
  }
  function inView(el) {
    var r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  }
  function instantReveal(el) {
    el.classList.add('is-instant', 'is-in');
    var w = el.closest('.work');
    if (w) w.classList.add('is-in');
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.remove('is-instant'); }); });
  }
  function nameFor(el, vt) {
    el.style.viewTransitionName = 'project-media';
    vt.finished.finally(function () { el.style.viewTransitionName = ''; });
  }
  var leadMedia = $('[data-lead-media]');
  var isHome = document.body.classList.contains('page-home');

  // opuszczanie strony
  window.addEventListener('pageswap', function (e) {
    if (!e.viewTransition || !e.activation || !e.activation.entry) return;
    var to = fileOf(e.activation.entry.url);
    if (isHome) {
      var card = $('.work[href="' + to + '"] .work__media');
      if (card && inView(card)) nameFor(card, e.viewTransition);
      else if (!card) return;
    } else if (leadMedia && (to === 'index.html') && inView(leadMedia)) {
      nameFor(leadMedia, e.viewTransition);
    }
  });

  // wejście na stronę
  window.addEventListener('pagereveal', function (e) {
    if (!e.viewTransition) return;
    var from = window.navigation && navigation.activation && navigation.activation.from;
    if (!from) return;
    var src = fileOf(from.url);
    if (!isHome && leadMedia && src === 'index.html') {
      instantReveal(leadMedia);
      nameFor(leadMedia, e.viewTransition);
    } else if (isHome) {
      var card = $('.work[href="' + src + '"] .work__media');
      if (card && inView(card)) { instantReveal(card); nameFor(card, e.viewTransition); }
    }
  });
})();
