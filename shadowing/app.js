/* Shadowing Practice — Practice with Sharaf (English or Spanish: window.PEWE_L, set by ../site.js)
 * The learner adds a sentence (typed or said), listens to an American voice, then repeats it.
 * The page checks the words (browser speech recognition, Chrome/Edge), the melody at the end of the
 * sentence (pitch from the recording), how lively the voice is, and the speed. Everything except the
 * speech recognition runs in the browser.
 * Guests: saved in this browser. Signed-in students: also saved to their account (field "shad").
 * A sentence with fav: true is one of the learner's favorites (the ⭐ Favorites tab).
 */
(() => {
  'use strict';

  const MAX_WORDS = 20;
  const POINTS = 10;          // per try with a match of 80% or more
  const L = window.PEWE_L || { code: 'en', name: 'English', bcp: 'en-US', accent: 'American', voiceRe: /^en[-_]US/i, anyVoiceRe: /^en\b/i };
  const ES = L.code === 'es';
  const lk = (k) => (window.PEWE_KEY ? window.PEWE_KEY(k) : k); // storage key for this language
  const STORE_KEY = lk('shadowing-v1');
  let storeKey = STORE_KEY;
  let cloudOK = false;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const clean = (s) => String(s || '').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();

  // ---------- storage ----------
  function load(key = storeKey) {
    try { const d = JSON.parse(localStorage.getItem(key) || 'null'); if (d) return { sentences: d.sentences || [], days: d.days || {}, videos: d.videos || [] }; } catch (e) { /* ignore */ }
    return { sentences: [], days: {}, videos: [] };
  }
  let db = load();
  let cloudTimer = null;
  function save() {
    try { localStorage.setItem(storeKey, JSON.stringify(db)); } catch (e) { /* ignore */ }
    if (window.PEWE && window.PEWE.user && cloudOK) { clearTimeout(cloudTimer); cloudTimer = setTimeout(flushCloud, 1500); }
  }
  function flushCloud() {
    clearTimeout(cloudTimer); cloudTimer = null;
    if (window.PEWE && window.PEWE.user && cloudOK && window.PEWE.saveShad) window.PEWE.saveShad(db).catch((e) => console.warn('Cloud save failed', e));
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && cloudTimer) flushCloud(); });
  const key = (t) => clean(t).toLowerCase().replace(/[^\p{L}\p{N}' ]/gu, '');
  function merge(a, b) {
    const out = { sentences: (a.sentences || []).map((s) => ({ ...s })), days: JSON.parse(JSON.stringify(a.days || {})), videos: (a.videos || []).map((v) => ({ ...v })) };
    // videos: the same video in both keeps the one practised last
    (b.videos || []).forEach((v) => {
      const k = out.videos.findIndex((x) => x.id === v.id);
      if (k < 0) out.videos.push({ ...v });
      else if ((v.at || 0) > (out.videos[k].at || 0)) out.videos[k] = { ...v };
    });
    (b.sentences || []).forEach((s) => {
      const x = out.sentences.find((y) => key(y.text) === key(s.text));
      if (!x) out.sentences.push({ ...s });
      else { if (s.fav) x.fav = true; x.tries = Math.max(x.tries || 0, s.tries || 0); x.best = Math.max(x.best || 0, s.best || 0); if ((s.lastAt || 0) > (x.lastAt || 0)) { x.last = s.last; x.lastAt = s.lastAt; } }
    });
    Object.entries(b.days || {}).forEach(([k, v]) => {
      const d = out.days[k] || (out.days[k] = {});
      ['tries', 'correct', 'score', 'newWords', 'sum'].forEach((f) => { d[f] = Math.max(d[f] || 0, v[f] || 0); });
    });
    return out;
  }
  document.addEventListener('pewe-auth', async (e) => {
    const user = e.detail.user;
    clearTimeout(cloudTimer); cloudOK = false;
    if (user) {
      storeKey = STORE_KEY + ':' + user.uid;
      let cloud = null;
      try { cloud = await window.PEWE.load(); cloudOK = true; } catch (err) { console.warn('Could not load account data', err); }
      db = merge(merge((cloud && cloud.shad) || { sentences: [], days: {}, videos: [] }, load(storeKey)), load(STORE_KEY));
      try { localStorage.removeItem(STORE_KEY); } catch (err) { /* ignore */ }
      save();
      if (cloudOK) flushCloud();
    } else { storeKey = STORE_KEY; db = load(storeKey); }
    refresh();
  });
  function day() { const k = todayKey(); return db.days[k] || (db.days[k] = { tries: 0, correct: 0, score: 0, newWords: 0, sum: 0 }); }
  function updateChip() { $('chipScore').textContent = (db.days[todayKey()] || {}).score || 0; }
  const findSentence = (t) => db.sentences.find((s) => key(s.text) === key(t));

  // ---------- words, stress and the expected melody ----------
  const FUNCTION_EN = new Set(('a an the and or but if so as at by for from in into of off on onto out over to up with about than then that this these those ' +
    'there here is are was were be been being am do does did have has had will would shall should can could may might must ' +
    'i you he she it we they me him her us them my your his its our their it\'s i\'m you\'re he\'s she\'s we\'re they\'re ' +
    'i\'ll you\'ll we\'ll i\'ve you\'ve we\'ve i\'d you\'d a.m. p.m. just').split(' '));
  // Spanish words that are normally unstressed in a sentence (articles, short prepositions, pronouns, que, y…)
  const FUNCTION_ES = new Set(('el la los las lo un una unos unas al del a de en con por para sin sobre entre hasta desde hacia ' +
    'y e o u ni que pero si se me te le les nos os mi mis tu tus su sus nuestro nuestra como cuando donde porque aunque mientras ' +
    'es son era fue soy eres ha he has han tan').split(' '));
  const FUNCTION = ES ? FUNCTION_ES : FUNCTION_EN;
  const WH = new Set(ES ? ['qué', 'quién', 'quiénes', 'cuál', 'cuáles', 'cómo', 'dónde', 'adónde', 'cuándo', 'cuánto', 'cuánta', 'cuántos', 'cuántas', 'por qué']
    : ['what', 'where', 'when', 'why', 'who', 'whom', 'whose', 'which', 'how']);
  const AUX = new Set(ES ? [] : ['do', 'does', 'did', 'is', 'are', 'was', 'were', 'am', 'can', 'could', 'will', 'would', 'should', 'shall', 'have', 'has', 'had', 'may', 'might', 'must',
    "don't", "doesn't", "didn't", "isn't", "aren't", "wasn't", "weren't", "can't", "couldn't", "won't", "wouldn't", "shouldn't", "haven't", "hasn't"]);
  const core = (w) => w.toLowerCase().replace(/[‘’]/g, "'").replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '');
  const wordsOf = (t) => clean(t).split(' ').filter((w) => core(w));
  // Does the sentence start with a question word (what, where… / qué, dónde, por qué…)?
  function startsWh(t) {
    const ws = clean(t).split(' ').map(core);
    return WH.has(ws[0]) || (ES && WH.has(ws[0] + ' ' + (ws[1] || '')));
  }
  function expectedTune(text) {
    const t = clean(text), first = core(t.split(' ')[0] || '');
    if (/\?\s*$/.test(t)) {
      if (startsWh(t)) return { end: 'fall', why: ES ? '<b>Question word</b> (qué, dónde…): voice <b>falls</b> ↘.' : '<b>Wh- question</b>: voice <b>falls</b> ↘.' };
      if (ES) return { end: 'rise', why: '<b>Yes/no question</b>: voice <b>rises</b> ↗.' };
      return { end: 'rise', why: AUX.has(first) ? '<b>Yes/no question</b>: voice <b>rises</b> ↗.' : '<b>Question</b>: voice <b>rises</b> ↗.' };
    }
    if (/[,;:]\s*$/.test(t) || !/[.!?]["'”’)\]]*\s*$/.test(t)) return { end: 'rise', soft: true, why: '<b>Unfinished</b>: keep your voice <b>up</b> ↗.' };
    if (/!\s*$/.test(t)) return { end: 'fall', why: '<b>Exclamation</b>: voice <b>falls</b> ↘.' };
    return { end: 'fall', why: '<b>Statement</b>: voice <b>falls</b> ↘.' };
  }
  function sentenceHtml(text) {
    const tune = expectedTune(text);
    const toks = clean(text).split(' ');
    let pos = 0;
    const src = clean(text);
    return toks.map((w, i) => {
      const start = src.indexOf(w, pos); pos = start + w.length;
      const c = core(w);
      const content = c && !FUNCTION.has(c);
      const comma = /,$/.test(w) && i < toks.length - 1 ? '<span class="tune-arrow small" title="Small rise: the sentence goes on">↗</span>' : '';
      const end = i === toks.length - 1 ? `<span class="tune-arrow" title="${tune.end === 'rise' ? 'Rise' : 'Fall'} at the end">${tune.end === 'rise' ? '↗' : '↘'}</span>` : '';
      return `<span class="sw${content ? ' content' : ''}" data-s="${start}" data-e="${start + w.length}">${esc(w)}</span>${comma}${end}`;
    }).join(' ');
  }

  // ---------- voices ----------
  const canSpeak = 'speechSynthesis' in window;
  const FEMALE = /\b(female|woman|zira|aria|jenny|michelle|ana|emma|ava|allison|samantha|susan|joanna|salli|ivy|kendra|nancy|sara|jane|amber|ashley|cora|elizabeth|monica|google us english|helena|laura|elvira|abril|estrella|irene|laia|lia|triana|vera|ximena|mónica|marisol|paulina|lucía|lucia|conchita|google español|flo|sandy|shelley|grandma)\b/i;
  // natural voices first; the Mac's joke voices (Grandma, Bubbles…) last
  const NOVELTY = /\b(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox)\b/i;
  const quality = (v) => (/natural|online|neural/i.test(v.name) ? 3 : 0) + (/google/i.test(v.name) ? 1 : 0) - (NOVELTY.test(v.name) ? 5 : 0);
  const VOICE_KEY = lk('pewe-shadow-voice');
  // Voices for the language being practised (Spain Spanish: es-ES first, any Spanish voice if there is none).
  function usVoices() {
    if (!canSpeak) return [];
    const all = speechSynthesis.getVoices();
    let list = all.filter((v) => L.voiceRe.test(v.lang));
    if (!list.length) list = all.filter((v) => L.anyVoiceRe.test(v.lang));
    return list.sort((a, b) => quality(b) - quality(a) || a.name.localeCompare(b.name));
  }
  const label = (v) => v.name.replace(/^(Microsoft|Google)\s+/, '').replace(/\s*-\s*(English|Spanish).*$/, '').replace(/\s*\(.*\)\s*$/, '') + (FEMALE.test(v.name) ? ' (woman)' : ' (man)') + (quality(v) >= 3 ? ' ★ natural' : '');
  function fillVoices() {
    const sel = $('voiceSel'), list = usVoices();
    let saved = ''; try { saved = localStorage.getItem(VOICE_KEY) || ''; } catch (e) { /* ignore */ }
    const cur = sel.value || saved;
    sel.innerHTML = list.map((v) => `<option value="${esc(v.name)}">${esc(label(v))}</option>`).join('') || '<option value="">Default voice</option>';
    if (list.some((v) => v.name === cur)) sel.value = cur;
    const natural = list.some((v) => quality(v) >= 3);
    $('voiceNote').innerHTML = !canSpeak ? 'This browser cannot speak. Try Edge or Chrome.'
      : natural ? '★ = natural voice.'
      : !list.length ? `No ${L.name} voice on this device. Try <b>Microsoft Edge</b>.`
      : 'Tip: <b>Microsoft Edge</b> has more natural voices.';
  }
  if (canSpeak) { speechSynthesis.addEventListener('voiceschanged', fillVoices); speechSynthesis.getVoices(); }
  $('voiceSel').addEventListener('change', () => { try { localStorage.setItem(VOICE_KEY, $('voiceSel').value); } catch (e) { /* ignore */ } });

  // Reads the sentence, lighting up each word as it is spoken. Resolves when the voice has finished.
  function speak(text, box = '#sShow') {
    return new Promise((resolve) => {
      if (!canSpeak || !text) return resolve(0);
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(clean(text));
      const v = usVoices().find((x) => x.name === $('voiceSel').value) || usVoices()[0];
      if (v) u.voice = v;
      u.lang = L.bcp;
      u.rate = $('slowBox').checked ? 0.7 : 0.95;
      const spans = [...document.querySelectorAll(box + ' .sw')];
      const mark = (i) => spans.forEach((s) => s.classList.toggle('now', +s.dataset.s <= i && i < +s.dataset.e));
      u.onboundary = (e) => { if (e.name === 'word' || e.name === undefined) mark(e.charIndex); };
      const t0 = performance.now();
      let done = false;
      const end = () => { if (done) return; done = true; spans.forEach((s) => s.classList.remove('now')); resolve((performance.now() - t0) / 1000); };
      u.onend = end; u.onerror = end;
      speechSynthesis.speak(u);
      setTimeout(end, 30000);
    });
  }

  // ---------- microphone: recognition + recording ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const canRecord = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  let mic = null;
  function micMessage(error) {
    return {
      'not-allowed': 'Allow the microphone (lock icon in the address bar), then try again.',
      'service-not-allowed': 'Allow the microphone, then try again.',
      'no-speech': 'I heard nothing. Try again.',
      'audio-capture': 'No microphone found.',
      network: 'Speech checking needs internet.'
    }[error] || '';
  }
  // Records once (and recognises, when the browser can). maxSec stops it in any case.
  function listenOnce(maxSec, { record = true } = {}) {
    return new Promise(async (resolve) => {
      let stream = null, rec = null, chunks = [], heard = '', error = '', audio = null;
      let recDone = !(record && canRecord), recogDone = !SR, finished = false, recog = null, timer = null;
      const finish = () => {
        if (finished || !recDone || !recogDone) return;
        finished = true; mic = null; clearTimeout(timer);
        if (stream) stream.getTracks().forEach((t) => t.stop());
        resolve({ heard, audio, error });
      };
      const stopAll = () => {
        try { if (recog) recog.stop(); } catch (e) { /* ignore */ }
        try { if (rec && rec.state !== 'inactive') rec.stop(); } catch (e) { recDone = true; }
        finish();
      };
      if (record && canRecord) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: { autoGainControl: false, noiseSuppression: true, echoCancellation: true } });
          rec = new MediaRecorder(stream);
          rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
          rec.onstop = () => { if (chunks.length) audio = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })); recDone = true; finish(); };
          rec.start();
        } catch (e) { return resolve({ heard: '', audio: null, error: 'not-allowed' }); }
      }
      if (SR) {
        recog = new SR();
        recog.lang = L.bcp; recog.interimResults = false; recog.continuous = false; recog.maxAlternatives = 1;
        recog.onresult = (e) => { heard = Array.from(e.results).map((r) => r[0].transcript).join(' '); };
        recog.onerror = (e) => { error = e.error; };
        recog.onend = () => { recogDone = true; try { if (rec && rec.state !== 'inactive') rec.stop(); } catch (e) { recDone = true; } finish(); };
        try { recog.start(); } catch (e) { recogDone = true; }
      }
      timer = setTimeout(stopAll, maxSec * 1000);
      mic = { stop: stopAll };
    });
  }

  // ---------- add a sentence ----------
  function countWords() {
    const n = wordsOf($('sText').value).length;
    $('sCount').textContent = n;
    $('sCount').parentElement.classList.toggle('over', n > MAX_WORDS);
  }
  $('sMax').textContent = MAX_WORDS;
  $('sText').addEventListener('input', () => { countWords(); $('sMsg').classList.add('hidden'); });
  function tidy(t) {
    t = clean(t);
    if (!t) return t;
    const lead = (t.match(/^[¿¡"“'(]*/) || [''])[0];
    t = lead + (t[lead.length] || '').toUpperCase() + t.slice(lead.length + 1);
    if (!/[.?!]["”')]*$/.test(t)) {
      const first = core(t.split(' ')[0]);
      const q = startsWh(t) || AUX.has(first) || /^¿/.test(t);
      t += q ? '?' : '.';
    }
    // Spanish questions and exclamations open with ¿ / ¡
    if (ES && /\?["”')]*$/.test(t) && !/¿/.test(t)) t = '¿' + t;
    if (ES && /!["”')]*$/.test(t) && !/¡/.test(t)) t = '¡' + t;
    return t;
  }
  function message(html) { $('sMsg').innerHTML = html; $('sMsg').classList.remove('hidden'); }
  $('sForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = clean($('sText').value);
    const n = wordsOf(raw).length;
    if (!n) return message('Please type a sentence first.');
    if (n > MAX_WORDS) return message(`Please keep it to ${MAX_WORDS} words or fewer (now ${n}). Shorter sentences are easier to shadow well.`);
    if (n < 2) return message('Please type a whole sentence. For single words, use the Pronunciation page.');
    const text = tidy(raw);
    $('sText').value = text; countWords();
    $('sMsg').classList.add('hidden');
    let s = findSentence(text);
    if (!s) { s = { id: uid(), text, added: todayKey(), tries: 0, best: 0, last: null }; db.sentences.push(s); day().newWords++; save(); updateChip(); }
    open(s);
  });
  let sayBusy = false;
  $('sSay').addEventListener('click', async () => {
    if (!SR) return message('Saying a sentence works in Chrome and Edge. Please type it instead.');
    if (sayBusy) { if (mic) mic.stop(); return; }
    sayBusy = true;
    if (canSpeak) speechSynthesis.cancel();
    const btn = $('sSay');
    btn.classList.add('on'); btn.textContent = '👂 Listening… (click to stop)';
    $('sMsg').classList.add('hidden');
    const r = await listenOnce(20, { record: false });
    sayBusy = false;
    btn.classList.remove('on'); btn.textContent = '🎙️ Say a sentence';
    if (!r.heard) return message(esc(micMessage(r.error) || 'I could not catch a sentence. Try again, or type it.'));
    const words = wordsOf(r.heard).slice(0, MAX_WORDS).join(' ');
    $('sText').value = tidy(words); countWords();
    message(`🎙️ I heard: <b>${esc(tidy(words))}</b><br><span class="muted">Check the text and fix it if needed. The end mark (. or ?) decides the melody. Then click “Add sentence”.</span>
      <div class="row" style="margin-top:8px"><button type="button" class="btn primary small" id="sUseHeard">✓ Yes, add it</button>
      <button type="button" class="btn ghost small" id="sSayAgain">🎙️ Say it again</button></div>`);
    $('sUseHeard').onclick = () => $('sForm').requestSubmit();
    $('sSayAgain').onclick = () => $('sSay').click();
  });

  // ---------- shadowing ----------
  let cur = null, queue = [], lastAudio = null;
  function open(s, { fromQueue = false } = {}) {
    cur = s;
    if (!fromQueue) queue = [];
    $('shadow').classList.remove('hidden');
    $('voiceSlotOne').appendChild($('voiceBox'));
    $('sShow').innerHTML = sentenceHtml(s.text);
    const tune = expectedTune(s.text);
    $('sTune').innerHTML = `${tune.why} <b>Bold</b> = stressed.`;
    $('sResult').innerHTML = ''; $('sStatus').textContent = '';
    $('sMine').classList.add('hidden');
    $('sNext').classList.toggle('hidden', !queue.length);
    favButton();
    fillVoices();
    $('shadow').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('sListen').addEventListener('click', () => { if (cur) speak(cur.text); });
  let running = false;
  $('sGo').addEventListener('click', async () => {
    if (!cur) return;
    if (running) { if (mic) mic.stop(); if (canSpeak) speechSynthesis.cancel(); return; }
    if (!SR && !canRecord) { $('sStatus').textContent = 'Recording is not supported in this browser. Try Chrome or Edge.'; return; }
    running = true;
    const go = $('sGo');
    go.classList.add('on');
    $('sResult').innerHTML = ''; $('sMine').classList.add('hidden');
    const along = $('alongBox').checked;
    const est = Math.max(2, wordsOf(cur.text).length * 0.45 * ($('slowBox').checked ? 1.4 : 1));
    let r;
    if (along) {
      go.textContent = '🗣️ Speak along now… (click to stop)';
      $('sStatus').textContent = 'Speak together with the voice.';
      const p = listenOnce(est * 2 + 6);
      await speak(cur.text);
      setTimeout(() => { if (mic) mic.stop(); }, 1500);
      r = await p;
      $('tDoneSpeak').classList.add('hidden');
    } else {
      go.textContent = '👂 Listen…';
      $('sStatus').textContent = 'Listen to the voice…';
      const modelSec = await speak(cur.text);
      go.textContent = '🎙️ Your turn! (click to stop)';
      $('sStatus').innerHTML = '<b>Your turn:</b> say the sentence now, the same way.';
      r = await listenOnce(Math.max(modelSec, est) * 2 + 4);
    }
    running = false;
    go.classList.remove('on'); go.textContent = '🔁 Listen, then repeat again';
    $('sStatus').textContent = '';
    if (lastAudio) URL.revokeObjectURL(lastAudio);
    lastAudio = r.audio;
    $('sMine').classList.toggle('hidden', !r.audio);
    if (r.error && !r.heard && micMessage(r.error)) { $('sResult').innerHTML = `<p class="feedback wrong">${esc(micMessage(r.error))}</p>`; return; }
    $('sStatus').textContent = 'Checking…';
    let a = null;
    if (r.audio) { try { a = await analyse(r.audio); } catch (e) { console.warn('Analysis failed', e); } }
    $('sStatus').textContent = '';
    $('sResult').innerHTML = (await scoreTry(cur, r.heard, a, !!SR)).html;
  });
  let audioEl = null;
  $('sMine').addEventListener('click', () => { if (!lastAudio) return; if (audioEl) audioEl.pause(); audioEl = new Audio(lastAudio); audioEl.play().catch(() => {}); });
  $('sNext').addEventListener('click', () => { const s = queue.shift(); if (s) open(s, { fromQueue: true }); });
  // ☆ / ★ on the shadowing card. The sentence must be in My sentences to be a favorite.
  function favButton() {
    const on = !!(cur && cur.fav);
    $('sFav').textContent = on ? '★ In favorites' : '☆ Add to favorites';
    $('sFav').classList.toggle('on-fav', on);
  }
  $('sFav').addEventListener('click', () => {
    if (!cur) return;
    let s = findSentence(cur.text);
    if (!s) { s = { id: uid(), text: cur.text, added: todayKey(), tries: 0, best: 0, last: null }; db.sentences.push(s); day().newWords++; }
    s.fav = !s.fav; cur = s;
    save(); favButton();
  });

  // ---------- comparing the words ----------
  const NUM = ES ? ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce']
    : ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  const plain = (w) => w.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Spanish: está = esta when comparing words
  const EXPAND = ES ? {} : { "i'm": 'i am', "you're": 'you are', "we're": 'we are', "they're": 'they are', "it's": 'it is', "that's": 'that is', "he's": 'he is', "she's": 'she is',
    "don't": 'do not', "doesn't": 'does not', "didn't": 'did not', "can't": 'can not', 'cannot': 'can not', "won't": 'will not', "isn't": 'is not', "aren't": 'are not',
    "i'll": 'i will', "you'll": 'you will', "we'll": 'we will', "i've": 'i have', "you've": 'you have', "we've": 'we have', "i'd": 'i would', "let's": 'let us', "what's": 'what is', "where's": 'where is' };
  // each target word -> list of comparable tokens
  function normToks(text) {
    return wordsOf(text).map((w) => {
      let c = core(w);
      if (/^\d+$/.test(c) && +c < NUM.length) c = NUM[+c];
      if (ES) c = plain(c);
      return (EXPAND[c] || c).split(' ');
    });
  }
  function compareWords(target, heard) {
    const T = normToks(target), H = normToks(heard).flat();
    const flat = [], owner = [];
    T.forEach((parts, i) => parts.forEach((p) => { flat.push(p); owner.push(i); }));
    // longest common subsequence
    const n = flat.length, m = H.length, L = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = flat[i] === H[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const hit = new Array(n).fill(false);
    let i = 0, j = 0;
    while (i < n && j < m) { if (flat[i] === H[j]) { hit[i] = true; i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++; }
    const ok = T.map(() => true);
    hit.forEach((h, k) => { if (!h) ok[owner[k]] = false; });
    const used = new Array(m).fill(false);
    { let a = 0, b = 0; while (a < n && b < m) { if (flat[a] === H[b]) { used[b] = true; a++; b++; } else if (L[a + 1][b] >= L[a][b + 1]) a++; else b++; } }
    return { ok, extra: Math.max(0, m - L[0][0]), unused: H.filter((h, k) => !used[k]) };
  }
  // Words that sound the same count as right ("sea" heard as "see"), using the Pronunciation page's US dictionary.
  const shards = {};
  async function sounds(word) {
    if (ES) return window.ES_PRON ? [window.ES_PRON.key(word)] : [];
    const w = word.toLowerCase(), k = w[0] >= 'a' && w[0] <= 'z' ? w[0] : '0';
    if (!shards[k]) shards[k] = fetch('../pronunciation/data/' + k + '.txt').then((r) => (r.ok ? r.text() : '')).catch(() => '').then((t) => {
      const m = new Map(); t.split(String.fromCharCode(10)).forEach((line) => { const i = line.indexOf(String.fromCharCode(9)); if (i > 0) m.set(line.slice(0, i), line.slice(i + 1).split(';').map((v) => v.replace(/[.\d]/g, '').replace(/ +/g, ' ').trim())); });
      return m;
    });
    return (await shards[k]).get(w) || [];
  }
  async function fixHomophones(target, cmp) {
    const toks = wordsOf(target);
    for (let i = 0; i < toks.length; i++) {
      if (cmp.ok[i] || !cmp.unused.length) continue;
      const a = await sounds(core(toks[i]));
      if (!a.length) continue;
      for (let j = 0; j < cmp.unused.length; j++) {
        const b = await sounds(cmp.unused[j]);
        if (b.some((x) => a.includes(x))) { cmp.ok[i] = true; cmp.unused.splice(j, 1); cmp.extra = Math.max(0, cmp.extra - 1); break; }
      }
    }
    return cmp;
  }

  // ---------- voice analysis: melody (pitch), liveliness, speed ----------
  async function decode(url) {
    const buf = await (await fetch(url)).arrayBuffer();
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    try { return await ctx.decodeAudioData(buf); } finally { if (ctx.close) ctx.close(); }
  }
  function toMono16k(ab) {
    const step = Math.max(1, Math.round(ab.sampleRate / 16000)), sr = ab.sampleRate / step;
    const n = Math.floor(ab.length / step), x = new Float32Array(n), ch = ab.numberOfChannels;
    for (let c = 0; c < ch; c++) { const d = ab.getChannelData(c); for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < step; k++) s += d[i * step + k] || 0; x[i] += s / step / ch; } }
    return { x, sr };
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
    return best > 0.5 ? sr / bestLag : 0;
  }
  function analyseSignal(x, sr) {
    const hop = Math.round(sr * 0.02), win = Math.round(sr * 0.04);
    const F = Math.max(0, Math.floor((x.length - win - Math.floor(sr / 70)) / hop));
    const rms = new Float32Array(F);
    for (let f = 0; f < F; f++) { let s = 0; for (let i = 0; i < win; i++) { const t = x[f * hop + i]; s += t * t; } rms[f] = Math.sqrt(s / win); }
    let max = 0; rms.forEach((t) => { if (t > max) max = t; });
    if (max < 0.003) return { quiet: true };
    let a = 0, b = F - 1;
    while (a < F && rms[a] < max * 0.08) a++;
    while (b > a && rms[b] < max * 0.08) b--;
    if (b - a < 10) return { quiet: true };
    const pts = [];
    for (let f = a; f <= b; f++) if (rms[f] > max * 0.12) { const p = pitchOf(x, f * hop, win, sr); if (p) pts.push({ t: (f - a) * hop / sr, hz: p }); }
    if (pts.length < 8) return { quiet: false, seconds: (b - a) * hop / sr, pts: [], noPitch: true };
    const hz = pts.map((p) => p.hz).sort((u, v) => u - v), med = hz[Math.floor(hz.length / 2)];
    let st = pts.map((p) => ({ t: p.t, s: 12 * Math.log2(p.hz / med) })).filter((p) => Math.abs(p.s) < 9); // drop octave errors
    st = st.map((p, i) => { const w = st.slice(Math.max(0, i - 2), i + 3).map((q) => q.s).sort((u, v) => u - v); return { t: p.t, s: w[Math.floor(w.length / 2)] }; });
    const mean = st.reduce((p, q) => p + q.s, 0) / st.length;
    const range = Math.sqrt(st.reduce((p, q) => p + (q.s - mean) * (q.s - mean), 0) / st.length);
    // melody at the end: the last voiced stretch (about the last word), and the step into it
    const runs = [];
    st.forEach((p, i) => { if (!i || p.t - st[i - 1].t > 0.07) runs.push([]); runs[runs.length - 1].push(p); });
    let last = runs.pop() || [];
    let prev = runs.pop() || [];
    if (last.length < 5 && prev.length) { last = prev.concat(last); prev = runs.pop() || []; }
    const avg = (arr) => arr.reduce((p, q) => p + q.s, 0) / arr.length;
    const n3 = Math.max(2, Math.min(4, Math.floor(last.length / 3)));
    const inside = avg(last.slice(-n3)) - avg(last.slice(0, n3));
    const step = prev.length >= 2 ? avg(last.slice(0, n3)) - avg(prev.slice(-n3)) : 0;
    const endMove = inside + 0.5 * step;
    const end = inside > 1 ? 'rise' : inside < -1 ? 'fall' : endMove > 1.5 ? 'rise' : endMove < -1.5 ? 'fall' : 'level';
    return { seconds: (b - a) * hop / sr, pts: st, range, endMove, end };
  }
  async function analyse(url) { const { x, sr } = toMono16k(await decode(url)); return analyseSignal(x, sr); }
  window.__peweShadowTest = { analyse, compareWords, expectedTune }; // for developer checks

  let markerN = 0;
  function contourSvg(a, want) {
    const mid = 'ah' + (++markerN);
    const W = 600, H = 120, P = 10;
    const tMax = a.pts[a.pts.length - 1].t || 1;
    const x = (t) => P + (W - 2 * P - 40) * (t / tMax), y = (s) => H / 2 - Math.max(-8, Math.min(8, s)) * (H / 2 - P) / 8;
    const segs = []; let curSeg = [];
    a.pts.forEach((p, i) => { if (i && p.t - a.pts[i - 1].t > 0.12) { segs.push(curSeg); curSeg = []; } curSeg.push(`${x(p.t).toFixed(1)},${y(p.s).toFixed(1)}`); });
    segs.push(curSeg);
    const ex = W - 30, ok = a.end === want;
    const arrow = want === 'rise' ? `M${ex - 14},${H / 2 + 18} L${ex + 10},${H / 2 - 18}` : `M${ex - 14},${H / 2 - 18} L${ex + 10},${H / 2 + 18}`;
    return `<svg class="contour" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Your voice's melody from start to end">
      <line x1="${P}" x2="${W - 40}" y1="${H / 2}" y2="${H / 2}" class="c-mid"/>
      ${segs.filter((s) => s.length > 1).map((s) => `<polyline points="${s.join(' ')}" class="c-line"/>`).join('')}
      <path d="${arrow}" class="c-want${ok ? ' ok' : ''}" marker-end="url(#${mid})"/>
      <defs><marker id="${mid}" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="c-head${ok ? ' ok' : ''}"/></marker></defs>
    </svg>`;
  }

  async function scoreTry(s, heard, a, haveSR) {
    const tune = expectedTune(s.text);
    const toks = wordsOf(s.text);
    const tips = [];
    let score = 0, parts = 0;
    let wordsHtml = '';
    if (haveSR) {
      const cmp = await fixHomophones(s.text, compareWords(s.text, heard || ''));
      const got = cmp.ok.filter(Boolean).length;
      parts += 5; score += 5 * (got / toks.length) * (cmp.extra > 2 ? 0.9 : 1);
      wordsHtml = `<div class="s-show small">${toks.map((w, i) => `<span class="sw ${cmp.ok[i] ? 'hit' : 'miss'}">${esc(w)}</span>`).join(' ')}</div>
        <p class="hint">I heard: “${esc(heard || '…')}”</p>`;
      const missed = toks.filter((w, i) => !cmp.ok[i]).map(core);
      if (!heard) tips.push('I could not understand the sentence. Listen again, then say it a bit slower and clearer.');
      else if (missed.length) {
        tips.push(`Words I did not hear clearly: ${missed.map((w) => `<b>${esc(w)}</b>`).join(', ')}.`);
        if (missed.some((w) => FUNCTION.has(w))) tips.push(ES ? 'Small words (de, la, que, en…) are short and quick in Spanish, but they are still said. Join them to the next word.' : 'Small words (to, the, a, of…) are short and quick in English, but they are still said. Link them to the next word.');
      } else tips.push('✓ All the words were clear.');
    }
    let chart = '';
    if (a && a.quiet) tips.push('Your recording was very quiet. Move closer to the microphone and speak up.');
    else if (a && a.noPitch) tips.push('I could not follow your voice melody. Speak a bit louder, in a quiet place.');
    else if (a) {
      parts += 3;
      const endOk = a.end === tune.end || (tune.soft && a.end === 'level');
      score += 3 * (endOk ? 1 : a.end === 'level' ? 0.4 : 0);
      if (endOk) tips.push(tune.soft ? '✓ Good: your voice stayed up, so the sentence sounds unfinished, as it should.' : `✓ Good melody at the end: your voice ${tune.end === 'rise' ? 'rose ↗' : 'fell ↘'}, as it should.`);
      else if (tune.soft) tips.push('Your voice fell here ↘, so it sounds like the end. This part goes on: keep your voice <b>up</b>.');
      else if (tune.end === 'fall') tips.push(a.end === 'rise' ? 'Your voice went <b>up</b> at the end ↗. In this sentence it should go <b>down</b> ↘ on the last stressed word, to sound finished and sure.' : 'Your voice stayed <b>flat</b> at the end. Let it <b>fall</b> ↘ on the last stressed word.');
      else tips.push(a.end === 'fall' ? 'Your voice went <b>down</b> at the end ↘. For a yes/no question, let it go <b>up</b> ↗ on the last word.' : 'Your voice stayed <b>flat</b> at the end. For this question, let it go <b>up</b> ↗ on the last word.');
      if (a.range < 1.6) tips.push(`Your voice sounds quite <b>flat</b>. ${ES ? 'Spanish' : 'American English'} goes up and down more: make the <b>bold</b> words higher and louder.`);
      parts += 2;
      const wps = toks.length / Math.max(0.5, a.seconds);
      if (wps < 1.5) { score += 1; tips.push('You spoke quite <b>slowly</b>. Try to keep up with the voice and link the words together.'); }
      else if (wps > 5) { score += 1; tips.push('You spoke very <b>fast</b>. Slow down a little and give the bold words more time.'); }
      else score += 2;
      chart = `<div class="contour-wrap">${contourSvg(a, tune.end)}</div>
        <p class="hint sc-key">Your voice melody, from start to end (up = higher). The arrow shows how the end should go: ${tune.end === 'rise' ? 'up ↗' : 'down ↘'}.</p>`;
    }
    const pct = parts ? Math.round((score / parts) * 100) : null;
    if (pct !== null) {
      s.tries = (s.tries || 0) + 1; s.best = Math.max(s.best || 0, pct); s.last = pct; s.lastAt = Date.now();
      const d = day(); d.tries++; d.sum = (d.sum || 0) + pct;
      if (pct >= 80) { d.correct++; d.score += POINTS; }
      save(); updateChip();
    }
    const cls = pct >= 80 ? 'good' : pct >= 50 ? 'mid' : 'low';
    return { pct, html: `
      ${pct !== null ? `<div class="pscore ${cls}"><span class="pscore-num">${pct}%</span><span class="pscore-lbl">match with the model${pct >= 80 ? ' · +10 points' : ''}</span></div>` : ''}
      ${wordsHtml}${chart}
      ${tips.length ? `<ul class="ptips">${tips.map((t) => `<li>${t}</li>`).join('')}</ul>` : ''}
      ${!haveSR ? '<p class="hint">Word checking needs Chrome or Edge.</p>' : ''}` };
  }


  // =====================================================
  // SHADOW A TEXT: paste or import a text; the page goes through it sentence by sentence on its own:
  // read the sentence, record the learner, score it, then move on to the next one.
  // =====================================================
  const MAX_TEXT_SENTENCES = 60;
  const ABBR = /\b(Mr|Mrs|Ms|Dr|Dra|Prof|Sr|Sra|Srta|Jr|St|vs|etc|e\.g|i\.e|U\.S|U\.K|a\.m|p\.m|No|Ud|Uds|Vd|Vds|pág|aprox|Avda|núm)\.$/i;
  // Split a text into sentences; long ones (more than MAX_WORDS) are cut at commas, or into even parts.
  function splitText(text) {
    const out = [];
    String(text || '').replace(/\r/g, '').split(/\n\s*\n|\n(?=\s*[-•*\d]+[.)]?\s)/).forEach((para) => {
      const flat = clean(para.replace(/\n/g, ' '));
      if (!flat) return;
      let buf = '';
      flat.split(' ').forEach((w) => {
        buf = buf ? buf + ' ' + w : w;
        if (/[.!?]["'”’)\]]*$/.test(w) && !ABBR.test(w.replace(/["'”’)\]]+$/, ''))) { out.push(buf); buf = ''; }
      });
      if (buf) out.push(buf);
    });
    const pieces = [];
    const cut = (s) => {
      const ws = s.split(' ');
      if (wordsOf(s).length <= MAX_WORDS) { pieces.push(s); return; }
      // the comma nearest the middle, keeping both halves at least 3 words
      let best = -1, bestD = Infinity;
      ws.forEach((w, i) => { if (/[,;:]$/.test(w) && i >= 2 && i <= ws.length - 4) { const d = Math.abs(i - ws.length / 2); if (d < bestD) { bestD = d; best = i; } } });
      if (best < 0) { const parts = Math.ceil(ws.length / 15), size = Math.ceil(ws.length / parts); for (let i = 0; i < ws.length; i += size) pieces.push(ws.slice(i, i + size).join(' ')); return; }
      cut(ws.slice(0, best + 1).join(' ')); cut(ws.slice(best + 1).join(' '));
    };
    out.forEach(cut);
    // very short bits (one word) join the one before
    const merged = [];
    pieces.forEach((p) => { if (wordsOf(p).length < 2 && merged.length) merged[merged.length - 1] += ' ' + p; else if (wordsOf(p).length) merged.push(p); });
    return merged;
  }
  function updateTextCount() {
    const n = splitText($('tText').value).length;
    $('tCount').textContent = n ? `${n} sentence${n === 1 ? '' : 's'}${n > MAX_TEXT_SENTENCES ? ` — only the first ${MAX_TEXT_SENTENCES} will be used` : ''}` : '';
  }
  $('tText').addEventListener('input', updateTextCount);
  $('tFile').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 200000) { $('tMsg').textContent = 'This file is too big. Please use a shorter text (a page or two).'; return; }
    $('tText').value = (await f.text()).replace(/\r/g, '').trim();
    $('tMsg').textContent = $('tText').value ? `Loaded “${f.name}”.` : 'This file has no text in it.';
    updateTextCount();
  });

  const run = { list: [], i: 0, active: false, paused: false, stopping: false, wait: null, results: [] };
  // Score table: one row per sentence with its own buttons; click a row to open its analysis.
  function rowsHtml(tag) {
    return run.list.map((t, k) => {
      const r = run.results[k], now = k === run.i && run.active;
      const cls = r == null ? '' : r.pct === null ? 'muted' : r.pct >= 80 ? 'acc-good' : 'acc-bad';
      const val = r == null ? (now ? '…' : '') : r.pct === null ? 'skipped' : r.pct + '%';
      const open = run.open === k && r && r.html;
      return `<tr class="${now ? 'sel' : ''}${open ? ' open' : ''}" data-k="${k}" title="${r && r.html ? 'Click to see the analysis' : ''}">
        <td>${k + 1}</td><td class="s-text">${esc(t)}${r && r.html ? ` <span class="muted">${open ? '▴' : '▾'}</span>` : ''}</td><td class="${cls}">${val}</td>
        <td class="row-acts">
          <button type="button" class="btn ghost small" data-act="listen" title="Listen to the voice">▶</button>
          <button type="button" class="btn ghost small" data-act="me" title="Hear my voice"${r && r.audio ? '' : ' disabled'}>🎧</button>
          <button type="button" class="btn ghost small" data-act="again" title="Repeat this sentence">🔁</button>
          <button type="button" class="btn ghost small" data-act="remove" title="${busyOn(k) ? 'This sentence is playing now. Skip it first.' : 'Remove from this text'}"${busyOn(k) ? ' disabled' : ''}>✕</button>
        </td></tr>${open ? `<tr class="row-detail"><td colspan="4">${r.html.replace(/ah(\d+)/g, 'ah$1' + tag)}</td></tr>` : ''}`;
    }).join('');
  }
  function renderRun() {
    $('tTable').querySelector('tbody').innerHTML = rowsHtml('run');
    const sum = $('tSumBody'); if (sum) sum.innerHTML = rowsHtml('sum');
    $('tProgress').textContent = `Sentence ${Math.min(run.i + 1, run.list.length)} of ${run.list.length}`;
    $('tBar').style.width = Math.round((run.results.filter((x) => x).length / run.list.length) * 100) + '%';
    $('tPause').textContent = run.paused ? '▶ Resume' : '⏸ Pause';
  }
  function playAudio(url) { if (!url) return; if (audioEl) audioEl.pause(); audioEl = new Audio(url); audioEl.play().catch(() => {}); }
  // Practise sentence k again: during a run it jumps there; after the run it does just that one, then returns to the results.
  function redoSentence(k) {
    run.results[k] = null; run.open = null;
    if (!run.active) {
      Object.assign(run, { active: true, paused: false, only: true, i: k });
      $('tDone').classList.add('hidden'); $('tRun').classList.remove('hidden');
      $('voiceSlotText').appendChild($('voiceBox'));
      loop(); return;
    }
    if (run.paused) { run.i = k; run.paused = false; loop(); return; }
    run.i = k;
    if (run.phase === 'wait') { run.redo = true; wake(); }
    else { run.redoNow = true; if (canSpeak) speechSynthesis.cancel(); if (mic) mic.stop(); }
  }
  // The sentence being read or recorded right now cannot be removed.
  const busyOn = (k) => run.active && !run.paused && run.phase === 'try' && k === run.i;
  // Remove sentence k from the text being shadowed (it is not deleted from My sentences).
  function removeFromRun(k) {
    if (busyOn(k) || !confirm(`Remove this sentence from the text?\n\n${run.list[k]}`)) return;
    run.list.splice(k, 1); run.results.splice(k, 1);
    if (k < run.i) run.i--;
    if (run.open === k) run.open = null; else if (run.open > k) run.open--;
    if (!run.list.length) { run.active = false; wake(); $('tRun').classList.add('hidden'); $('tDone').classList.add('hidden'); $('tSetup').classList.remove('hidden'); return; }
    if (run.active) renderRun(); else finishRun();
  }
  function onRows(e) {
    const tr = e.target.closest('tr[data-k]');
    if (!tr) return;
    const k = +tr.dataset.k, btn = e.target.closest('[data-act]');
    if (btn) {
      if (btn.dataset.act === 'listen') speak(run.list[k], '#none');
      else if (btn.dataset.act === 'remove') removeFromRun(k);
      else if (btn.dataset.act === 'me') playAudio((run.results[k] || {}).audio);
      else redoSentence(k);
      return;
    }
    if (run.results[k] && run.results[k].html) { run.open = run.open === k ? null : k; renderRun(); }
  }
  // waits that a button can cut short
  function sleep(ms) { return new Promise((res) => { run.wake = () => { clearTimeout(run.wait); run.wake = null; res(); }; run.wait = setTimeout(run.wake, ms); }); }
  const wake = () => { if (run.wake) run.wake(); };

  $('tStart').addEventListener('click', () => {
    let list = splitText($('tText').value);
    if (!list.length) { $('tMsg').textContent = 'Please paste or import a text first.'; return; }
    if (!SR && !canRecord) { $('tMsg').textContent = 'Recording is not supported in this browser. Try Chrome or Edge.'; return; }
    list = list.slice(0, MAX_TEXT_SENTENCES);
    Object.assign(run, { list, i: 0, active: true, paused: false, only: false, open: null, results: [] });
    $('tMsg').textContent = '';
    $('tSetup').classList.add('hidden'); $('tDone').classList.add('hidden'); $('tRun').classList.remove('hidden');
    $('voiceSlotText').appendChild($('voiceBox'));
    fillVoices();
    loop();
  });
  async function loop() {
    if (run.looping) return;
    run.looping = true;
    try { await loopBody(); } finally { run.looping = false; }
  }
  async function loopBody() {
    while (run.active && run.i < run.list.length) {
      while (!run.only && run.i < run.list.length && run.results[run.i]) run.i++; // already done: go on
      if (run.i >= run.list.length) break;
      if (run.paused) { renderRun(); $('tStatus').innerHTML = 'Paused. Click <b>Resume</b> to go on.'; return; }
      const text = run.list[run.i];
      renderRun();
      $('tShow').innerHTML = sentenceHtml(text);
      $('tTune').innerHTML = expectedTune(text).why;
      $('tResult').innerHTML = '';
      run.phase = 'try';
      const t = await shadowOnce(text, '#tShow', (html) => { $('tStatus').innerHTML = html; });
      if (!run.active) return;
      if (run.redoNow) { run.redoNow = false; continue; }
      if (t.fatal) { $('tStatus').innerHTML = ''; $('tResult').innerHTML = `<p class="feedback wrong">${esc(t.fatal)}</p>`; run.paused = true; renderRun(); return; }
      if (t.skipped) { run.results[run.i] = { pct: null }; $('tStatus').textContent = 'Skipped.'; }
      else {
        let s = $('tSave').checked ? findSentence(text) : null;
        if ($('tSave').checked && !s) { s = { id: uid(), text: /[.!?,;:]$/.test(text) ? text : text + '.', added: todayKey(), tries: 0, best: 0, last: null }; db.sentences.push(s); day().newWords++; }
        const res = await scoreTry(s || { text }, t.heard, t.a, !!SR);
        run.results[run.i] = { pct: res.pct, audio: t.audio, html: res.html };
        $('tResult').innerHTML = res.html;
        $('tStatus').textContent = '';
      }
      if (run.only) { run.only = false; run.i = run.list.length; finishRun(); return; }
      run.i++;
      renderRun();
      if (run.i >= run.list.length || !run.active) break;
      // short break to read the result, then the next sentence starts by itself
      run.phase = 'wait';
      $('tProgress').textContent = `Sentence ${run.i} of ${run.list.length} done`;
      const secs = +$('tGap').value;
      for (let k = secs; k > 0 && run.active && !run.paused && !run.redo; k--) { $('tStatus').innerHTML = `Next sentence in <b>${k}</b>…`; await sleep(1000); }
      run.redo = false;
    }
    if (run.active) finishRun();
  }
  // One try at a sentence: read it, record the learner, analyse. Shared by the text mode.
  async function shadowOnce(text, box, status) {
    const along = $('alongBox').checked;
    const est = Math.max(2, wordsOf(text).length * 0.45 * ($('slowBox').checked ? 1.4 : 1));
    let r;
    if (along) {
      status('🗣️ <b>Speak along</b> with the voice now.');
      $('tDoneSpeak').classList.remove('hidden');
      const p = listenOnce(est * 2 + 6);
      await speak(text, box);
      setTimeout(() => { if (mic) mic.stop(); }, 1500);
      r = await p;
      $('tDoneSpeak').classList.add('hidden');
    } else {
      status('👂 Listen…');
      const modelSec = await speak(text, box);
      if (!run.active || run.skipNow || run.redoNow) { run.skipNow = false; return { skipped: true }; }
      status('🎙️ <b>Your turn:</b> say it now, the same way.');
      $('tDoneSpeak').classList.remove('hidden');
      r = await listenOnce(Math.max(modelSec, est) * 2 + 4);
      $('tDoneSpeak').classList.add('hidden');
    }
    if (run.skipNow || run.redoNow) { run.skipNow = false; return { skipped: true }; }
    if (r.error === 'not-allowed' || r.error === 'service-not-allowed' || r.error === 'audio-capture') return { fatal: micMessage(r.error) };
    if (!r.heard && !r.audio) return { skipped: true };
    status('Checking…');
    let a = null;
    if (r.audio) { try { a = await analyse(r.audio); } catch (e) { console.warn('Analysis failed', e); } }
    if (!r.heard && a && a.quiet) return { skipped: true };
    return { heard: r.heard, a, audio: r.audio };
  }
  $('tPause').addEventListener('click', () => {
    if (!run.active) return;
    run.paused = !run.paused;
    renderRun();
    if (!run.paused) loop();
    else if (run.phase === 'wait') wake();
    else $('tStatus').innerHTML = 'Pausing after this sentence…';
  });
  $('tAgain').addEventListener('click', () => {
    if (!run.active) return;
    if (run.phase === 'wait' || run.paused) {
      // repeat the sentence that was just scored
      if (run.i > 0) { run.i--; run.results[run.i] = null; }
      run.redo = true; wake();
      if (run.paused) { run.paused = false; loop(); }
    } else {
      // start the current sentence again
      run.redoNow = true;
      if (canSpeak) speechSynthesis.cancel();
      if (mic) mic.stop();
    }
  });
  $('tSkip').addEventListener('click', () => {
    if (!run.active) return;
    if (run.phase === 'wait') { wake(); return; }
    run.skipNow = true;
    if (canSpeak) speechSynthesis.cancel();
    if (mic) mic.stop();
  });
  $('tStop').addEventListener('click', () => {
    run.active = false;
    wake();
    if (canSpeak) speechSynthesis.cancel();
    if (mic) mic.stop();
    finishRun();
  });
  $('tTable').addEventListener('click', onRows);
  $('tDoneSpeak').addEventListener('click', () => { if (mic) mic.stop(); });
  function finishRun() {
    run.active = false; run.only = false;
    $('tDoneSpeak').classList.add('hidden');
    flushCloud();
    $('tRun').classList.add('hidden'); $('tDone').classList.remove('hidden');
    const done = run.results.map((r, k) => ({ r, k })).filter((x) => x.r && x.r.pct !== null);
    const avg = done.length ? Math.round(done.reduce((p, x) => p + x.r.pct, 0) / done.length) : null;
    const weak = done.filter((x) => x.r.pct < 80);
    $('tSummary').innerHTML = `
      <div class="big-num">${avg === null ? '–' : avg + '%'}</div>
      <div class="line">Average match over ${done.length} sentence${done.length === 1 ? '' : 's'}${run.list.length > done.length ? ` (of ${run.list.length})` : ''}.</div>
      <div class="line">${done.filter((x) => x.r.pct >= 80).length} sentence(s) at 80% or more · today's shadowing score: <b>${(db.days[todayKey()] || {}).score || 0}</b> points.</div>
      <div class="table-wrap" style="margin-top:12px"><table class="click-rows score-rows"><thead><tr><th>#</th><th>Sentence</th><th>Match</th><th></th></tr></thead>
      <tbody id="tSumBody">${rowsHtml('sum')}</tbody></table></div>
      <p class="hint">Click a sentence to see its analysis.</p>`;
    $('tSumBody').onclick = onRows;
    $('tWeak').classList.toggle('hidden', !weak.length);
    $('tWeak').textContent = `Practise the ${weak.length} sentence${weak.length === 1 ? '' : 's'} under 80% again`;
    $('tWeak').onclick = () => {
      Object.assign(run, { list: weak.map((x) => run.list[x.k]), i: 0, active: true, paused: false, only: false, open: null, results: [] });
      $('tDone').classList.add('hidden'); $('tRun').classList.remove('hidden');
      loop();
    };
  }
  $('tNew').addEventListener('click', () => { $('tDone').classList.add('hidden'); $('tSetup').classList.remove('hidden'); });
  window.__peweShadowTest.splitText = splitText;

  // =====================================================
  // SHADOW A VIDEO: paste a YouTube link. The caption helper (worker/, a Cloudflare Worker) sends the
  // captions with their times; the page cuts them into sentences, plays each one from the video,
  // records the learner and scores the try. If the helper cannot get the captions, the learner pastes
  // YouTube's transcript instead.
  // =====================================================
  // The caption helper's address (see worker/). On this computer, a helper started with "npm run dev" is used.
  const CAPTIONS_API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://127.0.0.1:8787' : 'https://pewe-captions.practice-english-ehsan.workers.dev';
  const VIDEO_KEY = lk('pewe-shadow-video');
  const vid = { id: '', title: '', auto: false, sents: [], i: 0, results: [], busy: false, run: 0 };
  let yt = null, ytReady = null;

  function ytId(s) {
    s = String(s || '').trim();
    if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
    try {
      const u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s);
      const host = u.hostname.replace(/^(www\.|m\.|music\.)/, '');
      const id = host === 'youtu.be' ? u.pathname.slice(1).split('/')[0]
        : /^youtube(-nocookie)?\.com$/.test(host) ? (u.searchParams.get('v') || (u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/) || [])[1] || '') : '';
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
    } catch (e) { return ''; }
  }
  const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  // Caption pieces [{t, d, w}] -> sentences [{text, start, end}].
  // Each piece is cut into words with an estimated time. With punctuation (captions written by people)
  // sentences end at . ? !; automatic captions have none, so pauses in the speech end the sentence.
  function buildSentences(pieces) {
    const words = [];
    pieces.forEach((p, k) => {
      const txt = String(p.w || '').replace(/\[[^\]]*\]|\([^)]*\)|♪|>>+|^-\s*/g, ' ').replace(/\s+/g, ' ').trim();
      if (!txt) return;
      const next = pieces[k + 1];
      const end = Math.min(p.t + (p.d || 2), next && next.t > p.t ? next.t : Infinity);
      const ws = txt.split(' ');
      ws.forEach((w, i) => words.push({ w, t: p.t + ((end - p.t) * i) / ws.length, e: p.t + ((end - p.t) * (i + 1)) / ws.length }));
    });
    if (!words.length) return [];
    const punctuated = words.filter((x) => /[.?!]["'”’)]*$/.test(x.w)).length >= Math.max(1, words.length / 40);
    const out = [];
    let buf = [];
    const push = () => { if (buf.length) out.push(buf); buf = []; };
    words.forEach((x, i) => {
      buf.push(x);
      const next = words[i + 1], gap = next ? next.t - x.e : 9;
      const ends = punctuated ? /[.?!]["'”’)]*$/.test(x.w) && !ABBR.test(x.w.replace(/["'”’)]+$/, '')) : gap > 0.6 && buf.length >= 3;
      if (ends || (buf.length >= MAX_WORDS && (gap > 0.15 || /[,;:]$/.test(x.w))) || buf.length >= MAX_WORDS + 6) push();
    });
    push();
    // very short pieces join the sentence before when they follow it closely
    const merged = [];
    out.forEach((b) => { const last = merged[merged.length - 1]; if (last && b.length < 3 && last.length + b.length <= MAX_WORDS + 4 && b[0].t - last[last.length - 1].e < 0.8) last.push(...b); else merged.push(b); });
    return merged.map((b, k) => {
      let text = b.map((x) => x.w).join(' ');
      if (!ES) text = text.replace(/\bi\b/g, 'I').replace(/\bi'(m|ll|ve|d)\b/gi, "I'$1");
      text = punctuated ? text[0].toUpperCase() + text.slice(1) : tidy(text.replace(/[,;:]+$/, ""));
      const nextStart = merged[k + 1] ? merged[k + 1][0].t : Infinity;
      return { text, start: Math.max(0, b[0].t - 0.2), end: Math.min(b[b.length - 1].e + 0.35, nextStart + 0.1) };
    }).filter((s) => wordsOf(s.text).length >= 2);
  }

  // YouTube's "Show transcript" text: time lines ("1:23") followed by caption lines.
  function parseTranscript(raw) {
    const pieces = [];
    let t = null;
    String(raw || '').replace(/\r/g, '').split('\n').forEach((line) => {
      line = line.trim();
      if (!line) return;
      const m = line.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\s+(.*))?$/);
      if (m) {
        t = (+m[1] || 0) * 3600 + +m[2] * 60 + +m[3];
        if (m[4]) pieces.push({ t, w: m[4] });
        return;
      }
      if (/^\d+\s+(hours?|minutes?|seconds?)(,\s*\d+\s+(minutes?|seconds?))*$/i.test(line)) return; // screen-reader time label
      if (t === null) return;
      const last = pieces[pieces.length - 1];
      if (last && last.t === t) last.w += ' ' + line; else pieces.push({ t, w: line });
    });
    pieces.forEach((p, i) => { p.d = pieces[i + 1] ? Math.max(0.3, pieces[i + 1].t - p.t) : 4; });
    return pieces;
  }

  // ---- connected speech: how the sentence really sounds ----
  const REDUCE = [
    [/\bwant to\b/i, 'want to', 'wanna'], [/\bgoing to (?!the\b|a\b|school\b|work\b|bed\b)/i, 'going to', 'gonna'], [/\bgot to\b/i, 'got to', 'gotta'],
    [/\bhave to\b/i, 'have to', 'hafta'], [/\bhas to\b/i, 'has to', 'hasta'], [/\bkind of\b/i, 'kind of', 'kinda'], [/\bsort of\b/i, 'sort of', 'sorta'],
    [/\ba lot of\b/i, 'a lot of', 'a lotta'], [/\bout of\b/i, 'out of', 'outta'], [/\b(don't|do not) know\b/i, "don't know", 'dunno'],
    [/\blet me\b/i, 'let me', 'lemme'], [/\bgive me\b/i, 'give me', 'gimme'], [/\bdid you\b/i, 'did you', 'didja'], [/\bwould you\b/i, 'would you', 'wouldja'],
    [/\bcould you\b/i, 'could you', 'couldja'], [/\bdon't you\b/i, "don't you", 'doncha'], [/\bwhat do you\b/i, 'what do you', 'whaddaya'], [/\bgot you\b/i, 'got you', 'gotcha']
  ];
  const WEAK = { and: 'n', to: 'tə', of: 'əv', for: 'fər', can: 'kən', you: 'yə', your: 'yər', a: 'ə', the: 'thə', at: 'ət', from: 'frəm', was: 'wəz', are: 'ər' };
  const VOWEL = /^[aeiou]/i;
  function speechNotes(text) {
    if (ES) {
      // Spanish: linking between words, then the letters that sound different from English
      if (!window.ES_PRON) return [];
      const notes = window.ES_PRON.linkNotes(text);
      return notes.concat(window.ES_PRON.soundTips(wordsOf(text), 5 - notes.length)).slice(0, 5);
    }
    const notes = [], low = clean(text).toLowerCase();
    REDUCE.forEach(([re, from, to]) => { if (re.test(low)) notes.push(`<b>${esc(from)}</b> usually sounds like <span class="say">“${esc(to)}”</span> in fast American speech.`); });
    const ws = wordsOf(text).map(core);
    // flap T inside a word: water, better, city, little
    const flap = [...new Set(ws.filter((w) => /[aeiouy]r?tt?(?=[aouy]|i(?!on)|e(?!s?$))/.test(w) && !/^(at|it|to)$/.test(w) && w.length > 3))].slice(0, 3);
    if (flap.length) notes.push(`American T: in ${flap.map((w) => `<b>${esc(w)}</b>`).join(', ')} the <b>t</b> between vowels sounds like a quick soft <b>d</b> (<span class="say">“wa-der”</span> for water).`);
    // across words: T + vowel (get it -> ge-dit), then other consonant + vowel links
    const links = [];
    for (let i = 0; i < ws.length - 1 && links.length < 3; i++) {
      const a = ws[i], b = ws[i + 1];
      if (!a || !b || !VOWEL.test(b) || /^(a|i)$/.test(a)) continue;
      const B = b === 'i' ? 'I' : b;
      if (/[aeiour]t$/.test(a)) links.push(`<b>${esc(a)} ${esc(B)}</b> → <span class="say">“${esc(a.slice(0, -1))}-d${esc(B)}”</span>`);
      else if (/[bcdfgklmnprsvxz]$/.test(a) && !/'/.test(a)) links.push(`<b>${esc(a)}‿${esc(B)}</b>`);
    }
    if (links.length) notes.push(`Link the words, with no stop between them: ${links.join(', ')}.`);
    const weak = [...new Set(ws.filter((w) => WEAK[w]))].filter((w) => !/^(a|the)$/.test(w)).slice(0, 4);
    if (weak.length) notes.push(`Small words are short and weak: ${weak.map((w) => `<b>${esc(w)}</b> → <span class="say">${esc(WEAK[w])}</span>`).join(', ')}.`);
    const drop = ws.find((w, i) => /^(just|next|must|last|first|most|don't|can't)$/.test(w) && ws[i + 1] && !VOWEL.test(ws[i + 1]));
    if (drop) notes.push(`The <b>t</b> at the end of <b>${esc(drop)}</b> is often almost silent before a consonant.`);
    return notes.slice(0, 5);
  }
  window.__peweShadowTest.speechNotes = speechNotes;
  window.__peweShadowTest.buildSentences = buildSentences;
  window.__peweShadowTest.parseTranscript = parseTranscript;
  window.__peweShadowTest.video = () => vid; // for developer checks

  // ---- the YouTube player ----
  function loadYT() {
    if (ytReady) return ytReady;
    ytReady = new Promise((resolve, reject) => {
      if (window.YT && window.YT.Player) return resolve();
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => { ytReady = null; reject(new Error('YouTube player could not load')); };
      document.head.appendChild(s);
    });
    return ytReady;
  }
  async function makePlayer(id) {
    await loadYT();
    if (yt) { yt.cueVideoById(id); return; }
    await new Promise((resolve) => {
      yt = new YT.Player('vPlayer', { videoId: id, playerVars: { playsinline: 1, rel: 0, modestbranding: 1, cc_load_policy: 0 }, events: { onReady: resolve } });
    });
  }
  // Every action that uses the player (Speaker, Play then repeat, a row's ▶) gets its own number.
  // Starting a new action, Previous, Next or Stop changes the number, so an older action stops quietly
  // and never touches the player or the page again.
  const newRun = () => ++vid.run;
  const isRun = (n) => n === vid.run;
  function pausePlayer() { try { if (yt && yt.pauseVideo) yt.pauseVideo(); } catch (e) { /* ignore */ } }

  // Plays from..to, then pauses. Resolves true when the part has played (or the learner paused it),
  // false when it was stopped or the video did not start.
  function playPart(from, to, run) {
    return new Promise((resolve) => {
      if (!yt || !yt.seekTo) return resolve(false);
      if (canSpeak) speechSynthesis.cancel();
      if (audioEl) audioEl.pause();
      const rate = $('vSlow').checked ? 0.75 : 1;
      yt.setPlaybackRate(rate);
      yt.seekTo(from, true); yt.playVideo();
      const startBy = Date.now() + 12000, endBy = (to - from) / rate * 1000 + 4000;
      let started = 0;
      const tick = setInterval(() => {
        if (!isRun(run)) { clearInterval(tick); return resolve(false); } // a newer action owns the player now
        const t = yt.getCurrentTime(), st = yt.getPlayerState();
        if (!started) {
          // Right after a jump the player can still report the old time, so only count it as started
          // once it is really playing inside this sentence.
          if (st === 1 && t >= from - 1.5 && t < to) started = Date.now();
          else if (Date.now() > startBy) { clearInterval(tick); pausePlayer(); resolve(false); }
          return;
        }
        if (t >= to - 0.12 || st === 0 || st === 2 || Date.now() - started > endBy) { // stop a moment early: pausing takes a little time
          clearInterval(tick); pausePlayer();
          // wait until the player has really stopped, so the recording never hears the video
          const until = Date.now() + 800;
          const settle = setInterval(() => {
            if (!isRun(run) || yt.getPlayerState() !== 1 || Date.now() > until) { clearInterval(settle); resolve(isRun(run)); }
          }, 20);
        }
      }, 40);
    });
  }

  // ---- loading a video ----
  function vMsg(html) { $('vMsg').innerHTML = html; }
  $('vForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = ytId($('vLink').value);
    if (!id) return vMsg('Please paste a YouTube link, for example https://www.youtube.com/watch?v=…');
    const known = videoById(id);
    if (known) { $('vLink').value = ''; return startVideo(known); }
    if (!CAPTIONS_API) { $('vPasteBox').open = true; return vMsg('Finding the captions by link is not switched on yet. Please paste the transcript below.'); }
    $('vLoad').disabled = true; vMsg('Finding the sentences…');
    let data = null;
    try {
      const r = await fetch(`${CAPTIONS_API}/captions?v=${encodeURIComponent(id)}&lang=${L.code}`);
      data = await r.json();
    } catch (err) { data = { error: 'failed', message: 'Could not reach the caption helper.' }; }
    $('vLoad').disabled = false;
    if (data.error === 'no-captions') {
      $('vPasteBox').open = false;
      return vMsg(`${esc(data.message || `This video has no ${L.name} captions.`)}<br>Please try another video. Tip: on YouTube, videos with captions show a <b>CC</b> button, and in search you can choose <b>Filters → Subtitles/CC</b>.`);
    }
    if (data.error) { $('vPasteBox').open = true; return vMsg(`${esc(data.message || 'Could not get the captions.')} You can paste the transcript below instead.`); }
    startVideo({ id, title: data.title, auto: data.auto, sents: buildSentences(data.words) });
  });
  $('vUsePaste').addEventListener('click', () => {
    const id = ytId($('vLink').value);
    if (!id) return vMsg('Please paste the video link in the box above too, so the page can play the video.');
    const pieces = parseTranscript($('vPaste').value);
    if (pieces.length < 2) return vMsg('I could not find times in this transcript. Copy it from YouTube\'s “Show transcript” panel, with the times (like 0:12).');
    const known = videoById(id);
    startVideo({ id, title: known ? known.title : '', auto: false, sents: buildSentences(pieces), added: known && known.added, rounds: known ? known.rounds : 1, bestAvg: known ? known.bestAvg : null });
  });
  async function startVideo({ id, title, auto, sents, i = 0, results = [], added, rounds = 1, bestAvg = null }) {
    if (!sents.length) return vMsg('I could not find any sentences in this video.');
    Object.assign(vid, { id, title: title || 'YouTube video', auto, sents, i: Math.max(0, Math.min(i, sents.length - 1)), results: results.slice(), stop: false,
      added: added || todayKey(), rounds, bestAvg });
    vMsg('');
    $('vSetup').classList.add('hidden'); $('vLib').classList.add('hidden'); $('vRun').classList.remove('hidden');
    $('vTitle').textContent = vid.title;
    $('vAuto').textContent = `${sents.length} sentences${auto ? ' · automatic captions, some words may be wrong' : ''}`;
    saveVideo();
    showSentence();
    try { await makePlayer(id); } catch (err) { $('vStatus').textContent = 'The YouTube player could not load. Check your internet connection.'; return; }
    // a pasted transcript has no title: take the real one from the player
    if (vid.title === 'YouTube video') {
      const takeTitle = () => {
        try { const t = yt.getVideoData && yt.getVideoData().title; if (t && vid.id === id && vid.title === 'YouTube video') { vid.title = t; $('vTitle').textContent = t; saveVideo(); return true; } } catch (e) { /* ignore */ }
        return false;
      };
      if (!takeTitle()) setTimeout(takeTitle, 2500);
    }
  }

  // ---- My videos: every video is kept (with its sentences, place and scores) in the account ----
  const MAX_VIDEOS = 15;
  const r2 = (t) => Math.round(t * 100) / 100;
  const avgOf = (results) => { const v = (results || []).filter((r) => r && r.pct !== null && r.pct !== undefined); return v.length ? Math.round(v.reduce((a, r) => a + r.pct, 0) / v.length) : null; };
  function saveVideo() {
    if (!vid.id || !vid.sents.length) return;
    db.videos = db.videos || [];
    const entry = {
      id: vid.id, title: vid.title, auto: !!vid.auto, i: vid.i, at: Date.now(), added: vid.added || todayKey(),
      rounds: vid.rounds || 1, bestAvg: vid.bestAvg ?? null,
      sents: vid.sents.map((x) => ({ text: x.text, start: r2(x.start), end: r2(x.end) })),
      results: vid.sents.map((x, k) => (vid.results[k] ? { pct: vid.results[k].pct ?? null } : null))
    };
    db.videos = [entry, ...db.videos.filter((v) => v.id !== vid.id)].slice(0, MAX_VIDEOS);
    save();
  }
  // a video saved by the older version of this page (one video only) moves into the list
  (function moveOldVideo() {
    let v = null; try { v = JSON.parse(localStorage.getItem(VIDEO_KEY) || 'null'); } catch (e) { /* ignore */ }
    if (v && v.id && v.sents && v.sents.length) {
      db.videos = db.videos || [];
      if (!db.videos.some((x) => x.id === v.id)) { db.videos.push({ ...v, at: 1, added: todayKey(), rounds: 1, bestAvg: null }); save(); }
    }
    try { localStorage.removeItem(VIDEO_KEY); } catch (e) { /* ignore */ }
  })();
  function videoById(id) { return (db.videos || []).find((v) => v.id === id); }
  function renderVideoLib() {
    const list = [...(db.videos || [])].sort((a, b) => (b.at || 0) - (a.at || 0));
    $('vLib').classList.toggle('hidden', !list.length || !$('vRun').classList.contains('hidden'));
    $('vLibCount').textContent = list.length ? `(${list.length})` : '';
    $('vLibList').innerHTML = list.map((v) => {
      const done = (v.results || []).filter(Boolean).length, n = v.sents.length, avg = avgOf(v.results);
      const pct = Math.round((done / n) * 100), finished = done >= n;
      const when = v.at > 1 ? new Date(v.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
      return `<div class="vl-item" data-id="${esc(v.id)}">
        <img class="vl-thumb" src="https://i.ytimg.com/vi/${esc(v.id)}/mqdefault.jpg" alt="" loading="lazy">
        <div class="vl-main">
          <div class="vl-title">${esc(v.title || 'YouTube video')}</div>
          <div class="vl-meta muted">${finished ? '✓ Finished' : `Sentence ${Math.min(v.i + 1, n)} of ${n}`} · ${done} practised${avg !== null ? ` · average <b class="${avg >= 80 ? 'acc-good' : 'acc-bad'}">${avg}%</b>` : ''}${v.bestAvg != null ? ` · best round ${v.bestAvg}%` : ''}${(v.rounds || 1) > 1 ? ` · round ${v.rounds}` : ''}${when ? ` · ${when}` : ''}</div>
          <div class="progress vl-bar"><div class="bar" style="width:${pct}%"></div></div>
          <div class="row vl-acts">
            <button type="button" class="btn primary small" data-vact="go">${finished ? '▶ Open' : done || v.i ? '▶ Continue' : '▶ Start'}</button>
            <button type="button" class="btn ghost small" data-vact="new" title="Clear the scores and practise the whole video again">🔄 Start over</button>
            ${done && avg !== null && v.results.some((r) => r && r.pct !== null && r.pct < 80) ? '<button type="button" class="btn ghost small" data-vact="weak" title="Go to the first sentence under 80%">🎯 Weak sentences</button>' : ''}
            <button type="button" class="btn ghost small vl-del" data-vact="del" title="Remove this video from the list">✕</button>
          </div>
        </div>
      </div>`;
    }).join('');
  }
  // Start over: the scores are cleared, the round number goes up and the best round is kept.
  function restartEntry(v) {
    const avg = avgOf(v.results);
    return { ...v, i: 0, results: [], rounds: (v.rounds || 1) + 1, bestAvg: avg !== null && (v.results || []).filter(Boolean).length >= v.sents.length / 2 ? Math.max(v.bestAvg ?? 0, avg) : v.bestAvg ?? null };
  }
  $('vLibList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-vact]'), item = e.target.closest('.vl-item');
    if (!item) return;
    const v = videoById(item.dataset.id);
    if (!v) return;
    const act = btn ? btn.dataset.vact : (e.target.closest('.vl-thumb, .vl-title') ? 'go' : '');
    if (act === 'go') startVideo(v);
    else if (act === 'new') startVideo(restartEntry(v));
    else if (act === 'weak') { const k = v.results.findIndex((r) => r && r.pct !== null && r.pct < 80); startVideo({ ...v, i: k < 0 ? v.i : k }); }
    else if (act === 'del') {
      if (btn.dataset.sure) { db.videos = db.videos.filter((x) => x.id !== v.id); save(); renderVideoLib(); }
      else { btn.dataset.sure = '1'; btn.textContent = 'Remove?'; btn.classList.add('danger'); setTimeout(() => { if (btn.isConnected) { delete btn.dataset.sure; btn.textContent = '✕'; btn.classList.remove('danger'); } }, 3000); }
    }
  });
  $('vRestart').addEventListener('click', () => {
    cancelTry();
    const v = restartEntry({ ...vid, results: vid.results.map((r) => (r ? { pct: r.pct } : null)) });
    Object.assign(vid, { i: 0, results: [], rounds: v.rounds, bestAvg: v.bestAvg });
    saveVideo(); showSentence(); $('vStatus').textContent = `Round ${vid.rounds}: all scores cleared. Start again from the first sentence.`;
  });
  function offerResume() { renderVideoLib(); }

  // ---- one sentence ----
  function showSentence() {
    const s = vid.sents[vid.i];
    $('vProgress').textContent = `Sentence ${vid.i + 1} of ${vid.sents.length}`;
    $('vBar').style.width = Math.round((vid.results.filter(Boolean).length / vid.sents.length) * 100) + '%';
    $('vShow').innerHTML = sentenceHtml(s.text);
    $('vTune').innerHTML = `${expectedTune(s.text).why} <b>Bold</b> = stressed.`;
    $('vNotes').innerHTML = speechNotes(s.text).map((n) => `<li>${n}</li>`).join('');
    const r = vid.results[vid.i];
    $('vResult').innerHTML = r && r.html ? r.html : '';
    $('vMine').disabled = !(r && r.audio);
    $('vMine').title = r && r.audio ? 'Hear your last try' : 'Say the sentence first';
    $('vStatus').textContent = '';
    $('vPrev').disabled = vid.i === 0; $('vNext').disabled = vid.i >= vid.sents.length - 1;
    const f = findSentence(s.text);
    $('vFav').textContent = f && f.fav ? '★ In favorites' : '☆ Add to favorites';
    $('vFav').classList.toggle('on-fav', !!(f && f.fav));
    renderVideoList();
  }
  function renderVideoList() {
    $('vTable').querySelector('tbody').innerHTML = vid.sents.map((s, k) => {
      const r = vid.results[k], v = r ? (r.pct === null ? 'skipped' : r.pct + '%') : '';
      const cls = !r || r.pct === null ? 'muted' : r.pct >= 80 ? 'acc-good' : 'acc-bad';
      return `<tr data-k="${k}" class="${k === vid.i ? 'sel' : ''}"><td>${k + 1}</td><td class="muted">${mmss(s.start)}</td><td class="s-text">${esc(s.text)}</td><td class="${cls}">${v}</td>
        <td class="row-acts nowrap"><button type="button" class="btn listen-btn small" data-act="play" title="Listen to the speaker">▶</button><button type="button" class="btn voice-btn small" data-act="me" title="${r && r.audio ? 'Hear your voice' : 'Say it first'}"${r && r.audio ? '' : ' disabled'}>🎧</button></td></tr>`;
    }).join('');
    const sel = $('vTable').querySelector('tr.sel');
    if (sel) { const box = sel.closest('.v-list'); box.scrollTop = Math.max(0, sel.offsetTop - box.clientHeight / 2); }
  }
  function goTo(k) { cancelTry(); vid.i = Math.max(0, Math.min(vid.sents.length - 1, k)); saveVideo(); showSentence(); }
  // Stops whatever is going on (speaker, recording, waiting) and puts the buttons back at once.
  function cancelTry() {
    newRun();
    if (mic) mic.stop();
    pausePlayer();
    resetGo();
  }
  function resetGo() {
    vid.busy = false;
    $('vGo').classList.remove('on'); $('vGo').textContent = '🔁 Play, then repeat';
    $('vDoneSpeak').classList.add('hidden');
    if (/Next sentence in|Listen to|Your turn|Checking/.test($('vStatus').textContent)) $('vStatus').textContent = '';
  }
  // Speaker: plays one sentence from the video. Stops a try that is going on.
  async function playOnly(k) {
    cancelTry();
    const s = vid.sents[k];
    await playPart(s.start, s.end, newRun());
  }
  // Previous / Next go to the sentence and play it from the video right away.
  $('vPrev').addEventListener('click', () => { goTo(vid.i - 1); playOnly(vid.i); });
  $('vNext').addEventListener('click', () => { goTo(vid.i + 1); playOnly(vid.i); });
  $('vPlay').addEventListener('click', () => playOnly(vid.i));
  $('vTable').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-k]');
    if (!tr) return;
    const k = +tr.dataset.k, act = e.target.closest('[data-act]');
    if (act && act.dataset.act === 'me') { playAudio((vid.results[k] || {}).audio); return; }
    if (act && act.dataset.act === 'play') { playOnly(k); return; }
    goTo(k);
  });
  $('vChange').addEventListener('click', () => { cancelTry(); $('vRun').classList.add('hidden'); $('vSetup').classList.remove('hidden'); $('vLink').value = ''; $('vPaste').value = ''; $('vPasteBox').open = false; vMsg(''); offerResume(); });
  $('vMine').addEventListener('click', () => { if (vid.busy) cancelTry(); pausePlayer(); playAudio((vid.results[vid.i] || {}).audio); });
  $('vDoneSpeak').addEventListener('click', () => { if (mic) mic.stop(); });
  $('vSlow').addEventListener('change', () => { if (yt && yt.setPlaybackRate) yt.setPlaybackRate($('vSlow').checked ? 0.75 : 1); });
  $('vFav').addEventListener('click', () => {
    const text = vid.sents[vid.i].text;
    let s = findSentence(text);
    if (!s) { s = { id: uid(), text, added: todayKey(), tries: 0, best: 0, last: null }; db.sentences.push(s); day().newWords++; }
    s.fav = !s.fav; save(); updateChip(); showSentence();
  });

  // Play the sentence, record the learner, score; with "Go on by itself", continue with the next one.
  $('vGo').addEventListener('click', async () => {
    if (vid.busy) { cancelTry(); return; } // the green button also stops
    if (!SR && !canRecord) { $('vStatus').textContent = 'Recording is not supported in this browser. Try Chrome or Edge.'; return; }
    cancelTry(); // stops a Speaker play that may be going on
    const run = newRun();
    vid.busy = true;
    const go = $('vGo');
    go.classList.add('on');
    try {
      while (isRun(run)) {
        const k = vid.i, s = vid.sents[k];
        $('vResult').innerHTML = ''; $('vMine').disabled = true;
        go.textContent = '👂 Listen… (click to stop)'; $('vStatus').textContent = 'Listen to the speaker…';
        const played = await playPart(s.start, s.end, run);
        if (!isRun(run)) return;
        if (!played) { $('vStatus').textContent = 'The video did not start. Click ▶ on the video once, then try again.'; break; }
        go.textContent = '🎙️ Your turn! (click to stop)'; $('vStatus').innerHTML = '<b>Your turn:</b> say it now, the same way.';
        $('vDoneSpeak').classList.remove('hidden');
        const r = await listenOnce(Math.max(3, (s.end - s.start) / ($('vSlow').checked ? 0.75 : 1)) * 2 + 4);
        if (!isRun(run)) return; // stopped while recording: forget this try
        $('vDoneSpeak').classList.add('hidden');
        if (r.error && !r.heard && micMessage(r.error)) { $('vStatus').textContent = ''; $('vResult').innerHTML = `<p class="feedback wrong">${esc(micMessage(r.error))}</p>`; break; }
        $('vStatus').textContent = 'Checking…';
        let a = null;
        if (r.audio) { try { a = await analyse(r.audio); } catch (err) { console.warn('Analysis failed', err); } }
        if (!isRun(run)) return;
        const res = await scoreTry(findSentence(s.text) || { text: s.text }, r.heard, a, !!SR);
        vid.results[k] = { pct: res.pct, audio: r.audio, html: res.html };
        saveVideo();
        if (!isRun(run)) return;
        $('vStatus').textContent = '';
        $('vResult').innerHTML = res.html;
        $('vMine').disabled = !r.audio; $('vMine').title = 'Hear your last try';
        renderVideoList();
        $('vBar').style.width = Math.round((vid.results.filter(Boolean).length / vid.sents.length) * 100) + '%';
        if (!$('vOn').checked || vid.i >= vid.sents.length - 1) break;
        for (let n = 4; n > 0 && isRun(run); n--) { $('vStatus').innerHTML = `Next sentence in <b>${n}</b>… (click the green button to stop)`; await new Promise((res2) => setTimeout(res2, 1000)); }
        if (!isRun(run)) return;
        vid.i++; saveVideo(); showSentence();
      }
    } finally {
      if (isRun(run)) resetGo(); // an older run leaves the buttons to the newer one
      flushCloud();
    }
  });

  // ---------- my sentences ----------
  function showTab(name) {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + name));
    if (name === 'list') renderList();
    if (name === 'fav') renderFav();
    if (name === 'video') offerResume();
    if (name !== 'video' && vid.busy) cancelTry();
    if (name === 'text') updateTextCount();
  }
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));
  function renderList() {
    const q = key($('lSearch').value);
    const list = db.sentences.filter((s) => !q || key(s.text).includes(q)).sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0) || String(b.added).localeCompare(String(a.added)));
    $('lCount').textContent = `(${db.sentences.length})`;
    $('lEmpty').classList.toggle('hidden', db.sentences.length > 0);
    $('lPractise').classList.toggle('hidden', !db.sentences.length);
    const cell = (v) => (v === null || v === undefined || (!v && v !== 0) ? '<td class="muted">–</td>' : `<td class="${v >= 80 ? 'acc-good' : 'acc-bad'}">${v}%</td>`);
    $('lTable').querySelector('tbody').innerHTML = list.map((s) => `<tr data-id="${esc(s.id)}" tabindex="0"><td><div class="w s-text">${esc(s.text)}</div></td>
      ${s.tries ? cell(s.best) : '<td class="muted">–</td>'}${s.tries ? cell(s.last) : '<td class="muted">–</td>'}<td>${s.tries || 0}</td>
      <td class="nowrap">${starBtn(s)}<button class="del" type="button" data-del="${esc(s.id)}" title="Delete">✕</button></td></tr>`).join('');
    const d = db.days[todayKey()] || {};
    $('tScore').textContent = d.score || 0;
    $('tAvg').textContent = d.tries ? Math.round((d.sum || 0) / d.tries) + '%' : '–';
    $('tTries').textContent = d.tries || 0;
    $('tNew').textContent = d.newWords || 0;
  }
  $('lSearch').addEventListener('input', renderList);
  $('lTable').addEventListener('click', (e) => {
    if (toggleStar(e)) { renderList(); return; }
    const del = e.target.closest('[data-del]');
    if (del) {
      const s = db.sentences.find((x) => x.id === del.dataset.del);
      if (s && confirm(`Delete this sentence?\n\n${s.text}`)) { db.sentences = db.sentences.filter((x) => x !== s); save(); renderList(); }
      return;
    }
    const tr = e.target.closest('tr[data-id]');
    if (tr) { const s = db.sentences.find((x) => x.id === tr.dataset.id); if (s) { showTab('practise'); $('sText').value = s.text; countWords(); open(s); } }
  });
  $('lTable').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('tr[data-id]')) e.target.click(); });
  $('lPractise').addEventListener('click', () => {
    if (!db.sentences.length) return;
    queue = db.sentences.map((s) => ({ s, k: (s.tries ? (s.best || 0) / 100 : -1) + Math.random() * 0.3 })).sort((a, b) => a.k - b.k).map((x) => x.s);
    const first = queue.shift();
    showTab('practise'); $('sText').value = first.text; countWords();
    open(first, { fromQueue: true });
  });

  // ---------- favorites ----------
  const starBtn = (s) => `<button class="star${s.fav ? ' on' : ''}" type="button" data-star="${esc(s.id)}" title="${s.fav ? 'Remove from favorites' : 'Add to favorites'}" aria-pressed="${!!s.fav}">${s.fav ? '★' : '☆'}</button>`;
  // Handles a click on a ☆/★ button in a table. Returns true when it was one.
  function toggleStar(e) {
    const b = e.target.closest('[data-star]');
    if (!b) return false;
    const s = db.sentences.find((x) => x.id === b.dataset.star);
    if (s) { s.fav = !s.fav; save(); if (cur === s) favButton(); }
    return true;
  }
  const favs = () => db.sentences.filter((s) => s.fav);
  function renderFav() {
    const q = key($('fSearch').value), all = favs();
    // keep the order they were added in, so the learner's own list stays as they wrote it
    const list = all.filter((s) => !q || key(s.text).includes(q));
    $('fCount').textContent = `(${all.length})`;
    $('fEmpty').classList.toggle('hidden', all.length > 0);
    $('fPractise').classList.toggle('hidden', !all.length);
    const cell = (s, v) => (!s.tries || v === null || v === undefined ? '<td class="muted">–</td>' : `<td class="${v >= 80 ? 'acc-good' : 'acc-bad'}">${v}%</td>`);
    $('fTable').querySelector('tbody').innerHTML = list.map((s) => s.id === favEditing
      ? `<tr class="edit-row" data-edit="${esc(s.id)}"><td colspan="5">
          <textarea class="f-edit" rows="2" maxlength="300" aria-label="Edit the sentence">${esc(s.text)}</textarea>
          <div class="row" style="margin-top:6px; align-items:center">
            <button class="btn primary small" type="button" data-save="${esc(s.id)}">Save</button>
            <button class="btn ghost small" type="button" data-cancel="1">Cancel</button>
            <span class="f-edit-msg muted" aria-live="polite"></span>
          </div></td></tr>`
      : `<tr data-id="${esc(s.id)}" tabindex="0"><td><div class="w s-text">${esc(s.text)}</div></td>
      ${cell(s, s.best)}${cell(s, s.last)}<td>${s.tries || 0}</td>
      <td class="nowrap"><button class="star" type="button" data-editid="${esc(s.id)}" title="Edit this sentence">✎</button>${starBtn(s)}<button class="del" type="button" data-fdel="${esc(s.id)}" title="Delete this sentence">✕</button></td></tr>`).join('');
    const box = $('fTable').querySelector('.f-edit');
    if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
  }
  let favEditing = null;
  // Save an edited favorite. The scores stay with the sentence.
  function saveEdit(id) {
    const s = db.sentences.find((x) => x.id === id), row = $('fTable').querySelector('.edit-row');
    if (!s || !row) return;
    const say = (t) => { row.querySelector('.f-edit-msg').textContent = t; };
    const raw = clean(row.querySelector('.f-edit').value), n = wordsOf(raw).length;
    if (n < 2) return say('Please write a sentence of two words or more.');
    if (n > MAX_WORDS) return say(`Please keep it to ${MAX_WORDS} words or fewer (now ${n}).`);
    const text = tidy(raw), other = findSentence(text);
    if (other && other !== s) return say(other.fav ? 'This sentence is already in your favorites.' : 'This sentence is already in My sentences. Star it there instead.');
    s.text = text;
    favEditing = null; save(); renderFav();
    if (cur === s) open(s);
  }
  $('fSearch').addEventListener('input', renderFav);
  $('fAdd').addEventListener('click', () => {
    // one sentence per line; a line with several sentences or more than 20 words is split
    const parts = $('fText').value.replace(/\r/g, '').split('\n').flatMap((line) => splitText(line)).map(tidy).filter((t) => wordsOf(t).length >= 2);
    if (!parts.length) { $('fMsg').textContent = 'Please type or paste at least one sentence (two words or more).'; return; }
    let added = 0, already = 0;
    parts.forEach((text) => {
      let s = findSentence(text);
      if (!s) { s = { id: uid(), text, added: todayKey(), tries: 0, best: 0, last: null }; db.sentences.push(s); day().newWords++; }
      if (s.fav) already++; else { s.fav = true; added++; }
    });
    save(); updateChip();
    $('fText').value = '';
    $('fMsg').textContent = `Added ${added} sentence${added === 1 ? '' : 's'} to your favorites.` + (already ? ` ${already} ${already === 1 ? 'was' : 'were'} already there.` : '');
    renderFav();
  });
  $('fTable').addEventListener('click', (e) => {
    if (toggleStar(e)) { renderFav(); return; }
    const fd = e.target.closest('[data-fdel]');
    if (fd) {
      const s = db.sentences.find((x) => x.id === fd.dataset.fdel);
      if (s && confirm(`Delete this sentence?\n\n${s.text}\n\nIt is removed from Favorites and My sentences, with its scores.`)) {
        db.sentences = db.sentences.filter((x) => x !== s); save(); renderFav();
      }
      return;
    }
    const ed = e.target.closest('[data-editid]');
    if (ed) { favEditing = ed.dataset.editid; renderFav(); return; }
    const sv = e.target.closest('[data-save]');
    if (sv) { saveEdit(sv.dataset.save); return; }
    if (e.target.closest('[data-cancel]')) { favEditing = null; renderFav(); return; }
    if (e.target.closest('.edit-row')) return;
    const tr = e.target.closest('tr[data-id]');
    if (tr) { const s = db.sentences.find((x) => x.id === tr.dataset.id); if (s) { showTab('practise'); $('sText').value = s.text; countWords(); open(s); } }
  });
  $('fTable').addEventListener('keydown', (e) => {
    if (e.target.matches('.f-edit')) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(favEditing); }
      else if (e.key === 'Escape') { favEditing = null; renderFav(); }
      return;
    }
    if (e.key === 'Enter' && e.target.matches('tr[data-id]')) e.target.click();
  });
  $('fPractise').addEventListener('click', () => {
    const all = favs();
    if (!all.length) return;
    queue = all.map((s) => ({ s, k: (s.tries ? (s.best || 0) / 100 : -1) + Math.random() * 0.3 })).sort((a, b) => a.k - b.k).map((x) => x.s);
    const first = queue.shift();
    showTab('practise'); $('sText').value = first.text; countWords();
    open(first, { fromQueue: true });
  });

  offerResume();
  function refresh() {
    updateChip();
    if ($('tab-list').classList.contains('active')) renderList();
    if ($('tab-fav').classList.contains('active')) renderFav();
    renderVideoLib();
    if (cur) { cur = findSentence(cur.text) || cur; favButton(); }
  }
  if (!SR) $('sSay').classList.add('hidden');
  fillVoices();
  countWords();
  refresh();
})();
