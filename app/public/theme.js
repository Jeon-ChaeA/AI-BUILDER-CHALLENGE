// 다크 모드 토글. 저장한 선택이 있으면 그걸, 없으면 기기 설정을 따른다.
// 화면이 그려지기 전에 적용하려고 <head>에서 동기로 불러온다. 버튼은 #themeToggle.
(() => {
  const KEY = 'jg.theme';
  const root = document.documentElement;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
  } catch { /* 저장소가 막혀 있으면 기기 설정을 따른다 */ }

  const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
  const paint = (btn) => {
    const dark = isDark();
    btn.innerHTML = `<i class="ph ${dark ? 'ph-sun' : 'ph-moon'}"></i>`;
    btn.setAttribute('aria-label', dark ? '라이트 모드로 바꾸기' : '다크 모드로 바꾸기');
    btn.setAttribute('aria-pressed', String(dark));
  };

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    paint(btn);
    btn.addEventListener('click', () => {
      const next = isDark() ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem(KEY, next); } catch { /* 이번 방문에만 적용 */ }
      paint(btn);
    });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => paint(btn));
  });
})();
