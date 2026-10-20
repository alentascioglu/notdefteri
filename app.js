// ============================================================
// NOT DEFTERI - Uygulama Mantigi
// ============================================================

const SUBE_YAPISI = [
  { duzey: "9", subeler: [
    { ad: "9A", slug: "sube-9a" },
    { ad: "9B", slug: "sube-9b" },
  ]},
  { duzey: "10", subeler: [
    { ad: "10A", slug: "sube-10a" },
    { ad: "10B", slug: "sube-10b" },
  ]},
  { duzey: "11", subeler: [
    { ad: "11FM", slug: "sube-11fm" },
    { ad: "11TM", slug: "sube-11tm" },
    { ad: "11DİL", slug: "sube-11dil" },
  ]},
  { duzey: "12", subeler: [
    { ad: "12FM-1", slug: "sube-12fm-1" },
    { ad: "12FM-2", slug: "sube-12fm-2" },
    { ad: "12TM", slug: "sube-12tm" },
    { ad: "12DİL", slug: "sube-12dil" },
  ]},
];

const SUBE_SIRALI_LISTE = [];
SUBE_YAPISI.forEach((grup) => {
  grup.subeler.forEach((s) => {
    SUBE_SIRALI_LISTE.push({ id: s.slug, ad: s.ad, sinifDuzeyi: grup.duzey });
  });
});

const GRADE_FIELDS = [
  { key: "y1", label: "Yazılı 1", grup: "yazili" },
  { key: "y2", label: "Yazılı 2", grup: "yazili" },
  { key: "y3", label: "Yazılı 3", grup: "yazili" },
  { key: "s1", label: "Sözlü 1", grup: "sozlu" },
  { key: "s2", label: "Sözlü 2", grup: "sozlu" },
  { key: "p1", label: "Performans 1", grup: "performans" },
  { key: "p2", label: "Performans 2", grup: "performans" },
];

const GENEL_GORUNUM = "__genel__";

const OKUL_ADI_TR = "ÖZEL GETRONAGAN ERMENİ ANADOLU LİSESİ";
const OKUL_ADI_HY = "ԱԶԳԱՅԻՆ ԿԵԴՐՈՆԱԿԱՆ ՎԱՐԺԱՐԱՆ";

function okulBannerHtml() {
  return `
    <div class="dt-school-banner">
      <div class="dt-school-names">
        <div class="dt-school-hy" lang="hy">${OKUL_ADI_HY}</div>
        <div class="dt-school-tr">${OKUL_ADI_TR}</div>
      </div>
      <div class="dt-school-app">Not Defteri</div>
    </div>`;
}

let idSayaci = 1;
function idUret(prefix) {
  idSayaci += 1;
  return `${prefix}-${Date.now().toString(36)}-${idSayaci}`;
}

function bosOgrenci() {
  return { id: idUret("ogr"), ad: "", y1: "", y2: "", y3: "", s1: "", s2: "", p1: "", p2: "" };
}

function bosDers(ad) {
  return { id: idUret("ders"), dersAdi: ad || "Yeni Ders", dersSaati: 1, ogrenciler: [bosOgrenci(), bosOgrenci(), bosOgrenci()] };
}

// Agirlikli ortalama: [{ortalama, saat}] listesinden, sadece ortalama!=null olanlari kullanarak hesaplar.
function agirlikliOrtalamaHesapla(liste) {
  const dolular = liste.filter((x) => x.ortalama !== null && x.ortalama !== undefined);
  if (dolular.length === 0) return null;
  const toplamSaat = dolular.reduce((a, x) => a + (x.saat || 1), 0);
  if (toplamSaat === 0) return null;
  const toplamPuan = dolular.reduce((a, x) => a + x.ortalama * (x.saat || 1), 0);
  return toplamPuan / toplamSaat;
}

function ortalamaHesapla(ogrenci) {
  const degerler = GRADE_FIELDS.map((f) => parseFloat(ogrenci[f.key])).filter((v) => !Number.isNaN(v));
  if (degerler.length === 0) return null;
  return degerler.reduce((a, b) => a + b, 0) / degerler.length;
}

function fmt(n) {
  return n === null || n === undefined ? "" : n.toFixed(2);
}

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ============================================================
// STATE
// ============================================================

const state = {
  user: null,
  subeler: null,        // slug -> {id, ad, sinifDuzeyi, dersler:[...]}
  aktifSayfa: "ana",     // 'ana' | subeId
  aktifDersId: null,
  aramaAdi: "",
  oneriAcik: false,
  oneriIndex: -1,
  kayitDurumu: "idle",   // idle | saving | saved | error
};

const kirliSubeler = new Set();
let saveTimer = null;

// ============================================================
// FIREBASE
// ============================================================

let auth, db;
try {
  auth = firebase.auth();
  db = firebase.firestore();
} catch (e) {
  console.error("Firebase baslatilamadi:", e);
}

function varsayilanSubeVerisi(subeId, ornekliMi) {
  const meta = SUBE_SIRALI_LISTE.find((s) => s.id === subeId);
  const veri = { ad: meta.ad, sinifDuzeyi: meta.sinifDuzeyi, dersler: [] };
  if (ornekliMi) {
    const ornekDers = bosDers("Matematik");
    ornekDers.dersSaati = 4;
    ornekDers.ogrenciler = [
      { id: idUret("ogr"), ad: "Ayşe Yılmaz", y1: "88", y2: "92", y3: "79", s1: "85", s2: "90", p1: "", p2: "" },
      { id: idUret("ogr"), ad: "Mehmet Demir", y1: "70", y2: "", y3: "", s1: "65", s2: "", p1: "", p2: "" },
      bosOgrenci(),
    ];
    veri.dersler = [ornekDers];
  }
  return veri;
}

