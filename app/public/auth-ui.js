// 상단바 로그인 상태 전환. 다른 스크립트와 독립적으로 동작한다.
(() => {
  const $ = (id) => document.getElementById(id);
  const guest = $('authGuest');
  const user = $('authUser');
  if (!guest || !user) return;

  function render(me) {
    const loggedIn = Boolean(me);
    guest.hidden = loggedIn;
    user.hidden = !loggedIn;
    if (loggedIn && me.email) $('authEmail').textContent = me.email;
  }

  fetch('/api/auth/me')
    .then((r) => r.json())
    .then((d) => render(d.user))
    .catch(() => render(null));

  $('logoutBtn')?.addEventListener('click', async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
    render(null);
  });
})();
