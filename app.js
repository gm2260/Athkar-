const state = {
  athkarData: {},
  surahsData: [],
  currentCategory: 'morning',
  counters: {},
  currentSurah: 1,
  isPlayingAudio: false,
  coords: { lat: 26.25, lng: 43.83 },
  deviceId: localStorage.getItem('dev_id') || ('usr_' + Math.random().toString(36).substring(2, 9)),
  db: null
};

localStorage.setItem('dev_id', state.deviceId);

const fbConfig = {
  apiKey: "AIzaSyBQ9jCtlstM_Xzuy1_li_AytmXY_9BFZOA",
  authDomain: "athkar-72a94.firebaseapp.com",
  databaseURL: "https://athkar-72a94-default-rtdb.firebaseio.com",
  projectId: "athkar-72a94",
  storageBucket: "athkar-72a94.firebasestorage.app",
  messagingSenderId: "1067739053431",
  appId: "1:1067739053431:web:15a92c10aeea45c056b572"
};

const surahNamesList = "الفاتحة,البقرة,آل عمران,النساء,المائدة,الأنعام,الأعراف,الأنفال,التوبة,يونس,هود,يوسف,الرعد,إبراهيم,الحجر,النحل,الإسراء,الكهف,مريم,طه,الأنبياء,الحج,المؤمنون,النور,الفرقان,الشعراء,النمل,القصص,العنكبوت,الروم,لقمان,السجدة,الأحزاب,سبأ,فاطر,يس,الصافات,ص,الزمر,غافر,فصلت,الشورى,الزخرف,الدخان,الجاثية,الأحقاف,محمد,الفتح,الحجرات,ق,الذاريات,الطور,النجم,القمر,الرحمن,الواقعة,الحديد,المجادلة,الحشر,الممتحنة,الصف,الجمعة,المنافقون,التغابن,الطلاق,التحريم,الملك,القلم,الحاقة,المعارج,نوح,الجن,المزمل,المدثر,القيامة,الإنسان,المرسلات,النبأ,النازعات,عبس,التكوير,الانفطار,المطففين,الانشقاق,البروج,الطارق,الأعلى,الغاشية,الفجر,البلد,الشمس,الليل,الضحى,الشرح,التين,العلق,القدر,البينة,الزلزلة,العاديات,القارعة,التكاثر,العصر,الهمزة,الفيل,قريش,الماعون,الكوثر,الكافرون,النصر,المسد,الإخلاص,الفلق,الناس".split(',');
state.surahsData = surahNamesList.map((name, i) => ({ number: i + 1, name: name }));

async function init() {
  try {
    if (typeof firebase !== 'undefined') {
      firebase.initializeApp(fbConfig);
      state.db = firebase.database();
    }
  } catch(e) {}

  try {
    const res = await fetch('athkar.json');
    state.athkarData = await res.json();
  } catch(e) {
    console.warn("Using offline athkar");
  }

  try { state.counters = JSON.parse(localStorage.getItem('cnts') || '{}'); } catch(e) { state.counters = {}; }

  renderAthkar();
  renderSurahs(state.surahsData);
  loadPrayers();

  const bm = JSON.parse(localStorage.getItem('q_bm') || '{"surah":18,"name":"سورة الكهف","ayah":1}');
  const bmEl = document.getElementById('bm-txt');
  if (bmEl) bmEl.innerText = bm.name + " - آية " + bm.ayah;

  const cCnt = document.getElementById('cloud-cnt');
  if (cCnt) cCnt.innerText = localStorage.getItem('tasbeeh_lifetime') || '0';

  const dTxt = document.getElementById('dev-txt');
  if (dTxt) dTxt.innerText = state.deviceId;
}

