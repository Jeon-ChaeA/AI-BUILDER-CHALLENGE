// GSAP 연출. app.js가 DOM을 다 그린 뒤에 실행된다(스크립트 순서로 보장).
// 체크가 한 줄씩 판정되는 시그니처 애니는 styles.css(.run)에 그대로 두고,
// GSAP는 등장·시선 유도를 맡는다: 첫 화면 로드, 리포트 카드 수치, 전 섹션 스크롤 리빌.
// reduced-motion이면 .ganim이 안 붙어 바로 빠져나가고(모든 요소 처음부터 보임),
// CDN 실패 시 .ganim을 걷어 숨긴 요소를 즉시 보여 준다(폴백).
(function () {
  const root = document.documentElement;
  if (!root.classList.contains('ganim')) return;
  if (!window.gsap) { root.classList.remove('ganim'); return; }

  const { gsap } = window;
  gsap.registerPlugin(ScrollTrigger);
  const E = 'power2.out';

  // 숫자 카운트업 (prefix/suffix 지원)
  function countTo(el, end, { prefix = '', suffix = '', dur = 1.1, delay = 0, scroll = false } = {}) {
    const o = { v: 0 };
    const cfg = {
      v: end, duration: dur, ease: 'power1.out', snap: { v: 1 }, delay,
      onUpdate: () => { el.textContent = prefix + Math.round(o.v) + suffix; },
    };
    if (scroll) cfg.scrollTrigger = { trigger: el, start: 'top 90%' };
    gsap.to(o, cfg);
  }

  // 1) 첫 화면 로드 시퀀스
  gsap.set(['.hero h1', '.lede', '.intake', '.pr'], { y: 16 });
  gsap.timeline({ defaults: { duration: 0.6, ease: E } })
    .to('.hero h1', { opacity: 1, y: 0 })
    .to('.lede', { opacity: 1, y: 0 }, '-=0.42')
    .to('.intake', { opacity: 1, y: 0 }, '-=0.42')
    .to('.pr', { opacity: 1, y: 0 }, '-=0.50');

  // 2) 리포트 카드: 진행률 링이 차고 숫자가 올라온다
  const ring = document.querySelector('.rc-ring .prog');
  if (ring) {
    const C = 2 * Math.PI * 52;
    gsap.set(ring, { strokeDasharray: C, strokeDashoffset: C });
    gsap.to(ring, { strokeDashoffset: C * (1 - 0.62), duration: 1.1, ease: E, delay: 0.55 });
  }
  const pct = document.querySelector('.rc-pct strong');
  const earned = document.querySelector('.rc-big strong');
  if (pct) countTo(pct, 62, { dur: 1.1, delay: 0.55 });
  if (earned) countTo(earned, 84, { dur: 1.1, delay: 0.55 });

  // 3) 전 섹션 스크롤 리빌 (은은하게, 들어올 때 한 번)
  function reveal(sel, stagger = 0.08) {
    const els = gsap.utils.toArray(sel);
    if (!els.length) return;
    gsap.set(els, { opacity: 0, y: 18 });
    ScrollTrigger.batch(els, {
      start: 'top 88%',
      onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.55, ease: E, stagger, overwrite: true }),
    });
  }
  reveal('.sec > .step');
  reveal('.sec > h2');
  reveal('.sec > .sec-lede');
  reveal('.grass-card');
  reveal('.verified li', 0.06);
  reveal('.full .check', 0.06);
  reveal('.date', 0.08);
  reveal('.report');

  // 4) 졸업까지의 계획 노드가 선을 따라 올라온다
  gsap.set('#branch .node', { y: 18 });
  gsap.to('#branch .node', {
    opacity: 1, y: 0, duration: 0.5, ease: E, stagger: 0.12,
    scrollTrigger: { trigger: '#branch', start: 'top 78%' },
  });

  // 5) 마감 D-day 카운트업
  document.querySelectorAll('.dday').forEach((el) => {
    const m = el.textContent.match(/D-(\d+)/);
    if (!m) return;
    el.textContent = 'D-0';
    countTo(el, +m[1], { prefix: 'D-', dur: 1, scroll: true });
  });
})();
