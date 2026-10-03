// GSAP 연출. app.js가 DOM을 다 그린 뒤에 실행된다(스크립트 순서로 보장).
// 체크가 한 줄씩 판정되는 시그니처 애니는 styles.css(.run)에 그대로 두고,
// GSAP는 등장·시선 유도를 맡는다: 첫 화면 로드, 리포트 카드 수치, 결과 섹션 등장.
// 원칙: 내용을 '스크롤할 때까지' 숨기지 않는다. 스크롤하지 않는 전체 페이지 캡처(평가 봇, 인쇄 미리보기)에
// 결과가 빈칸으로 찍히기 때문이다. 연출은 그려진 직후 1초 안에 끝나고, 프레임이 멈춰도 타이머로 끝낸다.
// reduced-motion이면 .ganim이 안 붙어 바로 빠져나가고(모든 요소 처음부터 보임),
// CDN 실패 시 .ganim을 걷어 숨긴 요소를 즉시 보여 준다(폴백).
(function () {
  const root = document.documentElement;
  if (!root.classList.contains('ganim')) return;
  if (!window.gsap) { root.classList.remove('ganim'); return; }

  const { gsap } = window;
  // 탭이 뒤에 있거나 화면 갱신이 느린 환경에서도 연출이 제 시간에 끝나게 한다.
  // (기본값은 프레임이 밀리면 시간을 33ms씩만 진행시켜서, 요소가 반투명한 채로 오래 남는다.)
  gsap.ticker.lagSmoothing(0);
  const E = 'power2.out';

  // 숫자 카운트업
  function countTo(el, end, { dur = 1.1, delay = 0 } = {}) {
    const o = { v: 0 };
    gsap.to(o, {
      v: end, duration: dur, ease: 'power1.out', snap: { v: 1 }, delay,
      onUpdate: () => { el.textContent = Math.round(o.v); },
    });
  }

  // 1) 첫 화면 로드 시퀀스
  gsap.set(['.hero h1', '.lede', '.intake', '.pr'], { y: 16 });
  const intro = gsap.timeline({ defaults: { duration: 0.6, ease: E } })
    .to('.hero h1', { opacity: 1, y: 0 })
    .to('.lede', { opacity: 1, y: 0 }, '-=0.42')
    .to('.intake', { opacity: 1, y: 0 }, '-=0.42')
    .to('.pr', { opacity: 1, y: 0 }, '-=0.50');
  setTimeout(() => intro.progress(1), 2500); // 프레임이 아예 안 돌아도 첫 화면은 반드시 보이게

  // 2) 리포트 카드: 진행률 링이 차고 숫자가 올라온다. 수치는 app.js가 계산해 jg:hero로 보낸다.
  document.addEventListener('jg:hero', ({ detail: { pct: p, earned: e } }) => {
    const ring = document.querySelector('.rc-ring .prog');
    if (ring) {
      const C = 2 * Math.PI * 52;
      gsap.fromTo(ring, { strokeDashoffset: C }, { strokeDashoffset: C * (1 - p / 100), duration: 1.1, ease: E, delay: 0.55 });
    }
    const pct = document.querySelector('.rc-pct strong');
    const earned = document.querySelector('.rc-big strong');
    if (pct) countTo(pct, p, { dur: 1.1, delay: 0.55 });
    if (earned) countTo(earned, e, { dur: 1.1, delay: 0.55 });
  }, { once: true });

  // 연출을 반드시 끝낸다. 프레임이 돌지 않는 환경(뒤에 있는 탭)에서도 내용이 숨은 채로 남지 않는다.
  const finish = (tween, ms) => setTimeout(() => tween.progress(1), ms);

  // 3) 결과 등장: 새로 그려진 요소가 스크롤 위치와 상관없이 바로 올라온다.
  function reveal(sel) {
    const els = gsap.utils.toArray(sel).filter((el) => !el.dataset.revealed);
    if (!els.length) return;
    els.forEach((el) => { el.dataset.revealed = '1'; });
    finish(gsap.from(els, { opacity: 0, y: 14, duration: 0.5, ease: E, stagger: { amount: 0.3 }, clearProps: 'opacity,transform' }), 1500);
  }

  // 결과 섹션은 진단 뒤에 그려진다(app.js가 jg:render를 보냄). 그릴 때마다 새로 생긴 요소만 연출한다.
  document.addEventListener('jg:render', () => {
    reveal('.sec > .step');
    reveal('.sec > h2');
    reveal('.sec > .sec-lede');
    reveal('.grass-card');
    reveal('.verified li');
    reveal('.full .check');
    reveal('.report');
    reveal('.date'); // D-day 숫자는 건드리지 않는다(읽는 시점과 상관없이 값이 맞아야 한다)
    reveal('#branch .node'); // 계획 노드. 다시 짜면 새로 그려져 다시 올라온다
  });
})();