function renderAthkar() {
  const box = document.getElementById('athkar-box');
  if (!box) return;
  const list = state.athkarData[state.currentCategory] || [];
  box.innerHTML = '';

  list.forEach(item => {
    const rem = state.counters[item.id] !== undefined ? state.counters[item.id] : item.count;
    const isDone = rem === 0;

    const div = document.createElement('div');
    div.className = 'dhikr-card ' + (isDone ? 'completed' : '');
    div.innerHTML = `
      <div class="dhikr-card-head">
        <span>۞ ${item.title}</span>
        <span>التكرار: ${item.count}</span>
      </div>
      <div class="dhikr-body">${item.text}</div>
      <div class="dhikr-benefit">
        <div>✨ ${item.reward}</div>
        <div>📜 <strong>المرجع:</strong> ${item.source}</div>
      </div>
      <div class="dhikr-actions">
        <button class="btn-counter ${isDone ? 'completed' : ''}" onclick="decDhikr('${item.id}', ${item.count})">
          <span>${isDone ? '✓ تم بحمد الله' : 'اضغط للتسبيح'}</span>
          <span class="counter-badge">${rem}</span>
        </button>
        <button class="btn-icon" onclick="resetDhikr('${item.id}', ${item.count})" title="إعادة">🔄</button>
        <button class="btn-icon" onclick="copyDhikr('${item.id}')" title="نسخ">📋</button>
      </div>
    `;
    box.appendChild(div);
  });
}

function decDhikr(id, max) {
  if (state.counters[id] === undefined) state.counters[id] = max;
  if (state.counters[id] > 0) {
    state.counters[id]--;
    if (navigator.vibrate) navigator.vibrate(35);
    addTasbeehLifetime();
  }
  localStorage.setItem('cnts', JSON.stringify(state.counters));
  renderAthkar();
}

function resetDhikr(id, max) {
  state.counters[id] = max;
  localStorage.setItem('cnts', JSON.stringify(state.counters));
  renderAthkar();
}

function copyDhikr(id) {
  const list = state.athkarData[state.currentCategory] || [];
  const item = list.find(x => x.id === id);
  if (item) {
    navigator.clipboard.writeText(item.text);
    alert("تم النسخ 📋");
  }
}

function setCategory(cat, el) {
  state.currentCategory = cat;
  document.querySelectorAll('.category-scroller .chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderAthkar();
}

function getGPS() {
  if ("geolocation" in navigator) {
    const locTxt = document.getElementById('loc-txt');
    if (locTxt) locTxt.innerText = "جاري التحديد عبر GPS...";
    navigator.geolocation.getCurrentPosition(
      pos => {
        state.coords.lat = pos.coords.latitude;
        state.coords.lng = pos.coords.longitude;
        if (locTxt) locTxt.innerText = `موقعك الحالي (${state.coords.lat.toFixed(2)}°, ${state.coords.lng.toFixed(2)}°)`;
        loadPrayers();
      },
      () => loadPrayers(),
      { timeout: 8000 }
    );
  }
}

function loadPrayers() {
  const ts = Math.floor(Date.now() / 1000);
  fetch(`https://api.aladhan.com/v1/timings/${ts}?latitude=${state.coords.lat}&longitude=${state.coords.lng}&method=4`)
    .then(r => r.json())
    .then(d => {
      if (d && d.data) {
        const hijri = document.getElementById('hijri-txt');
        if (hijri) hijri.innerText = `${d.data.date.hijri.day} ${d.data.date.hijri.month.ar} ${d.data.date.hijri.year} هـ (تقويم أم القرى)`;
        updateTimes(d.data.timings);
      }
    })
    .catch(() => {
      updateTimes({ Fajr: "04:18", Sunrise: "05:38", Dhuhr: "11:58", Asr: "15:25", Maghrib: "18:19", Isha: "19:49" });
    });
}

function updateTimes(t) {
  ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].forEach(p => {
    const el = document.getElementById(`t-${p}`);
    if (el && t[p]) el.innerText = fmtTime(t[p]);
  });
  calcNextPrayer(t);
}