async function verileriYukle() {
  const istekler = SUBE_SIRALI_LISTE.map((meta) => db.collection("subeler").doc(meta.id).get());
  const sonuclar = await Promise.all(istekler);

  const subeler = [];
  const olusturulacaklar = [];

  sonuclar.forEach((doc, idx) => {
    const meta = SUBE_SIRALI_LISTE[idx];
    if (doc.exists) {
      const veri = doc.data();
      const dersler = (veri.dersler || []).map((d) => ({ dersSaati: 1, ...d }));
      subeler.push({ id: meta.id, ad: veri.ad || meta.ad, sinifDuzeyi: veri.sinifDuzeyi || meta.sinifDuzeyi, dersler });
    } else {
      const varsayilan = varsayilanSubeVerisi(meta.id, idx === 0);
      subeler.push({ id: meta.id, ...varsayilan });
      olusturulacaklar.push(db.collection("subeler").doc(meta.id).set(varsayilan));
    }
  });

  if (olusturulacaklar.length > 0) {
    await Promise.all(olusturulacaklar);
  }

  state.subeler = subeler;
}

function subeyiKirletVeKaydet(subeId) {
  kirliSubeler.add(subeId);
  state.kayitDurumu = "saving";
  guncelleKayitDurumu();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const idler = Array.from(kirliSubeler);
    kirliSubeler.clear();
    try {
      await Promise.all(
        idler.map((id) => {
          const sube = state.subeler.find((s) => s.id === id);
          if (!sube) return Promise.resolve();
          return db.collection("subeler").doc(id).set({
            ad: sube.ad,
            sinifDuzeyi: sube.sinifDuzeyi,
            dersler: sube.dersler,
          });
        })
      );
      state.kayitDurumu = "saved";
    } catch (e) {
      console.error("Kayit hatasi:", e);
      state.kayitDurumu = "error";
    }
    guncelleKayitDurumu();
  }, 600);
}

async function tumVerileriSifirla() {
  if (!window.confirm("Tüm şubeler, dersler ve öğrenci kayıtları silinip varsayılan haline dönecek. Emin misiniz?")) return;
  const yazmalar = SUBE_SIRALI_LISTE.map((meta, idx) => {
    const varsayilan = varsayilanSubeVerisi(meta.id, idx === 0);
    return db.collection("subeler").doc(meta.id).set(varsayilan);
  });
  await Promise.all(yazmalar);
  await verileriYukle();
  state.aktifSayfa = "ana";
  state.aktifDersId = null;
  render();
}

// ============================================================
// VERI GUNCELLEME YARDIMCILARI
// ============================================================

function subeBul(subeId) {
  return state.subeler.find((s) => s.id === subeId);
}
function dersBul(sube, dersId) {
  return sube.dersler.find((d) => d.id === dersId);
}

function dersEkle(subeId) {
  const sube = subeBul(subeId);
  const yeni = bosDers(`Ders ${sube.dersler.length + 1}`);
  sube.dersler.push(yeni);
  state.aktifDersId = yeni.id;
  subeyiKirletVeKaydet(subeId);
  render();
}

function dersSil(subeId, dersId) {
  if (!window.confirm("Bu dersi ve içindeki tüm not kayıtlarını silmek istediğinize emin misiniz?")) return;
  const sube = subeBul(subeId);
  sube.dersler = sube.dersler.filter((d) => d.id !== dersId);
  if (state.aktifDersId === dersId) state.aktifDersId = GENEL_GORUNUM;
  subeyiKirletVeKaydet(subeId);
  render();
}

function ogrenciEkle(subeId, dersId) {
  const sube = subeBul(subeId);
  const ders = dersBul(sube, dersId);
  ders.ogrenciler.push(bosOgrenci());
  subeyiKirletVeKaydet(subeId);
  render();
}

function ogrenciSil(subeId, dersId, ogrenciId) {
  const sube = subeBul(subeId);
  const ders = dersBul(sube, dersId);
  ders.ogrenciler = ders.ogrenciler.filter((o) => o.id !== ogrenciId);
  subeyiKirletVeKaydet(subeId);
  render();
}

// ============================================================
// OGRENCI LISTESINI DIGER DERSLERE KOPYALAMA
// ============================================================

function satirBosMu(o) {
  return !o.ad.trim() && GRADE_FIELDS.every((f) => !String(o[f.key] || "").trim());
}

// Kaynak dersteki ogrenci adlarini hedef derse ekler (notlar kopyalanmaz).
// Ayni isim hedefte zaten varsa atlanir; bos satirlar once doldurulur.
function listeyiKopyala(kaynakIsimler, hedefDers) {
  const mevcut = new Set(hedefDers.ogrenciler.map((o) => o.ad.trim().toLocaleLowerCase("tr-TR")).filter(Boolean));
  let eklenen = 0;
  let atlanan = 0;
  kaynakIsimler.forEach((ad) => {
    const key = ad.toLocaleLowerCase("tr-TR");
    if (mevcut.has(key)) { atlanan += 1; return; }
    const bos = hedefDers.ogrenciler.find(satirBosMu);
    if (bos) { bos.ad = ad; } else { const yeni = bosOgrenci(); yeni.ad = ad; hedefDers.ogrenciler.push(yeni); }
    mevcut.add(key);
    eklenen += 1;
  });
  return { eklenen, atlanan };
}

function kopyaModalKapat() {
  const eski = document.getElementById("kopya-modal");
  if (eski) eski.remove();
}

