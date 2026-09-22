document.addEventListener('DOMContentLoaded', () => {
  // Footer year
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Navbar background on scroll
  const navbar = document.getElementById('navbar');
  const onScroll = () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  };
  onScroll();
  window.addEventListener('scroll', onScroll);

  // Mobile nav toggle
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  const closeMobileNav = () => {
    navLinks.classList.remove('open');
    navToggle.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  };
  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    navToggle.classList.toggle('open', isOpen);
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMobileNav);
  });
  // Tapping the open panel's own background (not a link) also closes it.
  navLinks.addEventListener('click', (e) => {
    if (e.target === navLinks) closeMobileNav();
  });

  // Manual loop instead of the native `loop` attribute: seeking back to true
  // 0 only once playback already hit the end forces the decoder to stall on
  // a fresh keyframe scan, which shows as a black flash/stutter on some
  // (mostly mobile) browsers. Restarting a hair before the true end skips
  // that stall — the last fraction of a second of video is never missed by
  // eye, and the loop reads as continuous instead of cutting to black.
  function enableSeamlessLoop(video) {
    video.addEventListener('timeupdate', () => {
      if (video.duration && video.currentTime >= video.duration - 0.15) {
        video.currentTime = 0;
      }
    });
  }

  // About section's autoplaying background video, directly under the hero.
  // The `autoplay` HTML attribute alone isn't reliable on every mobile
  // browser (in-app webviews like Instagram/TikTok, Android data-saver
  // mode, etc. can silently block it) — when that happens the browser
  // falls back to showing its native play button over the video instead of
  // just quietly not playing. Explicitly calling .play() covers most of
  // those cases, and retrying once on the very first tap/scroll anywhere
  // on the page catches the rest, since a user gesture always clears an
  // autoplay block.
  document.querySelectorAll('.seamless-loop-video').forEach(video => {
    enableSeamlessLoop(video);
    video.muted = true;
    const tryPlay = () => video.play().catch(() => {});
    tryPlay();
    video.addEventListener('loadedmetadata', tryPlay, { once: true });
    ['touchstart', 'click', 'scroll'].forEach(evt =>
      document.addEventListener(evt, tryPlay, { once: true, passive: true })
    );
  });

  // Commercial-style gallery videos: play on hover, otherwise sit static on
  // their poster frame (mobile browsers don't reliably paint a video's own
  // first frame without one). Touch devices never fire mouseenter, so they
  // simply see the poster — no extra handling needed there.
  document.querySelectorAll('.hover-video').forEach(video => {
    video.addEventListener('mouseenter', () => video.play());
    video.addEventListener('mouseleave', () => {
      video.pause();
      video.currentTime = 0;
    });
    enableSeamlessLoop(video);
  });

  // Video lightbox: click/tap a gallery video (desktop or mobile) to expand
  // it full-screen with native controls (play/pause, scrub, volume). Each
  // thumbnail's own hover-preview video keeps playing muted underneath —
  // the lightbox uses a separate <video> so the two never fight over src.
  const videoLightbox = document.getElementById('videoLightbox');
  if (videoLightbox) {
    const lightboxPlayer = document.getElementById('videoLightboxPlayer');
    const lightboxCloseBtn = document.getElementById('videoLightboxClose');

    const openVideoLightbox = (src) => {
      lightboxPlayer.src = src;
      videoLightbox.classList.add('open');
      document.body.style.overflow = 'hidden';
      lightboxPlayer.play();
    };

    const closeVideoLightbox = () => {
      lightboxPlayer.pause();
      lightboxPlayer.removeAttribute('src');
      lightboxPlayer.load();
      videoLightbox.classList.remove('open');
      document.body.style.overflow = '';
    };

    document.querySelectorAll('.hover-video').forEach(video => {
      video.addEventListener('click', () => {
        video.pause();
        video.currentTime = 0;
        openVideoLightbox(video.currentSrc || video.src);
      });
    });

    lightboxCloseBtn.addEventListener('click', closeVideoLightbox);
    videoLightbox.addEventListener('click', (e) => {
      if (e.target === videoLightbox) closeVideoLightbox();
    });
    window.addEventListener('keydown', (e) => {
      if (videoLightbox.classList.contains('open') && e.key === 'Escape') closeVideoLightbox();
    });
  }

  // Hero slideshow: crossfade through hero-1..hero-5 in order, looping.
  const heroSlides = document.querySelectorAll('#heroSlideshow .hero-slide');
  if (heroSlides.length) {
    let activeIndex = 0;
    setInterval(() => {
      heroSlides[activeIndex].classList.remove('active');
      activeIndex = (activeIndex + 1) % heroSlides.length;
      heroSlides[activeIndex].classList.add('active');
    }, 3000);
  }

  // Continuously auto-scrolls `track` leftward and wraps seamlessly, for a
  // track built as two back-to-back identical copies of its content
  // (translating by exactly one copy's width lands back on frame 1,
  // pixel-for-pixel). Driven by requestAnimationFrame with the offset
  // wrapped via modulo every frame, instead of a CSS @keyframes loop that
  // has to hard-reset transform from 100% back to 0% — that reset is
  // exactly where wide composited layers tend to hitch or drop a frame,
  // especially on mobile. Modulo-wrapped JS state has no reset to hitch on:
  // every frame is just "a bit further than last frame," forever. Also
  // re-measures the track's width every frame, so it stays correct even
  // while images are still streaming in and the width: max-content box is
  // still growing.
  function setupSeamlessMarquee(track, hoverParent, desktopDuration, mobileDuration) {
    if (!track) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let offset = 0;
    let lastTime = null;
    let paused = false;

    if (hoverParent) {
      hoverParent.addEventListener('mouseenter', () => { paused = true; });
      hoverParent.addEventListener('mouseleave', () => { paused = false; });
    }

    function frame(now) {
      if (lastTime === null) lastTime = now;
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const halfWidth = track.scrollWidth / 2;
      if (!paused && halfWidth > 0) {
        const duration = window.matchMedia('(max-width: 640px)').matches ? mobileDuration : desktopDuration;
        offset = (offset + (halfWidth / duration) * dt) % halfWidth;
        track.style.transform = `translateX(${-offset}px)`;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // Worked-with logo marquee: two back-to-back copies of the logo list —
  // see setupSeamlessMarquee, above.
  const marqueeTrack = document.getElementById('marqueeTrack');
  if (marqueeTrack) {
    const brandLogos = [
      { src: 'images/brand-logos/fred.png', alt: 'Fred' },
      { src: 'images/brand-logos/giorgio-armani.png', alt: 'Giorgio Armani' },
      { src: 'images/brand-logos/gucci.png', alt: 'Gucci' },
      { src: 'images/brand-logos/chanel.png', alt: 'Chanel' },
      { src: 'images/brand-logos/jim-thompson.png', alt: 'Jim Thompson' },
      { src: 'images/brand-logos/louis-vuitton.png', alt: 'Louis Vuitton' },
      { src: 'images/brand-logos/montblanc.png', alt: 'Montblanc' },
      { src: 'images/brand-logos/sirivannavari.png', alt: 'Sirivannavari' },
      { src: 'images/brand-logos/vogue.png', alt: 'Vogue' },
    ];
    [...brandLogos, ...brandLogos].forEach(({ src, alt }) => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = alt;
      img.loading = 'lazy';
      marqueeTrack.appendChild(img);
    });
    setupSeamlessMarquee(marqueeTrack, document.getElementById('worked-with'), 32, 22);
  }

  // Highlights auto-scroll marquee: same seamless-loop technique as the
  // Worked With strip, plus a click-to-expand lightbox with prev/next nav.
  const highlightsTrack = document.getElementById('highlightsTrack');
  const highlightImages = ['SRV1', 'SRVNYC2', 'SRV4', 'SRV3', 'SRV2', 'SRV5', 'SRV6'];

  if (highlightsTrack) {
    [...highlightImages, ...highlightImages].forEach((name, i) => {
      const img = document.createElement('img');
      img.src = `images/highlights/${name}.jpg`;
      img.alt = `Camille Gandossi — highlight ${(i % highlightImages.length) + 1}`;
      img.loading = 'lazy';
      img.dataset.index = i % highlightImages.length;
      img.addEventListener('click', () => openLightbox(Number(img.dataset.index)));
      highlightsTrack.appendChild(img);
    });
    setupSeamlessMarquee(highlightsTrack, document.getElementById('highlights'), 46, 30);
  }

  const lightbox = document.getElementById('highlightsLightbox');
  const lightboxImage = document.getElementById('lightboxImage');
  const lightboxClose = document.getElementById('lightboxClose');
  const lightboxPrev = document.getElementById('lightboxPrev');
  const lightboxNext = document.getElementById('lightboxNext');
  let lightboxIndex = 0;

  function renderLightboxImage() {
    const name = highlightImages[lightboxIndex];
    lightboxImage.src = `images/highlights/${name}.jpg`;
    lightboxImage.alt = `Camille Gandossi — highlight ${lightboxIndex + 1}`;
  }

  function openLightbox(index) {
    lightboxIndex = index;
    renderLightboxImage();
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }

  function showPrev() {
    lightboxIndex = (lightboxIndex - 1 + highlightImages.length) % highlightImages.length;
    renderLightboxImage();
  }

  function showNext() {
    lightboxIndex = (lightboxIndex + 1) % highlightImages.length;
    renderLightboxImage();
  }

  if (lightbox) {
    lightboxClose.addEventListener('click', closeLightbox);
    lightboxPrev.addEventListener('click', showPrev);
    lightboxNext.addEventListener('click', showNext);

    // Click the dark backdrop (not the image or the buttons) to close.
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });

    window.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('open')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') showPrev();
      if (e.key === 'ArrowRight') showNext();
    });
  }

  // Luxury Brand Exclusive Events: 3 frames, each independently cycling
  // through a different brand's photos every 2s, staggered by 0.5s per
  // frame so they don't change in sync. At every moment the 3 frames must
  // show 3 different brands, so each tick picks a random brand that isn't
  // currently shown in either of the other two frames.
  const brandFrames = document.querySelectorAll('#brandFrames .brand-frame');
  if (brandFrames.length === 3) {
    // Montblanc has only 1 photo, so as its own rotation slot it would
    // reshow that same image as often as brands with 5-6 photos. Grouping
    // it with Sirivannavari (2 photos, the next-smallest set) gives that
    // slot 3 photos to draw from — each photo keeps its own brand name for
    // alt text via the {file, name} pairing below.
    const brandNames = {
      cc: 'Chanel',
      ga: 'Giorgio Armani',
      gg: 'Gucci',
      lv: 'Louis Vuitton',
      sv: 'Sirivannavari',
      vg: 'Vogue',
    };
    const brandPhotos = {
      cc: ['cc1.jpg', 'cc2.jpg', 'cc3.jpg', 'cc4.jpg', 'cc5.jpg'].map(file => ({ file, name: brandNames.cc })),
      ga: ['ga1.jpg', 'ga2.jpg', 'ga3.jpg'].map(file => ({ file, name: brandNames.ga })),
      gg: ['gg1.jpg', 'gg2.jpg', 'gg3.jpg'].map(file => ({ file, name: brandNames.gg })),
      lv: ['lv1.jpg', 'lv2.jpg', 'lv3.jpg', 'lv4.jpg'].map(file => ({ file, name: brandNames.lv })),
      sv: [
        ...['sv1.jpg', 'sv2.jpg'].map(file => ({ file, name: brandNames.sv })),
        { file: 'mb1.jpg', name: 'Montblanc' },
      ],
      vg: ['vg1.jpg', 'vg2.jpg', 'vg3.jpg', 'vg4.jpg', 'vg5.jpg', 'vg6.jpg'].map(file => ({ file, name: brandNames.vg })),
    };
    const brandKeys = Object.keys(brandPhotos);
    const brandCursor = Object.fromEntries(brandKeys.map(k => [k, 0]));

    // Preload every photo up front. These are large (some 1-5MB) source
    // files, and a photo taking longer than the 2s tick to arrive over the
    // network was the actual cause of brand collisions in testing: a
    // frame's "current brand" would advance again before its previous pick
    // had even finished loading, orphaning that reservation and letting
    // another frame legitimately reuse a brand that was still stuck
    // on-screen. Preloading means every src is already in the browser's
    // HTTP cache by the time it's needed.
    Object.values(brandPhotos).flat().forEach(({ file }) => {
      const preload = new Image();
      preload.src = `images/highbrands/${file}`;
    });

    // Shuffle and hand out 3 distinct starting brands, one per frame.
    const shuffled = [...brandKeys].sort(() => Math.random() - 0.5);
    const currentBrand = [shuffled[0], shuffled[1], shuffled[2]];
    const pending = [false, false, false];

    function nextPhoto(brand) {
      const photos = brandPhotos[brand];
      const photo = photos[brandCursor[brand] % photos.length];
      brandCursor[brand] += 1;
      return photo;
    }

    function makeFrameController(frameEl, frameIndex) {
      const layers = [...frameEl.querySelectorAll('.brand-frame-img')];
      let active = 0;

      return function showBrand(brand) {
        pending[frameIndex] = true;
        const next = 1 - active;
        const nextImg = layers[next];
        const photo = nextPhoto(brand);
        nextImg.src = `images/highbrands/${photo.file}`;
        nextImg.alt = `${photo.name} exclusive event`;
        const activate = () => {
          layers[active].classList.remove('active');
          nextImg.classList.add('active');
          active = next;
          pending[frameIndex] = false;
        };
        if (nextImg.complete) activate();
        else nextImg.onload = activate;
      };
    }

    const controllers = [...brandFrames].map((el, i) => makeFrameController(el, i));

    // Show each frame's first (already-picked) brand immediately.
    currentBrand.forEach((brand, i) => controllers[i](brand));

    currentBrand.forEach((_, frameIndex) => {
      setTimeout(() => {
        setInterval(() => {
          // Skip this tick if the previous pick for this frame hasn't
          // finished loading/activating — currentBrand[frameIndex] must
          // always match (or be about to imminently match) what's visible,
          // otherwise the uniqueness check below reads stale data.
          if (pending[frameIndex]) return;
          const forbidden = new Set(
            currentBrand.filter((_, i) => i !== frameIndex)
          );
          const candidates = brandKeys.filter(k => !forbidden.has(k));
          const newBrand = candidates[Math.floor(Math.random() * candidates.length)];
          currentBrand[frameIndex] = newBrand;
          controllers[frameIndex](newBrand);
        }, 3000);
      }, frameIndex * 500);
    });
  }
});
