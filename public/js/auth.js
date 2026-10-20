// Telegram login on the client: automatic inside the Mini App, through the bot in a browser,
// plus the account chip and the subscription dialog.

import { h, mount, api } from './ui.js';
import { getToken, setToken } from './session.js';
import { track } from './track.js';

const POLL_MS = 2000;

let config = { authMode: 'open', botUsername: null, channelUrl: null };
/** @type {{user: {id: number, username: string|null, firstName: string}, subscriber: boolean, trial: {profiling: number, arena: number}, channelUrl: string|null}|null} */
let me = null;
let closeModal = null;

const tgInitData = () => window.Telegram?.WebApp?.initData || '';
const displayName = (user) => (user.username ? `@${user.username}` : user.firstName || 'Профиль');

/* ---------- modal ---------- */

function openModal(title, children) {
  closeModal?.();
  const root = document.getElementById('modal-root');
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => {
    root.replaceChildren();
    document.removeEventListener('keydown', onKey);
    if (closeModal === close) closeModal = null;
  };
  const dialog = h('div', { class: 'modal', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': title } }, [
    h('button', { class: 'modal-close', text: '×', attrs: { 'aria-label': 'Закрыть' }, on: { click: close } }),
    h('h2', { text: title }),
    ...children,
  ]);
  root.replaceChildren(h('div', { class: 'modal-backdrop', on: { click: (e) => { if (e.target === e.currentTarget) close(); } } }, [dialog]));
  document.addEventListener('keydown', onKey);
  closeModal = close;
  return close;
}

/* ---------- account ---------- */

async function refreshMe({ fresh = false } = {}) {
  if (!getToken()) {
    me = null;
  } else {
    try {
      me = await api(`/me${fresh ? '?fresh=1' : ''}`, undefined, { quiet: true });
    } catch {
      me = null;
    }
  }
  renderAccount();
  return me;
}

function renderAccount() {
  const slot = document.getElementById('account');
  if (!slot) return;
  if (config.authMode !== 'telegram') return slot.replaceChildren();
  if (!me) {
    return slot.replaceChildren(h('button', { class: 'account-btn', text: 'Войти', on: { click: () => openLogin() } }));
  }
  return slot.replaceChildren(h('button', {
    class: `account-btn is-in ${me.subscriber ? 'is-member' : ''}`,
    attrs: { title: me.subscriber ? 'Полный доступ' : 'Пробный доступ' },
    on: { click: () => openAccount() },
  }, [h('span', { class: 'account-name', text: displayName(me.user) }), h('span', { class: 'account-badge', text: me.subscriber ? 'доступ' : 'проба' })]));
}

function trialLine() {
  if (!me || me.subscriber) return null;
  const { profiling, arena } = me.trial;
  return h('p', { class: 'muted', text: `Пробный доступ: Профайлинг — ${profiling}, Арена — ${arena}.` });
}

function openAccount() {
  if (!me) return openLogin();
  return openModal(displayName(me.user), [
    h('p', { text: me.subscriber ? 'Вы участник канала: Профайлинг и Арена открыты полностью.' : 'Полный доступ к ИИ-тренировкам открыт участникам канала.' }),
    trialLine(),
    h('div', { class: 'modal-actions' }, [
      !me.subscriber && channelLink(),
      !me.subscriber && h('button', { class: 'btn btn-ghost', text: 'Я вступил — проверить', on: { click: checkSubscription } }),
      h('button', {
        class: 'btn btn-ghost',
        text: 'Выйти',
        on: { click: () => { setToken(null); me = null; renderAccount(); closeModal?.(); } },
      }),
    ]),
  ]);
}

function channelLink() {
  const url = me?.channelUrl ?? config.channelUrl;
  return url ? h('a', { class: 'btn btn-primary', text: 'Вступить в канал', attrs: { href: url, target: '_blank', rel: 'noopener noreferrer' } }) : null;
}

