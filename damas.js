/* =====================================================
   damas.js — منطق الموقع. لا تحتاج لتعديله عند إضافة منتج،
   فالمنتجات كلها في ملف products.js
   ===================================================== */
 
const main      = document.querySelector('.imgs img');    // صورة المنتج في الوسط
const bg        = document.querySelector('.shamelll');    // خلفية الصفحة
const wave      = document.querySelector('.bg-wave');     // الطبقة التي تتسع من الوسط
const strip     = document.querySelector('.icon');        // شريط الصور الصغيرة
const btnPrev   = document.querySelector('.nav-btn.prev');
const btnNext   = document.querySelector('.nav-btn.next');
 
const VISIBLE  = 5;      // عدد الصور الصغيرة الظاهرة
const DURATION = 900;    // مدة حركة الانتقال (ms)
 
// ألوان احتياطية تُستخدم فقط إن تعذّر حساب لون الصورة تلقائياً
const FALLBACK_COLORS = [
  ['#1a6fff', '#03039c'],
  ['#2fbf3a', '#04450b'],
  ['#ff8a1f', '#a8470a'],
  ['#d94f9a', '#5a0f3a'],
  ['#8a5cf6', '#2a0f6b']
];
 
let products = [];   // المنتجات الصالحة فقط
let current  = 0;    // رقم المنتج المعروض في المنتصف
let busy     = false;


/* ---------- لودر إعادة التحميل (زر "الرئيسية") ---------- */

const root         = document.documentElement;
const RELOAD_DELAY = 500;    // مدة ظهور اللودر قبل إعادة التحميل (ms)
const LOADER_MIN   = 1000;   // أقل زمن (من بداية التحميل) يبقى فيه اللودر بعد إعادة التحميل (ms)
const cameFromReload = root.classList.contains('reloading');   // يضبطها السكربت الصغير في head
let reloadingNow = false;

if (cameFromReload) window.scrollTo(0, 0);

function reloadHome() {
  if (reloadingNow) return;
  reloadingNow = true;

  const base = getComputedStyle(bg).getPropertyValue('--base').trim() || '#0000c8';
  try {
    sessionStorage.setItem('damasReload', '1');
    sessionStorage.setItem('damasReloadBg', base);
  } catch (e) {}
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  root.style.setProperty('--loader-bg', base);   // لون اللودر = لون خلفية المنتج الحالي
  root.classList.add('reloading');
  setTimeout(() => location.reload(), RELOAD_DELAY);
}

document.querySelectorAll('a[data-reload]').forEach(a =>
  a.addEventListener('click', e => { e.preventDefault(); reloadHome(); })
);

// بعد إعادة التحميل: يبقى اللودر ثانية على الأقل ثم يختفي بنعومة
async function hideLoader() {
  if (!cameFromReload) return;
  const wait = Math.max(0, LOADER_MIN - performance.now());
  if (wait) await new Promise(r => setTimeout(r, wait));
  try {
    sessionStorage.removeItem('damasReload');
    sessionStorage.removeItem('damasReloadBg');
  } catch (e) {}
  root.classList.remove('reloading');
  if ('scrollRestoration' in history) history.scrollRestoration = 'auto';
  await new Promise(r => setTimeout(r, 380));   // مدة التلاشي
}
 
 
/* ---------- بيانات المنتج (الاسم والشرح والأسعار والميزات) ---------- */
 
const textBox = document.querySelector('.text');      // القسم الأيمن: الاسم والشرح والزر
const infoBox = document.querySelector('.maizat');    // القسم الأيسر: الأسعار والميزات
const mohtaoa = document.querySelector('.mohtaoa');
 
const els = {
  name:     document.querySelector('.text h1'),
  desc:     document.querySelector('.text p'),
  oldPrice: document.querySelector('.alsaer .kdem'),
  price:    document.querySelector('.alsaer .jaaded .price'),
  features: document.querySelector('.overlay ul'),
  badge:    document.getElementById('offerBadge')       // شارة العرض
};
 
// أزمنة حركة النصوص (ms): خروج، توقف خارج الشاشة، عودة
const TEXT_OUT  = 550;
const TEXT_HOLD = 250;
const TEXT_IN   = 1500;
 
// القيم الأصلية المكتوبة في damas.html: تُستخدم لأي حقل لم تكتبه في products.js
const defaults = {
  name:     els.name     ? els.name.textContent.trim()     : '',
  desc:     els.desc     ? els.desc.textContent.trim()     : '',
  oldPrice: els.oldPrice ? els.oldPrice.textContent.trim() : '',
  price:    els.price    ? els.price.textContent.trim()    : '',
  features: els.features ? [...els.features.children].map(li => li.textContent.trim()) : []
};
 
function toPrice(v) {
  return typeof v === 'number' ? v + '$' : String(v);
}
 