function kopyaModalAc(subeId, dersId) {
  const sube = subeBul(subeId);
  const kaynak = dersBul(sube, dersId);
  const kaynakIsimler = kaynak.ogrenciler.map((o) => o.ad.trim()).filter(Boolean);
  const digerleri = sube.dersler.filter((d) => d.id !== dersId);

  if (kaynakIsimler.length === 0) {
    window.alert("Önce bu derse en az bir öğrenci adı girin.");
    return;
  }
  if (digerleri.length === 0) {
    window.alert("Bu şubede kopyalanacak başka ders yok. Önce \"Ders Ekle\" ile yeni bir ders oluşturun.");
    return;
  }

  kopyaModalKapat();
  const overlay = document.createElement("div");
  overlay.id = "kopya-modal";
  overlay.className = "dt-modal-overlay";
  overlay.innerHTML = `
    <div class="dt-modal">
      <h2>Öğrenci listesini kopyala</h2>
      <p class="dt-modal-desc">
        <b>${escapeHtml(sube.ad)}</b> şubesindeki <b>${escapeHtml(kaynak.dersAdi)}</b> dersinin
        <b>${kaynakIsimler.length}</b> öğrencisi seçtiğiniz derslere eklenecek.
        Sadece isimler kopyalanır, notlar kopyalanmaz. Hedef derste zaten olan isimler tekrar eklenmez.
      </p>
      <label class="dt-modal-all"><input type="checkbox" id="kopya-hepsi" checked /> Tüm dersleri seç</label>
      <div class="dt-modal-list">
        ${digerleri.map((d) => `
          <label class="dt-modal-item">
            <input type="checkbox" class="js-kopya-hedef" value="${d.id}" checked />
            <span>${escapeHtml(d.dersAdi || "İsimsiz Ders")}</span>
            <small>${d.ogrenciler.filter((o) => o.ad.trim()).length} öğrenci var</small>
          </label>
        `).join("")}
      </div>
      <div class="dt-modal-actions">
        <button class="dt-modal-cancel" id="kopya-iptal">İptal</button>
        <button class="dt-modal-ok" id="kopya-onayla">Kopyala</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const kutular = () => Array.from(overlay.querySelectorAll(".js-kopya-hedef"));
  overlay.querySelector("#kopya-hepsi").addEventListener("change", (e) => {
    kutular().forEach((k) => (k.checked = e.target.checked));
  });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) kopyaModalKapat(); });
  overlay.querySelector("#kopya-iptal").addEventListener("click", kopyaModalKapat);
  overlay.querySelector("#kopya-onayla").addEventListener("click", () => {
    const secilenler = kutular().filter((k) => k.checked).map((k) => k.value);
    if (secilenler.length === 0) { window.alert("En az bir ders seçin."); return; }
    let toplamEklenen = 0;
    let toplamAtlanan = 0;
    secilenler.forEach((id) => {
      const hedef = dersBul(sube, id);
      const r = listeyiKopyala(kaynakIsimler, hedef);
      toplamEklenen += r.eklenen;
      toplamAtlanan += r.atlanan;
    });
    subeyiKirletVeKaydet(subeId);
    kopyaModalKapat();
    render();
    window.alert(`${secilenler.length} derse kopyalandı.\nEklenen kayıt: ${toplamEklenen}\nZaten var olduğu için atlanan: ${toplamAtlanan}`);
  });
}

// ============================================================
// RENDER - GIRIS EKRANI
// ============================================================

function renderLogin(hataMesaji) {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="dt-login-wrap">
      <div class="dt-login-card">
        <div class="dt-login-school">
          <div class="dt-login-rule"></div>
          <div class="dt-school-hy" lang="hy">${OKUL_ADI_HY}</div>
          <div class="dt-school-tr">${OKUL_ADI_TR}</div>
          <div class="dt-login-rule"></div>
          <div class="dt-login-app">Not Defteri</div>
        </div>
        <form id="login-form">
          <label for="login-email">E-posta</label>
          <input type="email" id="login-email" required autocomplete="username" />
          <label for="login-pass">Şifre</label>
          <input type="password" id="login-pass" required autocomplete="current-password" />
          <button type="submit" class="dt-login-btn" id="login-btn">Giriş Yap</button>
        </form>
        ${hataMesaji ? `<div class="dt-login-error">${escapeHtml(hataMesaji)}</div>` : ""}
      </div>
    </div>
  `;
  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const pass = document.getElementById("login-pass").value;
    const btn = document.getElementById("login-btn");
    btn.disabled = true;
    btn.textContent = "Giriş yapılıyor...";
    try {
      await auth.signInWithEmailAndPassword(email, pass);
      // onAuthStateChanged tetiklenecek, render otomatik yenilenecek
    } catch (err) {
      renderLogin("E-posta veya şifre hatalı. (" + (err.code || "hata") + ")");
    }
  });
}

// ============================================================
// RENDER - ANA UYGULAMA KABUGU
// ============================================================

function render() {
  if (!state.user) return; // login ekranı ayrı yönetiliyor
  if (state.subeler === null) {
    document.getElementById("app").innerHTML = `
      <div class="dt-loading">
        <div class="dt-spinner"></div>
        <span>Veriler yükleniyor...</span>
      </div>`;
    return;
  }

  const app = document.getElementById("app");
  app.innerHTML = `
    <aside class="dt-sidebar">
      <div class="dt-brand">🎓 Not Defteri</div>
      <nav class="dt-nav">
        <button class="dt-nav-item ${state.aktifSayfa === "ana" ? "dt-active" : ""}" data-action="nav-ana">
          <span>🔍 Ana Sayfa</span>
        </button>
        <div class="dt-nav-scroll">
          ${SUBE_YAPISI.map((grup) => `
            <div>
              <div class="dt-nav-label">${grup.duzey}. Sınıf</div>
              ${grup.subeler.map((s) => {
                const sube = subeBul(s.slug);
                const aktif = state.aktifSayfa === s.slug;
                return `
                  <button class="dt-nav-item ${aktif ? "dt-active" : ""}" data-action="nav-sube" data-sube-id="${s.slug}">
                    <span>${escapeHtml(s.ad)}</span>
                    <span class="dt-nav-count">${sube ? sube.dersler.length : 0}</span>
                  </button>`;
              }).join("")}
            </div>
          `).join("")}
        </div>
      </nav>
      <div class="dt-sidebar-foot">
        <div class="dt-save-status dt-save-${state.kayitDurumu}" id="save-status">
          ${saveStatusHtml()}
        </div>
        <button class="dt-reset" data-action="sifirla">↺ Sıfırla</button>
        <button class="dt-logout" data-action="logout">Çıkış Yap</button>
      </div>
    </aside>
    <main class="dt-main" id="main"></main>
  `;

  renderMain();
  eventleriBaglaMain();
}

