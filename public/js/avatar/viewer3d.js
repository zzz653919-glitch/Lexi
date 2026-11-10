/* The 3D skin viewer: a real-time WebGL model of the learner's character wearing a skin, with 360° turning, zoom, front / side / back views
   and the skin's details and buttons. The model is BUILT FROM THE SKIN'S OWN DRAWING: every shape of the front and of the back picture
   is extruded into a solid piece, stacked in drawing order, lit and shaded (three.js, loaded only when a preview is opened). It is a
   relief-style model, not a sculpted mesh, and it follows every colour, pattern and design of the skin. Without WebGL a turning 2.5D card is shown. */
import { h, toast } from '../ui.js';
import { t } from '../i18n.js';
import { renderAvatar, fitsStyle } from './render.js';
import { A, equippedItems, rarityBadge, tokenAmount, activeAvatar } from './ui.js';

let lib = null;
async function loadLib() {
  if (lib) return lib;
  const [T, L, C, U] = await Promise.all([import('/vendor/three/three.module.min.js'), import('/vendor/three/SVGLoader.js'), import('/vendor/three/OrbitControls.js'), import('/vendor/three/BufferGeometryUtils.js')]);
  lib = { T, SVGLoader: L.SVGLoader, OrbitControls: C.OrbitControls, merge: U.mergeGeometries };
  return lib;
}
const webglOk = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (_) { return false; } };

/* a flat version of a rendered picture that the SVG loader can read: gradients become their middle colour, clipped, filtered and decorative parts are dropped */
function flatten(svg) {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml'), root = doc.documentElement;
  const mid = new Map();
  doc.querySelectorAll('radialGradient, linearGradient').forEach((g) => { const stops = [...g.querySelectorAll('stop')]; if (stops.length) mid.set(g.getAttribute('id'), (stops[Math.min(1, stops.length - 1)].getAttribute('stop-color')) || '#cccccc'); });
  root.querySelectorAll('defs, text, image, filter, clipPath, .av-shadow, [clip-path], .av-tw, .av-fx').forEach((n) => { if (n.parentNode) n.parentNode.removeChild(n); });
  root.querySelectorAll('*').forEach((n) => {
    for (const a of ['fill', 'stroke']) { const v = n.getAttribute(a); if (v && v.startsWith('url(')) n.setAttribute(a, mid.get(v.slice(5, -1)) || '#cccccc'); }
    n.removeAttribute('filter'); n.removeAttribute('class'); n.removeAttribute('style');
  });
  return new XMLSerializer().serializeToString(root);
}

/* the picture of the character wearing the item (front or back) */
export function dressedSvg(item, view) {
  const a = activeAvatar() || { style: 'cartoon', look: {}, equipped: {} }, eq = { ...equippedItems(a.equipped) };
  const clears = { dress: ['top', 'bottom', 'outfit'], outfit: ['top', 'bottom', 'dress'], top: ['dress', 'outfit'], bottom: ['dress', 'outfit'] };
  for (const s of clears[item.slot] || []) delete eq[s];
  eq[item.slot] = item;
  delete eq.background; delete eq.effect; delete eq.pet;
  return renderAvatar({ style: a.style, look: a.look, equipped: eq, size: 240, viewBox: '0 0 240 340', plain: true, view, petPose: 'sit' });
}