// يأخذ الحقول النصية من المنتج ويتجاهل أي حقل فارغ أو بشكل خاطئ
function normalizeText(o) {
  const t = {};
  if (o.name)     t.name     = String(o.name);
  if (o.desc)     t.desc     = String(o.desc);
  if (o.oldPrice) t.oldPrice = toPrice(o.oldPrice);
  if (o.price)    t.price    = toPrice(o.price);
  if (Array.isArray(o.features) && o.features.length) t.features = o.features.map(String);

  // العرض: offer: true مع offerText (وofferLabel اختياري)، أو offer: 'نص العرض' مباشرة
  if (o.offer) {
    const txt = typeof o.offer === 'string' ? o.offer : o.offerText;
    if (txt) {
      t.offer      = String(txt);
      t.offerLabel = o.offerLabel ? String(o.offerLabel) : 'عرض خاص';
    }
  }
  return t;
}

// شارة العرض في أعلى يمين المنتج: تظهر فقط للمنتجات التي فيها عرض
let offerAnim = null;
function showOffer(t, animate) {
  const b = els.badge;
  if (!b) return;
  if (offerAnim) { offerAnim.cancel(); offerAnim = null; }
  if (!t.offer) { b.hidden = true; return; }
  b.querySelector('.ob-label').textContent = t.offerLabel || 'عرض خاص';
  b.querySelector('.ob-text').textContent  = t.offer;
  b.hidden = false;
  if (animate) {
    offerAnim = b.animate(
      [{ opacity: 0, scale: '0.5' }, { opacity: 1, scale: '1' }],
      { duration: 500, easing: 'cubic-bezier(.2, 1.4, .4, 1)' }
    );
  }
}
 
function applyText(p, animate) {
  const t = { ...defaults, ...p.text };
  if (els.name)     els.name.textContent     = t.name;
  if (els.desc)     els.desc.textContent     = t.desc;
  if (els.oldPrice) els.oldPrice.textContent = t.oldPrice;
  if (els.price)    els.price.textContent    = t.price;
  if (els.features) {
    els.features.replaceChildren(...t.features.map(f => {
      const li = document.createElement('li');
      li.textContent = f;
      return li;
    }));
  }
  showOffer(t, animate);
}
 
// المسافة التي يحتاجها القسم ليخرج بالكامل من الشاشة (يمين أو يسار)
function offscreenShift(el, side) {
  const r = el.getBoundingClientRect();
  return side === 'right' ? window.innerWidth - r.left + 30 : -(r.right + 30);
}
 
// في الجوال: النصوص لا تخرج للجانبين، بل تتلاشى لحظة وتعود في مكانها وقد تغيّرت
const PHONE_QUERY = '(max-width: 600px)';   // نفس حد الجوال في damas.css
const FADE_OUT  = 300;
const FADE_HOLD = 150;
const FADE_IN   = 400;
 
async function fadeText(p) {
  const targets = [els.name, els.desc, document.querySelector('.alsaer'), document.querySelector('.overlay')].filter(Boolean);
  const outs = targets.map(el => el.animate(
    [{ opacity: 1 }, { opacity: 0 }],
    { duration: FADE_OUT, easing: 'ease-in', fill: 'forwards' }
  ));
 
  try {
    await Promise.all(outs.map(a => a.finished));
    applyText(p, true);
    await new Promise(r => setTimeout(r, FADE_HOLD));
 
    const ins = targets.map(el => el.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: FADE_IN, easing: 'ease-out', fill: 'backwards' }
    ));
    outs.forEach(a => a.cancel());
    await Promise.all(ins.map(a => a.finished));
  } finally {
    outs.forEach(a => a.cancel());
  }
}
 
// القسمان يخرجان إلى جانبي الموقع، يتوقفان قليلاً وتتبدل بياناتهما، ثم يعودان
async function swapText(p) {
  if (window.matchMedia(PHONE_QUERY).matches) return fadeText(p);
  const boxes = [
    { el: textBox, side: 'right' },
    { el: infoBox, side: 'left' }
  ].filter(b => b.el).map(b => ({ ...b, dx: offscreenShift(b.el, b.side) }));
 
  const outs = boxes.map(b => b.el.animate(
    [{ transform: 'translateX(0)' }, { transform: `translateX(${b.dx}px)` }],
    { duration: TEXT_OUT, easing: 'ease-in', fill: 'forwards' }
  ));
 
  try {
    await Promise.all(outs.map(a => a.finished));
    applyText(p, true);
    await new Promise(r => setTimeout(r, TEXT_HOLD));
 
    const ins = boxes.map((b, i) => b.el.animate(
      [{ transform: `translateX(${b.dx}px)` }, { transform: 'translateX(0)' }],
      { duration: TEXT_IN, delay: i * 90, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }
    ));
    outs.forEach(a => a.cancel());
    await Promise.all(ins.map(a => a.finished));
  } finally {
    outs.forEach(a => a.cancel());
  }
}
 