function saveStatusHtml() {
  if (state.kayitDurumu === "saving") return "⏳ Kaydediliyor";
  if (state.kayitDurumu === "saved") return "✓ Kaydedildi";
  if (state.kayitDurumu === "error") return "Kayıt hatası";
  return "&nbsp;";
}

function guncelleKayitDurumu() {
  const el = document.getElementById("save-status");
  if (el) {
    el.className = `dt-save-status dt-save-${state.kayitDurumu}`;
    el.innerHTML = saveStatusHtml();
  }
}

// ============================================================
// RENDER - MAIN ICERIK
// ============================================================

function renderMain() {
  const main = document.getElementById("main");
  if (state.aktifSayfa === "ana") {
    main.innerHTML = okulBannerHtml() + anaSayfaHtml();
    anaSayfaSonuclariGuncelle();
  } else {
    const sube = subeBul(state.aktifSayfa);
    main.innerHTML = okulBannerHtml() + subeSayfaHtml(sube);
  }
}

// ---------- Ana Sayfa ----------

function anaSayfaHtml() {
  return `
    <div class="dt-page">
      <header class="dt-page-head">
        <h1>Öğrenci Ara</h1>
        <p>Bir öğrencinin adını yazın; kayıtlı olduğu tüm şube ve derslerdeki notları ile genel ortalaması otomatik listelenir.</p>
      </header>
      <div class="dt-search-wrap">
        <div class="dt-search">
          <span>🔍</span>
          <input type="text" id="arama-input" placeholder="Öğrenci adının bir kısmını yazın..." value="${escapeHtml(state.aramaAdi)}" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="oneri-kutusu" autofocus />
        </div>
        <div id="oneri-kutusu" class="dt-oneri-list" role="listbox" hidden></div>
      </div>
      <div id="ana-sonuclar"></div>
    </div>
  `;
}

// Buyuk/kucuk harf ve Turkce karakter farkini yok sayar: "Ayşe" ile "ayse" ayni sayilir.
function aramaNormallestir(str) {
  return String(str == null ? "" : str)
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ").trim();
}

// Yazilan metni iceren ogrenci adlarini (tekrarsiz) sube bilgisiyle listeler.
function oneriListesiHesapla(metin) {
  const nq = aramaNormallestir(metin);
  if (!nq || !state.subeler) return [];
  const parcalar = nq.split(" ").filter(Boolean);
  const harita = new Map();
  state.subeler.forEach((sube) => {
    sube.dersler.forEach((ders) => {
      ders.ogrenciler.forEach((o) => {
        const ad = o.ad.trim();
        if (!ad) return;
        const key = aramaNormallestir(ad);
        if (!parcalar.every((p) => key.includes(p))) return;
        if (!harita.has(key)) harita.set(key, { ad, key, subeler: new Set(), dersSayisi: 0 });
        const kayit = harita.get(key);
        kayit.subeler.add(sube.ad);
        kayit.dersSayisi += 1;
      });
    });
  });
  const puan = (k) => (k.key.startsWith(nq) ? 0 : k.key.split(" ").some((w) => w.startsWith(parcalar[0])) ? 1 : 2);
  return Array.from(harita.values()).sort((a, b) => puan(a) - puan(b) || a.ad.localeCompare(b.ad, "tr-TR"));
}

const ONERI_LIMIT = 8;

function oneriGuncelle() {
  const kutu = document.getElementById("oneri-kutusu");
  const input = document.getElementById("arama-input");
  if (!kutu || !input) return;
  const oneriler = oneriListesiHesapla(state.aramaAdi);
  const nq = aramaNormallestir(state.aramaAdi);
  // Zaten tam secilmis tek bir isim varsa listeyi gostermeye gerek yok
  const tekTam = oneriler.length === 1 && oneriler[0].key === nq;
  const goster = state.oneriAcik && oneriler.length > 0 && !tekTam;

  if (!goster) {
    kutu.hidden = true;
    kutu.innerHTML = "";
    input.setAttribute("aria-expanded", "false");
    return;
  }
  const gorunen = oneriler.slice(0, ONERI_LIMIT);
  if (state.oneriIndex >= gorunen.length) state.oneriIndex = gorunen.length - 1;
  kutu.innerHTML =
    gorunen.map((o, i) => `
      <div class="dt-oneri-item ${i === state.oneriIndex ? "dt-oneri-aktif" : ""}" role="option" data-action="oneri-sec" data-ad="${escapeHtml(o.ad)}">
        <span class="dt-oneri-ad">${escapeHtml(o.ad)}</span>
        <span class="dt-oneri-sube">${Array.from(o.subeler).map(escapeHtml).join(", ")}</span>
      </div>`).join("") +
    (oneriler.length > ONERI_LIMIT
      ? `<div class="dt-oneri-daha">+${oneriler.length - ONERI_LIMIT} öğrenci daha var, listeyi daraltmak için yazmaya devam edin</div>`
      : "");
  kutu.hidden = false;
  input.setAttribute("aria-expanded", "true");
}

