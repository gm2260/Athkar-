/**
 * زاد المسلم - المحرك البرمجي التفاعلي
 */

const state = {
  athkarData: {},
  surahsData: [],
  tafsirData: {},
  config: {},
  currentCategory: 'morning',
  counters: {},
  currentSurah: 1,
  isPlayingAudio: false,
  coords: { lat: 26.25, lng: 43.83 }, // القصيم / الرياض
  deviceId: localStorage.getItem('dev_id') || ('usr_' + Math.random().toString(36).substring(2, 9)),
  db: null
};

localStorage.setItem('dev_id', state.deviceId);

function initFirebase() {
  if (typeof firebase !== 'undefined' && state.config.firebase) {
    try {
      firebase.initializeApp(state.config.firebase);
      state.db = firebase.database();
    } catch (e) {
      console.warn("Firebase Init Notice:", e);
    }
  }
}

async function loadProjectData() {
  try {
    const [athkarRes, surahsRes, tafsirRes, configRes] = await Promise.all([
      fetch('data/athkar.json').then(r => r.json()),
      fetch('data/surahs.json').then(r => r.json()),
      fetch('data/tafsir.json').then(r => r.json()),
      fetch('data/config.json').then(r => r.json())
    ]);

    state.athkarData = athkarRes;
    state.surahsData = surahsRes;
    state.tafsirData = tafsirRes;
    state.config = configRes;

    initFirebase();
    initApp();
  } catch (error) {
    console.warn("Falling back to local cache:", error);
    initApp();
  }
}

function initApp() {
  try {
    state.counters = JSON.parse(localStorage.getItem('cnts') || '{}');
  } catch (e) {
    state.counters = {};
  }

  renderAthkar();
  renderSurahs(state.surahsData);
  loadPrayerTimes();

  const bm = JSON.parse(localStorage.getItem('q_bm') || '{"surah":18,"name":"سورة الكهف","ayah":1}');
  const bmTxt = document.getElementById('bm-txt');
  if (bmTxt) bmTxt.innerText = bm.name + " - آية " + bm.ayah;

  const cloudCnt = document.getElementById('cloud-cnt');
  if (cloudCnt) cloudCnt.innerText = localStorage.getItem('tasbeeh_lifetime') || '0';

  const devTxt = document.getElementById('dev-txt');
  if (devTxt) devTxt.innerText = state.deviceId;
}

