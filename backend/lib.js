/* Train Sim Germany – Backend: kleine Hilfen (Base64url, Zeit, Bytes) */
export const enc = new TextEncoder();
export const dec = new TextDecoder();

export function b64u(bytes) {
  let s = '';
  new Uint8Array(bytes).forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export const fromB64u = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4)), (c) => c.charCodeAt(0));
export const randomKey = (n = 32) => b64u(crypto.getRandomValues(new Uint8Array(n)));
export const now = () => Math.floor(Date.now() / 1000);
export const clip = (v, n) => String(v ?? '').slice(0, n);
export function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  parts.forEach((p) => { out.set(p, o); o += p.length; });
  return out;
}
export const jsonPart = (part) => JSON.parse(dec.decode(fromB64u(part)));