function oneriSec(ad) {
  state.aramaAdi = ad;
  state.oneriAcik = false;
  state.oneriIndex = -1;
  const input = document.getElementById("arama-input");
  if (input) { input.value = ad; input.focus(); }
  oneriGuncelle();
  anaSayfaSonuclariGuncelle();
}

function aramaSonucHesapla() {
  const q = aramaNormallestir(state.aramaAdi);
  if (!q) return [];
  const sonuclar = [];
  state.subeler.forEach((sube) => {
    sube.dersler.forEach((ders) => {
      const ogrenci = ders.ogrenciler.find((o) => aramaNormallestir(o.ad) === q);
      if (ogrenci) {
        sonuclar.push({
          subeId: sube.id,
          subeAdi: sube.ad,
          dersId: ders.id,
          dersAdi: ders.dersAdi,
          saat: ders.dersSaati || 1,
          ortalama: ortalamaHesapla(ogrenci),
        });
      }
    });
  });
  return sonuclar;
}

function anaSayfaSonuclariGuncelle() {
  const kapsayici = document.getElementById("ana-sonuclar");
  if (!kapsayici) return;
  const aramaYapildi = state.aramaAdi.trim().length > 0;
  if (!aramaYapildi) { kapsayici.innerHTML = ""; return; }

  const sonuclar = aramaSonucHesapla();

  // Henuz tam bir ogrenci secilmediyse ozet kutularini gostermeden sadece yonlendir
  if (sonuclar.length === 0) {
    const adaylar = oneriListesiHesapla(state.aramaAdi).length;
    kapsayici.innerHTML = adaylar > 0
      ? `<div class="dt-empty">${adaylar} öğrenci eşleşti. Notlarını görmek için yukarıdaki listeden birini seçin.</div>`
      : `<div class="dt-empty">Bu yazıyla eşleşen bir öğrenci bulunamadı. Yazımı kontrol edin ya da adın başka bir bölümünü deneyin.</div>`;
    return;
  }

  const farkliSube = new Set(sonuclar.map((r) => r.subeId)).size;

  const genelOrtalama = agirlikliOrtalamaHesapla(sonuclar.map((r) => ({ ortalama: r.ortalama, saat: r.saat })));

  let html = "";
  if (farkliSube > 1) {
    html += `<div class="dt-warning">Bu isim birden fazla şubede bulundu. Aynı isimli farklı öğrenciler olabilir, sonuçları şube sütunundan kontrol edin.</div>`;
  }

  html += `
    <div class="dt-summary-row">
      <div class="dt-summary-card dt-summary-accent">
        <span class="dt-summary-label">Genel Ortalama</span>
        <span class="dt-summary-value">${genelOrtalama !== null ? fmt(genelOrtalama) : "—"}</span>
      </div>
      <div class="dt-summary-card">
        <span class="dt-summary-label">Bulunan Kayıt</span>
        <span class="dt-summary-value">${sonuclar.length}</span>
      </div>
    </div>
  `;

  {
    html += `
      <table class="dt-table">
        <thead><tr><th>Şube</th><th>Ders</th><th>Saat</th><th>Ortalama</th><th>Durum</th></tr></thead>
        <tbody>
          ${sonuclar.map((s) => `
            <tr class="dt-row-clickable" data-action="sonuc-git" data-sube-id="${s.subeId}" data-ders-id="${s.dersId}">
              <td>${escapeHtml(s.subeAdi)}</td>
              <td>${escapeHtml(s.dersAdi)}</td>
              <td class="dt-num">${s.saat}</td>
              <td class="dt-num">${s.ortalama !== null ? fmt(s.ortalama) : "—"}</td>
              <td>${
                s.ortalama === null
                  ? `<span class="dt-badge dt-badge-muted">Not girilmedi</span>`
                  : s.ortalama >= 50
                  ? `<span class="dt-badge dt-badge-ok">Başarılı</span>`
                  : `<span class="dt-badge dt-badge-bad">Başarısız</span>`
              }</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }
  kapsayici.innerHTML = html;
}

// ---------- Sube Sayfasi ----------

function subeSayfaHtml(sube) {
  const genelAktif = state.aktifDersId === GENEL_GORUNUM;
  const aktifDers = sube.dersler.find((d) => d.id === state.aktifDersId);

  let icerik;
  if (genelAktif) {
    icerik = subeGenelGorunumHtml(sube);
  } else if (!aktifDers) {
    icerik = `<div class="dt-empty">Bu şubede henüz ders yok. Başlamak için yukarıdan "Ders Ekle" butonuna tıklayın.</div>`;
  } else {
    icerik = dersTablosuHtml(sube, aktifDers);
  }

  return `
    <div class="dt-page">
      <header class="dt-page-head">
        <h1>${escapeHtml(sube.ad)}</h1>
        <p>Bu şubeye ait dersleri yönetin. Her ders için öğrenci ve not girişi yapabilirsiniz.</p>
      </header>
      <div class="dt-pill-row">
        <div class="dt-pill dt-pill-genel ${genelAktif ? "dt-pill-active" : ""}" data-action="genel-gorunum" data-sube-id="${sube.id}">
          <span>👥 Genel Görünüm</span>
        </div>
        <div class="dt-pill-divider"></div>
        ${sube.dersler.map((d) => `
          <div class="dt-pill ${state.aktifDersId === d.id ? "dt-pill-active" : ""}" data-action="ders-sec" data-sube-id="${sube.id}" data-ders-id="${d.id}">
            <span class="js-pill-label" data-ders-id="${d.id}">📘 ${escapeHtml(d.dersAdi || "İsimsiz Ders")}</span>
            <button class="dt-pill-x" data-action="ders-sil" data-sube-id="${sube.id}" data-ders-id="${d.id}" title="Dersi sil">✕</button>
          </div>
        `).join("")}
        <button class="dt-pill dt-pill-add" data-action="ders-ekle" data-sube-id="${sube.id}">+ Ders Ekle</button>
      </div>
      <div id="sube-icerik">${icerik}</div>
    </div>
  `;
}

