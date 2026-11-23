/* Pronunciation Practice — Practice with Sharaf (English or Spanish: window.PEWE_L, set by ../site.js)
 * Spanish (Spain): syllables, stress and IPA are worked out from the spelling by ../spanish.js.
 * English: American pronunciations (phonetics, syllables, stress) come from the CMU Pronouncing Dictionary,
 * split by first letter in data/*.txt. Format: word<TAB>syllables;variant  (syllables split by ".",
 * phones in ARPAbet, vowel digit = stress: 1 main, 2 secondary, 0 none).
 * Meanings and real recordings come from the free dictionaryapi.dev, when it has the word.
 * Guests: saved in this browser. Signed-in students: also saved to their account (../account.js).
 */
(() => {
  'use strict';

  const POINTS = 10;
  const SAY_TRIES = 3;                      // attempts per word in "Say the word"
  const L = window.PEWE_L || { code: 'en', name: 'English', bcp: 'en-US', region: 'US', accent: 'American', voiceRe: /^en[-_]US/i, anyVoiceRe: /^en\b/i };
  const ES = L.code === 'es';
  const REGION = ES ? 'Spain' : 'US', REGION_CODE = ES ? 'ES' : 'US';
  const lk = (k) => (window.PEWE_KEY ? window.PEWE_KEY(k) : k); // storage key for this language
  const STORE_KEY = lk('pronunciation-v1');
  const DICT_KEY = lk('dictation-practice-v1'); // Dictation's own saved words (read only)
  let storeKey = STORE_KEY;
  let cloudOK = false;
  let cloudDictWords = [];

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').replace(/[‘’]/g, "'").toLowerCase().normalize('NFC').replace(ES ? /[^a-záéíóúüñ -]/g : /[^a-z' -]/g, ' ').replace(/\s+/g, ' ').trim();
  const pct = (c, t) => (t ? Math.round((c / t) * 100) : 0);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const ordinal = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

  // ---------- storage ----------
  function load(key = storeKey) {
    try { const d = JSON.parse(localStorage.getItem(key) || 'null'); if (d) return { words: d.words || [], days: d.days || {} }; } catch (e) { /* ignore */ }
    return { words: [], days: {} };
  }
  let db = load();
  let cloudTimer = null;
  function save() {
    try { localStorage.setItem(storeKey, JSON.stringify(db)); } catch (e) { /* ignore */ }
    if (window.PEWE && window.PEWE.user && cloudOK) { clearTimeout(cloudTimer); cloudTimer = setTimeout(flushCloud, 1500); }
  }
  function flushCloud() {
    clearTimeout(cloudTimer); cloudTimer = null;
    if (window.PEWE && window.PEWE.user && cloudOK && window.PEWE.savePron) window.PEWE.savePron(db).catch((e) => console.warn('Cloud save failed', e));
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && cloudTimer) flushCloud(); });

  const STAT_FIELDS = ['sayTries', 'sayOk', 'stressTries', 'stressOk'];
  function merge(a, b) {
    const out = { words: (a.words || []).map((w) => ({ ...w })), days: JSON.parse(JSON.stringify(a.days || {})) };
    (b.words || []).forEach((w) => {
      const x = out.words.find((y) => norm(y.text) === norm(w.text));
      if (!x) out.words.push({ ...w });
      else STAT_FIELDS.forEach((f) => { x[f] = Math.max(x[f] || 0, w[f] || 0); });
    });
    Object.entries(b.days || {}).forEach(([k, v]) => {
      const d = out.days[k] || (out.days[k] = {});
      ['tries', 'correct', 'score', 'newWords'].forEach((f) => { d[f] = Math.max(d[f] || 0, v[f] || 0); });
    });
    return out;
  }

  document.addEventListener('pewe-auth', async (e) => {
    const user = e.detail.user;
    clearTimeout(cloudTimer);
    cloudOK = false; cloudDictWords = [];
    if (user) {
      storeKey = STORE_KEY + ':' + user.uid;
      let cloud = null;
      try { cloud = await window.PEWE.load(); cloudOK = true; } catch (err) { console.warn('Could not load account data', err); }
      cloudDictWords = (cloud && cloud.words) || [];
      db = merge(merge((cloud && cloud.pron) || { words: [], days: {} }, load(storeKey)), load(STORE_KEY));
      try { localStorage.removeItem(STORE_KEY); } catch (err) { /* ignore */ }
      save();
      if (cloudOK) flushCloud();
    } else {
      storeKey = STORE_KEY;
      db = load(storeKey);
    }
    refresh();
  });

  function day() {
    const k = todayKey();
    return db.days[k] || (db.days[k] = { tries: 0, correct: 0, score: 0, newWords: 0 });
  }
  function record(word, kind, ok) {
    const d = day();
    d.tries++;
    if (ok) { d.correct++; d.score += POINTS; }
    if (word) {
      word[kind + 'Tries'] = (word[kind + 'Tries'] || 0) + 1;
      if (ok) word[kind + 'Ok'] = (word[kind + 'Ok'] || 0) + 1;
      word.last = Date.now();
    }
    save(); updateChip();
  }
  function updateChip() { $('chipScore').textContent = (db.days[todayKey()] || {}).score || 0; }
  function findWord(text) { return db.words.find((w) => norm(w.text) === norm(text)); }

  // ---------- pronunciation dictionary ----------
  const shards = {};
  function shard(ch) {
    const k = ch >= 'a' && ch <= 'z' ? ch : '0';
    if (!shards[k]) {
      shards[k] = fetch('data/' + k + '.txt').then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); }).then((t) => {
        const m = new Map();
        t.split('\n').forEach((line) => { const i = line.indexOf('\t'); if (i > 0) m.set(line.slice(0, i), line.slice(i + 1).split(';')); });
        return m;
      }).catch((e) => { delete shards[k]; throw e; });
    }
    return shards[k];
  }
  // -> array of variants; each variant = array of syllables {phones:[...], stress:0|1|2}
  async function prons(word) {
    const w = norm(word);
    if (!w) return [];
    if (ES) { const sy = window.ES_PRON ? window.ES_PRON.syllables(w) : []; return sy.length ? [sy] : []; } // Spanish: from the spelling
    const m = await shard(w[0]);
    const raw = m.get(w) || m.get(w.replace(/'/g, '')) || [];
    return raw.map((v) => v.split('.').map((s) => {
      const phones = s.split(' ');
      const vow = phones.find((p) => /\d$/.test(p)) || '';
      return { phones, stress: vow ? +vow.slice(-1) : 0 };
    }));
  }

  const IPA = { AA: 'ɑ', AE: 'æ', AO: 'ɔ', AW: 'aʊ', AY: 'aɪ', EH: 'ɛ', EY: 'eɪ', IH: 'ɪ', IY: 'i', OW: 'oʊ', OY: 'ɔɪ', UH: 'ʊ', UW: 'u',
    B: 'b', CH: 'tʃ', D: 'd', DH: 'ð', F: 'f', G: 'g', HH: 'h', JH: 'dʒ', K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ŋ', P: 'p', R: 'r',
    S: 's', SH: 'ʃ', T: 't', TH: 'θ', V: 'v', W: 'w', Y: 'j', Z: 'z', ZH: 'ʒ' };
  function ipaPhone(p) {
    const b = p.replace(/\d/, ''), s = p.slice(-1);
    if (b === 'AH') return s === '0' ? 'ə' : 'ʌ';
    if (b === 'ER') return s === '0' ? 'ɚ' : 'ɝ';
    return IPA[b] || '';
  }
  const ipaSyl = (syl) => (syl.ipa !== undefined ? syl.ipa : syl.phones.map(ipaPhone).join(''));
  const ipaWord = (sy) => sy.map((s) => (sy.length > 1 && s.stress === 1 ? 'ˈ' : sy.length > 1 && s.stress === 2 ? 'ˌ' : '') + ipaSyl(s)).join('');

  // "Sounds like" spelling for learners, e.g. pruh · nun · see · AY · shuhn
  const RES = { B: 'b', CH: 'ch', D: 'd', DH: 'dh', F: 'f', G: 'g', HH: 'h', JH: 'j', K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ng', P: 'p',
    R: 'r', S: 's', SH: 'sh', T: 't', TH: 'th', V: 'v', W: 'w', Y: 'y', Z: 'z', ZH: 'zh' };
  function respell(syl) {
    if (syl.text !== undefined) return syl.stress === 1 ? syl.text.toUpperCase() : syl.text; // Spanish: the written syllable
    const ph = syl.phones, vi = ph.findIndex((p) => /\d$/.test(p));
    const onset = vi > 0, coda = vi >= 0 && vi < ph.length - 1;
    const out = ph.map((p, i) => {
      if (i !== vi) return RES[p] || '';
      const b = p.replace(/\d/, '');
      switch (b) {
        case 'AA': return 'ah'; case 'AE': return 'a'; case 'AO': return 'aw'; case 'AW': return 'ow';
        case 'AY': return !onset ? 'eye' : coda ? 'igh' : 'y';
        case 'EH': return coda ? 'e' : 'eh'; case 'IH': return coda ? 'i' : 'ih';
        case 'EY': return 'ay'; case 'IY': return 'ee'; case 'OW': return 'oh'; case 'OY': return 'oy';
        case 'UH': return 'uu'; case 'UW': return 'oo'; case 'ER': return 'ur';
        case 'AH': return p.endsWith('0') || !coda ? 'uh' : 'u';
        default: return '';
      }
    }).join('');
    return syl.stress === 1 ? out.toUpperCase() : out;
  }

  // ---------- online dictionary (meaning + real US recording) ----------
  const extraCache = {};
  function extra(word) {
    const w = norm(word);
    if (ES) return Promise.resolve({ audioUS: '', ipa: '', meaning: '', pos: '', example: '' }); // the free dictionary is English only
    if (!extraCache[w]) {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
      extraCache[w] = fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(w), { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : [])).catch(() => []).then((j) => {
          clearTimeout(t);
          const out = { audioUS: '', ipa: '', meaning: '', pos: '', example: '' };
          (Array.isArray(j) ? j : []).forEach((e) => {
            (e.phonetics || []).forEach((p) => {
              if (!out.audioUS && p.audio && /-us\.mp3$/i.test(p.audio)) out.audioUS = p.audio;
              if (!out.ipa && p.text) out.ipa = p.text;
            });
            if (!out.meaning && e.meanings && e.meanings[0]) {
              const m = e.meanings[0], d = (m.definitions || [])[0] || {};
              out.meaning = d.definition || ''; out.pos = m.partOfSpeech || ''; out.example = d.example || '';
            }
          });
          return out;
        });
    }
    return extraCache[w];
  }

  // ---------- voices ----------
  const canSpeak = 'speechSynthesis' in window;
  const FEMALE = /\b(female|woman|zira|aria|jenny|michelle|ana|emma|ava|allison|samantha|susan|victoria|karen|kimberly|joanna|salli|ivy|kendra|nancy|sara|jane|amber|ashley|cora|elizabeth|monica|libby|sonia|natasha|google us english|helena|laura|elvira|abril|estrella|irene|laia|lia|triana|vera|ximena|mónica|marisol|paulina|lucía|lucia|conchita|google español|flo|sandy|shelley|grandma)\b/i;
  const MALE = /\b(male|man|david|mark|guy|davis|tony|jason|andrew|brian|eric|christopher|roger|steffan|ryan|thomas|daniel|alex|fred|aaron|tom|ralph|matthew|justin|joey|kevin|jacob|brandon|google uk english male|pablo|alvaro|álvaro|jorge|arnau|dario|darío|elias|elías|nil|saul|saúl|teo|juan|diego|enrique|carlos|raul|raúl|eddy|reed|rocko|grandpa)\b/i;
  // Voices for the language being practised (Spain Spanish: es-ES first, any Spanish voice if there is none)
  function usVoices() {
    if (!canSpeak) return [];
    const all = speechSynthesis.getVoices(), list = all.filter((v) => L.voiceRe.test(v.lang));
    return list.length ? list : all.filter((v) => L.anyVoiceRe.test(v.lang));
  }
  const NOVELTY = /\b(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox)\b/i;
  const quality = (v) => (/natural|online|neural/i.test(v.name) ? 3 : 0) + (/google/i.test(v.name) ? 1 : 0) - (NOVELTY.test(v.name) ? 5 : 0);
  function voiceFor(gender) {
    const list = usVoices();
    const isF = (v) => FEMALE.test(v.name) && !/\bmale\b/i.test(v.name);
    const isM = (v) => MALE.test(v.name) && !isF(v);
    const match = list.filter(gender === 'female' ? isF : isM).sort((a, b) => quality(b) - quality(a));
    if (match.length) return { voice: match[0], pitch: 1 };
    // No voice of that kind on this device: use another US voice with a higher or lower pitch.
    const any = list.sort((a, b) => quality(b) - quality(a))[0] || null;
    return { voice: any, pitch: gender === 'female' ? 1.3 : 0.65, fallback: true };
  }
  let slow = false;
  function say(text, gender = 'female') {
    if (!canSpeak || !text) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = voiceFor(gender);
    u.lang = L.bcp;
    if (v.voice) u.voice = v.voice;
    u.pitch = v.pitch;
    u.rate = slow ? 0.55 : 0.9;
    speechSynthesis.speak(u);
  }
  function voiceNote() {
    if (!canSpeak) return 'This browser cannot speak. Try Chrome or Edge.';
    const f = voiceFor('female'), m = voiceFor('male');
    if (!f.voice) return `No ${L.name} voice on this device. Try Microsoft Edge.`;
    const name = (x) => x.voice.name.replace(/^(Microsoft|Google)\s+/, '').replace(/\s*[-–(].*$/, '');
    let s = `👩 ${esc(name(f))} · 👨 ${esc(name(m))}`;
    if (f.fallback || m.fallback) s += ' · Edge has better voices.';
    return s;
  }
  if (canSpeak) speechSynthesis.addEventListener('voiceschanged', () => { const n = document.querySelector('.voice-note'); if (n) n.innerHTML = voiceNote(); });
  let audioEl = null;
  function playUrl(url) { if (audioEl) audioEl.pause(); audioEl = new Audio(url); audioEl.play().catch(() => {}); }

  // ---------- microphone: speech recognition + recording ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const canRecord = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  let mic = null; // { stop() }
  // Listens once. Resolves { heard: [alternatives], audio: blobURL|null, error }
  function listenOnce(onState) {
    return new Promise(async (resolve) => {
      let stream = null, rec = null, chunks = [], heard = [], confidence = 0, error = '', done = false, recDone = !canRecord;
      let audio = null;
      const finish = () => {
        if (done || !recDone) return;
        done = true; mic = null; onState('idle');
        resolve({ heard, audio, error, confidence });
      };
      const stopAll = () => {
        try { if (recog) recog.stop(); } catch (e) { /* ignore */ }
        try { if (rec && rec.state !== 'inactive') rec.stop(); else { recDone = true; finish(); } } catch (e) { recDone = true; finish(); }
        if (stream) stream.getTracks().forEach((t) => t.stop());
      };
      let recog = null;
      if (canRecord) {
        try {
          // auto gain off, so loud and soft syllables keep their difference
          stream = await navigator.mediaDevices.getUserMedia({ audio: { autoGainControl: false, noiseSuppression: true, echoCancellation: true } });
          rec = new MediaRecorder(stream);
          rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
          rec.onstop = () => { if (chunks.length) audio = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })); recDone = true; if (!recog) finish(); else if (recogEnded) finish(); };
          rec.start();
        } catch (e) {
          recDone = true;
          return resolve({ heard: [], audio: null, error: 'not-allowed' });
        }
      }
      let recogEnded = !SR;
      if (SR) {
        recog = new SR();
        recog.lang = L.bcp; recog.maxAlternatives = 5; recog.interimResults = false; recog.continuous = false;
        recog.onresult = (e) => { const alts = Array.from(e.results[0] || []); heard = alts.map((a) => a.transcript); confidence = alts[0] ? alts[0].confidence || 0 : 0; };
        recog.onerror = (e) => { error = e.error; };
        recog.onend = () => { recogEnded = true; stopAll(); finish(); };
        try { recog.start(); } catch (e) { recogEnded = true; }
      } else {
        setTimeout(stopAll, 3500); // recording only: 3.5 seconds
      }
      mic = { stop: stopAll };
      onState('listening');
    });
  }
  // Did the learner say the word? Also accepts words that sound the same ("there" for "their").
  async function matches(target, heard) {
    const t = norm(target);
    const alts = heard.map(norm).filter(Boolean);
    if (alts.some((a) => a === t || a.replace(/[ -]/g, '') === t.replace(/[ -]/g, ''))) return true;
    if (t.includes(' ')) return false;
    try {
      const flat = (vs) => vs.map((v) => (ES ? v.map((s) => s.ipa).join('').replace(/β/g, 'b').replace(/ð/g, 'd').replace(/ɣ/g, 'ɡ') : v.map((s) => s.phones.join(' ')).join(' ').replace(/\d/g, '')));
      const tp = flat(await prons(t));
      for (const a of alts) {
        if (a.includes(' ')) continue;
        const ap = flat(await prons(a));
        if (ap.some((p) => tp.includes(p))) return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  // ---------- voice analysis: syllables and stress from the recording ----------
  // Finds the vowel parts of the recording (voiced, in the speech band), then compares the syllables'
  // loudness, pitch and length to see which one the learner stressed. Approximate: it looks at stress
  // and syllables, not at single sounds. Tested on 24 recordings (2 voices x 12 words): 22 right.
  async function decode(url) {
    const buf = await (await fetch(url)).arrayBuffer();
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    try { return await ctx.decodeAudioData(buf); } finally { if (ctx.close) ctx.close(); }
  }
  function toMono16k(ab) {
    const step = Math.max(1, Math.round(ab.sampleRate / 16000)), sr = ab.sampleRate / step;
    const n = Math.floor(ab.length / step), x = new Float32Array(n), ch = ab.numberOfChannels;
    for (let c = 0; c < ch; c++) {
      const d = ab.getChannelData(c);
      for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < step; k++) s += d[i * step + k] || 0; x[i] += s / step / ch; }
    }
    return { x, sr };
  }
  function biquad(x, sr, type, f0) {
    const w = 2 * Math.PI * f0 / sr, al = Math.sin(w) / (2 * 0.707), c = Math.cos(w);
    const [b0, b1, b2] = type === 'lp' ? [(1 - c) / 2, 1 - c, (1 - c) / 2] : [(1 + c) / 2, -(1 + c), (1 + c) / 2];
    const a0 = 1 + al, a1 = -2 * c, a2 = 1 - al, y = new Float32Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  }
  function pitchOf(x, start, len, sr) {
    const minLag = Math.floor(sr / 400), maxLag = Math.floor(sr / 70);
    if (start + len + maxLag >= x.length) return 0;
    let e0 = 0; for (let i = 0; i < len; i++) e0 += x[start + i] * x[start + i];
    if (e0 <= 1e-9) return 0;
    let best = 0, bestLag = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let c = 0, e1 = 0;
      for (let i = 0; i < len; i++) { const b = x[start + i + lag]; c += x[start + i] * b; e1 += b * b; }
      const r = c / Math.sqrt(e0 * e1 || 1);
      if (r > best) { best = r; bestLag = lag; }
    }
    return best > 0.45 ? sr / bestLag : 0;
  }
  function analyseSignal(x, sr, n) {
    const v = biquad(biquad(x, sr, 'hp', 300), sr, 'lp', 2500); // speech band, where vowels are strong
    const hop = Math.round(sr * 0.01), win = Math.round(sr * 0.03), pw = Math.round(sr * 0.04);
    const F = Math.max(0, Math.floor((x.length - pw - Math.floor(sr / 70)) / hop));
    const rms = new Float32Array(F), f0 = new Float32Array(F);
    for (let f = 0; f < F; f++) { let s = 0; for (let i = 0; i < win; i++) { const t = v[f * hop + i]; s += t * t; } rms[f] = Math.sqrt(s / win); }
    let mx0 = 0; rms.forEach((t) => { if (t > mx0) mx0 = t; });
    for (let f = 0; f < F; f++) f0[f] = rms[f] > mx0 * 0.08 ? pitchOf(x, f * hop, pw, sr) : 0;
    const e = rms.map((t, f) => t * (f0[f] ? 1 : 0.25)); // vowels are voiced; s, f, t... count less
    const sm = e.map((_, f) => { let s = 0, k = 0; for (let j = f - 2; j <= f + 2; j++) if (j >= 0 && j < F) { s += e[j]; k++; } return s / k; });
    let max = 0; sm.forEach((t) => { if (t > max) max = t; });
    if (max < 0.002) return { quiet: true };
    let a = 0, b = F - 1;
    while (a < F && sm[a] < max * 0.1) a++;
    while (b > a && sm[b] < max * 0.1) b--;
    if (b - a < 8) return { quiet: true };
    // syllable centres: peaks separated by a real dip
    const peaks = [];
    for (let f = a + 1; f < b; f++) if (sm[f] >= sm[f - 1] && sm[f] > sm[f + 1] && sm[f] > max * 0.15) peaks.push(f);
    const merged = [];
    peaks.forEach((p) => {
      const q = merged[merged.length - 1];
      if (q === undefined) { merged.push(p); return; }
      let dip = Infinity; for (let f = q; f <= p; f++) dip = Math.min(dip, sm[f]);
      if (p - q < 8 || dip > 0.7 * Math.min(sm[p], sm[q])) { if (sm[p] > sm[q]) merged[merged.length - 1] = p; }
      else merged.push(p);
    });
    // use exactly n parts: keep the n strongest peaks, or split the longest parts if there are too few
    let chosen = merged.slice();
    if (chosen.length > n) chosen = chosen.map((p) => [p, sm[p]]).sort((u, w) => w[1] - u[1]).slice(0, n).map((u) => u[0]).sort((u, w) => u - w);
    const valley = (p, q) => { let m = p; for (let f = p; f <= q; f++) if (sm[f] < sm[m]) m = f; return m; };
    const bounds = [a];
    for (let i = 0; i + 1 < chosen.length; i++) bounds.push(valley(chosen[i], chosen[i + 1]));
    bounds.push(b);
    while (bounds.length - 1 < n) {
      let li = 0; for (let i = 1; i < bounds.length - 1; i++) if (bounds[i + 1] - bounds[i] > bounds[li + 1] - bounds[li]) li = i;
      bounds.splice(li + 1, 0, Math.round((bounds[li] + bounds[li + 1]) / 2));
    }
    const segs = [];
    for (let i = 0; i < n; i++) {
      const s0 = bounds[i], s1 = Math.max(bounds[i + 1], s0 + 1);
      let pk = 0; for (let f = s0; f < s1; f++) pk = Math.max(pk, sm[f]);
      let dur = 0; const ps = [];
      for (let f = s0; f < s1; f++) if (sm[f] > pk * 0.5 && f0[f]) { dur++; ps.push(f0[f]); }
      ps.sort((u, w) => u - w);
      segs.push({ loud: 20 * Math.log10(pk + 1e-9), dur, pitch: ps.length ? ps[Math.floor(ps.length / 2)] : 0 });
    }
    // stress score: loudness, pitch and length, each compared with the other syllables of the word
    const z = (key) => {
      const vals = segs.map((s) => s[key]), ok = vals.filter((t) => t > 0 || key === 'loud');
      if (ok.length < 2) return vals.map(() => 0);
      const m = ok.reduce((p, q) => p + q, 0) / ok.length;
      const sd = Math.sqrt(ok.reduce((p, q) => p + (q - m) * (q - m), 0) / ok.length) || 1;
      return vals.map((t) => (t > 0 || key === 'loud' ? (t - m) / sd : 0));
    };
    const zl = z('loud'), zp = z('pitch'), zd = z('dur');
    segs.forEach((s, i) => { s.score = 0.35 * zl[i] + 0.35 * zp[i] + 0.3 * zd[i]; });
    const order = segs.map((s, i) => i).sort((u, w) => segs[w].score - segs[u].score);
    return { segs, heardCount: merged.length, stressed: order[0], margin: n > 1 ? segs[order[0]].score - segs[order[1]].score : 1 };
  }
  async function analyse(url, n) {
    const { x, sr } = toMono16k(await decode(url));
    return analyseSignal(x, sr, n);
  }
  window.__pewePronTest = { analyse }; // for developer checks

  // Score, chart and tips for one attempt.
  function feedbackHtml(syl, a, recognised, confidence) {
    const tips = [];
    let score = 0, parts = 0;
    if (recognised !== null) { parts++; score += recognised ? 1 : 0; }
    if (recognised === false) tips.push('I could not understand the word. Listen to the model again and say each sound clearly.');
    if (a && a.quiet) tips.push('Your recording was very quiet. Move closer to the microphone and speak up.');
    let chart = '';
    if (syl && syl.length > 1 && a && !a.quiet) {
      const n = syl.length, want = syl.findIndex((s) => s.stress === 1), got = a.stressed;
      const ok = got === want, R = (i) => esc(respell(syl[i]));
      const second = !ok && syl[got].stress === 2;
      parts += 2; score += 2 * (ok ? (a.margin > 0.4 ? 1 : 0.75) : second ? 0.5 : 0.15); // stress counts double
      if (ok && a.margin > 0.4) tips.push(`✓ Stress in the right place: <b>${R(want)}</b>.`);
      else if (ok) tips.push(`Almost: <b>${R(want)}</b> was your strongest syllable, but only a little. Make it clearly louder, longer and higher.`);
      else if (second) {
        tips.push(`You made <b>${R(got).toLowerCase()}</b> the strongest. It has a weaker stress; the main stress is on <b>${R(want)}</b>.`);
        tips.push(`Keep ${R(got).toLowerCase()} clear but lighter, and push <b>${R(want)}</b> more: louder, longer and higher.`);
      } else {
        tips.push(`You stressed the <b>${ordinal(got + 1)}</b> syllable (${R(got).toLowerCase()}), but the stress is on the <b>${ordinal(want + 1)}</b> (<b>${R(want)}</b>).`);
        tips.push(`Say <b>${R(want)}</b> louder, longer and a little higher, and make ${R(got).toLowerCase()} shorter and softer.`);
      }
      // (too few syllables is not reported: smooth, linked speech often hides the dips between them)
      if (a.heardCount >= n + 2) tips.push(`I heard more syllables than the word has (${n}). Don't add extra vowels between consonants.`);
      const weak = syl.map((s, i) => (i !== want && s.phones.some((p) => p === 'AH0' || p === 'ER0') ? i : -1)).filter((i) => i >= 0);
      if (weak.length && ok) tips.push(`Keep the weak syllable${weak.length > 1 ? 's' : ''} ${weak.map(R).join(', ')} short and relaxed (the /ə/ sound).`);
      const top = Math.max(...a.segs.map((s) => s.score)), bot = Math.min(...a.segs.map((s) => s.score));
      chart = `<div class="stress-chart">
        ${syl.map((s, i) => {
          const h = Math.round(20 + 80 * ((a.segs[i].score - bot) / ((top - bot) || 1)));
          return `<div class="sc-col"><div class="sc-bar-wrap"><div class="sc-bar${i === got ? ' got' : ''}${i === got && !ok ? (second ? ' half' : ' off') : ''}" style="height:${h}%"></div></div>
            <div class="sc-lbl${i === want ? ' want' : ''}">${R(i)}</div></div>`;
        }).join('')}
        </div><p class="hint sc-key">Bars: how strong you made each syllable. Coloured label: where the stress should be.</p>`;
    } else if (syl && syl.length === 1 && a && !a.quiet && recognised !== false) {
      tips.push('One-syllable word, so there is no stress to place. Make the vowel clear and full.');
    }
    if (recognised && confidence > 0) { parts++; score += Math.min(1, confidence / 0.9); }
    if (recognised && confidence > 0 && confidence < 0.6) tips.push('The word was understood, but not very clearly. Open your mouth more and slow down a little.');
    const pctScore = parts ? Math.round((score / parts) * 100) : null;
    const cls = pctScore >= 80 ? 'good' : pctScore >= 50 ? 'mid' : 'low';
    return `${pctScore !== null ? `<div class="pscore ${cls}"><span class="pscore-num">${pctScore}%</span><span class="pscore-lbl">match with the correct pronunciation</span></div>` : ''}
      ${chart}
      ${tips.length ? `<ul class="ptips">${tips.map((t) => `<li>${t}</li>`).join('')}</ul>` : ''}`;
  }

  function micMessage(error) {
    return {
      'not-allowed': 'Please allow the microphone for this site (click the lock icon in the address bar), then try again.',
      'service-not-allowed': 'Please allow the microphone for this site, then try again.',
      'no-speech': 'I did not hear anything. Click the microphone and say the word clearly.',
      'audio-capture': 'No microphone found.',
      network: 'Speech checking needs an internet connection.'
    }[error] || '';
  }

  // ---------- word details ----------
  async function lookup(text) {
    const tokens = norm(text).split(' ').filter(Boolean).slice(0, 5);
    const per = await Promise.all(tokens.map((t) => prons(t).catch(() => [])));
    return tokens.map((t, i) => ({ text: t, variants: per[i] }));
  }
  function sylChips(sy, hideStress) {
    return sy.map((s) => {
      const cls = hideStress ? 's0' : 's' + s.stress;
      const r = respell(s);
      return `<span class="syl ${cls}"><b>${esc(hideStress ? r.toLowerCase() : r)}</b><small>${esc(ipaSyl(s))}</small></span>`;
    }).join('<span class="syl-dot">·</span>');
  }
  function stressSentence(sy) {
    if (sy.length < 2) return 'One syllable.';
    const i = sy.findIndex((s) => s.stress === 1);
    const sec = sy.findIndex((s) => s.stress === 2);
    let t = `${sy.length} syllables · main stress on the <b>${ordinal(i + 1)}</b> syllable (<b>${esc(respell(sy[i]))}</b>)`;
    if (sec >= 0) t += ` · weaker stress on the ${ordinal(sec + 1)} (${esc(respell(sy[sec]))})`;
    return t + '.';
  }

  let current = null;
  async function showWord(text, { addToList = true, keep = false } = {}) {
    const el = $('detail');
    const clean = norm(text);
    if (!clean) return;
    el.classList.remove('hidden');
    el.innerHTML = '<p class="muted">Looking up…</p>';
    let parts;
    try { parts = await lookup(clean); } catch (e) {
      el.innerHTML = '<p class="hint">Could not load. Check your connection.</p>'; return;
    }
    const known = parts.every((p) => p.variants.length);
    current = { text: clean, parts };
    const ex = await extra(clean.split(' ').length === 1 ? clean : clean.split(' ')[0]).catch(() => ({}));
    const fullIpa = known ? '/' + parts.map((p) => ipaWord(p.variants[0])).join(' ') + '/' : (ex.ipa || '');
    const alts = parts.length === 1 && parts[0].variants.length > 1
      ? parts[0].variants.slice(1).map((v) => `<div class="alt-pron"><span class="muted">Also said:</span> <span class="ipa-sm">/${esc(ipaWord(v))}/</span> <span class="syls small">${sylChips(v)}</span></div>`).join('') : '';

    el.innerHTML = `
      <div class="pr-head">
        <div>
          <div class="pr-word">${esc(clean)}</div>
          <div class="ipa">${fullIpa ? esc(fullIpa) : '<span class="muted">No phonetics found</span>'} <span class="flag">${REGION_CODE}</span></div>
        </div>
      </div>
      ${known ? `<div class="syls">${parts.map((p) => sylChips(p.variants[0])).join('<span class="syl-gap"></span>')}</div>
        <p class="hint">${parts.length === 1 ? stressSentence(parts[0].variants[0]) : 'Stress is shown on each word.'}
        The <span class="stress-key">BIG</span> syllable is stressed: say it louder, longer and a little higher.</p>${alts}`
        : `<p class="hint">This word is not in the ${ES ? 'Spanish' : 'American'} pronunciation list${ex.ipa ? ', so the phonetics above come from an online dictionary' : ''}. You can still listen to it.</p>`}
      <div class="voice-row">
        <button class="btn primary" type="button" data-say="female">👩 Woman (${REGION})</button>
        <button class="btn primary" type="button" data-say="male">👨 Man (${REGION})</button>
        <label class="check slow-check"><input type="checkbox" id="slowBox" ${slow ? 'checked' : ''}> 🐢 Slow</label>
      </div>
      <p class="hint voice-note">${voiceNote()}</p>
      <h3 class="sub-h">Your turn</h3>
      ${SR || canRecord ? `<p class="hint">${SR ? 'Say the word to get a score and tips.' : 'Record and compare. (Scoring needs Chrome or Edge.)'}</p>
        <div class="row"><button class="btn mic-btn" type="button" id="dMic">🎙️ Say it</button></div>
        <div id="dMicResult" class="mic-result" aria-live="polite"></div>` : '<p class="hint">Recording is not supported in this browser. Try Chrome or Edge.</p>'}
      ${addToList ? '<p class="hint saved-note"></p>' : ''}`;

    $('slowBox').onchange = (e) => { slow = e.target.checked; };
    const micBtn = $('dMic');
    if (micBtn) micBtn.onclick = () => runMic(micBtn, $('dMicResult'), clean, (ok) => { const w = findWord(clean); if (w) record(w, 'say', ok); });

    if (addToList && (known || ex.ipa || keep)) {
      let w = findWord(clean);
      const note = el.querySelector('.saved-note');
      if (!w) {
        w = { id: uid(), text: clean, added: todayKey(), sayTries: 0, sayOk: 0, stressTries: 0, stressOk: 0 };
        db.words.push(w); day().newWords++; save(); updateChip();
        if (note) note.textContent = '✓ Added to My words, so you can practise it later.';
      } else if (note) note.textContent = '✓ Already in My words.';
    }
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-say]');
    if (b) { const t = b.closest('#prRun') ? (pr.queue[pr.i] || {}).text : current && current.text; say(t, b.dataset.say); }
  });

  // Shared microphone button behaviour. onResult(ok) is called once per attempt.
  async function runMic(btn, out, target, onResult) {
    if (mic) { mic.stop(); return; }
    if (canSpeak) speechSynthesis.cancel();
    out.innerHTML = '';
    const r = await listenOnce((state) => {
      btn.classList.toggle('on', state === 'listening');
      btn.textContent = state === 'listening' ? (SR ? '👂 Listening… (click to stop)' : '⏺ Recording… (click to stop)') : '🎙️ Say it again';
    });
    const play = r.audio ? `<button class="btn ghost small" type="button" data-play="${r.audio}">▶ My voice</button>` : '';
    const models = '<button class="btn ghost small" type="button" data-say="female">▶ Woman</button><button class="btn ghost small" type="button" data-say="male">▶ Man</button>';
    if (r.error && !r.heard.length && micMessage(r.error)) { out.innerHTML = `<p class="feedback wrong">${micMessage(r.error)}</p>${play ? `<div class="row">${play}</div>` : ''}`; return null; }
    let syl = null;
    if (!norm(target).includes(' ')) { try { syl = (await prons(target))[0] || null; } catch (e) { /* ignore */ } }
    let a = null;
    if (r.audio && syl) { try { a = await analyse(r.audio, syl.length); } catch (e) { console.warn('Analysis failed', e); } }
    const ok = SR ? await matches(target, r.heard) : null;
    if (SR && onResult) onResult(ok);
    const heard = r.heard[0] ? `“${esc(r.heard[0].trim())}”` : 'nothing clear';
    const head = !SR ? '' : ok ? `<p class="feedback right">✓ I heard ${heard}.</p>` : `<p class="feedback wrong">✗ I heard ${heard}.</p>`;
    out.innerHTML = `${head}${feedbackHtml(syl, a, ok, r.confidence)}<div class="row">${play}${models}</div>`;
    return ok;
  }
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-play]'); if (b) playUrl(b.dataset.play); });

  // ---------- spell check (same English word list as Dictation) ----------
  const wl = { list: null, set: null, loading: null };
  function loadList() {
    if (ES) return Promise.resolve(false); // Spanish: every spelling has a pronunciation, so no English word list
    if (!wl.loading) {
      wl.loading = fetch('../dictation/words.txt').then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then((t) => { wl.list = t.split(String.fromCharCode(10)).map((x) => x.trim()).filter(Boolean); wl.set = new Set(wl.list); return true; })
        .catch(() => { wl.loading = null; return false; });
    }
    return wl.loading;
  }
  // Typo distance (insert, delete, change, swap); stops early above max.
  function distance(a, b, max) {
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > max) return max + 1;
    let prev2 = null, prev = Array.from({ length: lb + 1 }, (_, j) => j), cur;
    for (let i = 1; i <= la; i++) {
      cur = new Array(lb + 1); cur[0] = i;
      let rowMin = i;
      for (let j = 1; j <= lb; j++) {
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        cur[j] = v; if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      prev2 = prev; prev = cur;
    }
    return prev[lb];
  }
  // Closest spellings first, more common words first; only words we have a pronunciation for.
  async function suggest(word, n = 5) {
    const max = word.length <= 4 ? 1 : word.length >= 9 ? 3 : 2;
    const found = [];
    wl.list.forEach((w, i) => { if (Math.abs(w.length - word.length) <= max) { const d = distance(word, w, max); if (d <= max) found.push({ w, d, i }); } });
    found.sort((x, y) => x.d - y.d || x.i - y.i);
    const out = [];
    for (const f of found.slice(0, 25)) {
      try { if ((await prons(f.w)).length) out.push(f.w); } catch (e) { /* ignore */ }
      if (out.length >= n) break;
    }
    return out;
  }
  async function unknownWords(text) {
    const bad = [];
    for (const t of norm(text).split(' ').filter(Boolean)) {
      let has = false;
      try { has = (await prons(t)).length > 0; } catch (e) { /* ignore */ }
      if (!has && !wl.set.has(t) && !wl.set.has(t.replace(/'s$/, ''))) bad.push(t);
    }
    return bad;
  }
  let acceptedSpelling = '';
  async function showSpellBox(text, word) {
    const box = $('spellBox');
    box.innerHTML = '<p class="muted">Looking for suggestions…</p>';
    box.classList.remove('hidden');
    const sugs = await suggest(word);
    box.innerHTML = `
      <p>⚠ <b>"${esc(word)}"</b> doesn't look like a correct English spelling.</p>
      ${sugs.length ? `<p class="muted">Did you mean:</p><div class="sugs">${sugs.map((s) => `<button type="button" class="btn ghost small sug" data-sug="${esc(s)}">${esc(s)}</button>`).join('')}</div>`
        : '<p class="muted">No suggestions found.</p>'}
      <div class="row" style="margin-top:0">
        <button type="button" class="btn ghost small" id="spellKeep">No, use "${esc(text)}"</button>
        <button type="button" class="btn ghost small" id="spellEdit">Edit it myself</button>
      </div>`;
    box.querySelectorAll('.sug').forEach((b) => b.addEventListener('click', () => {
      $('wordInput').value = norm($('wordInput').value).split(' ').map((t) => (t === word ? b.dataset.sug : t)).join(' ');
      box.classList.add('hidden');
      $('wordForm').requestSubmit();
    }));
    $('spellKeep').onclick = () => { acceptedSpelling = norm(text); box.classList.add('hidden'); $('wordForm').requestSubmit(); };
    $('spellEdit').onclick = () => { box.classList.add('hidden'); $('wordInput').focus(); $('wordInput').select(); };
  }
  $('wordInput').addEventListener('focus', loadList, { once: true });
  $('wordInput').addEventListener('input', () => $('spellBox').classList.add('hidden'));

  $('wordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = $('wordInput').value;
    if (!norm(text)) return;
    if (norm(text) !== acceptedSpelling) {
      const btn = $('wordAdd');
      btn.disabled = true; btn.textContent = 'Checking…';
      const ok = await loadList();
      const bad = ok ? await unknownWords(text) : [];
      btn.disabled = false; btn.textContent = 'Add word';
      if (bad.length) { showSpellBox(text, bad[0]); return; }
    }
    const keep = norm(text) === acceptedSpelling;
    acceptedSpelling = '';
    $('spellBox').classList.add('hidden');
    showWord(text, { keep });
  });

  // ---------- add a word by saying it ----------
  // The browser turns speech into text (Chrome/Edge). The learner confirms the word, picks another
  // guess, says it again, or types it.
  let sayRec = null;
  function hearWord() {
    return new Promise((resolve) => {
      const r = new SR();
      let alts = [], error = '';
      r.lang = L.bcp; r.maxAlternatives = 6; r.interimResults = false; r.continuous = false;
      r.onresult = (e) => { alts = Array.from(e.results[0] || []).map((a) => a.transcript); };
      r.onerror = (e) => { error = e.error; };
      r.onend = () => { sayRec = null; resolve({ alts, error }); };
      sayRec = r;
      try { r.start(); } catch (e) { sayRec = null; resolve({ alts: [], error: 'busy' }); }
    });
  }
  async function sayToAdd() {
    const btn = $('wordSay'), box = $('spellBox');
    if (sayRec) { sayRec.stop(); return; }
    if (canSpeak) speechSynthesis.cancel();
    box.classList.add('hidden');
    btn.classList.add('on'); btn.textContent = '👂 Listening… say one word';
    const { alts, error } = await hearWord();
    btn.classList.remove('on'); btn.textContent = '🎙️ Say a word';
    // unique guesses, at most 5 words each; words we know the pronunciation of come first
    const seen = new Set(), guesses = [];
    alts.map((a) => norm(a).split(' ').slice(0, 5).join(' ')).forEach((g) => { if (g && !seen.has(g)) { seen.add(g); guesses.push(g); } });
    const known = await Promise.all(guesses.map(async (g) => {
      try { return (await Promise.all(g.split(' ').map((t) => prons(t)))).every((v) => v.length); } catch (e) { return false; }
    }));
    const order = guesses.map((g, i) => ({ g, k: known[i], i })).sort((a, b) => (b.k - a.k) || (a.i - b.i)).map((x) => x.g);
    box.classList.remove('hidden');
    if (!order.length) {
      box.innerHTML = `<p>${esc(micMessage(error) || 'I could not catch a word. Click “Say a word” and say it clearly, or type it.')}</p>
        <div class="row" style="margin-top:0"><button type="button" class="btn ghost small" id="sayAgain">🎙️ Try again</button>
        <button type="button" class="btn ghost small" id="sayType">⌨️ Type it instead</button></div>`;
    } else {
      const [best, ...others] = order;
      box.innerHTML = `<p>🎙️ Did you say <b>“${esc(best)}”</b>?</p>
        <div class="row" style="margin-top:0"><button type="button" class="btn primary small heard-pick" data-w="${esc(best)}">✓ Yes, add “${esc(best)}”</button></div>
        ${others.length ? `<p class="muted" style="margin-top:12px">Or did you mean:</p><div class="sugs">${others.slice(0, 4).map((g) => `<button type="button" class="btn ghost small sug heard-pick" data-w="${esc(g)}">${esc(g)}</button>`).join('')}</div>` : ''}
        <div class="row" style="margin-top:6px"><button type="button" class="btn ghost small" id="sayAgain">🎙️ No, say it again</button>
        <button type="button" class="btn ghost small" id="sayType">⌨️ Type it instead</button></div>`;
    }
    box.querySelectorAll('.heard-pick').forEach((b) => { b.onclick = () => { $('wordInput').value = b.dataset.w; box.classList.add('hidden'); $('wordForm').requestSubmit(); }; });
    $('sayAgain').onclick = sayToAdd;
    $('sayType').onclick = () => { box.classList.add('hidden'); $('wordInput').focus(); $('wordInput').select(); };
  }
  if (SR) $('wordSay').onclick = sayToAdd;
  else $('wordSay').classList.add('hidden');

  // ---------- tabs ----------
  function showTab(name) {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + name));
    if (name === 'words') renderWords();
    if (name === 'practice') renderSetup();
  }
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));
  document.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.goto)));
  const show = (...ids) => ids.forEach((id) => $(id).classList.remove('hidden'));
  const hide = (...ids) => ids.forEach((id) => $(id).classList.add('hidden'));

  // ---------- practice ----------
  function dictationWords() {
    let local = [];
    try {
      const key = window.PEWE && window.PEWE.user ? DICT_KEY + ':' + window.PEWE.user.uid : DICT_KEY;
      local = (JSON.parse(localStorage.getItem(key) || 'null') || {}).words || [];
    } catch (e) { /* ignore */ }
    const seen = new Set(), out = [];
    [...cloudDictWords, ...local].forEach((w) => { const t = norm(w.text); if (t && !seen.has(t)) { seen.add(t); out.push(t); } });
    return out;
  }
  function sourceWords() {
    const src = $('prSource').value;
    const list = [];
    if (src !== 'dict') db.words.forEach((w) => list.push(w.text));
    if (src !== 'pron') dictationWords().forEach((t) => { if (!list.some((x) => norm(x) === t)) list.push(t); });
    return list;
  }
  const MODE_HINT = {
    say: SR ? 'Say each word. 3 tries per word.'
      : 'Scoring needs Chrome or Edge. You can still record yourself.',
    stress: 'Click the stressed syllable.'
  };
  function renderSetup() {
    const n = sourceWords().length;
    $('prEmpty').classList.toggle('hidden', n > 0);
    $('prModeHint').textContent = MODE_HINT[$('prMode').value];
  }
  ['prMode', 'prSource'].forEach((id) => $(id).addEventListener('change', renderSetup));

  const pr = { mode: 'say', queue: [], i: 0, right: 0, missed: [], tries: 0, answered: false };
  function accOf(text, mode) {
    const w = findWord(text);
    if (!w) return 0.5;
    const t = w[mode + 'Tries'] || 0;
    return t ? (w[mode + 'Ok'] || 0) / t : 0;
  }
  $('prForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    pr.mode = $('prMode').value;
    let words = sourceWords();
    if (!words.length) { renderSetup(); return; }
    if (pr.mode === 'stress') {
      // only words with 2+ syllables that are in the pronunciation list
      const ok = await Promise.all(words.map(async (t) => { try { const v = await prons(t); return v.length && v[0].length > 1 && !t.includes(' '); } catch (er) { return false; } }));
      words = words.filter((_, i) => ok[i]);
      if (!words.length) { $('prModeHint').textContent = 'No words with 2+ syllables yet.'; return; }
    }
    // weaker words first, with some shuffling
    words = words.map((t) => ({ t, k: accOf(t, pr.mode) + Math.random() * 0.5 })).sort((a, b) => a.k - b.k).map((x) => x.t);
    const c = $('prCount').value;
    words = c === 'all' ? words : words.slice(0, +c);
    pr.queue = words.map((t) => ({ text: t })); pr.i = 0; pr.right = 0; pr.missed = [];
    hide('prSetup', 'prDone'); show('prRun');
    step();
  });

  async function step() {
    const item = pr.queue[pr.i];
    pr.tries = 0; pr.answered = false;
    $('prCounter').textContent = `Word ${pr.i + 1} of ${pr.queue.length}`;
    $('prBar').style.width = pct(pr.i, pr.queue.length) + '%';
    $('prFeedback').textContent = ''; $('prFeedback').className = 'feedback';
    hide('prNext'); show('prSkip');
    const body = $('prBody');
    let v = [];
    try { v = await prons(item.text); } catch (e) { /* ignore */ }
    item.syl = v[0] || null;
    if (pr.mode === 'stress') {
      body.innerHTML = `<div class="target">${esc(item.text)}</div><p class="hint">Which syllable has the main stress?</p>
        <div class="syls pick">${item.syl.map((s, i) => `<button type="button" class="syl s0" data-i="${i}"><b>${esc(respell(s).toLowerCase())}</b><small>${esc(ipaSyl(s))}</small></button>`).join('<span class="syl-dot">·</span>')}</div>`;
      body.querySelectorAll('[data-i]').forEach((b) => { b.onclick = () => pickStress(+b.dataset.i); });
    } else {
      body.innerHTML = `<div class="target">${esc(item.text)}</div>
        ${item.syl ? `<div class="ipa center">/${esc(ipaWord(item.syl))}/</div><div class="syls center">${sylChips(item.syl)}</div>` : ''}
        <div class="row center"><button class="btn mic-btn" type="button" id="prMic">🎙️ Say it</button></div>
        <div id="prMicResult" class="mic-result center" aria-live="polite"></div>`;
      $('prMic').onclick = () => {
        // After the word is scored, the button still works for extra practice, but does not change the score.
        if (pr.answered) { runMic($('prMic'), $('prMicResult'), item.text, null); return; }
        runMic($('prMic'), $('prMicResult'), item.text, (ok) => {
          pr.tries++;
          const w = findWord(item.text);
          record(w, 'say', ok);
          if (ok) { if (pr.tries === 1) pr.right++; else if (!pr.missed.includes(item.text)) pr.missed.push(item.text); endWord(true); }
          else if (pr.tries >= SAY_TRIES) { if (!pr.missed.includes(item.text)) pr.missed.push(item.text); endWord(false); }
          else $('prFeedback').textContent = `Try ${pr.tries + 1} of ${SAY_TRIES}`;
        });
      };
    }
  }
  function pickStress(i) {
    if (pr.answered) return;
    const item = pr.queue[pr.i];
    const right = item.syl.findIndex((s) => s.stress === 1);
    const ok = i === right;
    record(findWord(item.text), 'stress', ok);
    if (ok) pr.right++; else pr.missed.push(item.text);
    const box = $('prBody').querySelector('.syls');
    box.innerHTML = sylChips(item.syl);
    box.classList.remove('pick');
    $('prFeedback').className = 'feedback ' + (ok ? 'right' : 'wrong');
    $('prFeedback').innerHTML = (ok ? '✓ Correct! ' : '✗ Not this one. ') + stressSentence(item.syl);
    say(item.text, Math.random() < 0.5 ? 'female' : 'male');
    endWord(ok, true);
  }
  function endWord(ok, keepMsg) {
    pr.answered = true;
    if (!keepMsg) {
      $('prFeedback').className = 'feedback ' + (ok ? 'right' : 'wrong');
      $('prFeedback').textContent = ok ? '✓ Well done!' : `The word is “${pr.queue[pr.i].text}”. Listen to it a few times and it will come back later.`;
      if (!ok) say(pr.queue[pr.i].text, 'female');
    }
    hide('prSkip'); show('prNext');
    $('prNext').textContent = pr.i + 1 < pr.queue.length ? 'Next word' : 'See results';
    $('prNext').focus();
  }
  $('prNext').onclick = () => { if (mic) mic.stop(); pr.i++; if (pr.i < pr.queue.length) step(); else finish(); };
  $('prSkip').onclick = () => { if (mic) mic.stop(); if (!pr.missed.includes(pr.queue[pr.i].text)) pr.missed.push(pr.queue[pr.i].text); pr.i++; if (pr.i < pr.queue.length) step(); else finish(); };
  $('prQuit').onclick = () => { if (mic) mic.stop(); hide('prRun'); show('prSetup'); renderSetup(); };
  $('prAgain').onclick = () => { hide('prDone'); show('prSetup'); renderSetup(); };
  function finish() {
    flushCloud();
    $('prBar').style.width = '100%';
    hide('prRun'); show('prDone');
    const n = pr.queue.length;
    $('prSummary').innerHTML = `
      <div class="big-num">${pct(pr.right, n)}%</div>
      <div class="line">${pr.right} of ${n} right${pr.mode === 'say' ? ' on the first try' : ''}.</div>
      <div class="line">Today's pronunciation score: <b>${(db.days[todayKey()] || {}).score || 0}</b> points.</div>
      ${pr.missed.length ? `<div class="missed">Practise these again: ${pr.missed.map((t) => `<span>${esc(t)}</span>`).join(' ')}</div>` : ''}`;
  }

  // ---------- my words ----------
  async function renderWords() {
    const q = norm($('wSearch').value);
    const list = db.words.filter((w) => !q || norm(w.text).includes(q)).sort((a, b) => (b.last || 0) - (a.last || 0) || String(b.added).localeCompare(String(a.added)));
    $('wCount').textContent = `(${db.words.length})`;
    $('wEmpty').classList.toggle('hidden', db.words.length > 0);
    const cell = (ok, t) => (t ? `<td class="${pct(ok, t) >= 80 ? 'acc-good' : 'acc-bad'}">${pct(ok, t)}% <span class="muted">(${t})</span></td>` : '<td class="muted">–</td>');
    const tb = $('wTable').querySelector('tbody');
    tb.innerHTML = list.map((w) => `<tr data-id="${esc(w.id)}" tabindex="0"><td><div class="w">${esc(w.text)}</div></td><td class="ipa-cell" data-ipa="${esc(w.text)}"></td>
      ${cell(w.sayOk, w.sayTries)}${cell(w.stressOk, w.stressTries)}<td><button class="del" type="button" data-del="${esc(w.id)}" title="Delete">✕</button></td></tr>`).join('');
    renderToday();
    for (const td of tb.querySelectorAll('[data-ipa]')) {
      const t = td.dataset.ipa;
      try {
        const parts = await lookup(t);
        td.textContent = parts.every((p) => p.variants.length) ? '/' + parts.map((p) => ipaWord(p.variants[0])).join(' ') + '/' : '';
        if (!td.textContent) extra(t).then((x) => { td.textContent = x.ipa || ''; });
      } catch (e) { /* ignore */ }
    }
  }
  $('wSearch').addEventListener('input', renderWords);
  $('wTable').addEventListener('click', (e) => {
    const del = e.target.closest('[data-del]');
    if (del) {
      const w = db.words.find((x) => x.id === del.dataset.del);
      if (w && confirm(`Delete “${w.text}” from My words?`)) { db.words = db.words.filter((x) => x !== w); save(); renderWords(); }
      return;
    }
    const tr = e.target.closest('tr[data-id]');
    if (tr) { const w = db.words.find((x) => x.id === tr.dataset.id); if (w) { showTab('word'); $('wordInput').value = w.text; $('spellBox').classList.add('hidden'); showWord(w.text); } }
  });
  $('wTable').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('tr[data-id]')) e.target.click(); });

  function renderToday() {
    const d = db.days[todayKey()] || {};
    $('tScore').textContent = d.score || 0;
    $('tAcc').textContent = d.tries ? pct(d.correct, d.tries) + '%' : '–';
    $('tTries').textContent = d.tries || 0;
    $('tNew').textContent = d.newWords || 0;
  }

  function refresh() {
    updateChip();
    if ($('tab-words').classList.contains('active')) renderWords();
    if ($('tab-practice').classList.contains('active')) renderSetup();
  }

  if (!SR) $('prMode').querySelector('[value=say]').textContent = 'Say the word (record and compare)';
  if (canSpeak) speechSynthesis.getVoices();
  refresh();
  const startWord = new URLSearchParams(location.search).get('w');
  if (startWord) { $('wordInput').value = startWord; showWord(startWord); }
})();
