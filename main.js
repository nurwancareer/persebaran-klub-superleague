// Persebaran Klub Super League — tampilan isometrik 3D (Three.js) + panel HTML.
// Data: data.json (dibuat oleh desain/skrip/prep.py dari CSV di folder data/).
import * as THREE from 'three';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nf0 = new Intl.NumberFormat('id-ID');
const nf1 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const tgl = (s) => new Date(s + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
const tglP = (s) => new Date(s + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
const tanda = (v, f = nf1) => (v > 0.005 ? '+' : v < -0.005 ? '−' : '±') + f.format(Math.abs(v));
const kelasArah = (v) => (v > 0.005 ? 'naik' : v < -0.005 ? 'turun' : 'tetap');
const inisial = (k) => { const w = k.pendek.split(/\s+/); return (w.length > 1 ? w.map((x) => x[0]).join('') : k.pendek.slice(0, 3)).toUpperCase().slice(0, 3); };
const logoHtml = (k, u = 28) => k.logo
  ? `<img class="logo-k" style="--u:${u}px" src="${esc(k.logo)}" alt="" loading="lazy">`
  : `<span class="logo-ph" style="--u:${u}px;--c:${esc(k.warna)}" aria-hidden="true">${esc(inisial(k))}</span>`;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const backOut = (t) => { const c1 = 1.70158 * 1.15, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const diam = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- tampilan ----------
const WARNA = {
  darat: '#ECE8DC', daratSisi: '#D7D1C1',
  ramp: ['#D3E6D3', '#A9D0AE', '#74AF84', '#3F8A5C', '#1F6F4A'],
  garis: '#FFFDF8',
  zona: { acl: '#E0A50A', mid: '#7E847F', rel: '#D2452F' },
};
const HMAX = 46, BASE = 2.5;            // tinggi provinsi (unit dunia)
const EL = 52 * Math.PI / 180, AZ = -8 * Math.PI / 180; // sudut kamera
const DIR = new THREE.Vector3(Math.sin(AZ) * Math.cos(EL), Math.sin(EL), Math.cos(AZ) * Math.cos(EL));
const TIANG = 20;                       // tinggi tiang stadion

const LENSA = {
  nilai: { label: 'Nilai pasar', unit: 'Rp miliar', fmt: (v) => nf1.format(v),
    jelas: (S) => `Tinggi = total nilai pasar skuad klub di provinsi itu (Transfermarkt, ${tgl(S.snap)}). Pilih tanggal atau tekan putar untuk melihat perubahannya.` },
  poin: { label: 'Poin', unit: 'poin', fmt: (v) => nf0.format(v),
    jelas: (S) => `Tinggi = total poin klub di provinsi itu, klasemen usai pekan ${S.meta.pekan_terakhir}.` },
  klub: { label: 'Jumlah klub', unit: 'klub', fmt: (v) => nf0.format(v),
    jelas: () => 'Tinggi = banyaknya klub Super League yang bermarkas di provinsi itu.' },
  kapasitas: { label: 'Kapasitas', unit: 'kursi', fmt: (v) => nf0.format(v),
    jelas: () => 'Tinggi = total kapasitas stadion kandang di provinsi itu.' },
};

// ---------- state ----------
const S = { data: null, meta: null, snap: null, snaps: [], lensa: 'nilai', mode: 'nasional', prov: null, klub: null, hover: null, mulai: 0 };
const panggung = $('#panggung');

// ---------- renderer & scene ----------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $('#kanvas'), antialias: true, alpha: true });
} catch (e) {
  $('#pesan').textContent = 'Browser ini tidak mendukung WebGL, jadi tampilan 3D tidak bisa ditampilkan.';
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 6000);
scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c2, 1.7));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -700, right: 700, top: 700, bottom: -700, near: 1, far: 3000 });
sun.shadow.bias = -0.0008;
scene.add(sun, sun.target);
const lantai = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.08 }));
lantai.receiveShadow = true;
scene.add(lantai);

let W = innerWidth, H = innerHeight;
function ukurUlang() {
  W = innerWidth; H = innerHeight;
  renderer.setSize(W, H, false);
  cam.left = -W / 2; cam.right = W / 2; cam.top = H / 2; cam.bottom = -H / 2;
  cam.updateProjectionMatrix();
  if (S.data) { ZOOM0 = kamNasional().zoom; kamTujuan = S.mode === 'prov' ? kamProv(S.prov) : kamNasional(); kamNow = { ...kamTujuan }; aturKamera(kamNow); }
}