function subeGenelSatirlariHesapla(sube) {
  const dersler = sube.dersler;
  const isimMap = new Map();
  dersler.forEach((d) => {
    d.ogrenciler.forEach((o) => {
      const ad = o.ad.trim();
      if (!ad) return;
      const key = ad.toLocaleLowerCase("tr-TR");
      if (!isimMap.has(key)) isimMap.set(key, ad);
    });
  });

  const satirlar = Array.from(isimMap.entries()).map(([key, ad]) => {
    const dersOrtalamalari = {};
    dersler.forEach((d) => {
      const ogrenci = d.ogrenciler.find((o) => o.ad.trim().toLocaleLowerCase("tr-TR") === key);
      dersOrtalamalari[d.id] = ogrenci ? ortalamaHesapla(ogrenci) : null;
    });
    const agirlikliListe = dersler.map((d) => ({ ortalama: dersOrtalamalari[d.id], saat: d.dersSaati || 1 }));
    const genelOrtalama = agirlikliOrtalamaHesapla(agirlikliListe);
    return { ad, dersOrtalamalari, genelOrtalama };
  });
  satirlar.sort((a, b) => a.ad.localeCompare(b.ad, "tr-TR"));
  return satirlar;
}

function subeGenelGorunumHtml(sube) {
  const dersler = sube.dersler;
  if (dersler.length === 0) {
    return `<div class="dt-empty">Bu şubede henüz ders yok. Öğrencileri toplu görebilmek için önce "Ders Ekle" ile en az bir ders oluşturup içine öğrenci girmeniz gerekir.</div>`;
  }

  const satirlar = subeGenelSatirlariHesapla(sube);

  if (satirlar.length === 0) {
    return `<div class="dt-empty">Bu şubedeki derslere henüz öğrenci eklenmemiş. Bir derse girip "Öğrenci Ekle" ile başlayabilirsiniz.</div>`;
  }

  return `
    <div class="dt-table-wrap">
      <table class="dt-table dt-table-genel">
        <thead>
          <tr>
            <th class="dt-th-sticky">Öğrenci Adı Soyadı</th>
            ${dersler.map((d) => `
              <th class="dt-th-genel-ders">
                <span class="dt-th-clickable" data-action="ders-sec" data-sube-id="${sube.id}" data-ders-id="${d.id}">${escapeHtml(d.dersAdi || "İsimsiz Ders")}</span>
                <div class="dt-genel-saat-row">
                  <input type="number" min="1" max="20" class="js-genel-saat-input" data-sube-id="${sube.id}" data-ders-id="${d.id}" value="${d.dersSaati || 1}" />
                  <span>sa/hf</span>
                </div>
              </th>`).join("")}
            <th class="dt-group-ortalama">Genel Ortalama</th>
          </tr>
        </thead>
        <tbody>
          ${satirlar.map((s) => `
            <tr>
              <td class="dt-th-sticky">${escapeHtml(s.ad)}</td>
              ${dersler.map((d) => `<td class="dt-num">${s.dersOrtalamalari[d.id] !== null ? fmt(s.dersOrtalamalari[d.id]) : "—"}</td>`).join("")}
              <td class="dt-group-ortalama dt-num" style="font-weight:600">${s.genelOrtalama !== null ? fmt(s.genelOrtalama) : "—"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function dersTablosuHtml(sube, ders) {
  const ortalamalar = ders.ogrenciler.map(ortalamaHesapla);
  const dolular = ortalamalar.filter((v) => v !== null);
  const subeOrtalamasi = dolular.length > 0 ? dolular.reduce((a, b) => a + b, 0) / dolular.length : null;

  return `
    <div>
      <div class="dt-ders-baslik-row dt-ders-baslik-flex">
        <div>
          <label class="dt-ders-adi-label">Ders Adı</label>
          <input class="dt-ders-adi-input" id="ders-adi-input" data-sube-id="${sube.id}" data-ders-id="${ders.id}" value="${escapeHtml(ders.dersAdi)}" />
        </div>
        <div>
          <label class="dt-ders-adi-label">Haftalık Ders Saati</label>
          <input type="number" min="1" max="20" class="dt-ders-saati-input" id="ders-saati-input" data-sube-id="${sube.id}" data-ders-id="${ders.id}" value="${ders.dersSaati || 1}" />
        </div>
      </div>
      <p class="dt-ders-saati-aciklama">Bu değer, öğrencinin genel ortalaması hesaplanırken bu dersin ne kadar ağırlıklı sayılacağını belirler (örn. 6 saatlik bir ders, 1 saatlik bir derse göre genel ortalamaya çok daha fazla etki eder).</p>
      <div class="dt-table-wrap">
        <table class="dt-table dt-table-editable">
          <thead>
            <tr>
              <th rowspan="2" class="dt-th-sticky">Öğrenci Adı Soyadı</th>
              <th colspan="3" class="dt-group-yazili">Yazılı</th>
              <th colspan="2" class="dt-group-sozlu">Sözlü</th>
              <th colspan="2" class="dt-group-performans">Performans</th>
              <th rowspan="2" class="dt-group-ortalama">Ortalama</th>
              <th rowspan="2" class="dt-th-action"></th>
            </tr>
            <tr>
              <th class="dt-group-yazili">1</th><th class="dt-group-yazili">2</th><th class="dt-group-yazili">3</th>
              <th class="dt-group-sozlu">1</th><th class="dt-group-sozlu">2</th>
              <th class="dt-group-performans">1</th><th class="dt-group-performans">2</th>
            </tr>
          </thead>
          <tbody>
            ${ders.ogrenciler.map((o, idx) => `
              <tr data-ogr-id="${o.id}">
                <td class="dt-th-sticky dt-cell-name-bar">
                  <input class="dt-cell-input dt-cell-text js-ogr-ad" data-sube-id="${sube.id}" data-ders-id="${ders.id}" data-ogr-id="${o.id}" placeholder="Ad Soyad" value="${escapeHtml(o.ad)}" />
                </td>
                ${GRADE_FIELDS.map((f) => `
                  <td data-label="${f.label}" class="dt-group-${f.grup}">
                    <input class="dt-cell-input dt-cell-num js-ogr-not" type="number" min="0" max="100"
                      data-sube-id="${sube.id}" data-ders-id="${ders.id}" data-ogr-id="${o.id}" data-field="${f.key}"
                      placeholder="—" value="${escapeHtml(o[f.key])}" />
                  </td>
                `).join("")}
                <td data-label="Ortalama" class="dt-group-ortalama dt-num dt-cell-computed js-ortalama-cell" data-ogr-id="${o.id}">
                  ${ortalamalar[idx] !== null ? fmt(ortalamalar[idx]) : "—"}
                </td>
                <td class="dt-th-action">
                  <button class="dt-row-del" data-action="ogr-sil" data-sube-id="${sube.id}" data-ders-id="${ders.id}" data-ogr-id="${o.id}" title="Öğrenciyi sil">
                    ✕ <span class="dt-row-del-label">Öğrenciyi Sil</span>
                  </button>
                </td>
              </tr>
            `).join("")}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="8" class="dt-foot-label">Şube Ortalaması (bu ders)</td>
              <td class="dt-group-ortalama dt-num dt-foot-value js-sube-ortalama">${subeOrtalamasi !== null ? fmt(subeOrtalamasi) : "—"}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div class="dt-btn-row">
        <button class="dt-add-row-btn" data-action="ogr-ekle" data-sube-id="${sube.id}" data-ders-id="${ders.id}">+ Öğrenci Ekle</button>
        <button class="dt-add-row-btn dt-copy-btn" data-action="kopyala-ac" data-sube-id="${sube.id}" data-ders-id="${ders.id}">⧉ Listeyi diğer derslere kopyala</button>
      </div>
    </div>
  `;
}

// ============================================================
// OLAY YONETIMI
// ============================================================

function tiklamaDinleyicisiniBagla() {
  const app = document.getElementById("app");

  // Arama kutusu disina tiklaninca oneri listesini kapat
  document.addEventListener("click", (e) => {
    if (state.oneriAcik && !e.target.closest(".dt-search-wrap")) {
      state.oneriAcik = false;
      state.oneriIndex = -1;
      oneriGuncelle();
    }
  });

  app.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;

    if (action === "nav-ana") {
      state.aktifSayfa = "ana";
      render();
    } else if (action === "nav-sube") {
      state.aktifSayfa = el.dataset.subeId;
      state.aktifDersId = GENEL_GORUNUM;
      render();
    } else if (action === "genel-gorunum") {
      state.aktifDersId = GENEL_GORUNUM;
      renderMain();
      eventleriBaglaMain();
    } else if (action === "ders-sec") {
      state.aktifSayfa = el.dataset.subeId;
      state.aktifDersId = el.dataset.dersId;
      render();
    } else if (action === "ders-ekle") {
      dersEkle(el.dataset.subeId);
    } else if (action === "ders-sil") {
      e.stopPropagation();
      dersSil(el.dataset.subeId, el.dataset.dersId);
    } else if (action === "ogr-ekle") {
      ogrenciEkle(el.dataset.subeId, el.dataset.dersId);
    } else if (action === "oneri-sec") {
      oneriSec(el.dataset.ad);
    } else if (action === "kopyala-ac") {
      kopyaModalAc(el.dataset.subeId, el.dataset.dersId);
    } else if (action === "ogr-sil") {
      ogrenciSil(el.dataset.subeId, el.dataset.dersId, el.dataset.ogrId);
    } else if (action === "sonuc-git") {
      state.aktifSayfa = el.dataset.subeId;
      state.aktifDersId = el.dataset.dersId;
      render();
    } else if (action === "sifirla") {
      tumVerileriSifirla();
    } else if (action === "logout") {
      auth.signOut();
    }
  });
}