// نثبّت ارتفاع القسم على أطول بيانات بين المنتجات، حتى لا تتحرك صورة المنتج عند اختلاف طول النصوص
function lockLayoutHeight() {
  if (!mohtaoa || !products.length) return;
  mohtaoa.style.minHeight = '';
  if (!mohtaoa.offsetHeight) return;          // في الجوال التخطيط مختلف ولا حاجة له
  let max = 0;
  products.forEach(p => {
    applyText(p);
    max = Math.max(max, mohtaoa.offsetHeight);
  });
  applyText(products[current]);
  mohtaoa.style.minHeight = max + 'px';
  updateGlowCenter();
}
 
let lockTimer;
function scheduleLock() {
  clearTimeout(lockTimer);
  lockTimer = setTimeout(() => (busy ? scheduleLock() : lockLayoutHeight()), 200);
}
window.addEventListener('resize', scheduleLock);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleLock);
 
 
/* ---------- أدوات مساعدة ---------- */
 
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error('تعذّر تحميل الصورة: ' + src));
    img.src = src;
  });
}
 
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r)      h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else                h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
 
// يحسب لون التوهج من الصورة نفسها (يعطي null إذا منع المتصفح قراءة البكسلات)
function autoColors(img) {
  try {
    const S = 40;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, S, S);
    const d = ctx.getImageData(0, 0, S, S).data;
 
    let r = 0, g = 0, b = 0, w = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 200) continue;                       // نتجاهل الشفاف
      const max = Math.max(d[i], d[i + 1], d[i + 2]);
      const min = Math.min(d[i], d[i + 1], d[i + 2]);
      const sat = max ? (max - min) / max : 0;
      const wt = sat * (max / 255) + 0.02;                // الألوان الزاهية أهم من الأسود والأبيض
      r += d[i] * wt; g += d[i + 1] * wt; b += d[i + 2] * wt; w += wt;
    }
    if (!w) return null;
 
    let [h, s] = rgbToHsl(r / w, g / w, b / w);
    if (s < 0.08) h = 220;                                // صورة رمادية: نميل للأزرق
    const gs = Math.round(Math.max(s, 0.45) * 100);
    const bs = Math.round(Math.max(s, 0.5) * 100);
    return {
      glow: `hsl(${Math.round(h)}, ${gs}%, 52%)`,
      base: `hsl(${Math.round(h)}, ${bs}%, 20%)`
    };
  } catch (e) {
    return null;
  }
}
 
function buildProduct(item, index, img) {
  const o = typeof item === 'string' ? { src: item } : item;
  let glow = o.glow, base = o.base;
 
  if (!glow || !base) {
    const auto = autoColors(img);
    if (auto) { glow = glow || auto.glow; base = base || auto.base; }
  }
  if (!glow || !base) {
    const f = FALLBACK_COLORS[index % FALLBACK_COLORS.length];
    glow = glow || f[0];
    base = base || f[1];
  }
  return { url: img.src, img, glow, base, text: normalizeText(o) };
}
 
function setBackground(p) {
  bg.style.setProperty('--glow', p.glow);
  bg.style.setProperty('--base', p.base);
}
 
 
/* ---------- مركز التوهج خلف صورة المنتج ---------- */
 
function getGlowGeometry() {
  const r = main.getBoundingClientRect();
  const b = bg.getBoundingClientRect();
  const cx = r.left - b.left + r.width / 2;
  const cy = r.top - b.top + r.height / 2;
  const radius = Math.hypot(Math.max(cx, b.width - cx), Math.max(cy, b.height - cy)) + 4;
  return { cx, cy, radius };
}
 
function updateGlowCenter() {
  const { cx, cy } = getGlowGeometry();
  bg.style.setProperty('--cx', cx + 'px');
  bg.style.setProperty('--cy', cy + 'px');
}
 
window.addEventListener('load', updateGlowCenter);
window.addEventListener('resize', updateGlowCenter);
main.addEventListener('load', updateGlowCenter);
updateGlowCenter();
 
 
/* ---------- شريط الصور الصغيرة (حلقة) ---------- */
 
const STRIP_MS = 700;   // مدة تقدّم الصور داخل الشريط (ms)
 
// الشريط يعرض المنتجات التي تلي المنتج المعروض في المنتصف، ويلتف حول القائمة
// (المنتج المعروض في المنتصف لا يتكرر داخل الشريط)
function stripIndexes(cur) {
  const n = products.length;
  const count = Math.min(VISIBLE, n - 1);
  return Array.from({ length: count }, (_, k) => (cur + 1 + k) % n);
}
 