/* extrude every shape of a flattened picture into solid pieces (one merged mesh per colour) */
function buildStack(svgText, { T, SVGLoader, merge }, mirror) {
  const data = new SVGLoader().parse(flatten(svgText)), groups = new Map();
  const n = data.paths.length || 1, step = Math.max(0.1, Math.min(0.45, 80 / n)), BASE = 16;   // each piece keeps its front face in drawing order; big pieces grow backwards to the middle plane (solid body), small ones stay thin
  const put = (geo, color, opacity, key) => { const k = `${key}|${color}|${opacity}`; if (!groups.has(k)) groups.set(k, { geos: [], color, opacity, flat: key === 's' }); groups.get(k).geos.push(geo); };
  let z = 0;
  for (const path of data.paths) {
    const st = path.userData.style || {}, op = (st.opacity ?? 1);
    if (st.fill && st.fill !== 'none' && (st.fillOpacity ?? 1) * op > 0.04) {
      const c = new T.Color().setStyle(st.fill), op2 = Math.round((st.fillOpacity ?? 1) * op * 20) / 20;
      for (const shape of SVGLoader.createShapes(path)) {
        const pts = shape.getPoints(3); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const q of pts) { if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; }
        const face = BASE + z, area = Math.sqrt(Math.max(0, (x1 - x0) * (y1 - y0))), D = area > 34 ? face : Math.max(3, Math.min(face, 3 + area * .3));   // never past the middle plane
        const g = new T.ExtrudeGeometry(shape, { depth: D, bevelEnabled: false, curveSegments: 5 }); g.translate(0, 0, face - D); put(g, c.getHex(), op2, 'f');
      }
    }
    if (st.stroke && st.stroke !== 'none' && (st.strokeOpacity ?? 1) * op > 0.04 && (st.strokeWidth ?? 1) > 0) {
      const c = new T.Color().setStyle(st.stroke);
      for (const sub of path.subPaths) { const g = SVGLoader.pointsToStroke(sub.getPoints(), st); if (g && g.attributes.position && g.attributes.position.count) { g.translate(0, 0, BASE + z + 0.03); put(g, c.getHex(), Math.round((st.strokeOpacity ?? 1) * op * 20) / 20, 's'); } }
    }
    z += step;
  }
  const out = new T.Group();
  for (const g of groups.values()) {
    let geo = merge(g.geos.map((x) => (x.index ? x.toNonIndexed() : x)), false);
    if (mirror) { geo.translate(-120, 0, 0); geo.rotateY(Math.PI); geo.translate(120, 0, 0); }   // the back picture is turned half a round: it reads correctly from behind
    const mat = new T.MeshStandardMaterial({ color: g.color, roughness: g.flat ? .8 : .58, metalness: .06, transparent: g.opacity < 1, opacity: g.opacity, side: g.flat ? T.DoubleSide : T.FrontSide, depthWrite: g.opacity >= 1 });
    out.add(new T.Mesh(geo, mat));
    g.geos.forEach((x) => x.dispose());
  }
  return out;
}