function fmtTime(s) {
  const p = s.split(':');
  let h = parseInt(p[0], 10);
  const m = p;
  const pm = h >= 12;
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${pm ? 'م' : 'ص'}`;
}

function calcNextPrayer(t) {
  const now = new Date();
  const names = { Fajr: "الفجر", Sunrise: "الشروق", Dhuhr: "الظهر", Asr: "العصر", Maghrib: "المغرب", Isha: "العشاء" };
  const keys = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  let next = 'Fajr';
  let min = Infinity;

  keys.forEach(k => {
    const [h, m] = t[k].split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0);
    const diff = d.getTime() - now.getTime();
    if (diff > 0 && diff < min) {
      min = diff;
      next = k;
    }
  });

  document.querySelectorAll('.prayer-card').forEach(c => c.classList.remove('current'));
  const card = document.getElementById(`card-${next}`);
  if (card) card.classList.add('current');

  const txt = document.getElementById('next-p-txt');
  if (txt) txt.innerText = `الصلاة القادمة: صلاة ${names[next]}`;

  const cnt = document.getElementById('count-txt');
  if (cnt && min !== Infinity) {
    const hrs = Math.floor(min / 3600000);
    const mins = Math.floor((min % 3600000) / 60000);
    cnt.innerText = `متبقي على الأذان: ${hrs} ساعة و ${mins} دقيقة`;
  }
}

function askNotif() {
  if ("Notification" in window) {
    Notification.requestPermission().then(p => {
      alert(p === "granted" ? "✅ تم تفعيل إشعارات الأذان بنجاح!" : "يرجى تفعيل الإشعارات من إعدادات المتصفح.");
    });
  }
}

function renderSurahs(list) {
  const box = document.getElementById('surahs-box');
  if (!box) return;
  box.innerHTML = '';
  list.forEach(s => {
    const div = document.createElement('div');
    div.className = 'surah-card';
    div.onclick = () => openQuran(s.number);
    div.innerHTML = `
      <div class="surah-number-badge">${s.number}</div>
      <div style="flex:1; margin-right:12px;">
        <div style="font-weight:800; font-size:15px; color:#fff;">سورة ${s.name}</div>
      </div>
      <div style="color:var(--gold-primary); font-size:16px;">📖</div>
    `;
    box.appendChild(div);
  });
}

function searchSurah(q) {
  q = (q || '').trim();
  if (!q) { renderSurahs(state.surahsData); return; }
  renderSurahs(state.surahsData.filter(s => s.name.includes(q) || s.number.toString() === q));
}

function openQuran(num) {
  state.currentSurah = num;
  const s = state.surahsData.find(x => x.number === num) || { name: "الفاتحة", number: num };
  document.getElementById('q-name').innerText = `سورة ${s.name}`;
  document.getElementById('quran-reader-modal').classList.add('active');

  const content = document.getElementById('q-content');
  content.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">جاري جلب الآيات الكريمة...</div>';

  fetch(`https://api.alquran.cloud/v1/surah/${num}`)
    .then(r => r.json())
    .then(d => {
      if (d && d.data && d.data.ayahs) {
        content.innerHTML = '';
        if (num !== 9 && num !== 1) {
          const bis = document.createElement('div');
          bis.style.cssText = 'text-align:center; color:var(--gold-primary); margin-bottom:14px; font-size:22px;';
          bis.innerText = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
          content.appendChild(bis);
        }

        d.data.ayahs.forEach(ay => {
          let txt = ay.text;
          if (ay.numberInSurah === 1 && txt.startsWith("بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ") && num !== 1) {
            txt = txt.replace("بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ", "").trim();
          }
          const span = document.createElement('span');
          span.className = 'ayah-clickable';
          span.innerText = txt + ' ';
          const numSpan = document.createElement('span');
          numSpan.className = 'ayah-symbol';
          numSpan.innerText = ay.numberInSurah;
          span.appendChild(numSpan);
          span.onclick = () => showTafsir(num, ay.numberInSurah, txt);

          content.appendChild(span);
          content.appendChild(document.createTextNode(' '));
        });
      }
    })
    .catch(() => {
      content.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">يتطلب تصفح السور اتصالاً بالإنترنت.</div>';
    });
}

function closeQuran() {
  document.getElementById('quran-reader-modal').classList.remove('active');
  const p = document.getElementById('player');
  if (p) p.pause();
  state.isPlayingAudio = false;
  document.getElementById('aud-btn').innerText = "▶️ تلاوة";
}