function makeThumb(pi) {
  const img = document.createElement('img');
  img.src = products[pi].url;
  img.alt = 'المنتج ' + (pi + 1);
  img.draggable = false;
  img.dataset.index = pi;
  img.addEventListener('click', () => goTo(pi, img));
  return img;
}
 
function updateArrows() {
  const single = products.length < 2;
  btnPrev.hidden = single;
  btnNext.hidden = single;
}
 
// بناء الشريط أول مرة (بدون حركة)
function renderStrip() {
  strip.replaceChildren(...stripIndexes(current).map(makeThumb));
  updateArrows();
}
 
function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
 
// يحدّث الشريط للمنتج الجديد بحركة هادئة:
// الصورة المضغوطة تغادر (تطير للمنتصف)، والصور التي بعدها تتقدم لتملأ مكانها،
// وصورة جديدة تظهر في آخر الشريط
function updateStrip(newCur, clickedEl) {
  const oldEls = [...strip.children];
  const oldRects = new Map(oldEls.map(el => [el, el.getBoundingClientRect()]));
  const byIndex = new Map(oldEls.map(el => [Number(el.dataset.index), el]));
 
  const reused = new Set();
  const fresh = new Set();
  const ordered = stripIndexes(newCur).map(pi => {
    const old = byIndex.get(pi);
    if (old && old !== clickedEl) { reused.add(old); return old; }
    const el = makeThumb(pi);
    fresh.add(el);
    return el;
  });
 
  // الصور الخارجة من الشريط (غير المضغوطة): نسخة ثابتة تتلاشى في مكانها
  oldEls.forEach(el => {
    if (reused.has(el) || el === clickedEl) return;
    const r = oldRects.get(el);
    const ghost = el.cloneNode();
    Object.assign(ghost.style, {
      position: 'fixed',
      left: r.left + 'px',
      top: r.top + 'px',
      width: r.width + 'px',
      height: r.height + 'px',
      maxWidth: 'none',
      objectFit: 'contain',
      margin: 0,
      zIndex: 5,
      pointerEvents: 'none'
    });
    document.body.appendChild(ghost);
    ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350, easing: 'ease-out', fill: 'forwards' })
      .finished.then(() => ghost.remove(), () => ghost.remove());
  });
 
  strip.replaceChildren(...ordered);
 
  const ease = 'cubic-bezier(.45, .05, .25, 1)';   // حركة هادئة تبدأ وتنتهي بنعومة
  const anims = [];
  const shifts = [];
 
  // الصور الباقية تنزلق من مكانها القديم إلى الجديد
  reused.forEach(el => {
    const o = oldRects.get(el);
    const n = el.getBoundingClientRect();
    const dx = o.left - n.left;
    const dy = o.top - n.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    shifts.push(dx);
    anims.push(el.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
      { duration: STRIP_MS, easing: ease }
    ).finished);
  });
 
  // الصور الجديدة تدخل مع نفس الاتجاه كأنها جزء من الحركة
  const typical = median(shifts);
  fresh.forEach(el => {
    anims.push(el.animate(
      [{ opacity: 0, transform: `translateX(${typical}px)` }, { opacity: 1, transform: 'translateX(0)' }],
      { duration: STRIP_MS, delay: 150, easing: ease, fill: 'backwards' }
    ).finished);
  });
 
  updateArrows();
  return Promise.all(anims).catch(() => {});
}
 
 
/* ---------- الانتقال إلى منتج ---------- */
 
// الشاشات الصغيرة (نفس حد التخطيط العمودي في damas.css)
const SMALL_QUERY = '(max-width: 900px)';
const isSmall = () => window.matchMedia(SMALL_QUERY).matches;

// المستطيل الذي تشغله الصورة فعلياً داخل صندوق (object-fit: contain)
function fitRect(box, img) {
  const s = Math.min(box.width / img.naturalWidth, box.height / img.naturalHeight);
  const w = img.naturalWidth * s, h = img.naturalHeight * s;
  return { left: box.left + (box.width - w) / 2, top: box.top + (box.height - h) / 2, width: w, height: h };
}