// ---------- kamera ----------
let kamNow = { tx: 500, ty: 0, tz: 200, zoom: 1 }, kamTujuan = kamNow, kamDari = kamNow, kamT0 = 0, KAM_DUR = 1100;
function aturKamera(k) {
  const T = new THREE.Vector3(k.tx, k.ty, k.tz);
  cam.position.copy(T).addScaledVector(DIR, 2000);
  cam.lookAt(T);
  cam.zoom = k.zoom;
  cam.updateProjectionMatrix();
  sun.position.set(k.tx - 420, 900, k.tz + 380);
  sun.target.position.copy(T);
}
let BATAS = { x0: 0, x1: 1000, z0: 0, z1: 420 };
// area layar yang tidak tertutup kartu: peta diposisikan di tengah area ini
function areaBebas(mode) {
  const kecil = W < 900, r = (s) => $(s).getBoundingClientRect();
  const judul = r('.judul'), det = $('#detail'), detOn = !det.classList.contains('kosong') && getComputedStyle(det).display !== 'none';
  let x0 = 0, x1 = W, y0 = 0, y1 = H - 40;
  if (kecil) { y0 = judul.bottom + 8; if (detOn) y1 = r('#detail').top - 8; }
  else if (mode === 'prov') { x0 = judul.right + 10; if (detOn) x1 = r('#detail').left - 10; }
  else { x0 = judul.right * 0.3; }
  if (y1 - y0 < 120) y1 = y0 + 120;
  return { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}
function posisikan(cx, cz, ty, zoom, A) {
  const dx = A.cx - W / 2, dy = A.cy - H / 2;
  return { tx: cx - dx / zoom, ty, tz: cz - dy / (zoom * Math.sin(EL)), zoom };
}
function kamNasional() {
  const A = areaBebas('nasional');
  // layar sempit: fokus ke rentang tempat klub berada (Sumatra selatan s.d. Sulawesi), Aceh & Papua boleh terpotong
  const B = W < 900 ? { x0: 150, x1: 560, z0: BATAS.z0 + 60, z1: BATAS.z1 - 30 } : BATAS;
  const bw = B.x1 - B.x0, bd = B.z1 - B.z0;
  const zoom = Math.min((A.w * 0.94) / bw, (A.h * 0.92) / (bd * Math.sin(EL) + HMAX * Math.cos(EL)));
  return posisikan((B.x0 + B.x1) / 2, (B.z0 + B.z1) / 2, 0, zoom, A);
}
let ZOOM0 = 1;
function kamProv(nama) {
  const pr = provBy(nama), b = pr.bbox, A = areaBebas('prov');
  const z = Math.min((A.w * 0.7) / Math.max(b.w, 1), (A.h * 0.7) / Math.max(b.d * Math.sin(EL) + pr.H * Math.cos(EL), 1));
  const zoom = clamp(z, ZOOM0 * 1.4, ZOOM0 * 3.2);
  return posisikan(b.cx, b.cz, pr.H * 0.5, zoom, A);
}
function terbang(k) {
  kamDari = { ...kamNow }; kamTujuan = k; kamT0 = performance.now();
  if (diam()) { kamNow = { ...k }; aturKamera(kamNow); }
}

// ---------- data turunan ----------
const zona = (pos) => (pos <= 2 ? 'acl' : pos >= 16 ? 'rel' : 'mid');
const kls = (k) => k.klasemen[k.klasemen.length - 1] || null;
const nilaiPada = (k, t) => k.nilai.find((n) => n.tanggal === t)?.nilai;
const nilaiSnap = (k) => nilaiPada(k, S.snap) ?? (k.nilai[k.nilai.length - 1] || { nilai: 0 }).nilai;
const selisihAwal = (k) => { const a = nilaiPada(k, S.snaps[0]); return a == null || S.snap === S.snaps[0] ? null : nilaiSnap(k) - a; };
const skuadAktif = (k) => k.skuad.filter((p) => p.pinjam !== 'keluar');
const nilaiAkhir = (k) => k.nilai[k.nilai.length - 1] || null;
const metrikKlub = (k, l = S.lensa) => l === 'nilai' ? nilaiSnap(k) : l === 'poin' ? Math.max(0, kls(k)?.poin ?? 0) : l === 'kapasitas' ? k.kapasitas : 1;
const klubDi = (nama) => S.data.klub.filter((k) => k.provinsi === nama);
const metrikProv = (nama, l = S.lensa) => klubDi(nama).reduce((s, k) => s + metrikKlub(k, l), 0);

// ---------- peta ----------
const PROV = [], PIN = [], kenaRay = [];
const provBy = (nama) => PROV.find((p) => p.nama === nama);
const klubBy = (id) => S.data.klub.find((k) => k.id === id);

function bangunPeta(d) {
  const xs = [], zs = [];
  d.provinsi.forEach((p, i) => {
    const rings = p.rings.map((r) => r.split(' ').map((s) => s.split(',').map(Number)));
    rings.flat().forEach(([x, z]) => { xs.push(x); zs.push(z); });
    const flat = rings.flat();
    const bx0 = Math.min(...flat.map((q) => q[0])), bx1 = Math.max(...flat.map((q) => q[0]));
    const bz0 = Math.min(...flat.map((q) => q[1])), bz1 = Math.max(...flat.map((q) => q[1]));
    const cx = p.cx, cz = p.cz;
    const shapes = rings.map((r) => new THREE.Shape(r.map(([x, z]) => new THREE.Vector2(x - cx, -(z - cz)))));
    const geo = new THREE.ExtrudeGeometry(shapes, { depth: 1, bevelEnabled: false, curveSegments: 1 });
    geo.rotateX(-Math.PI / 2);
    const mAtas = new THREE.MeshLambertMaterial({ color: WARNA.darat, transparent: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const mSisi = new THREE.MeshLambertMaterial({ color: WARNA.daratSisi, transparent: true });
    const mesh = new THREE.Mesh(geo, [mAtas, mSisi]);
    mesh.castShadow = true; mesh.receiveShadow = true;
    const seg = [];
    rings.forEach((r) => r.forEach(([x, z], j) => { const [x2, z2] = r[(j + 1) % r.length]; seg.push(x - cx, 0, z - cz, x2 - cx, 0, z2 - cz); }));
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
    const mGaris = new THREE.LineBasicMaterial({ color: WARNA.garis, transparent: true });
    const garis = new THREE.LineSegments(lg, mGaris);
    const grup = new THREE.Group();
    grup.position.set(cx, 0, cz);
    grup.add(mesh, garis);
    scene.add(grup);
    const pr = { nama: p.nama, grup, mesh, garis, mAtas, mSisi, mGaris, h: 0.01, H: BASE, lift: 0, opa: 1,
      delay: (cx / 1000) * 600, bbox: { cx: (bx0 + bx1) / 2, cz: (bz0 + bz1) / 2, w: bx1 - bx0, d: bz1 - bz0 } };
    mesh.userData = { jenis: 'prov', pr };
    PROV.push(pr); kenaRay.push(mesh);
  });
  BATAS = { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };

  const gTiang = new THREE.CylinderGeometry(0.8, 0.8, 1, 8).translate(0, 0.5, 0);
  d.klub.forEach((k) => {
    const mat = new THREE.SpriteMaterial({ map: teksturLogo(k), transparent: true, depthTest: true });
    const tiang = new THREE.Mesh(gTiang, new THREE.MeshLambertMaterial({ color: '#2B2F2C', transparent: true }));
    const kepala = new THREE.Sprite(mat);
    kepala.center.set(0.5, 0.08);
    tiang.castShadow = true;
    const grup = new THREE.Group();
    grup.add(tiang, kepala);
    scene.add(grup);
    const el = document.createElement('div');
    el.className = 'lbl'; el.textContent = k.pendek; el.style.opacity = 0;
    $('#label').append(el);
    const pin = { id: k.id, k, grup, tiang, kepala, mat, el, s: 0, skala: 1 };
    tiang.userData = kepala.userData = { jenis: 'klub', pin };
    PIN.push(pin); kenaRay.push(kepala, tiang);
  });
}

// lencana bulat untuk kepala tiang: logo klub di atas lingkaran putih, cincin = zona klasemen
function teksturLogo(k) {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const zw = WARNA.zona[zona(kls(k)?.pos ?? 9)];
  const dasar = () => {
    g.clearRect(0, 0, N, N);
    g.beginPath(); g.arc(N / 2, N / 2, N / 2 - 6, 0, Math.PI * 2); g.fillStyle = '#FFFDF8'; g.fill();
    g.lineWidth = 14; g.strokeStyle = zw; g.stroke();
  };
  dasar();
  if (k.logo) {
    const img = new Image();
    img.onload = () => { dasar(); const s = N * 0.66; g.drawImage(img, (N - s) / 2, (N - s) / 2, s, s); tex.needsUpdate = true; };
    img.src = k.logo;
  } else {
    g.beginPath(); g.arc(N / 2, N / 2, N / 2 - 26, 0, Math.PI * 2); g.fillStyle = k.warna; g.fill();
    g.fillStyle = '#fff'; g.font = '800 64px "Plus Jakarta Sans", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(inisial(k), N / 2, N / 2 + 3);
  }
  tex.needsUpdate = true;
  return tex;
}

function terapkanLensa() {
  const vals = PROV.map((p) => metrikProv(p.nama));
  const vmax = Math.max(...vals, 1);
  const isi = vals.filter((v) => v > 0).sort((a, b) => a - b);
  const kelas = (v) => { if (!v) return -1; const r = isi.indexOf(v) / Math.max(isi.length - 1, 1); return Math.min(4, Math.floor(r * 5)); };
  PROV.forEach((p, i) => {
    const v = vals[i];
    p.H = BASE + (v / vmax) * HMAX;
    p.v = v;
    const c = kelas(v);
    p.mAtas.color.set(c < 0 ? WARNA.darat : WARNA.ramp[c]);
    p.mSisi.color.set(c < 0 ? WARNA.daratSisi : new THREE.Color(WARNA.ramp[c]).multiplyScalar(0.86));
  });
  document.querySelectorAll('#lensa button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.l === S.lensa)));
  document.querySelectorAll('#titik-snap button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.t === S.snap)));
  $('#linimasa').hidden = S.lensa !== 'nilai' || S.snaps.length < 2;
  $('#jelas').textContent = LENSA[S.lensa].jelas(S);
  renderPeringkat();
}

// ---------- UI: lensa, peringkat, detail ----------
function siapLensa() {
  $('#lensa').innerHTML = Object.entries(LENSA).map(([id, l]) =>
    `<button type="button" role="tab" data-l="${id}" aria-selected="false">${esc(l.label)}</button>`).join('');
  $('#lensa').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    S.lensa = b.dataset.l; henti(); terapkanLensa(); renderDetail();
    if (S.mode === 'prov') terbang(kamProv(S.prov));
  });
  $('#titik-snap').innerHTML = S.snaps.map((t) =>
    `<button type="button" role="tab" data-t="${t}" aria-selected="false"><span>${esc(tglP(t))}</span><i></i></button>`).join('');
  $('#titik-snap').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { henti(); pilihSnap(b.dataset.t); } });
  $('#putar').addEventListener('click', () => (putaran ? henti() : putar()));
}
function pilihSnap(t) { S.snap = t; terapkanLensa(); renderDetail(); }
let putaran = null;
function putar() {
  let i = 0; pilihSnap(S.snaps[0]); $('#putar').classList.add('jalan');
  putaran = setInterval(() => { i++; if (i >= S.snaps.length) return henti(); pilihSnap(S.snaps[i]); }, 1500);
}
function henti() { clearInterval(putaran); putaran = null; $('#putar').classList.remove('jalan'); }

function renderPeringkat() {
  const L = LENSA[S.lensa];
  let rows;
  if (S.lensa === 'klub') {
    rows = PROV.filter((p) => p.v > 0).sort((a, b) => b.v - a.v).slice(0, 5)
      .map((p) => ({ key: 'p:' + p.nama, nama: p.nama, sub: klubDi(p.nama).map((k) => k.pendek).join(', '), v: p.v, logo: '' }));
    $('#peringkat-judul').textContent = 'Provinsi terbanyak';
  } else if (S.lensa === 'poin') {
    rows = S.data.klub.slice().sort((a, b) => (kls(a)?.pos ?? 99) - (kls(b)?.pos ?? 99)).slice(0, 5)
      .map((k) => ({ key: 'k:' + k.id, nama: k.pendek, sub: `${k.kota} · main ${kls(k)?.main ?? '–'}`, v: kls(k)?.poin ?? 0, logo: logoHtml(k, 26) }));
    $('#peringkat-judul').textContent = `Klasemen pekan ${S.meta.pekan_terakhir}`;
  } else {
    rows = S.data.klub.slice().sort((a, b) => metrikKlub(b) - metrikKlub(a)).slice(0, 5)
      .map((k) => ({ key: 'k:' + k.id, nama: k.pendek, sub: k.kota, v: metrikKlub(k), logo: logoHtml(k, 26),
        d: S.lensa === 'nilai' ? selisihAwal(k) : null }));
    $('#peringkat-judul').textContent = S.lensa === 'nilai' ? `Top 5 klub · ${tglP(S.snap)}` : 'Top 5 klub';
  }
  $('#peringkat-kolom').textContent = L.unit;
  const max = Math.max(...rows.map((r) => r.v), 1);
  $('#peringkat').innerHTML = rows.map((r, i) => `<li data-key="${esc(r.key)}" class="${r.key === 'k:' + S.klub || r.key === 'p:' + S.prov ? 'on' : ''}">
    <span class="no">${i + 1}</span><span>${r.logo}</span><span class="nm">${esc(r.nama)}<small>${esc(r.sub)}</small></span>
    <span class="v">${L.fmt(r.v)}${r.d != null ? `<small class="${kelasArah(r.d)}" title="sejak ${esc(tgl(S.snaps[0]))}">${tanda(r.d)}</small>` : ''}</span>
    <span class="bar"><i style="width:${(r.v / max) * 100}%"></i></span></li>`).join('');
}
$('#peringkat').addEventListener('click', (e) => {
  const li = e.target.closest('li'); if (!li) return;
  const [t, id] = li.dataset.key.split(/:(.*)/s);
  if (t === 'k') pilihKlub(id); else masukProv(id);
});

function tren(nilai, { balik = false, min, max, fmt }) {
  // nilai: [{v, lbl, t?}] — kalau ada t (tanggal ISO), jarak titik mengikuti tanggal
  if (!nilai.length) return '<p class="kecil">Belum ada data.</p>';
  const w = 300, h = 74, px = 6, pr = 6, pt = 20, pb = 18;
  const vs = nilai.map((n) => n.v);
  const lo = min ?? Math.min(...vs), hi = max ?? Math.max(...vs);
  const ts = nilai.map((n, i) => (n.t ? Date.parse(n.t) : i));
  const t0 = ts[0], t1 = ts[ts.length - 1];
  const X = (i) => nilai.length === 1 ? w / 2 : px + ((ts[i] - t0) / (t1 - t0 || 1)) * (w - px - pr);
  const Y = (v) => { const r = hi === lo ? 0.5 : (v - lo) / (hi - lo); return pt + (balik ? r : 1 - r) * (h - pt - pb); };
  const d = nilai.map((n, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(n.v).toFixed(1)}`).join('');
  const L = nilai.length - 1, akhir = nilai[L];
  const tit = nilai.map((n, i) => `<circle cx="${X(i)}" cy="${Y(n.v)}" r="${i === L ? 3.6 : 2.4}" fill="${WARNA.ramp[4]}"><title>${esc(n.lbl)}: ${esc(fmt(n.v))}</title></circle>`).join('');
  const sb = (i, anchor) => `<text x="${X(i)}" y="${h - 3}" text-anchor="${anchor}">${esc(nilai[i].lbl)}</text>`;
  return `<svg class="tren" viewBox="0 0 ${w} ${h}" role="img" aria-label="Tren ${esc(nilai[0].lbl)} sampai ${esc(akhir.lbl)}">
    <line x1="0" x2="${w}" y1="${h - pb + 4}" y2="${h - pb + 4}" stroke="#E2DDD0"/>
    <path d="${d}" fill="none" stroke="${WARNA.ramp[4]}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${tit}
    ${L === 0 ? sb(0, 'middle') : sb(0, 'start') + sb(L, 'end')}
    ${L > 0 ? `<text x="${X(0)}" y="${Y(nilai[0].v) - 8}" text-anchor="start">${esc(fmt(nilai[0].v))}</text>` : ''}
    <text x="${X(L)}" y="${Y(akhir.v) - 8}" text-anchor="${L === 0 ? 'middle' : 'end'}" style="font-weight:700;fill:#1C2321">${esc(fmt(akhir.v))}</text>
  </svg>`;
}

function renderDetail() {
  const el = $('#detail');
  el.classList.remove('kosong');
  el.classList.toggle('ringkas', !S.klub && S.mode !== 'prov');
  if (S.klub) {
    const k = klubBy(S.klub), r = kls(k), na = nilaiAkhir(k), z = zona(r?.pos ?? 9);
    const nTren = k.nilai.map((n) => ({ v: n.nilai, lbl: tglP(n.tanggal), t: n.tanggal }));
    const pTren = k.klasemen.map((x) => ({ v: x.pos, lbl: 'P' + x.pekan }));
    const aktif = skuadAktif(k), asing = aktif.filter((p) => p.asing).length, masuk = aktif.filter((p) => p.pinjam === 'masuk').length;
    const keluar = k.skuad.length - aktif.length;
    const per = ['Kiper', 'Bek', 'Gelandang', 'Penyerang'].map((pos) => `<span><b>${aktif.filter((p) => p.posisi === pos).length}</b> ${pos.toLowerCase()}</span>`).join('·');
    const d = k.nilai.length > 1 ? k.nilai[k.nilai.length - 1].nilai - k.nilai[0].nilai : null;
    el.innerHTML = `
      <button class="kembali" data-aksi="prov" type="button" style="margin:0 0 6px">← ${esc(k.provinsi)}</button>
      <div class="klub-kepala">${logoHtml(k, 64)}<div>
        <span class="pill" style="background:${WARNA.zona[z]}22;color:${z === 'mid' ? '#4A4F4B' : WARNA.zona[z]}">${esc(k.status)}</span>
        <h2>${esc(k.nama)}</h2><p class="lok">${esc(k.kota)}, ${esc(k.provinsi)}</p></div></div>
      <div class="angka">
        <div><b>${r ? r.pos : '–'}</b><span>Peringkat</span></div>
        <div><b>${r ? r.poin : '–'}</b><span>Poin</span></div>
        <div><b>${k.nilai.length ? nf1.format(nilaiSnap(k)) : '–'}</b><span>Rp miliar</span></div>
      </div>
      ${r ? `<p class="rekor">Pekan ${r.pekan}: main <b>${r.main}</b> · menang <b>${r.menang}</b> · seri <b>${r.seri}</b> · kalah <b>${r.kalah}</b> · nilai pasar per ${esc(tgl(S.snap))}</p>` : ''}
      <button type="button" class="tombol-skuad" data-aksi="skuad"><span>Lihat skuad lengkap<small>${aktif.length} pemain · ${aktif.length - asing} lokal · ${asing} asing${masuk ? ` · ${masuk} pinjaman` : ''}${keluar ? ` · ${keluar} dipinjamkan` : ''}</small></span><span aria-hidden="true">→</span></button>
      <p class="sub-judul">Nilai pasar skuad</p>
      ${tren(nTren, { fmt: (v) => 'Rp ' + nf1.format(v) + ' M' })}
      ${d != null ? `<p class="selisih"><b class="${kelasArah(d)}">${tanda(d)} M (${tanda((d / k.nilai[0].nilai) * 100)}%)</b> <span class="kecil">sejak ${esc(tgl(k.nilai[0].tanggal))}${na?.skuad ? ` · ${na.skuad} pemain tercatat di Transfermarkt` : ''}</span></p>` : ''}
      <p class="sub-judul">Posisi per pekan</p>
      ${pTren.length > 1 ? tren(pTren, { balik: true, min: 1, max: 18, fmt: (v) => '#' + v }) : `<p class="kecil" style="margin:0">Pekan ${r?.pekan ?? '–'}: peringkat <b>${r?.pos ?? '–'}</b>. Grafik muncul setelah ada data dua pekan atau lebih.</p>`}
      <p class="sub-judul">Profil</p>
      <dl class="info">
        <dt>Stadion</dt><dd>${esc(k.stadion)}</dd>
        <dt>Kapasitas</dt><dd>${nf0.format(k.kapasitas)} kursi</dd>
        <dt>Pelatih</dt><dd>${esc(k.pelatih)}</dd>
        <dt>Kapten</dt><dd>${esc(k.kapten)}</dd>
        <dt>Apparel</dt><dd>${esc(k.apparel)}</dd>
        <dt>2025/26</dt><dd>${esc(k.musim_lalu)}</dd>
      </dl>
      <div class="komposisi">${per}</div>
      ${k.catatan ? `<p class="catatan">${esc(k.catatan)}</p>` : ''}`;
  } else if (S.mode === 'prov') {
    const ks = klubDi(S.prov).sort((a, b) => metrikKlub(b) - metrikKlub(a));
    const L = LENSA[S.lensa];
    el.innerHTML = `<span class="pill">Provinsi</span><h2>${esc(S.prov)}</h2>
      <p class="lok">${ks.length ? `${ks.length} klub · ${L.label.toLowerCase()} ${L.fmt(metrikProv(S.prov))} ${L.unit}` : 'Belum ada klub Super League di provinsi ini.'}</p>
      <div class="daftar-klub">${ks.map((k) => `<button type="button" data-id="${esc(k.id)}">
        ${logoHtml(k, 34)}<span><b>${esc(k.nama)}</b><small>${esc(k.kota)} · ${esc(k.stadion)}</small></span>
        <span class="v">${L.fmt(metrikKlub(k))}</span></button>`).join('')}</div>`;
  } else {
    const ks = S.data.klub, pemuncak = ks.find((k) => kls(k)?.pos === 1);
    const termahal = ks.slice().sort((a, b) => nilaiSnap(b) - nilaiSnap(a))[0];
    const prov = new Set(ks.map((k) => k.provinsi));
    const total = ks.reduce((s, k) => s + nilaiSnap(k), 0);
    const totTren = S.snaps.map((t) => ({ v: ks.reduce((s, k) => s + (nilaiPada(k, t) ?? 0), 0), lbl: tglP(t), t }));
    const naik = ks.map((k) => ({ k, d: selisihAwal(k) })).filter((x) => x.d != null).sort((a, b) => b.d - a.d).slice(0, 3);
    el.innerHTML = `<span class="pill">Ringkasan liga</span><h2>${ks.length} klub, ${prov.size} provinsi</h2>
      <p class="lok">Klik pulau berwarna atau logo klub untuk melihat lebih dekat.</p>
      <div class="angka">
        <div><b>${nf0.format(Math.round(total))}</b><span>Rp miliar total</span></div>
        <div>${logoHtml(pemuncak, 26)}<span>Pemuncak: ${esc(pemuncak?.pendek ?? '–')}</span></div>
        <div>${logoHtml(termahal, 26)}<span>Termahal: ${esc(termahal.pendek)}</span></div>
      </div>
      <p class="sub-judul">Total nilai pasar liga</p>
      ${tren(totTren, { fmt: (v) => 'Rp ' + nf0.format(Math.round(v)) + ' M' })}
      ${naik.length ? `<p class="sub-judul">Naik terbanyak sejak ${esc(tglP(S.snaps[0]))}</p>
      <div class="daftar-klub">${naik.map(({ k, d }) => `<button type="button" data-id="${esc(k.id)}">${logoHtml(k, 30)}
        <span><b>${esc(k.pendek)}</b><small>Rp ${nf1.format(nilaiPada(k, S.snaps[0]))} → ${nf1.format(nilaiSnap(k))} M</small></span>
        <span class="v ${kelasArah(d)}">${tanda(d)}</span></button>`).join('')}</div>` : ''}
      <p class="kecil" style="margin-top:12px">Nilai pasar per ${tgl(S.snap)}. Klasemen usai pekan ${S.meta.pekan_terakhir} (${tgl(S.meta.tanggal_klasemen)}).</p>
      ${S.meta.catatan_nilai ? `<p class="catatan">${esc(S.meta.catatan_nilai)}</p>` : ''}
      ${S.meta.catatan ? `<p class="catatan">${esc(S.meta.catatan)}</p>` : ''}`;
  }
}
$('#detail').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.aksi === 'skuad') bukaSkuad(S.klub);
  else if (b.dataset.id) pilihKlub(b.dataset.id);
  else if (b.dataset.aksi === 'prov') { const p = klubBy(S.klub).provinsi; S.klub = null; masukProv(p); }
});

// ---------- navigasi ----------
function setMode() { document.body.classList.toggle('mode-prov', S.mode === 'prov'); }
function setHash(h) { setMode(); history.replaceState(null, '', h ? '#' + encodeURIComponent(h) : location.pathname + location.search); }
function masukProv(nama) {
  if (!provBy(nama)) return;
  S.mode = 'prov'; S.prov = nama; S.klub = null;
  $('#tbl-kembali').hidden = false;
  renderDetail(); renderPeringkat(); terbang(kamProv(nama)); setHash(nama);
}
function pilihKlub(id) {
  const k = klubBy(id); if (!k) return;
  const pindah = S.prov !== k.provinsi || S.mode !== 'prov';
  S.mode = 'prov'; S.prov = k.provinsi; S.klub = id; $('#tbl-kembali').hidden = false;
  renderDetail(); renderPeringkat();
  if (pindah || W < 900) terbang(kamProv(k.provinsi));
  setHash(id);
}
function keNasional() {
  S.mode = 'nasional'; S.prov = null; S.klub = null;
  $('#tbl-kembali').hidden = true;
  renderDetail(); renderPeringkat(); terbang(kamNasional()); setHash('');
}
$('#tbl-kembali').addEventListener('click', keNasional);
addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; if (!$('#skuad').hidden) tutupSkuad(); else keNasional(); });
function dariHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (!h) return keNasional();
  if (klubBy(h)) return pilihKlub(h);
  if (provBy(h)) return masukProv(h);
}

// ---------- hover & klik ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const balon = $('#balon');
let turun = null;
function kena(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, cam);
  const hit = ray.intersectObjects(kenaRay, false).find((h) => h.object.visible);
  return hit ? hit.object.userData : null;
}
function tampilBalon(ev, html) {
  balon.innerHTML = html; balon.hidden = false;
  const bw = balon.offsetWidth, bh = balon.offsetHeight;
  balon.style.left = clamp(ev.clientX + 16, 8, W - bw - 8) + 'px';
  balon.style.top = clamp(ev.clientY - bh - 14, 8, H - bh - 8) + 'px';
}
const kanvas = renderer.domElement;
kanvas.addEventListener('pointermove', (ev) => {
  if (!S.data) return;
  const u = kena(ev);
  S.hover = u ? (u.jenis === 'klub' ? 'k:' + u.pin.id : 'p:' + u.pr.nama) : null;
  kanvas.style.cursor = u && (u.jenis === 'klub' || u.pr.v > 0) ? 'pointer' : 'default';
  if (!u || ev.pointerType === 'touch') { balon.hidden = true; return; }
  const L = LENSA[S.lensa];
  if (u.jenis === 'klub') {
    const k = u.pin.k, r = kls(k);
    const d = selisihAwal(k);
    tampilBalon(ev, `<div class="bk">${logoHtml(k, 36)}<div><div class="t">${esc(k.kota)} · ${esc(k.stadion)}</div><b>${esc(k.nama)}</b></div></div>
      <div class="r">Peringkat ${r?.pos ?? '–'} · ${r?.poin ?? '–'} poin</div>
      <div class="r">Nilai pasar Rp ${nf1.format(nilaiSnap(k))} M${d != null ? ` <b class="${kelasArah(d)}">${tanda(d)}</b>` : ''}</div>`);
  } else {
    const ks = klubDi(u.pr.nama);
    tampilBalon(ev, `<div class="t">Provinsi</div><b>${esc(u.pr.nama)}</b>
      <div class="r">${ks.length ? `${L.label}: <b>${L.fmt(u.pr.v)}</b> ${L.unit}` : 'Belum ada klub Super League'}</div>
      ${ks.length ? `<div class="r">${ks.map((k) => esc(k.pendek)).join(', ')}</div>` : ''}`);
  }
});
kanvas.addEventListener('pointerleave', () => { S.hover = null; balon.hidden = true; });
kanvas.addEventListener('pointerdown', (ev) => { turun = [ev.clientX, ev.clientY]; });
kanvas.addEventListener('pointerup', (ev) => {
  if (!turun || Math.hypot(ev.clientX - turun[0], ev.clientY - turun[1]) > 6) return;
  const u = kena(ev);
  balon.hidden = true;
  if (!u) return;
  if (u.jenis === 'klub') pilihKlub(u.pin.id);
  else if (klubDi(u.pr.nama).length) masukProv(u.pr.nama);
});

// ---------- skuad lengkap ----------
const POSISI = ['Kiper', 'Bek', 'Gelandang', 'Penyerang'];
const SILUET = `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="17" r="9" fill="rgba(255,255,255,.55)"/><path d="M5 48c1.5-11 9-17 19-17s17.5 6 19 17z" fill="rgba(255,255,255,.55)"/></svg>`;
const SK = { id: null, pos: 'Semua', q: '' };
let fokusSebelum = null;
function bukaSkuad(id) {
  const k = klubBy(id); if (!k) return;
  SK.id = id; SK.pos = 'Semua'; SK.q = ''; $('#cari-pemain').value = '';
  const aktif = skuadAktif(k), asing = aktif.filter((p) => p.asing).length;
  $('.skuad-panel').style.setProperty('--c', k.warna);
  $('#skuad-logo').innerHTML = logoHtml(k, 64);
  $('#skuad-nama').textContent = k.nama;
  $('#skuad-ringkas').textContent = `${aktif.length} pemain · ${aktif.length - asing} lokal · ${asing} asing · pelatih ${k.pelatih}`;
  $('#skuad-sumber').textContent = 'Sumber: ' + (S.meta.sumber_skuad || '—');
  fokusSebelum = document.activeElement;
  $('#skuad').hidden = false;
  renderSkuad();
  $('#skuad-tutup').focus();
}
function tutupSkuad() { $('#skuad').hidden = true; fokusSebelum?.focus?.(); }
function renderSkuad() {
  const k = klubBy(SK.id), q = SK.q.trim().toLowerCase();
  const cocok = (p) => (SK.pos === 'Semua' || p.posisi === SK.pos) && (!q || `${p.nama} ${p.negara}`.toLowerCase().includes(q));
  const hitung = (pos) => skuadAktif(k).filter((p) => pos === 'Semua' || p.posisi === pos).length;
  $('#tab-posisi').innerHTML = ['Semua', ...POSISI].map((pos) =>
    `<button type="button" role="tab" data-pos="${pos}" aria-selected="${pos === SK.pos}">${pos}<small>${hitung(pos)}</small></button>`).join('');
  const baris = (p) => {
    const lencana = p.pinjam === 'masuk' ? `<span class="lencana">Pinjaman dari ${esc(p.klub_pinjam)}</span>`
      : p.pinjam === 'keluar' ? `<span class="lencana keluar">Dipinjamkan ke ${esc(p.klub_pinjam)}</span>`
      : p.catatan ? `<span class="lencana lain">${esc(p.catatan)}</span>` : '';
    const bendera = p.kode ? `<img src="aset/bendera/${esc(p.kode)}.svg" alt="${esc(p.negara)}" title="${esc(p.negara)}" loading="lazy">` : '';
    return `<tr class="${p.pinjam === 'keluar' ? 'dipinjamkan' : ''}">
      <td><div class="pemain"><span class="avatar">${SILUET}</span><div><div class="pemain-nama">${esc(p.nama)}</div>${lencana}</div></div></td>
      <td class="kol-klub"><div class="sel-klub">${logoHtml(k, 28)}<span>${esc(k.pendek)}</span></div></td>
      <td>${esc(p.posisi)}</td>
      <td><div class="sel-negara">${bendera}<span>${esc(p.negara || '—')}</span></div></td></tr>`;
  };
  const grup = (judul, list) => list.length ? `<tr class="grup"><td colspan="4">${esc(judul)} · ${list.length}</td></tr>` + list.map(baris).join('') : '';
  const aktif = k.skuad.filter((p) => p.pinjam !== 'keluar' && cocok(p));
  const keluar = k.skuad.filter((p) => p.pinjam === 'keluar' && cocok(p));
  const html = (SK.pos === 'Semua' ? POSISI.map((pos) => grup(pos, aktif.filter((p) => p.posisi === pos))).join('') : grup(SK.pos, aktif))
    + grup('Sedang dipinjamkan ke klub lain', keluar);
  $('#skuad-isi').innerHTML = html;
  $('#skuad-kosong').hidden = !!html;
}
$('#tab-posisi').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { SK.pos = b.dataset.pos; renderSkuad(); } });
$('#cari-pemain').addEventListener('input', (e) => { SK.q = e.target.value; renderSkuad(); });
$('#skuad-tutup').addEventListener('click', tutupSkuad);
$('#skuad').addEventListener('click', (e) => { if (e.target === e.currentTarget) tutupSkuad(); });

// ---------- loop ----------
const _v = new THREE.Vector3();
let tSebelum = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - tSebelum) / 1000); tSebelum = now;
  const k = 1 - Math.exp(-dt * 10);

  if (kamTujuan !== kamNow || now - kamT0 < KAM_DUR) {
    const t = diam() ? 1 : inOut(clamp((now - kamT0) / KAM_DUR));
    kamNow = Object.fromEntries(Object.keys(kamTujuan).map((key) => [key, lerp(kamDari[key], kamTujuan[key], t)]));
    if (t >= 1) kamNow = { ...kamTujuan };
    aturKamera(kamNow);
  }

  for (const pr of PROV) {
    const intro = diam() ? 1 : clamp((now - S.mulai - pr.delay) / 800);
    const target = pr.H * (intro <= 0 ? 0 : backOut(intro));
    pr.h = intro < 1 ? Math.max(0.01, target) : lerp(pr.h, pr.H, k);
    const on = S.mode === 'prov' && pr.nama === S.prov, hov = S.hover === 'p:' + pr.nama && pr.v > 0;
    const liftT = on ? 3 + 1.5 * (1 - Math.cos((now / 2600) * Math.PI * 2)) : hov ? 4 : 0;
    pr.lift = diam() ? liftT : lerp(pr.lift, liftT, k);
    pr.mesh.scale.y = pr.h;
    pr.garis.position.y = pr.h + 0.06;
    pr.grup.position.y = pr.lift;
    const opaT = S.mode === 'prov' && !on ? 0.28 : 1;
    pr.opa = lerp(pr.opa, opaT, k);
    pr.mAtas.opacity = pr.mSisi.opacity = pr.mGaris.opacity = pr.opa;
    pr.mAtas.depthWrite = pr.mSisi.depthWrite = pr.opa > 0.95;
  }

  for (const pin of PIN) {
    const pr = provBy(pin.k.provinsi);
    const intro = diam() ? 1 : clamp((now - S.mulai - 700 - pr.delay) / 600);
    const sel = S.klub === pin.id, hov = S.hover === 'k:' + pin.id;
    const fokus = S.mode !== 'prov' || pin.k.provinsi === S.prov;
    pin.s = lerp(pin.s, (fokus ? 1 : 0.45) * (intro <= 0 ? 0 : backOut(intro)), k);
    const sk = 1 / Math.max(1, kamNow.zoom / ZOOM0) ** 0.6;
    pin.skala = lerp(pin.skala, (sel ? 1.45 : hov ? 1.25 : 1) * sk, k);
    const y = pr.h + pr.lift;
    pin.grup.position.set(pin.k.x, y, pin.k.z);
    pin.tiang.scale.set(pin.skala, TIANG * pin.s * pin.skala, pin.skala);
    pin.kepala.position.y = TIANG * pin.s * pin.skala;
    const ks = Math.max(0.001, 13 * pin.s * pin.skala);
    pin.kepala.scale.set(ks, ks, 1);
    pin.mat.opacity = pin.tiang.material.opacity = fokus ? 1 : 0.35;
    // label
    const tampil = sel || hov || (S.mode === 'prov' && pin.k.provinsi === S.prov);
    _v.set(pin.k.x, y + pin.kepala.position.y + ks * 0.98, pin.k.z).project(cam);
    pin.el.style.left = ((_v.x + 1) / 2) * W + 'px';
    pin.el.style.top = ((1 - _v.y) / 2) * H + 'px';
    pin.el.style.opacity = tampil && intro >= 1 ? 1 : 0;
    pin.el.classList.toggle('on', sel);
  }

  renderer.render(scene, cam);
  requestAnimationFrame(frame);
}

// ---------- mulai ----------
async function mulai() {
  ukurUlang();
  addEventListener('resize', ukurUlang);
  let d;
  try {
    const res = await fetch('data.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    d = await res.json();
  } catch (e) {
    $('#pesan').textContent = 'Gagal memuat data.json. Buka lewat server (python3 -m http.server), bukan langsung dari file.';
    throw e;
  }
  S.data = d; S.meta = d.meta;
  S.snaps = d.meta.tanggal_nilai_lengkap?.length ? d.meta.tanggal_nilai_lengkap : d.meta.tanggal_nilai.slice(-1);
  S.snap = S.snaps[S.snaps.length - 1];

  $('#pill').textContent = `${d.meta.kompetisi} ${d.meta.musim} · pekan ${d.meta.pekan_terakhir}`;
  const sumberHtml = d.meta.sumber.map((s) => `${esc(s.untuk)}: <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.nama)}</a>`).join(' · ');
  $('#sumber').innerHTML = 'Sumber: ' + sumberHtml;
  $('#sumber-m').innerHTML = '<summary>Sumber data</summary>' + d.meta.sumber.map((s) => `<p>${esc(s.untuk)}: <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.nama)}</a></p>`).join('');

  bangunPeta(d);
  siapLensa();
  terapkanLensa();
  renderDetail();
  ZOOM0 = kamNasional().zoom;
  kamNow = kamTujuan = kamDari = kamNasional(); aturKamera(kamNow);
  S.mulai = performance.now();
  panggung.classList.remove('memuat');
  dariHash();
  addEventListener('hashchange', dariHash);
  requestAnimationFrame(frame);
}
mulai();