const RAD = Math.PI / 180;
export async function openSkinViewer({ item, list = [], buy, wear, tryOn, refresh = () => {} }) {
  closeSkinViewer();
  let cur = Math.max(0, list.findIndex((x) => x.slug === item.slug)), it = item;
  const canvasHost = h('div', { class: 'av-v3-stage', id: 'av-v3-stage' }), info = h('div', { class: 'av-v3-info', id: 'av-v3-info' }), bar = h('div', { class: 'av-v3-actions', id: 'av-v3-actions' });
  const status = h('div', { class: 'av-v3-status', role: 'status' });
  let ctx = null, raf = 0, disposed = false, mode = 'webgl';
  const views = h('div', { class: 'av-v3-views', role: 'group', 'aria-label': t('av.v3.views') });
  const btn = (id, label, fn, cls = '') => h('button', { type: 'button', class: 'av-v3-btn ' + cls, id, 'aria-label': label, title: label, onclick: fn }, label);
  const root = h('div', { class: 'av-modal av-v3', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'av-v3-h', id: 'skin-viewer' },
    h('div', { class: 'av-v3-room' },
      h('header', { class: 'av-v3-head' }, h('h2', { id: 'av-v3-h' }, '🎮 ', t('av.v3.title')), h('button', { type: 'button', class: 'av-btn av-v3-close', id: 'av-v3-close', 'aria-label': t('av.close'), title: t('av.close'), onclick: () => close() }, '✕')),
      h('div', { class: 'av-v3-body' }, h('section', { class: 'av-v3-left' }, canvasHost, views, status), h('section', { class: 'av-v3-right' }, info, bar, h('p', { class: 'av-v3-note' }, t('av.v3.note'))))));

  /* ---- the scene ---- */
  async function start() {
    status.textContent = t('av.v3.loading');
    if (!webglOk()) { fallback(); return; }
    try {
      const L = await loadLib(); if (disposed) return;
      const { T, OrbitControls } = L;
      const canvas = h('canvas', { class: 'av-v3-canvas', id: 'av-v3-canvas', tabindex: 0, 'aria-label': t('av.v3.drag') });
      canvasHost.replaceChildren(canvas);
      const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.outputColorSpace = T.SRGBColorSpace;
      const scene = new T.Scene(), camera = new T.PerspectiveCamera(32, 1, 1, 40), group = new T.Group(), modelHolder = new T.Group();
      scene.add(new T.HemisphereLight(0xffffff, 0x8f7fc0, 1.25));
      const key = new T.DirectionalLight(0xffffff, 1.9); key.position.set(-3.5, 5, 6); scene.add(key);
      const rim = new T.DirectionalLight(0xb9a8ff, 1.0); rim.position.set(4, 3, -6); scene.add(rim);
      const fill = new T.DirectionalLight(0xffd6ec, .7); fill.position.set(5, 1, 4); scene.add(fill);
      /* the floor: a soft shadow and a glowing ring */
      const sc = document.createElement('canvas'); sc.width = sc.height = 128; const g2 = sc.getContext('2d'), gr = g2.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(20,10,50,.55)'); gr.addColorStop(1, 'rgba(20,10,50,0)'); g2.fillStyle = gr; g2.fillRect(0, 0, 128, 128);
      const shadow = new T.Mesh(new T.CircleGeometry(1.7, 40), new T.MeshBasicMaterial({ map: new T.CanvasTexture(sc), transparent: true, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
      const ring = new T.Mesh(new T.RingGeometry(1.55, 1.68, 64), new T.MeshBasicMaterial({ color: 0xff7ab8, transparent: true, opacity: .55, side: T.DoubleSide })); ring.rotation.x = -Math.PI / 2; scene.add(ring);
      group.add(modelHolder); scene.add(group);
      const controls = new OrbitControls(camera, canvas);
      controls.enableDamping = true; controls.dampingFactor = .08; controls.enablePan = false; controls.rotateSpeed = .9; controls.zoomSpeed = .9;
      controls.minPolarAngle = .3 * Math.PI; controls.maxPolarAngle = .62 * Math.PI;
      const H = 3.6; let fitDist = 8;
      const fitCamera = () => { const w = canvasHost.clientWidth || 400, hh = canvasHost.clientHeight || 500; renderer.setSize(w, hh, false); camera.aspect = w / hh; const vfov = camera.fov * RAD, need = (H / 2) / Math.tan(vfov / 2) * 1.22, needW = (2.3 / 2) / (Math.tan(vfov / 2) * camera.aspect) * 1.2; fitDist = Math.max(need, needW); controls.minDistance = fitDist * .42; controls.maxDistance = fitDist * 1.5; camera.updateProjectionMatrix(); };
      const place = (az, polar, dist) => { const sph = new T.Spherical(dist, polar, az); camera.position.setFromSpherical(sph); camera.lookAt(0, 0, 0); controls.update(); };
      let tween = null;
      const tweenTo = (azDeg, ms = 550) => { const from = controls.getAzimuthalAngle(), to = azDeg * RAD; let d = ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI; tween = { from, d, t0: performance.now(), ms }; };
      const setDist = (f) => { const off = camera.position.clone(), d = Math.min(controls.maxDistance, Math.max(controls.minDistance, off.length() * f)); off.setLength(d); camera.position.copy(off); controls.update(); };
      const state = () => { const az = ((controls.getAzimuthalAngle() / RAD) % 360 + 360) % 360; canvas.dataset.azimuth = String(Math.round(az)); canvas.dataset.zoom = (fitDist / camera.position.length()).toFixed(2); };
      controls.addEventListener('change', state);
      ctx = { renderer, scene, camera, controls, place, tweenTo, setDist, fitCamera, T, L, modelHolder, canvas, state, fit: () => fitDist, setModel(obj) { modelHolder.clear(); modelHolder.add(obj); } };
      new ResizeObserver(() => { fitCamera(); }).observe(canvasHost);
      fitCamera(); place(0, Math.PI / 2 - .04, fitDist); state();
      canvas.dataset.mode = 'webgl';
      await loadModel();
      const loop = () => {
        if (disposed) return; raf = requestAnimationFrame(loop);
        if (tween) { const k = Math.min(1, (performance.now() - tween.t0) / tween.ms), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, az = tween.from + tween.d * e, off = camera.position.clone(), sph = new T.Spherical().setFromVector3(off); sph.theta = az; camera.position.setFromSpherical(sph); camera.lookAt(0, 0, 0); if (k >= 1) tween = null; }
        controls.autoRotate = auto; controls.update(); renderer.render(scene, camera);
      };
      loop();
    } catch (e) { console.warn('3D viewer fell back:', e); fallback(); }
  }
  let auto = false;
  async function loadModel() {
    if (!ctx) return; status.textContent = t('av.v3.loading'); canvasHost.classList.add('loading');
    await new Promise((r) => setTimeout(r, 30));   // let the "loading" text paint
    const { T, L } = ctx, front = buildStack(dressedSvg(it, 'front'), L, false), back = buildStack(dressedSvg(it, 'back'), L, true);
    const model = new T.Group(); model.add(front, back);
    const box = new T.Box3().setFromObject(model), size = box.getSize(new T.Vector3()), ctr = box.getCenter(new T.Vector3());
    const s = 3.6 / 340; model.position.set(-ctr.x, -ctr.y, -ctr.z); const holder = new T.Group(); holder.add(model); holder.scale.set(s, -s, s);
    ctx.setModel(holder);
    const sz = new T.Box3().setFromObject(holder).getSize(new T.Vector3()); ctx.depth = sz.z;
    status.textContent = ''; canvasHost.classList.remove('loading');
    ctx.canvas.dataset.skin = it.slug;
  }
  /* ---- the fallback: the same picture on a turning card ---- */
  function fallback() {
    mode = 'fallback'; let flip = 0, zoom = 1;
    const front = h('div', { class: 'av-v3-face' }), back = h('div', { class: 'av-v3-face back' }), card = h('div', { class: 'av-v3-card', id: 'av-v3-card', 'data-mode': 'fallback' }, front, back);
    const paint = () => { front.innerHTML = dressedSvg(it, 'front'); back.innerHTML = dressedSvg(it, 'back'); };
    paint(); canvasHost.replaceChildren(h('div', { class: 'av-v3-scene' }, card)); canvasHost.dataset.mode = 'fallback'; status.textContent = t('av.v3.no_webgl');
    ctx = { fallback: true, tweenTo: (deg) => { flip = deg; card.style.setProperty('--a', flip + 'deg'); card.dataset.azimuth = String(Math.round(deg)); }, setDist: (f) => { zoom = Math.min(1.8, Math.max(.6, zoom / f)); card.style.setProperty('--z', String(zoom)); card.dataset.zoom = zoom.toFixed(2); }, reset: () => { flip = 0; zoom = 1; card.style.setProperty('--a', '0deg'); card.style.setProperty('--z', '1'); }, repaint: paint };
  }

  /* ---- controls ---- */
  const view = (deg) => { if (ctx) ctx.tweenTo(deg); };
  const mk = (id, label, fn, cls) => btn(id, label, fn, cls);
  views.append(mk('av-v3-front', t('av.v3.front'), () => view(0)), mk('av-v3-side', t('av.v3.side'), () => view(90)), mk('av-v3-back', t('av.v3.back'), () => view(180)), mk('av-v3-left', '◀ ' + t('av.v3.turn'), () => { if (ctx && !ctx.fallback) { const cur0 = ctx.controls.getAzimuthalAngle() / RAD; ctx.tweenTo(cur0 - 45); } else view(-45); }, 'rot'), mk('av-v3-right', t('av.v3.turn') + ' ▶', () => { if (ctx && !ctx.fallback) { const cur0 = ctx.controls.getAzimuthalAngle() / RAD; ctx.tweenTo(cur0 + 45); } else view(45); }, 'rot'),
    mk('av-v3-zoom-out', '−', () => ctx && ctx.setDist(1.25), 'zoom'), mk('av-v3-zoom-in', '+', () => ctx && ctx.setDist(.8), 'zoom'),
    mk('av-v3-auto', '⟳ 360°', (e) => { auto = !auto; e.currentTarget.classList.toggle('on', auto); e.currentTarget.setAttribute('aria-pressed', String(auto)); }, 'auto'), mk('av-v3-reset', t('av.v3.reset'), () => { auto = false; document.getElementById('av-v3-auto').classList.remove('on'); if (ctx && !ctx.fallback) { ctx.place(0, Math.PI / 2 - .04, ctx.fit()); ctx.state(); } else if (ctx) ctx.reset(); }));

  const owned = () => it.owned || it.starter;
  const compat = () => fitsStyle((activeAvatar() || { style: 'cartoon' }).style, it);
  function drawInfo() {
    const game = it.collection ? (t('av.collection.' + it.collection)) : '', sub = it.sub ? (t('av.sub.' + it.sub) === 'av.sub.' + it.sub ? it.sub.replace(/-/g, ' ') : t('av.sub.' + it.sub)) : '';
    info.replaceChildren(h('h3', { id: 'av-v3-name' }, it.name), h('div', { class: 'av-v3-chips' }, h('span', { class: 'av-v3-game', id: 'av-v3-game' }, '🎮 ', game), ...(sub ? [h('span', { class: 'av-v3-sub' }, sub)] : []), rarityBadge(it.rarity), h('span', { class: 'av-v3-kind' }, t('av.kind.' + it.kind))),
      h('div', { class: 'av-v3-price', id: 'av-v3-price' }, owned() ? h('span', { class: 'av-owned' }, '✔ ', t(it.starter ? 'av.starter' : 'av.owned')) : it.forSale ? tokenAmount(it.price) : h('small', {}, t('av.earn_only'))),
      ...(!compat() ? [h('p', { class: 'av-v3-warn' }, t('av.fit.no_fit'))] : []));
    const need = it.forSale && !owned() ? it.price - A.boot.wallet.balance : 0;
    bar.replaceChildren(
      h('button', { type: 'button', class: 'av-btn wear', id: 'av-v3-try', disabled: !compat(), onclick: () => { close(); tryOn(it); } }, '👗 ', t('av.fit')),
      ...[!owned() ? h('button', { type: 'button', class: 'av-btn go buy', id: 'av-v3-buy', disabled: !it.forSale || need > 0, title: need > 0 ? t('av.need_more', { n: need }) : '', onclick: async () => { if (await buy(it)) { drawInfo(); refresh(); } } }, need > 0 ? t('av.need_more', { n: need }) : t('av.buy')) : h('button', { type: 'button', class: 'av-btn go', id: 'av-v3-equip', disabled: !compat(), onclick: async () => { await wear(it); } }, t('av.fit.equip'))],
      ...(list.length > 1 ? [h('div', { class: 'av-v3-nav' }, h('button', { type: 'button', class: 'av-btn', id: 'av-v3-prev', 'aria-label': t('av.v3.prev'), onclick: () => step(-1) }, '‹'), h('span', { class: 'av-v3-count' }, `${cur + 1} / ${list.length}`), h('button', { type: 'button', class: 'av-btn', id: 'av-v3-next', 'aria-label': t('av.v3.next'), onclick: () => step(1) }, '›'))] : []));
  }
  async function step(d) { if (!list.length) return; cur = (cur + d + list.length) % list.length; it = list[cur]; drawInfo(); if (ctx && ctx.fallback) ctx.repaint(); else await loadModel(); }
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } else if (e.key === 'ArrowLeft' && e.altKey) step(-1); else if (e.key === 'ArrowRight' && e.altKey) step(1); };
  function close() {
    disposed = true; cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey);
    if (ctx && ctx.renderer) { ctx.modelHolder.clear(); ctx.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); }); ctx.controls.dispose(); ctx.renderer.dispose(); try { ctx.renderer.forceContextLoss(); } catch (_) { /* ignore */ } }
    root.remove(); if (current && current.root === root) current = null; document.body.classList.remove('av-noscroll');
  }
  current = { root, close, refresh: drawInfo };
  drawInfo(); document.addEventListener('keydown', onKey); document.body.classList.add('av-noscroll'); document.body.append(root); root.querySelector('#av-v3-close').focus();
  await start();
  return current;
}
let current = null;
export const closeSkinViewer = () => { if (current) current.close(); };