// thumb: الصورة الصغيرة المضغوطة (تطير للمنتصف).
// في الشاشات الكبيرة: بدونها (سهم السابق) تدخل الصورة الجديدة من الأسفل.
// في الشاشات الصغيرة: الحركة واحدة دائماً، المنتج يطير من الشريط السفلي إلى مكان المنتج الكبير.
async function goTo(index, thumb) {
  if (busy || index === current || !products[index]) return;
  busy = true;

  const next = products[index];
  const small = isSmall();
  let flyer, mainAnim, waveAnim;

  try {
    const to = main.getBoundingClientRect();
    const { cx, cy, radius } = getGlowGeometry();

    // 1) الخلفية الجديدة: تتسع من وسط المنتج، وفي الشاشات الصغيرة تتبدل بتلاشٍ ناعم
    wave.style.setProperty('--glow', next.glow);
    wave.style.setProperty('--base', next.base);
    waveAnim = small
      ? wave.animate([
          { clipPath: 'inset(0)', opacity: 0 },
          { clipPath: 'inset(0)', opacity: 1 }
        ], { duration: DURATION + 200, easing: 'ease-in-out', fill: 'forwards' })
      : wave.animate([
          { clipPath: `circle(0px at ${cx}px ${cy}px)` },
          { clipPath: `circle(${radius}px at ${cx}px ${cy}px)` }
        ], { duration: DURATION, easing: 'ease-in-out', fill: 'forwards' });
 
    // 2) الصورة الحالية تصعد للأعلى فقط وتزداد شفافيتها
    mainAnim = main.animate([
      { transform: 'translateY(0)', opacity: 1 },
      { transform: `translateY(${-to.height * 0.9}px)`, opacity: 0 }
    ], { duration: DURATION, easing: 'ease-in', fill: 'forwards' });
 
    // شارة العرض القديمة تتلاشى مع بدء الانتقال
    if (els.badge && !els.badge.hidden) {
      if (offerAnim) offerAnim.cancel();
      offerAnim = els.badge.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' });
    }

    const waits = [mainAnim.finished, waveAnim.finished];
 
    // النصوص تخرج (أو تتلاشى في الجوال) وتعود ببيانات المنتج الجديد
    const textPromise = swapText(next).catch(err => console.error(err));
 
    // 3) الصورة الصغيرة تغادر الشريط وتطير وتكبر إلى مكان وحجم صورة المنتصف
    let flyThumb = thumb;          // الصورة الصغيرة التي تطير (قد تكون فعلية أو مصطنعة)
    let fromBox = null;            // صندوق الانطلاق للصورة المصطنعة
    if (small && !flyThumb) {
      // سهم السابق: إن كان المنتج ظاهراً في الشريط يطير منه، وإلا يطير من جهة سهم السابق
      flyThumb = strip.querySelector(`img[data-index="${index}"]`);
      if (!flyThumb) {
        const ref = strip.firstElementChild ? strip.firstElementChild.getBoundingClientRect() : null;
        const bw  = ref ? ref.width : 70;
        const bh  = ref ? ref.height : 70;
        const pb  = btnPrev.getBoundingClientRect();
        fromBox = { left: pb.left + pb.width / 2 - bw / 2, top: pb.top + pb.height / 2 - bh / 2, width: bw, height: bh };
      }
    }
    const usesFlyer = !!(flyThumb || fromBox);

    if (usesFlyer) {
      const box = fromBox || flyThumb.getBoundingClientRect();
      let from, target;
      if (small) {
        // الصورة داخل صندوق ثابت (contain): نطير من حجمها الفعلي إلى حجمها الفعلي في مكان المنتج الكبير
        from   = fitRect(box, next.img);
        target = fitRect(to, next.img);
      } else {
        const aspect = next.img.naturalHeight / next.img.naturalWidth;
        const targetH = to.width * aspect;
        from   = box;
        target = { left: to.left, top: to.top + to.height / 2 - targetH / 2, width: to.width, height: targetH };
      }
      const scaleX = target.width / from.width;
      const scaleY = target.height / from.height;
      const targetLeft = target.left;
      const targetTop  = target.top;

      if (flyThumb) flyer = flyThumb.cloneNode();
      else { flyer = new Image(); flyer.src = next.url; }
      flyer.className = '';
      Object.assign(flyer.style, {
        position: 'fixed',
        left: from.left + 'px',
        top: from.top + 'px',
        width: from.width + 'px',
        height: from.height + 'px',
        maxWidth: 'none',
        margin: 0,
        zIndex: 10,
        transformOrigin: 'top left',
        pointerEvents: 'none'
      });
      document.body.appendChild(flyer);
 
      waits.push(flyer.animate([
        { transform: 'translate(0, 0) scale(1, 1)' },
        { transform: `translate(${targetLeft - from.left}px, ${targetTop - from.top}px) scale(${scaleX}, ${scaleY})` }
      ], { duration: DURATION, easing: 'ease-in-out', fill: 'forwards' }).finished);
    }
 
    // 4) في نفس اللحظة: الشريط يتقدم بهدوء ويملأ مكان الصورة التي غادرت
    const stripPromise = updateStrip(index, flyThumb || null);
 
    await Promise.all(waits);
 
    // نبدّل الصورة الأساسية ونثبّت الخلفية الجديدة
    main.src = next.url;
    setBackground(next);
    mainAnim.cancel();
    waveAnim.cancel();
    if (flyer) { flyer.remove(); flyer = null; }
 
    // عند سهم السابق: الصورة الجديدة تدخل من الأسفل
    const enter = usesFlyer ? null : main.animate([
      { transform: 'translateY(300px)', opacity: 0 },
      { transform: 'translateY(0)', opacity: 1 }
    ], { duration: 600, easing: 'ease-out' });
 
    current = index;
    updateGlowCenter();
 
    // ننتظر انتهاء بقية الحركات: الصورة الداخلة والنصوص والشريط
    await Promise.all([enter ? enter.finished : null, textPromise, stripPromise]);
  } catch (err) {
    console.error(err);
  } finally {
    // مهما حصل: نفتح القفل ونزيل الصورة الطائرة
    if (flyer) flyer.remove();
    busy = false;
  }
}
 