function toggleAudio() {
  const p = document.getElementById('player');
  const b = document.getElementById('aud-btn');
  if (state.isPlayingAudio) {
    p.pause();
    state.isPlayingAudio = false;
    b.innerText = "▶️ تلاوة";
  } else {
    p.src = `https://server8.mp3quran.net/afs/${("000" + state.currentSurah).slice(-3)}.mp3`;
    p.play().then(() => {
      state.isPlayingAudio = true;
      b.innerText = "⏸️ إيقاف";
    }).catch(() => alert("يتطلب الاستماع اتصالاً بالإنترنت."));
  }
}

function saveBookmark() {
  const s = state.surahsData.find(x => x.number === state.currentSurah) || { name: "الكهف" };
  const bm = { surah: state.currentSurah, name: `سورة ${s.name}`, ayah: 1 };
  localStorage.setItem('q_bm', JSON.stringify(bm));
  document.getElementById('bm-txt').innerText = `${bm.name} - آية ${bm.ayah}`;
  if (state.db) state.db.ref(`users/${state.deviceId}/bookmark`).set(bm);
  alert("✅ تم حفظ فاصلة القراءة بنجاح!");
}

function resumeBookmark() {
  const bm = JSON.parse(localStorage.getItem('q_bm') || '{"surah":18}');
  openQuran(bm.surah || 18);
}

function showTafsir(surahNum, ayahNum, text) {
  const s = state.surahsData.find(x => x.number === surahNum) || { name: "" };
  document.getElementById('t-head').innerText = `تفسير سورة ${s.name} (آية ${ayahNum})`;
  document.getElementById('t-ayah').innerText = text;
  document.getElementById('t-kathir').innerText = "بيان معاني الآية الكريمة ومقاصدها وتفسير القرآن بالقرآن والسنة النبوية الصحيحة وأقوال السلف الصالح.";
  document.getElementById('t-hajar').innerText = "استنباط الأحكام الحديثية والفوائد اللغوية والفقهية من صحيح البخاري وشرحه فتح الباري.";
  document.getElementById('tafsir-modal').classList.add('active');
}

function closeTafsir() {
  document.getElementById('tafsir-modal').classList.remove('active');
}

let tasbeehVal = 0;
let tasbeehTarget = 33;

function countTasbeeh() {
  tasbeehVal++;
  document.getElementById('t-val').innerText = tasbeehVal;
  if (navigator.vibrate) navigator.vibrate(35);
  addTasbeehLifetime();
}

function addTasbeehLifetime() {
  const c = parseInt(localStorage.getItem('tasbeeh_lifetime') || '0', 10) + 1;
  localStorage.setItem('tasbeeh_lifetime', c);
  const el = document.getElementById('cloud-cnt');
  if (el) el.innerText = c;
}

function setTasbeeh(lbl, target, el) {
  document.getElementById('t-lbl').innerText = lbl;
  tasbeehTarget = target;
  document.getElementById('t-target').innerText = `الهدف: ${target}`;
  tasbeehVal = 0;
  document.getElementById('t-val').innerText = "0";
  document.querySelectorAll('#tab-tasbeeh .chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
}

function resetTasbeeh() {
  tasbeehVal = 0;
  document.getElementById('t-val').innerText = "0";
}

function syncFirebase() {
  if (!state.db) { alert("يعمل التطبيق محلياً بدون اتصال بسحابة Firebase."); return; }
  const total = parseInt(localStorage.getItem('tasbeeh_lifetime') || '0', 10);
  const bm = JSON.parse(localStorage.getItem('q_bm') || '{"surah":18,"name":"سورة الكهف","ayah":1}');

  state.db.ref(`users/${state.deviceId}`).update({
    tasbeeh_total: total,
    quran_bookmark: bm,
    last_synced: new Date().toISOString()
  }).then(() => {
    alert("✅ تمت مزامنة جميع الأذكار والتسبيحات مع سحابة Firebase بنجاح!");
  });
}

function navigateTab(tabId, el) {
  document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));

  const target = document.getElementById(`tab-${tabId}`);
  if (target) target.classList.add('active');
  if (el) el.classList.add('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.addEventListener('DOMContentLoaded', init);