// Sadece #main icindeki inputlar icin (partial re-render sonrasi tekrar cagrilir)
function eventleriBaglaMain() {
  const main = document.getElementById("main");
  if (!main) return;

  // Ana sayfa arama kutusu
  const aramaInput = document.getElementById("arama-input");
  if (aramaInput) {
    aramaInput.addEventListener("input", (e) => {
      state.aramaAdi = e.target.value;
      state.oneriAcik = true;
      state.oneriIndex = -1;
      oneriGuncelle();
      anaSayfaSonuclariGuncelle();
      // sonuc satirlarina tiklama olay delegasyonu app seviyesinde zaten calisiyor
    });
    aramaInput.addEventListener("focus", () => {
      if (state.aramaAdi.trim()) { state.oneriAcik = true; oneriGuncelle(); }
    });
    aramaInput.addEventListener("keydown", (e) => {
      const oneriler = oneriListesiHesapla(state.aramaAdi).slice(0, ONERI_LIMIT);
      const acik = !document.getElementById("oneri-kutusu").hidden;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (oneriler.length === 0) return;
        e.preventDefault();
        state.oneriAcik = true;
        const yon = e.key === "ArrowDown" ? 1 : -1;
        state.oneriIndex = (state.oneriIndex + yon + oneriler.length) % oneriler.length;
        oneriGuncelle();
      } else if (e.key === "Enter") {
        if (!acik || oneriler.length === 0) return;
        e.preventDefault();
        oneriSec(oneriler[state.oneriIndex >= 0 ? state.oneriIndex : 0].ad);
      } else if (e.key === "Escape") {
        state.oneriAcik = false;
        state.oneriIndex = -1;
        oneriGuncelle();
      }
    });
  }

  // Ders adi input
  const dersAdiInput = document.getElementById("ders-adi-input");
  if (dersAdiInput) {
    dersAdiInput.addEventListener("input", (e) => {
      const subeId = e.target.dataset.subeId;
      const dersId = e.target.dataset.dersId;
      const sube = subeBul(subeId);
      const ders = dersBul(sube, dersId);
      ders.dersAdi = e.target.value;
      const pillLabel = document.querySelector(`.js-pill-label[data-ders-id="${dersId}"]`);
      if (pillLabel) pillLabel.textContent = "📘 " + (e.target.value || "İsimsiz Ders");
      subeyiKirletVeKaydet(subeId);
    });
  }

  // Genel Gorunum: ders basliklarindaki toplu saat girisleri
  main.querySelectorAll(".js-genel-saat-input").forEach((input) => {
    input.addEventListener("input", (e) => {
      const { subeId, dersId } = e.target.dataset;
      const sube = subeBul(subeId);
      const ders = dersBul(sube, dersId);
      const deger = parseInt(e.target.value, 10);
      ders.dersSaati = Number.isNaN(deger) || deger < 1 ? 1 : deger;

      const satirlar = subeGenelSatirlariHesapla(sube);
      const satirElemanlari = main.querySelectorAll(".dt-table-genel tbody tr");
      satirlar.forEach((satir, idx) => {
        const hucre = satirElemanlari[idx] && satirElemanlari[idx].querySelector(".dt-group-ortalama");
        if (hucre) hucre.textContent = satir.genelOrtalama !== null ? fmt(satir.genelOrtalama) : "—";
      });

      subeyiKirletVeKaydet(subeId);
    });
  });

  // Haftalik ders saati input
  const dersSaatiInput = document.getElementById("ders-saati-input");
  if (dersSaatiInput) {
    dersSaatiInput.addEventListener("input", (e) => {
      const subeId = e.target.dataset.subeId;
      const dersId = e.target.dataset.dersId;
      const sube = subeBul(subeId);
      const ders = dersBul(sube, dersId);
      const deger = parseInt(e.target.value, 10);
      ders.dersSaati = Number.isNaN(deger) || deger < 1 ? 1 : deger;
      subeyiKirletVeKaydet(subeId);
    });
  }

  // Ogrenci adi inputlari
  main.querySelectorAll(".js-ogr-ad").forEach((input) => {
    input.addEventListener("input", (e) => {
      const { subeId, dersId, ogrId } = e.target.dataset;
      const sube = subeBul(subeId);
      const ders = dersBul(sube, dersId);
      const ogr = ders.ogrenciler.find((o) => o.id === ogrId);
      ogr.ad = e.target.value;
      subeyiKirletVeKaydet(subeId);
    });
  });

  // Not inputlari
  main.querySelectorAll(".js-ogr-not").forEach((input) => {
    input.addEventListener("input", (e) => {
      const { subeId, dersId, ogrId, field } = e.target.dataset;
      const sube = subeBul(subeId);
      const ders = dersBul(sube, dersId);
      const ogr = ders.ogrenciler.find((o) => o.id === ogrId);
      ogr[field] = e.target.value;

      const ortCell = main.querySelector(`.js-ortalama-cell[data-ogr-id="${ogrId}"]`);
      const yeniOrt = ortalamaHesapla(ogr);
      if (ortCell) ortCell.textContent = yeniOrt !== null ? fmt(yeniOrt) : "—";

      const tumOrtalamalar = ders.ogrenciler.map(ortalamaHesapla).filter((v) => v !== null);
      const subeOrt = tumOrtalamalar.length > 0 ? tumOrtalamalar.reduce((a, b) => a + b, 0) / tumOrtalamalar.length : null;
      const subeOrtCell = main.querySelector(".js-sube-ortalama");
      if (subeOrtCell) subeOrtCell.textContent = subeOrt !== null ? fmt(subeOrt) : "—";

      subeyiKirletVeKaydet(subeId);
    });
  });
}

// ============================================================
// BASLANGIC / AUTH DINLEYICI
// ============================================================

tiklamaDinleyicisiniBagla();

if (auth) {
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      state.user = user;
      if (state.subeler === null) {
        render(); // yukleniyor ekrani goster
        try {
          await verileriYukle();
        } catch (e) {
          console.error("Veri yukleme hatasi:", e);
          document.getElementById("app").innerHTML = `
            <div class="dt-loading" style="flex-direction:column;gap:14px;text-align:center;padding:20px;">
              <span>Veriler yüklenemedi. Firestore kurallarınızı ve firebase-config.js dosyanızı kontrol edin.</span>
              <span style="font-size:12px;color:var(--ink-soft)">${escapeHtml(e.message || "")}</span>
            </div>`;
          return;
        }
      }
      render();
    } else {
      state.user = null;
      state.subeler = null;
      renderLogin();
    }
  });
} else {
  document.getElementById("app").innerHTML = `
    <div class="dt-loading" style="flex-direction:column;gap:14px;text-align:center;padding:20px;">
      <span>Firebase başlatılamadı. firebase-config.js dosyasındaki değerleri kontrol edin.</span>
    </div>`;
}