// التالي = أول صورة في الشريط، والسابق = المنتج الذي قبل الحالي في القائمة
btnNext.addEventListener('click', () => {
  const first = strip.firstElementChild;
  if (first) goTo(Number(first.dataset.index), first);
});
btnPrev.addEventListener('click', () => {
  if (products.length > 1) goTo((current - 1 + products.length) % products.length, null);
});
 
 
/* ---------- التشغيل ---------- */
 
async function initCore() {
  const list = (typeof PRODUCTS !== 'undefined' && Array.isArray(PRODUCTS)) ? PRODUCTS : [];
  if (!list.length) {
    console.warn('قائمة PRODUCTS فارغة أو غير موجودة. تأكد من ملف products.js');
    return;
  }
 
  const results = await Promise.allSettled(list.map(item => {
    const src = typeof item === 'string' ? item : item && item.src;
    return src ? loadImage(src) : Promise.reject(new Error('منتج بدون مسار صورة (src)'));
  }));
 
  results.forEach((res, i) => {
    if (res.status === 'fulfilled') products.push(buildProduct(list[i], products.length, res.value));
    else console.warn('تم تجاهل منتج:', res.reason.message);
  });
 
  if (!products.length) return;
 
  // المنتج الأول هو الذي يظهر عند فتح الموقع
  if (main.src !== products[0].url) main.src = products[0].url;
  setBackground(products[0]);
  applyText(products[0]);
  renderStrip();
  lockLayoutHeight();
  updateGlowCenter();
}
 
/* ---------- حركة دخول الصفحة ----------
   النصوص تدخل من الجانبين، المنتج من الأسفل، والشريط السفلي من الأسفل
   (نفس حركة أسهم التالي والسابق). في الجوال: ظهور تدريجي من الأسفل. */
async function playIntro() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ease    = 'cubic-bezier(.2,.8,.2,1)';
  const imgsBox = document.querySelector('.imgs');
  const bottom  = document.querySelector('.thelsafhaon');
  const small   = window.matchMedia('(max-width: 900px)').matches;
  const anims   = [];

  const run = (el, frames, opts) => {
    if (!el) return;
    anims.push(el.animate(frames, { fill: 'backwards', easing: ease, ...opts }).finished);
  };
  const rise = (el, y, delay, duration, easing) => run(el,
    [{ opacity: 0, transform: `translateY(${y}px)` }, { opacity: 1, transform: 'translateY(0)' }],
    { duration, delay, ...(easing ? { easing } : {}) }
  );

  if (!reduceMotion) {
    rise(imgsBox, 300, 100, 700, 'ease-out');                       // المنتج يدخل من الأسفل

    if (!small) {
      // النصوص من الجانبين (النص يمين، والسعر والميزات يسار)
      [[textBox, 'right', 200], [infoBox, 'left', 290]].forEach(([el, side, delay]) => {
        if (!el) return;
        run(el,
          [{ transform: `translateX(${offscreenShift(el, side)}px)` }, { transform: 'translateX(0)' }],
          { duration: TEXT_IN, delay }
        );
      });
      rise(bottom, 140, 400, 900);                                   // الشريط السفلي من الأسفل
    } else {
      [els.name, els.desc, document.querySelector('.text button'),
       document.querySelector('.alsaer'), document.querySelector('.overlay')]
        .forEach((el, i) => rise(el, 30, 350 + i * 90, 700));
      [document.querySelector('.carousel'), document.querySelector('.taosel'), document.querySelector('.tauasul')]
        .forEach((el, i) => rise(el, 120, 300 + i * 80, 800));
    }
  }

  // نرفع الإخفاء بعد تجهيز الحركات مباشرة: كل عنصر يبدأ من وضعه الأول بلا وميض
  root.classList.remove('intro-pending');
  await Promise.all(anims).catch(() => {});
}

async function init() {
  try { await initCore(); } catch (err) { console.error(err); }
  await hideLoader();
  await playIntro();
}

