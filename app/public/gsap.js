// GSAP 연출. app.js가 DOM을 다 그린 뒤에 실행된다(스크립트 순서로 보장).
// 체크가 한 줄씩 판정되는 시그니처 애니는 styles.css(.run)에 그대로 두고,
// GSAP는 "적절히" 세 순간에만 쓴다: 첫 화면 등장 · 계획 노드 reveal · 마감 D-day 카운트업.
// reduced-motion이면 .ganim이 안 붙어 여기서 바로 빠져나가고, 모든 요소는 처음부터 보인다.
(function () {
  const root = document.documentElement;
  if (!root.classList.contains('ganim')) return;              // reduced-motion
  if (!window.gsap) { root.classList.remove('ganim'); return; } // CDN 실패 → 숨김 해제(폴백)

  const { gsap } = window;
  gsap.registerPlugin(ScrollTrigger);

  // 1) 첫 화면이 한 박자에 자리를 잡는다
  gsap.set(['.hero h1', '.lede', '.intake', '.pr'], { y: 16 });
  gsap.timeline({ defaults: { duration: 0.6, ease: 'power2.out' } })
    .to('.hero h1', { opacity: 1, y: 0 })
    .to('.lede', { opacity: 1, y: 0 }, '-=0.42')
    .to('.intake', { opacity: 1, y: 0 }, '-=0.42')
    .to('.pr', { opacity: 1, y: 0 }, '-=0.50');

  // 2) 졸업까지의 계획 노드가 선을 따라 하나씩 올라온다 (선 그리기는 app.js가 .drawn으로 처리)
  gsap.set('#branch .node', { y: 18 });
  gsap.to('#branch .node', {
    opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.12,
    scrollTrigger: { trigger: '#branch', start: 'top 78%' },
  });

  // 3) 마감 D-day가 0에서 올라오며 시선을 끈다
  document.querySelectorAll('.dday').forEach((el) => {
    const m = el.textContent.match(/D-(\d+)/);
    if (!m) return;                       // "진행 중" 같은 칸은 건너뛴다
    const end = +m[1], o = { v: 0 };
    el.textContent = 'D-0';
    gsap.to(o, {
      v: end, duration: 1, ease: 'power1.out', snap: { v: 1 },
      onUpdate: () => { el.textContent = 'D-' + Math.round(o.v); },
      scrollTrigger: { trigger: el, start: 'top 88%' },
    });
  });
})();
