/* Shadowing engine — Practice with Sharaf
 * Shared by the Shadowing page logic and the Vocabulary page's ⭐ Sentences: stress and the expected melody,
 * recording + speech recognition, word comparison, voice melody analysis, and the score with tips.
 * Copied from shadowing/app.js so that both pages score a try in exactly the same way.
 *   const SC = window.SHADOW_CORE(window.PEWE_L);
 *   SC.sentenceHtml(text), SC.expectedTune(text).why, await SC.speak(text, { box, voice, rate }),
 *   const r = await SC.listenOnce(maxSec); SC.stopMic(); const a = r.audio && await SC.analyse(r.audio);
 *   const { pct, html } = await SC.scoreTry({ text }, r.heard, a, SC.hasSR, 10);
 */
(function () {
  'use strict';
  const BASE = (document.currentScript && document.currentScript.src || '').replace(/shadow-core\.js(\?.*)?$/, '');
  window.SHADOW_CORE = function (L) {
  L = L || { code: 'en', name: 'English', bcp: 'en-US' };
  const ES = L.code === 'es';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clean = (s) => String(s || '').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();

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
      if (startsWh(t)) return { end: 'fall', why: ES ? 'This is a <b>question with a question word</b> (qué, dónde, cómo…): the voice <b>falls</b> at the end ↘.' : 'This is a <b>wh- question</b> (what, where, how…): the voice <b>falls</b> at the end ↘.' };
      if (ES) return { end: 'rise', why: 'This is a <b>yes/no question</b> (¿…?): the voice <b>rises</b> at the end ↗. In Spanish only the melody turns a sentence into a question.' };
      return { end: 'rise', why: AUX.has(first) ? 'This is a <b>yes/no question</b>: the voice <b>rises</b> at the end ↗.' : 'This is a question: the voice <b>rises</b> at the end ↗.' };
    }
    if (/[,;:]\s*$/.test(t) || !/[.!?]["'”’)\]]*\s*$/.test(t)) return { end: 'rise', soft: true, why: 'This part continues the sentence: keep your voice <b>up</b> (or a small rise ↗). Don\'t let it fall yet.' };
    if (/!\s*$/.test(t)) return { end: 'fall', why: 'This is an exclamation: strong stress, and the voice <b>falls</b> at the end ↘.' };
    return { end: 'fall', why: 'This is a <b>statement</b>: the voice <b>falls</b> at the end ↘.' };
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

  // Reads the text aloud, lighting up each word (spans .sw inside box). Resolves with the seconds it took.
  const canSpeak = 'speechSynthesis' in window;
  function speak(text, { box = null, voice = null, rate = 0.95 } = {}) {
    return new Promise((resolve) => {
      if (!canSpeak || !text) return resolve(0);
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(clean(text).replace(/[¿¡]/g, ''));
      if (voice) u.voice = voice;
      u.lang = L.bcp;
      u.rate = rate;
      const spans = box ? [...box.querySelectorAll('.sw')] : [];
      const lead = (clean(text).match(/^[¿¡]*/) || [''])[0].length; // ¿ ¡ are not read
      const mark = (i) => spans.forEach((s) => s.classList.toggle('now', +s.dataset.s <= i + lead && i + lead < +s.dataset.e));
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
      'not-allowed': 'Please allow the microphone for this site (click the lock icon in the address bar), then try again.',
      'service-not-allowed': 'Please allow the microphone for this site, then try again.',
      'no-speech': 'I did not hear anything. Try again and speak clearly.',
      'audio-capture': 'No microphone found.',
      network: 'Checking your speech needs an internet connection.'
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
  const stopMic = () => { if (mic) mic.stop(); };
  const micBusy = () => !!mic;

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
    if (!shards[k]) shards[k] = fetch(BASE + 'pronunciation/data/' + k + '.txt').then((r) => (r.ok ? r.text() : '')).catch(() => '').then((t) => {
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

  // Score of one try, with the words, the melody chart and tips.
  // points: shown when the score is 80% or more.
  async function scoreTry(s, heard, a, haveSR, points = 0) { // s = { text }; returns { pct, html } and saves nothing
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
    const cls = pct >= 80 ? 'good' : pct >= 50 ? 'mid' : 'low';
    return { pct, html: `
      ${pct !== null ? `<div class="pscore ${cls}"><span class="pscore-num">${pct}%</span><span class="pscore-lbl">match with the model${pct >= 80 && points ? ` · +${points} points` : ''}</span></div>` : ''}
      ${wordsHtml}${chart}
      ${tips.length ? `<ul class="ptips">${tips.map((t) => `<li>${t}</li>`).join('')}</ul>` : ''}
      ${!haveSR ? '<p class="hint">Word checking works in Chrome and Edge. Here you can still compare your melody and play back your voice.</p>' : ''}` };
  }

  return { core, wordsOf, FUNCTION, expectedTune, sentenceHtml, speak, listenOnce, stopMic, micBusy, micMessage, analyse, scoreTry,
    hasSR: !!SR, canRecord, canSpeak };
  };
})();