init();
 
 
/* ======================================================
   طبقة الطلب (تظهر عند الضغط على "اطلب الان")
   الهاتف يتولاه phone.js (input, getE164, getFinalPhone, checkPhone)
   ====================================================== */
 
// سعر صرف الدولار مقابل الليرة السورية (بالعملة القديمة، سعر المبيع في السوق).
// ترتيب المصادر عند تحميل الصفحة:
//   1) LiraScope API مباشرة (سعر السوق، مجاني وبلا مفتاح)
//   2) ملف rates.json (تعدّله يدوياً أو يحدّثه n8n)
//   3) الرقم الاحتياطي أدناه
const FALLBACK_USD_TO_SYP = 14330;
const RATE_API_URL = 'https://lirascope.syria-cloud.sy/api/v1/rates/latest?currencies=USD&lang=en';
const OLD_PER_NEW  = 100;     // الليرة الجديدة = 100 قديمة (الـ API يعطي الجديدة)
let   USD_TO_SYP = FALLBACK_USD_TO_SYP;
const MAX_QTY    = 10;

function acceptRate(r, source) {
  if (isFinite(r) && r > 1000 && r < 1000000) {   // نتجاهل أي قيمة غير منطقية
    USD_TO_SYP = r;
    if (typeof updateTotals === 'function') updateTotals();
    return true;
  }
  console.warn(source + ': قيمة غير صالحة (' + r + ')');
  return false;
}

async function fetchJson(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function loadRate() {
  // 1) LiraScope: سعر مبيع السوق للدولار بالليرة الجديدة ثم نحوّله للقديمة
  try {
    const data = await fetchJson(RATE_API_URL, 5000);
    const usd = (data.marketRates || []).find(x => x.currency === 'USD');
    if (usd && acceptRate(Math.round(Number(usd.sell) * OLD_PER_NEW), 'LiraScope')) return;
  } catch (err) {
    console.warn('تعذّر الاتصال بـ LiraScope، جاري استخدام rates.json:', err.message);
  }
  // 2) rates.json
  try {
    const data = await fetchJson('rates.json?t=' + Date.now(), 5000);
    if (acceptRate(Number(data.usdToSyp), 'rates.json')) return;
  } catch (err) {
    console.warn('تعذّر قراءة rates.json، سيُستخدم السعر الاحتياطي:', err.message);
  }
}
loadRate();
 
// رقم واتساب الذي يستقبل الطلبات (بدون + وبدون مسافات)
const WHATSAPP_NUMBER = '963931493129';





const orderBtn    = document.querySelector('.text button');
const orderOverlay = document.getElementById('orderOverlay');
const orderClose   = orderOverlay.querySelector('.order-close');
const orderForm    = document.getElementById('orderForm');
const fName        = document.getElementById('fName');
const fGov         = document.getElementById('fGov');
const fCity        = document.getElementById('fCity');
const qtyVal       = document.getElementById('qtyVal');
const orderOk      = document.getElementById('orderOk');
 
let orderQty = 1;


 
/* --- فتح وإغلاق --- */
 
function openOrder() {
  fillSummary();
  orderOk.hidden = true;
  smsLink.hidden = true;
  orderOverlay.scrollTop = 0;
  orderOverlay.classList.add('open');
  orderOverlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');
}
 
function closeOrder() {
  orderOverlay.classList.remove('open');
  orderOverlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('no-scroll');
}
 
orderBtn.addEventListener('click', openOrder);
orderClose.addEventListener('click', closeOrder);
 
// "الرئيسية" في الشريط العلوي تغلق الطبقة وتعود للصفحة
orderOverlay.querySelector('.navbar ul li:first-child a').addEventListener('click', e => {
  e.preventDefault();
  closeOrder();
});
 
// الضغط على الخلفية الضبابية (خارج الشريط والنموذج والملخص) يغلق الطبقة
orderOverlay.addEventListener('click', e => {
  if (!e.target.closest('.navbar, .order-form, .order-summary')) closeOrder();
});
 
// Escape يغلق الطبقة، إلا إذا كان يغلق قائمة الدول فقط (phone.js يمنع الحدث وقتها)
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !e.defaultPrevented) closeOrder();
});
 
 
/* --- ملخص الطلب: يُقرأ من المنتج المعروض وقت فتح الطبقة --- */
 
function readPrice() {
  const n = parseFloat((els.price ? els.price.textContent : '').replace(/[^\d.]/g, ''));
  return isNaN(n) ? 0 : n;
}
 
