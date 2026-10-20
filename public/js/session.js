// Session token storage. A bearer token (not a cookie) works inside Telegram's webview and iframe alike.

const KEY = 'kpv-session';

export function getToken() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch { /* storage unavailable: the session lasts for this page only */ }
}