// 1. Athkar
function renderAthkar() {
  const container = document.getElementById('athkar-box');
  if (!container) return;

  const list = state.athkarData[state.currentCategory] || [];
  container.innerHTML = '';

  list.forEach(item => {
    const rem = state.counters[item.id] !== undefined ? state.counters[item.id] : item.count;
    const isDone = rem === 0;

    const card = document.createElement('div');
    card.className = 'dhikr-card ' + (isDone ? 'completed' : '');
    card.innerHTML = `
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
    container.appendChild(card);
  });
}

function decDhikr(id, max) {
  if (state.counters[id] === undefined) state.counters[id] = max;
  if (state.counters[id] > 0) {
    state.counters[id]--;
    if (navigator.vibrate) navigator.vibrate(35);
    incrementTasbeehLifetime();
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
    alert("تم نسخ الذكر إلى الحافظة 📋");
  }
}

function setCategory(cat, el) {
  state.currentCategory = cat;
  document.querySelectorAll('.category-scroller .chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderAthkar();
}

// 2. Prayer Times
function getGPS() {
  if ("geolocation" in navigator) {
    const locTxt = document.getElementById('loc-txt');
    if (locTxt) locTxt.innerText = "جاري التحديد عبر الأقمار الاصطناعية...";
    navigator.geolocation.getCurrentPosition(
      pos => {
        state.coords.lat = pos.coords.latitude;
        state.coords.lng = pos.coords.longitude;
        if (locTxt) locTxt.innerText = `موقعك الحالي (${state.coords.lat.toFixed(2)}°, ${state.coords.lng.toFixed(2)}°)`;
        loadPrayerTimes();
      },
      () => { loadPrayerTimes(); },
      { timeout: 8000 }
    );
  }
}

function loadPrayerTimes() {
  const ts = Math.floor(Date.now() / 1000);
  fetch(`https://api.aladhan.com/v1/timings/${ts}?latitude=${state.coords.lat}&longitude=${state.coords.lng}&method=4`)
    .then(r => r.json())
    .then(d => {
      if (d && d.data) {
        const hijriTxt = document.getElementById('hijri-txt');
        if (hijriTxt) {
          hijriTxt.innerText = `${d.data.date.hijri.day} ${d.data.date.hijri.month.ar} ${d.data.date.hijri.year} هـ (تقويم أم القرى)`;
        }
        updatePrayerUI(d.data.timings);
      }
    })
    .catch(() => {
      updatePrayerUI({ Fajr: "04:18", Sunrise: "05:38", Dhuhr: "11:58", Asr: "15:25", Maghrib: "18:19", Isha: "19:49" });
    });
}

function updatePrayerUI(t) {
  ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].forEach(p => {
    const el = document.getElementById(`t-${p}`);
    if (el && t[p]) el.innerText = formatTime(t[p]);
  });
  calculateNextPrayer(t);
}

function formatTime(s) {
  const parts = s.split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1];
  const pm = h >= 12;
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${pm ? 'م' : 'ص'}`;
}

function calculateNextPrayer(t) {
  const now = new Date();
  const names = { Fajr: "الفجر", Sunrise: "الشروق", Dhuhr: "الظهر", Asr: "العصر", Maghrib: "المغرب", Isha: "العشاء" };
  const keys = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  let nextKey = 'Fajr';
  let minDiff = Infinity;

  keys.forEach(k => {
    const [h, m] = t[k].split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0);
    const diff = d.getTime() - now.getTime();
    if (diff > 0 && diff < minDiff) {
      minDiff = diff;
      nextKey = k;
    }
  });

  document.querySelectorAll('.prayer-card').forEach(c => c.classList.remove('current'));
  const curCard = document.getElementById(`card-${nextKey}`);
  if (curCard) curCard.classList.add('current');

  const nextTxt = document.getElementById('next-p-txt');
  if (nextTxt) nextTxt.innerText = `الصلاة القادمة: صلاة ${names[nextKey]}`;

  const countTxt = document.getElementById('count-txt');
  if (countTxt && minDiff !== Infinity) {
    const hrs = Math.floor(minDiff / 3600000);
    const mins = Math.floor((minDiff % 3600000) / 60000);
    countTxt.innerText = `متبقي على الأذان: ${hrs} ساعة و ${mins} دقيقة`;
  }
}

function askNotif() {
  if ("Notification" in window) {
    Notification.requestPermission().then(p => {
      alert(p === "granted" ? "✅ تم تفعيل إشعارات الأذان والأذكار بنجاح!" : "يرجى تفعيل الإشعارات من إعدادات المتصفح.");
    });
  }
}

// 3. Quran Reader
function renderSurahs(list) {
  const container = document.getElementById('surahs-box');
  if (!container) return;

  container.innerHTML = '';
  list.forEach(s => {
    const card = document.createElement('div');
    card.className = 'surah-card';
    card.onclick = () => openQuran(s.number);
    card.innerHTML = `
      <div class="surah-number-badge">${s.number}</div>
      <div style="flex:1; margin-right:12px;">
        <div style="font-weight:800; font-size:15px; color:#fff;">سورة ${s.name}</div>
        <div style="font-size:11px; color:var(--text-muted);">${s.revelationType || 'مكية'} • ${s.numberOfAyahs || 7} آيات</div>
      </div>
      <div style="color:var(--gold-primary); font-size:16px;">📖</div>
    `;
    container.appendChild(card);
  });
}

function searchSurah(q) {
  q = (q || '').trim();
  if (!q) {
    renderSurahs(state.surahsData);
    return;
  }
  const filtered = state.surahsData.filter(s => s.name.includes(q) || s.number.toString() === q);
  renderSurahs(filtered);
}

function openQuran(num) {
  state.currentSurah = num;
  const s = state.surahsData.find(x => x.number === num) || { name: "الفاتحة", number: num };
  const nameEl = document.getElementById('q-name');
  if (nameEl) nameEl.innerText = `سورة ${s.name}`;

  const modal = document.getElementById('quran-reader-modal');
  if (modal) modal.classList.add('active');

  const content = document.getElementById('q-content');
  if (content) content.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">جاري جلب الآيات الكريمة...</div>';

  fetch(`https://api.alquran.cloud/v1/surah/${num}`)
    .then(r => r.json())
    .then(d => {
      if (d && d.data && d.data.ayahs && content) {
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
      if (content) content.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">يتطلب تصفح السور اتصالاً بالإنترنت.</div>';
    });
}

function closeQuran() {
  const modal = document.getElementById('quran-reader-modal');
  if (modal) modal.classList.remove('active');
  const player = document.getElementById('player');
  if (player) player.pause();
  state.isPlayingAudio = false;
  const btn = document.getElementById('aud-btn');
  if (btn) btn.innerText = "▶️ تلاوة";
}

function toggleAudio() {
  const player = document.getElementById('player');
  const btn = document.getElementById('aud-btn');
  if (state.isPlayingAudio) {
    if (player) player.pause();
    state.isPlayingAudio = false;
    if (btn) btn.innerText = "▶️ تلاوة";
  } else {
    const formattedNum = ("000" + state.currentSurah).slice(-3);
    player.src = `https://server8.mp3quran.net/afs/${formattedNum}.mp3`;
    player.play()
      .then(() => {
        state.isPlayingAudio = true;
        if (btn) btn.innerText = "⏸️ إيقاف";
      })
      .catch(() => {
        alert("يتطلب تشغيل التلاوة اتصالاً بالإنترنت.");
      });
  }
}

function saveBookmark() {
  const s = state.surahsData.find(x => x.number === state.currentSurah) || { name: "الكهف", number: state.currentSurah };
  const bm = { surah: state.currentSurah, name: `سورة ${s.name}`, ayah: 1 };
  localStorage.setItem('q_bm', JSON.stringify(bm));

  const bmTxt = document.getElementById('bm-txt');
  if (bmTxt) bmTxt.innerText = `${bm.name} - آية ${bm.ayah}`;

  if (state.db) {
    state.db.ref(`users/${state.deviceId}/bookmark`).set(bm);
  }
  alert("✅ تم حفظ فاصلة القراءة بنجاح!");
}

function resumeBookmark() {
  const bm = JSON.parse(localStorage.getItem('q_bm') || '{"surah":18}');
  openQuran(bm.surah || 18);
}

// 4. Tafsir
function showTafsir(surahNum, ayahNum, text) {
  const s = state.surahsData.find(x => x.number === surahNum) || { name: "" };
  const headEl = document.getElementById('t-head');
  if (headEl) headEl.innerText = `تفسير سورة ${s.name} (آية ${ayahNum})`;

  const ayahEl = document.getElementById('t-ayah');
  if (ayahEl) ayahEl.innerText = text;

  const key = `${surahNum}_${ayahNum}`;
  const custom = state.tafsirData[key] || state.tafsirData['default'] || {};

  const kathirEl = document.getElementById('t-kathir');
  if (kathirEl) kathirEl.innerText = custom.ibn_kathir || "بيان معاني الآية الكريمة ومقاصدها وتفسير القرآن بالقرآن والسنة النبوية الصحيحة وأقوال الصحابة.";

  const hajarEl = document.getElementById('t-hajar');
  if (hajarEl) hajarEl.innerText = custom.ibn_hajar || "استنباط الأحكام الحديثية والفوائد اللغوية والفقهية من صحيح البخاري وشرحه فتح الباري.";

  const modal = document.getElementById('tafsir-modal');
  if (modal) modal.classList.add('active');
}

function closeTafsir() {
  const modal = document.getElementById('tafsir-modal');
  if (modal) modal.classList.remove('active');
}

// 5. Tasbeeh
let tasbeehVal = 0;
let tasbeehTarget = 33;

function countTasbeeh() {
  tasbeehVal++;
  const valEl = document.getElementById('t-val');
  if (valEl) valEl.innerText = tasbeehVal;

  if (navigator.vibrate) navigator.vibrate(35);
  incrementTasbeehLifetime();
}

function incrementTasbeehLifetime() {
  const current = parseInt(localStorage.getItem('tasbeeh_lifetime') || '0', 10) + 1;
  localStorage.setItem('tasbeeh_lifetime', current);
  const el = document.getElementById('cloud-cnt');
  if (el) el.innerText = current;
}

function setTasbeeh(lbl, target, el) {
  const lblEl = document.getElementById('t-lbl');
  if (lblEl) lblEl.innerText = lbl;

  tasbeehTarget = target;
  const tgtEl = document.getElementById('t-target');
  if (tgtEl) tgtEl.innerText = `الهدف: ${target}`;

  tasbeehVal = 0;
  const valEl = document.getElementById('t-val');
  if (valEl) valEl.innerText = "0";

  document.querySelectorAll('#tab-tasbeeh .chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
}

function resetTasbeeh() {
  tasbeehVal = 0;
  const valEl = document.getElementById('t-val');
  if (valEl) valEl.innerText = "0";
}

// 6. Firebase Sync
function syncFirebase() {
  if (!state.db) {
    alert("يعمل التطبيق محلياً بدون اتصال بسحابة Firebase.");
    return;
  }
  const total = parseInt(localStorage.getItem('tasbeeh_lifetime') || '0', 10);
  const bm = JSON.parse(localStorage.getItem('q_bm') || '{"surah":18,"name":"سورة الكهف","ayah":1}');

  state.db.ref(`users/${state.deviceId}`).update({
    tasbeeh_total: total,
    quran_bookmark: bm,
    last_synced: new Date().toISOString()
  }).then(() => {
    alert("✅ تمت مزامنة جميع الأذكار والتسبيحات مع سحابة Firebase بنجاح!");
  }).catch(e => {
    alert("تنبيه مزامنة السحابة: " + e.message);
  });
}

// 7. Navigation
function navigateTab(tabId, el) {
  document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));

  const target = document.getElementById(`tab-${tabId}`);
  if (target) target.classList.add('active');
  if (el) el.classList.add('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.addEventListener('DOMContentLoaded', loadProjectData);