function fillSummary() {
  document.getElementById('sumImg').src = main.src;
  document.getElementById('sumName').textContent = els.name ? els.name.textContent : '';
  document.getElementById('sumOld').textContent  = els.oldPrice ? els.oldPrice.textContent : '';
  document.getElementById('sumNew').textContent  = els.price ? els.price.textContent : '';
 
  // لون الطبقة والنموذج = لون خلفية الصفحة المعروضة حالياً (خلفية المنتج)
  const cs   = getComputedStyle(bg);
  const cur  = products[current];
  const glow = cs.getPropertyValue('--glow').trim() || (cur && cur.glow);
  const base = cs.getPropertyValue('--base').trim() || (cur && cur.base);
  if (glow) orderOverlay.style.setProperty('--glow', glow);
  if (base) orderOverlay.style.setProperty('--base', base);
 
  updateTotals();
}
 
 
/* --- الكمية والإجمالي --- */
 
function totalUsd() {
  return Math.round(readPrice() * orderQty * 100) / 100;
}
 
function updateTotals() {
  const usd = totalUsd();
  const syp = Math.round(usd * USD_TO_SYP);
  qtyVal.textContent = orderQty;
  document.getElementById('totUsd').textContent = usd.toLocaleString('en-US') + '$';
  document.getElementById('totSyp').textContent = syp.toLocaleString('en-US') + ' ل.س';
}
 
document.getElementById('qtyMinus').addEventListener('click', () => {
  if (orderQty > 1) { orderQty--; updateTotals(); }
});
document.getElementById('qtyPlus').addEventListener('click', () => {
  if (orderQty < MAX_QTY) { orderQty++; updateTotals(); }
});
 
 
/* --- التحقق من بقية الحقول (الهاتف يتحقق منه phone.js) --- */
 
function setFieldError(el, message) {
  const field = el.closest('.field');
  field.classList.toggle('invalid', !!message);
  field.querySelector('.err').textContent = message || '';
  return !message;
}
 
function validateOrder() {
  const okName  = setFieldError(fName, fName.value.trim().length >= 3 ? '' : 'اكتب اسمك الكامل');
  const okPhone = checkPhone();
  const okGov   = setFieldError(fGov,  fGov.value ? '' : 'اختر المحافظة');
  const okCity  = setFieldError(fCity, fCity.value.trim().length >= 2 ? '' : 'اكتب اسم بلدتك أو مدينتك أو قريتك');
  return okName && okPhone && okGov && okCity;
}
 
[fName, fGov, fCity].forEach(el =>
  el.addEventListener('input', () => setFieldError(el, ''))
);
 
 
/* --- الإرسال إلى واتساب --- */
 
function buildWhatsAppUrl(o) {
  const lines = [
    'طلب جديد',
    '',
    'المنتج: ' + o.product,
    'الكمية: ' + o.quantity,
    'الإجمالي: ' + o.totalUsd + '$ (' + o.totalSyp.toLocaleString('en-US') + ' ل.س)',
    '',
    'الاسم: ' + o.name,
    'الهاتف: ' + o.phoneDisplay,
    'المحافظة: ' + o.governorate,
    'البلد/المدينة/القرية: ' + o.city,
    'الدفع: عند الاستلام'
  ];
  return 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(lines.join('\n'));
}

// الرقم الذي يستقبل رسائل SMS (بصيغة دولية مع +)
const SMS_NUMBER = '+986274790';

// نسخة مختصرة من الرسالة: الـ SMS بالعربية يُحتسب كل 70 حرفاً تقريباً برسالة مستقلة
function buildSmsUrl(o) {
  const lines = [
    'طلب جديد',
    'المنتج: ' + o.product,
    'الكمية: ' + o.quantity,
    'الإجمالي: ' + o.totalUsd + '$',
    'الاسم: ' + o.name,
    'الهاتف: ' + o.phoneDisplay,
    'المحافظة: ' + o.governorate,
    'البلد/المدينة/القرية: ' + o.city
  ];
  return 'sms:' + SMS_NUMBER + '?&body=' + encodeURIComponent(lines.join('\n'));
}

const smsLink  = document.getElementById('smsFallback');
const isMobile = window.matchMedia('(pointer: coarse)').matches;   // الروابط sms: لا تعمل على الحاسوب
 
orderForm.addEventListener('submit', e => {
  e.preventDefault();
  if (!validateOrder()) return;
 
  const usd = totalUsd();
  const order = {
    name:         fName.value.trim(),
    phone:        getE164(),
    phoneDisplay: getFinalPhone(),
    governorate:  fGov.value,
    city:         fCity.value.trim(),
    product:      els.name ? els.name.textContent.trim() : '',
    quantity:     orderQty,
    totalUsd:     usd,
    totalSyp:     Math.round(usd * USD_TO_SYP)
  };
 


  const url = buildWhatsAppUrl(order);
  const w = window.open(url, '_blank');
  if (!w) window.location.href = url;   // إن منع المتصفح النافذة الجديدة
 
  orderOk.hidden = false;
    if (isMobile) {
    smsLink.href = buildSmsUrl(order);
    smsLink.hidden = false;
  }
});