async function checkSubscription(e) {
  const btn = e?.currentTarget;
  if (btn) { btn.disabled = true; btn.textContent = 'Проверяем…'; }
  await refreshMe({ fresh: true });
  if (me?.subscriber) {
    track('subscription_confirmed');
    openModal('Доступ открыт', [
      h('p', { text: 'Спасибо! Профайлинг и Арена теперь доступны полностью. Запустите тренировку ещё раз.' }),
      h('div', { class: 'modal-actions' }, [h('button', { class: 'btn btn-primary', text: 'Продолжить', on: { click: () => closeModal?.() } })]),
    ]);
  } else if (btn) {
    btn.disabled = false;
    btn.textContent = 'Пока не видим подписку — проверить ещё раз';
  }
}

/* ---------- login ---------- */

/** Browser login: the link opens the bot; the page waits until the user confirms there. */
function openLogin() {
  if (tgInitData()) {
    return openModal('Не удалось войти', [h('p', { text: 'Telegram не подтвердил вход. Закройте и снова откройте приложение из бота.' })]);
  }
  let stopped = false;
  const status = h('p', { class: 'muted', text: 'Готовим ссылку…' });
  const actions = h('div', { class: 'modal-actions' });
  const close = openModal('Вход через Telegram', [
    h('p', { text: 'Откроется наш бот. Нажмите «Старт», затем выберите в боте код, показанный ниже, — и возвращайтесь на эту страницу.' }),
    actions,
    status,
  ]);
  const stop = () => { stopped = true; };
  const wrappedClose = () => { stop(); close(); };
  closeModal = wrappedClose;

  (async () => {
    let login;
    try {
      login = await api('/auth/bot/start', {}, { quiet: true });
    } catch (err) {
      status.textContent = err.message;
      return;
    }
    actions.replaceChildren(
      h('div', { class: 'login-code' }, [
        h('span', { class: 'muted', text: 'Ваш код — выберите его в боте' }),
        h('strong', { text: String(login.code) }),
      ]),
      h('a', { class: 'btn btn-primary', text: 'Открыть Telegram', attrs: { href: login.link, target: '_blank', rel: 'noopener noreferrer' } }),
    );
    status.textContent = 'Ждём подтверждения в Telegram…';
    const deadline = Date.now() + login.expiresIn * 1000;
    while (!stopped && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      if (stopped) return;
      let result;
      try {
        result = await api('/auth/bot/claim', { token: login.token, nonce: login.nonce }, { quiet: true });
      } catch (err) {
        if (err.status === 410) break;
        continue; // network blip: keep waiting
      }
      if (result.token) {
        setToken(result.token);
        track('login_completed', { method: 'bot' });
        await refreshMe();
        wrappedClose();
        return;
      }
    }
    if (!stopped) {
      status.textContent = 'Ссылка устарела.';
      actions.replaceChildren(h('button', { class: 'btn btn-primary', text: 'Попробовать снова', on: { click: () => openLogin() } }));
    }
  })();
  return wrappedClose;
}

function openPaywall() {
  track('paywall_shown');
  openModal('Доступ для участников канала', [
    h('p', { text: 'Пробная попытка этой тренировки уже использована. Полный доступ к Профайлингу и Арене открыт участникам нашего канала.' }),
    trialLine(),
    h('div', { class: 'modal-actions' }, [
      channelLink(),
      h('button', { class: 'btn btn-ghost', text: 'Я вступил — проверить', on: { click: checkSubscription } }),
    ]),
  ]);
}

/* ---------- start ---------- */

export async function initAuth() {
  try {
    config = await api('/config', undefined, { quiet: true });
  } catch {
    config = { authMode: 'open', botUsername: null, channelUrl: null };
  }
  if (config.authMode === 'telegram') {
    const initData = tgInitData();
    if (initData) {
      try {
        const { token } = await api('/auth/telegram', { initData }, { quiet: true });
        setToken(token);
        track('login_completed', { method: 'miniapp' });
      } catch { /* keep any stored session */ }
    }
    await refreshMe();
  }
  renderAccount();
  window.addEventListener('kpv:auth', (e) => {
    if (e.detail?.reason === 'subscription_required') refreshMe().then(openPaywall);
    else { me = null; renderAccount(); openLogin(); }
  });
}
