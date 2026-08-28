// Safe rendering helpers for browser-visible values.
// Untrusted user/local/API strings must never be interpolated into raw HTML unchanged.
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function safeText(value, maxLength = 500) {
  return String(value ?? '').slice(0, maxLength);
}
