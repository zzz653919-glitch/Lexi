/* Applies the brand colour from the site settings. White text must stay readable on it (WCAG AA, 4.5:1), so a colour that is too
   light is darkened until it is. */
const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const toRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
export function accessibleBrand(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex || '')) return '#147a54';
  let rgb = toRgb(hex);
  for (let i = 0; i < 40 && 1.05 / (lum(rgb) + 0.05) < 4.5; i++) rgb = rgb.map((v) => v * 0.94);
  return toHex(rgb);
}
export function applyBrand(hex) {
  document.documentElement.style.setProperty('--brand', accessibleBrand(hex));
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', accessibleBrand(hex));
}
