/* Vocabulary — Practice with Sharaf (English or Spanish: window.PEWE_L, set by ../site.js)
 * Only the learner's own words: their library, one per language (there are no built-in word lists).
 * Spanish: English meanings, IPA and stress (../spanish.js), a Spain voice.
 * English: the learner's own library, with American IPA and stress (../english.js) and English definitions.
 * Learn (word cards), Flashcards (words you miss come back sooner), Quiz (4 choices), Add word (type or say a word:
 * LanguageTool checks the spelling and suggests the closest words; MyMemory (Spanish) or dictionaryapi.dev (English)
 * suggests the meaning; the word goes to the learner's library).
 * Guests: saved in this browser. Signed-in students: also in their account (vocab / es.vocab, see ../account.js).
 * Library words keep the old field names: es = the word, en = its meaning.
 */
(() => {
  'use strict';

  const L = window.PEWE_L || { code: 'en', name: 'English', bcp: 'en-US', voiceRe: /^en[-_]US/i, anyVoiceRe: /^en\b/i };
  const ES = L.code === 'es';
  const $ = (id) => document.getElementById(id);

  const POINTS = 10;
  const MAX_BOX = 5;
  const STORE_KEY = window.PEWE_KEY ? window.PEWE_KEY('vocab-v1') : 'vocab-v1';
  let storeKey = STORE_KEY, cloudOK = false, cloudTimer = null;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const plain = (s) => clean(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ ]/g, '').trim();
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const show = (...ids) => ids.forEach((id) => $(id).classList.remove('hidden'));
  const hide = (...ids) => ids.forEach((id) => $(id).classList.add('hidden'));

  // ---------- words ----------
  // No built-in word lists: the learner's own library is the word list, in both languages.
  const TOPICS = [];
  const BUILT = [];
  const topicName = (id) => (id === 'mine' ? 'My library' : id === 'all' ? 'All topics' : (TOPICS.find((t) => t.id === id) || {}).name || id);

  // ---------- storage ----------
  // words: { [spanish]: { box, right, wrong, last } }, mine: [{ es, en, added }], days: { date: { tries, correct, score, newWords } }
  function load(key = storeKey) {
    try { const d = JSON.parse(localStorage.getItem(key) || 'null'); if (d) return { words: d.words || {}, mine: d.mine || [], sents: d.sents || [], days: d.days || {} }; } catch (e) { /* ignore */ }
    return { words: {}, mine: [], sents: [], days: {} };
  }
  let db = load();
  function save() {
    try { localStorage.setItem(storeKey, JSON.stringify(db)); } catch (e) { /* ignore */ }
    if (window.PEWE && window.PEWE.user && cloudOK) { clearTimeout(cloudTimer); cloudTimer = setTimeout(flushCloud, 1500); }
  }
  function flushCloud() {
    clearTimeout(cloudTimer); cloudTimer = null;
    if (window.PEWE && window.PEWE.user && cloudOK && window.PEWE.saveVocab) window.PEWE.saveVocab(db).catch((e) => console.warn('Cloud save failed', e));
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && cloudTimer) flushCloud(); });
  function merge(a, b) {
    const out = { words: JSON.parse(JSON.stringify(a.words || {})), mine: (a.mine || []).map((w) => ({ ...w })), sents: (a.sents || []).map((x) => ({ ...x })), days: JSON.parse(JSON.stringify(a.days || {})) };
    (b.sents || []).forEach((x) => {
      const y = out.sents.find((z) => plain(z.text) === plain(x.text));
      if (!y) out.sents.push({ ...x });
      else { y.tries = Math.max(y.tries || 0, x.tries || 0); y.best = Math.max(y.best || 0, x.best || 0); if ((x.last || 0) > (y.last || 0)) { y.last = x.last; y.lastPct = x.lastPct; } if (!y.en && x.en) y.en = x.en; }
    });
    Object.entries(b.words || {}).forEach(([k, v]) => {
      const x = out.words[k];
      if (!x || (v.last || 0) > (x.last || 0)) out.words[k] = { ...v, right: Math.max(v.right || 0, (x || {}).right || 0), wrong: Math.max(v.wrong || 0, (x || {}).wrong || 0) };
    });
    (b.mine || []).forEach((w) => { if (!out.mine.some((x) => plain(x.es) === plain(w.es))) out.mine.push({ ...w }); });
    Object.entries(b.days || {}).forEach(([k, v]) => {
      const d = out.days[k] || (out.days[k] = {});
      ['tries', 'correct', 'score', 'newWords'].forEach((f) => { d[f] = Math.max(d[f] || 0, v[f] || 0); });
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
      db = merge(merge((cloud && cloud.vocab) || { words: {}, mine: [], sents: [], days: {} }, load(storeKey)), load(STORE_KEY));
      try { localStorage.removeItem(STORE_KEY); } catch (err) { /* ignore */ }
      save();
      if (cloudOK) flushCloud();
    } else { storeKey = STORE_KEY; db = load(storeKey); }
    refresh();
  });
  function day() { const k = todayKey(); return db.days[k] || (db.days[k] = { tries: 0, correct: 0, score: 0, newWords: 0 }); }
  function updateChip() { $('chipScore').textContent = (db.days[todayKey()] || {}).score || 0; }
  const stat = (w) => db.words[w.es] || (db.words[w.es] = { box: 0, right: 0, wrong: 0, last: 0 });
  // A word moves up a box when known, back to box 0 when missed. Box 3 or more = learned.
  function mark(w, ok) {
    const s = stat(w), d = day();
    if (!s.last) d.newWords++;
    s.last = Date.now();
    d.tries++;
    if (ok) { s.right++; s.box = Math.min(MAX_BOX, (s.box || 0) + 1); d.correct++; d.score += POINTS; } else { s.wrong++; s.box = 0; }
    save(); updateChip();
  }
  const learned = (w) => ((db.words[w.es] || {}).box || 0) >= 3;
  const mineWords = () => db.mine.map((m) => ({ es: m.es, en: m.en, ipa: m.ipa, syl: m.syl, topic: 'mine', added: m.added || '' }));
  // every word once (a built-in word I also added counts once)
  const allWords = () => { const mine = mineWords(); return BUILT.filter((w) => !mine.some((m) => m.es === w.es)).concat(mine); };
  const practised = (w) => !!(db.words[w.es] || {}).last;
  // My library = the words I added + every word I have practised (Learn, Flashcards, Quiz)
  const libraryWords = () => { const mine = mineWords(); return mine.concat(BUILT.filter((w) => practised(w) && !mine.some((m) => m.es === w.es))); };
  const wordsOf = (topic) => (topic === 'all' ? allWords() : topic === 'mine' ? libraryWords() : BUILT.filter((w) => w.topic === topic));

  // ---------- sounds ----------
  // Sounds: Spanish from the spelling (ES_PRON); English from the American dictionary (EN_PRON), saved with the word.
  const P = window.ES_PRON;
  const tokens = (t) => clean(t).split(' ').map((w) => w.replace(/[^\p{L}']/gu, '')).filter(Boolean);
  // syllables -> [{ text, stress }] with { gap: true } between words
  function sylList(t) {
    if (!ES || !P) return [];
    const out = [];
    tokens(t).forEach((w, i) => { const sy = P.syllables(w); if (i) out.push({ gap: true }); sy.forEach((x) => out.push(sy.length > 1 ? x : { ...x, stress: 0 })); });
    return out;
  }
  const ipaText = (t) => (ES && P ? tokens(t).map((w) => P.ipa(w)).join(' ') : '');
  const ipaOf = (w) => { const i = typeof w === 'string' ? ipaText(w) : (w.ipa || ipaText(w.es)); return i ? '/' + i + '/' : ''; };
  function sylHtml(w) {
    const list = typeof w === 'string' ? sylList(w) : (w.syl && w.syl.length ? w.syl : sylList(w.es));
    let html = '', prevWord = false;
    list.forEach((s) => {
      if (s.gap) { html += '<i class="gap"> </i>'; prevWord = false; return; }
      html += (prevWord ? '<i>·</i>' : '') + `<span class="${s.stress ? 'v-stress' : ''}">${esc(s.stress ? s.text.toUpperCase() : s.text)}</span>`;
      prevWord = true;
    });
    return html;
  }

  // ---------- voice ----------
  const canSpeak = 'speechSynthesis' in window;
  const NOVELTY = /\b(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox)\b/i;
  function voice() {
    const all = canSpeak ? speechSynthesis.getVoices() : [];
    const good = (v) => (/natural|online|neural/i.test(v.name) ? 3 : 0) + (/google/i.test(v.name) ? 1 : 0) - (NOVELTY.test(v.name) ? 5 : 0);
    const exact = all.filter((v) => L.voiceRe.test(v.lang));
    const list = exact.length ? exact : all.filter((v) => L.anyVoiceRe.test(v.lang));
    return list.sort((a, b) => good(b) - good(a))[0] || null;
  }
  if (canSpeak) { speechSynthesis.getVoices(); speechSynthesis.addEventListener('voiceschanged', () => {}); }
  function say(text, slow = false) {
    if (!canSpeak || !text) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean(text).replace(/[¿?¡!]/g, ''));
    u.lang = L.bcp;
    const v = voice(); if (v) u.voice = v;
    u.rate = slow ? 0.6 : 0.9;
    speechSynthesis.speak(u);
  }

  // ---------- say it (speech recognition, Spain Spanish) ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  function hear() {
    return new Promise((resolve) => {
      const r = new SR();
      let alts = [], error = '';
      r.lang = L.bcp; r.maxAlternatives = 5; r.interimResults = false; r.continuous = false;
      r.onresult = (e) => { alts = Array.from(e.results[0] || []).map((a) => a.transcript); };
      r.onerror = (e) => { error = e.error; };
      r.onend = () => { rec = null; resolve({ alts, error }); };
      rec = r;
      try { r.start(); } catch (e) { rec = null; resolve({ alts: [], error: 'busy' }); }
    });
  }
  // Right if what was heard has the same words (accents ignored) or sounds the same.
  function saidRight(target, alts) {
    const want = plain(target).split(' ').filter(Boolean);
    const key = (w) => (ES && P ? P.key(w) : w);
    return alts.some((a) => {
      const got = plain(a).split(' ').filter(Boolean);
      if (got.join(' ').includes(want.join(' '))) return true;
      return want.every((w) => got.some((g) => g === w || key(g) === key(w)));
    });
  }
  async function sayIt(btn, out, w) {
    if (!SR) { out.innerHTML = '<p class="feedback wrong">Checking your speech works in Chrome and Edge.</p>'; return; }
    if (rec) { rec.stop(); return; }
    if (canSpeak) speechSynthesis.cancel();
    btn.classList.add('on'); const label = btn.textContent; btn.textContent = '👂';
    out.innerHTML = '<p class="hint">Say it now…</p>';
    const { alts, error } = await hear();
    btn.classList.remove('on'); btn.textContent = label;
    if (!alts.length) {
      out.innerHTML = `<p class="feedback wrong">${error === 'not-allowed' || error === 'service-not-allowed' ? 'Allow the microphone, then try again.' : 'I heard nothing. Try again.'}</p>`;
      return;
    }
    const ok = saidRight(w.es, alts);
    mark(w, ok);
    out.innerHTML = ok ? `<p class="feedback right">✓ I heard “${esc(alts[0])}”. +${POINTS}</p>` : `<p class="feedback wrong">✗ I heard “${esc(alts[0])}”. Listen ▶ and try again.</p>`;
    if (curTab === 'learn') renderTopics();
    if (curTab === 'library') renderMine();
  }

  // ---------- word cards (Learn and My words) ----------
  function cardHtml(w, { del = false } = {}) {
    const s = db.words[w.es] || {};
    const state = learned(w) ? '<span class="w-state ok" title="Learned">✓ learned</span>' : s.last ? '<span class="w-state">learning</span>' : '';
    return `<div class="wcard" data-es="${esc(w.es)}">
      <div class="w-top"><span class="w-es" lang="${L.code}">${esc(w.es)}</span>${state}</div>
      <div class="w-en">${esc(w.en)}</div>
      <div class="w-ipa">${esc(ipaOf(w))}</div>
      <div class="w-syl" lang="${L.code}">${sylHtml(w)}</div>
      <div class="w-acts">
        <button type="button" class="btn listen-btn small" data-act="say" title="Listen">▶</button>
        <button type="button" class="btn ghost small" data-act="slow" title="Listen slowly">🐢</button>
        <button type="button" class="btn mic-btn small" data-act="mic" title="Say it">🎙️</button>
        ${del ? '<button type="button" class="del" data-act="del" title="Delete">✕</button>' : ''}
      </div>
      <div class="w-res" aria-live="polite"></div>
    </div>`;
  }
  function onCards(e) {
    const b = e.target.closest('[data-act]'), card = e.target.closest('.wcard');
    if (!b || !card) return;
    const w = allWords().find((x) => x.es === card.dataset.es);
    if (!w) return;
    const act = b.dataset.act;
    if (act === 'say') say(w.es);
    else if (act === 'slow') say(w.es, true);
    else if (act === 'mic') sayIt(b, card.querySelector('.w-res'), w);
    else if (act === 'del') {
      const own = db.mine.some((m) => m.es === w.es);
      if (!confirm(`Remove “${w.es}” from your library?`)) return;
      db.mine = db.mine.filter((m) => m.es !== w.es); delete db.words[w.es]; save(); renderMine();
    }
  }

  // ---------- Learn ----------
  // My library comes first: it is the topic shown until the learner picks another one.
  let topic = null, topicPicked = false;
  const hasLibrary = () => true;
  const defaultTopic = () => (hasLibrary() ? 'mine' : TOPICS[0] ? TOPICS[0].id : 'mine');
  function renderTopics() {
    $('lTopics').classList.toggle('hidden', !TOPICS.length); // only My library: no topic chips
    if (!topicPicked || !topic) topic = defaultTopic();
    const ts = TOPICS.map((t) => ({ ...t, words: wordsOf(t.id) }));
    if (hasLibrary()) ts.unshift({ id: 'mine', name: 'My library', icon: '📚', words: wordsOf('mine') });
    $('lTopics').innerHTML = ts.map((t) => {
      const n = t.words.length, k = t.words.filter(learned).length;
      return `<button type="button" class="topic-chip${t.id === topic ? ' on' : ''}" data-topic="${t.id}" aria-pressed="${t.id === topic}">
        <span aria-hidden="true">${t.icon}</span> ${esc(t.name)} <small>${k}/${n}</small></button>`;
    }).join('');
  }
  function renderLearn() {
    renderTopics();
    const q = plain($('lSearch').value);
    const list = q ? allWords().filter((w) => plain(w.es).includes(q) || plain(w.en).includes(q)) : wordsOf(topic);
    $('lCount').textContent = q ? `(${list.length} found)` : `(${allWords().length} words)`;
    $('lGrid').innerHTML = list.map((w) => cardHtml(w)).join('')
      || (!q && topic === 'mine' ? '<p class="empty">Your library is empty. Add words in the <b>➕ Add word</b> tab: type them or say them.</p>' : '<p class="empty">No words found.</p>');
  }
  $('lTopics').addEventListener('click', (e) => { const b = e.target.closest('[data-topic]'); if (!b) return; topic = b.dataset.topic; topicPicked = true; $('lSearch').value = ''; renderLearn(); });
  $('lSearch').addEventListener('input', renderLearn);
  $('lGrid').addEventListener('click', onCards);

  // ---------- topic menus ----------
  // Topic menus of Flashcards and Quiz: My library first, and chosen until the learner picks another topic.
  function fillTopicSelect(sel) {
    const cur = sel.dataset.picked ? sel.value : '';
    sel.innerHTML = (hasLibrary() ? `<option value="mine">📚 My library (${libraryWords().length})</option>` : '')
      + TOPICS.map((t) => `<option value="${t.id}">${t.icon} ${esc(t.name)}</option>`).join('');
    sel.value = cur && [...sel.options].some((o) => o.value === cur) ? cur : (hasLibrary() ? 'mine' : 'all');
  }
  ['cTopic', 'qTopic'].forEach((id) => $(id).addEventListener('change', () => { $(id).dataset.picked = '1'; }));

  // ---------- Flashcards ----------
  const fc = { queue: [], i: 0, known: 0, missed: [], total: 0 };
  // Words to study first: lower box first, then the ones not seen for longest, a little shuffled.
  // My own words that I have not practised yet come first.
  const isMine = (w) => db.mine.some((m) => m.es === w.es);
  const due = (list) => list.map((w) => ({ w, k: ((db.words[w.es] || {}).box || 0) * 10 + Math.random() * 6 - ((Date.now() - ((db.words[w.es] || {}).last || 0)) / 864e5 > 3 ? 4 : 0)
      - (isMine(w) && !(db.words[w.es] || {}).last ? 50 : 0) }))
    .sort((a, b) => a.k - b.k).map((x) => x.w);
  $('cStart').addEventListener('click', () => {
    const list = wordsOf($('cTopic').value);
    if (!list.length) { $('cMsg').textContent = 'Your library is empty. Add words first.'; return; }
    fc.queue = due(list).slice(0, +$('cCount').value);
    Object.assign(fc, { i: 0, known: 0, missed: [], total: fc.queue.length });
    hide('cSetup', 'cDone'); show('cRun');
    cardStep();
  });
  function cardStep() {
    const w = fc.queue[fc.i];
    $('cProgress').textContent = `Card ${Math.min(fc.i + 1, fc.queue.length)} of ${fc.queue.length}`;
    $('cBar').style.width = Math.round((fc.i / fc.queue.length) * 100) + '%';
    $('cFront').innerHTML = `<div class="fc-es" lang="${L.code}">${esc(w.es)}</div><div class="w-ipa">${esc(ipaOf(w))}</div><div class="w-syl" lang="${L.code}">${sylHtml(w)}</div>`;
    $('cBack').innerHTML = `<div class="fc-en">${esc(w.en)}</div>`;
    hide('cBack', 'cNo', 'cYes'); show('cShow');
    $('cShow').focus();
    say(w.es);
  }
  $('cListen').addEventListener('click', () => say(fc.queue[fc.i].es));
  $('cShow').addEventListener('click', () => { show('cBack', 'cNo', 'cYes'); hide('cShow'); $('cYes').focus(); });
  $('cCard').addEventListener('click', () => { if (!$('cShow').classList.contains('hidden')) $('cShow').click(); });
  function cardAnswer(ok) {
    const w = fc.queue[fc.i];
    mark(w, ok);
    if (ok) fc.known++;
    else {
      if (!fc.missed.includes(w)) fc.missed.push(w);
      if (fc.queue.slice(fc.i + 1).indexOf(w) < 0) fc.queue.splice(Math.min(fc.queue.length, fc.i + 4), 0, w); // see it again soon
    }
    fc.i++;
    if (fc.i >= fc.queue.length) cardsDone(); else cardStep();
  }
  $('cYes').addEventListener('click', () => cardAnswer(true));
  $('cNo').addEventListener('click', () => cardAnswer(false));
  $('cQuit').addEventListener('click', cardsDone);
  function cardsDone() {
    if (canSpeak) speechSynthesis.cancel();
    hide('cRun'); show('cDone');
    $('cSummary').innerHTML = `<div class="big-num">${fc.known}/${fc.total}</div>
      <div class="line">words you knew the first time · today's vocabulary score: <b>${(db.days[todayKey()] || {}).score || 0}</b> points</div>
      ${fc.missed.length ? `<div class="line">To practise again: ${fc.missed.map((w) => `<b lang="${L.code}">${esc(w.es)}</b> (${esc(w.en)})`).join(', ')}</div>` : ''}`;
  }
  $('cAgain').addEventListener('click', () => { hide('cDone'); show('cSetup'); fillTopicSelect($('cTopic')); });
  document.addEventListener('keydown', (e) => {
    if (curTab !== 'cards' || $('cRun').classList.contains('hidden') || e.target.matches('input, select, textarea')) return;
    if (e.key === ' ' || e.key === 'Enter') { if (!$('cShow').classList.contains('hidden')) { e.preventDefault(); $('cShow').click(); } }
    else if (e.key === 'ArrowRight' && !$('cYes').classList.contains('hidden')) cardAnswer(true);
    else if (e.key === 'ArrowLeft' && !$('cNo').classList.contains('hidden')) cardAnswer(false);
  });

  // ---------- Quiz ----------
  const qz = { list: [], i: 0, right: 0, missed: [], mode: 'es2en', answered: false };
  $('qStart').addEventListener('click', () => {
    const pool = wordsOf($('qTopic').value);
    if (pool.length < 4) { $('qMsg').textContent = 'A quiz needs at least 4 words.'; return; }
    Object.assign(qz, { list: shuffle(due(pool).slice(0, Math.max(+$('qCount').value * 2, 12))).slice(0, +$('qCount').value), i: 0, right: 0, missed: [], mode: $('qMode').value });
    $('qMsg').textContent = '';
    hide('qSetup', 'qDone'); show('qRun');
    quizStep();
  });
  function options(w) {
    // other answers from the same topic first (harder), then from anywhere
    const same = shuffle(allWords().filter((x) => x.topic === w.topic && x.es !== w.es && x.en !== w.en));
    const other = shuffle(allWords().filter((x) => x.topic !== w.topic && x.es !== w.es && x.en !== w.en));
    const picks = [];
    [...same, ...other].forEach((x) => { if (picks.length < 3 && !picks.some((p) => p.en === x.en || p.es === x.es)) picks.push(x); });
    return shuffle([w, ...picks]);
  }
  function quizStep() {
    const w = qz.list[qz.i];
    qz.answered = false;
    $('qProgress').textContent = `Question ${qz.i + 1} of ${qz.list.length}`;
    $('qBar').style.width = Math.round((qz.i / qz.list.length) * 100) + '%';
    const m = qz.mode;
    $('qPrompt').innerHTML = m === 'en2es' ? (ES ? `<div class="q-ask">How do you say</div><div class="fc-en">${esc(w.en)}</div><div class="q-ask">in Spanish?</div>` : `<div class="q-ask">Which word means</div><div class="fc-en">${esc(w.en)}</div>`)
      : m === 'listen' ? '<div class="q-ask">Listen. What does it mean?</div><div class="fc-es">🔊</div>'
      : `<div class="q-ask">What does it mean?</div><div class="fc-es" lang="${L.code}">${esc(w.es)}</div><div class="w-ipa">${esc(ipaOf(w))}</div>`;
    $('qListen').classList.toggle('hidden', m === 'en2es');
    $('qOptions').innerHTML = options(w).map((o) => `<button type="button" class="q-opt" data-es="${esc(o.es)}"${m === 'en2es' ? ` lang="${L.code}"` : ''}>${esc(m === 'en2es' ? o.es : o.en)}</button>`).join('');
    $('qFeedback').textContent = ''; $('qFeedback').className = 'feedback center';
    hide('qNext');
    if (m !== 'en2es') say(w.es);
  }
  $('qListen').addEventListener('click', () => say(qz.list[qz.i].es));
  $('qOptions').addEventListener('click', (e) => {
    const b = e.target.closest('.q-opt');
    if (!b || qz.answered) return;
    qz.answered = true;
    const w = qz.list[qz.i], ok = b.dataset.es === w.es;
    mark(w, ok);
    if (ok) qz.right++; else qz.missed.push(w);
    $('qOptions').querySelectorAll('.q-opt').forEach((x) => { x.disabled = true; if (x.dataset.es === w.es) x.classList.add('right'); });
    if (!ok) b.classList.add('wrong');
    $('qFeedback').className = 'feedback center ' + (ok ? 'right' : 'wrong');
    $('qFeedback').innerHTML = ok ? `✓ Right! <b lang="${L.code}">${esc(w.es)}</b> = ${esc(w.en)} · +${POINTS}` : `✗ <b lang="${L.code}">${esc(w.es)}</b> means “${esc(w.en)}”.`;
    if (qz.mode === 'en2es' || !ok) say(w.es);
    $('qNext').textContent = qz.i + 1 >= qz.list.length ? 'See results' : 'Next';
    show('qNext'); $('qNext').focus();
    if (ok) { const at = qz.i; setTimeout(() => { if (qz.answered && qz.i === at && qz.i + 1 < qz.list.length && !$('qRun').classList.contains('hidden')) quizNext(); }, 1200); }
  });
  function quizNext() { qz.i++; if (qz.i >= qz.list.length) quizDone(); else quizStep(); }
  $('qNext').addEventListener('click', quizNext);
  $('qQuit').addEventListener('click', quizDone);
  function quizDone() {
    if (canSpeak) speechSynthesis.cancel();
    hide('qRun'); show('qDone');
    const n = Math.max(1, Math.min(qz.i + (qz.answered ? 1 : 0), qz.list.length));
    $('qSummary').innerHTML = `<div class="big-num">${qz.right}/${n}</div>
      <div class="line">${Math.round((qz.right / n) * 100)}% right · today's vocabulary score: <b>${(db.days[todayKey()] || {}).score || 0}</b> points</div>
      ${qz.missed.length ? `<div class="line">To practise again: ${qz.missed.map((w) => `<b lang="${L.code}">${esc(w.es)}</b> (${esc(w.en)})`).join(', ')}</div>` : `<div class="line">No mistakes. ${ES ? '¡Muy bien!' : 'Well done!'}</div>`}`;
  }
  $('qAgain').addEventListener('click', () => { hide('qDone'); show('qSetup'); fillTopicSelect($('qTopic')); });

  // ---------- Add word + My library ----------
  // ---- My library tab ----
  let libShow = 'all';
  function renderMine() {
    const lib = libraryWords();
    const groups = { all: lib, added: mineWords(), practised: lib.filter(practised), learned: lib.filter(learned) };
    const names = { all: 'All', added: 'Added by me', practised: 'Practised', learned: '✓ Learned' };
    $('libFilter').innerHTML = Object.keys(names).map((k) => `<button type="button" class="topic-chip${k === libShow ? ' on' : ''}" data-show="${k}" aria-pressed="${k === libShow}">${names[k]} <small>${groups[k].length}</small></button>`).join('');
    const q = plain($('mSearch').value);
    // newest first: words I added (by date), then practised words (by last practice)
    const when = (w) => Math.max((db.words[w.es] || {}).last || 0, w.added ? Date.parse(w.added) || 0 : 0);
    const list = groups[libShow].slice().sort((a, b) => when(b) - when(a)).filter((w) => !q || plain(w.es).includes(q) || plain(w.en).includes(q));
    $('mCount').textContent = lib.length ? `(${lib.length})` : '';
    $('mEmpty').classList.toggle('hidden', lib.length > 0);
    $('libCards').disabled = $('libQuiz').disabled = !lib.length;
    $('mGrid').innerHTML = list.map((w) => cardHtml(w, { del: true })).join('') || (lib.length ? '<p class="empty">No words here yet.</p>' : '');
  }
  $('mGrid').addEventListener('click', onCards);
  $('mSearch').addEventListener('input', renderMine);
  $('libFilter').addEventListener('click', (e) => { const b = e.target.closest('[data-show]'); if (b) { libShow = b.dataset.show; renderMine(); } });
  // start flashcards or a quiz with the library
  function practiseLibrary(kind) {
    showTab(kind);
    const sel = $(kind === 'cards' ? 'cTopic' : 'qTopic');
    sel.value = 'mine';
    hide(kind === 'cards' ? 'cDone' : 'qDone'); show(kind === 'cards' ? 'cSetup' : 'qSetup');
    $(kind === 'cards' ? 'cStart' : 'qStart').click();
  }
  $('libCards').addEventListener('click', () => practiseLibrary('cards'));
  $('libQuiz').addEventListener('click', () => practiseLibrary('quiz'));
  $('libAdd').addEventListener('click', () => { showTab('mine'); $('mEs').focus(); });

  // Words on this page for the language being practised
  $('mLabel').textContent = `${L.name} word or phrase`;
  $('mMeanLabel').textContent = ES ? 'English meaning' : 'Meaning';
  $('mHint').innerHTML = `Type or say a word. The spelling is checked for you.`;
  $('lHint').innerHTML = `The <span class="stress-key">BIG</span> syllable is stressed.`;

  // Adding a word: check the spelling (LanguageTool), offer the closest words, then a preview
  // (sounds, syllables, meaning) and add it to the library.
  let pending = ''; // the word in the preview
  let pendingPron = null; // English: { ipa, syllables } from the dictionary
  const msg = (t) => { $('mMsg').textContent = t; };
  function resetAdd() { pending = ''; pendingPron = null; hide('mCheck', 'mPreview', 'mDone'); $('mEn').value = ''; }
  $('mEs').addEventListener('input', () => { if (pending || !$('mCheck').classList.contains('hidden') || !$('mDone').classList.contains('hidden')) resetAdd(); msg(''); });

  // -> { ok: true } | { ok: false, bad, offset, length, sugs: [...] } | { error: true }
  async function checkSpelling(text) {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
      const r = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST', signal: ctl.signal,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ text, language: ES ? 'es' : 'en-US' })
      });
      clearTimeout(t);
      if (!r.ok) return { error: true };
      const j = await r.json();
      const m = (j.matches || []).find((x) => x.rule && x.rule.issueType === 'misspelling');
      if (!m) return { ok: true };
      const bad = text.substr(m.offset, m.length);
      const sugs = [...new Set((m.replacements || []).map((x) => x.value)
        .filter((v) => v && (bad.includes(' ') || !v.includes(' ')) && v.toLowerCase() !== bad.toLowerCase()))]
        .filter((v, i, all) => all.findIndex((x) => plain(x) === plain(v)) === i) // bicicleta / bicicletá: keep the first (closest)
        .slice(0, 4);
      return { ok: false, bad, offset: m.offset, length: m.length, sugs };
    } catch (e) { return { error: true }; }
  }
  // Spanish: English meaning (MyMemory). English: a short definition (dictionaryapi.dev).
  async function meaningOf(word) {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
      if (ES) {
        const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=es|en`, { signal: ctl.signal });
        clearTimeout(t);
        const tr = clean((((await r.json()) || {}).responseData || {}).translatedText || '');
        return tr && plain(tr) !== plain(word) && !/MYMEMORY WARNING|INVALID/i.test(tr) ? tr : '';
      }
      const r = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word.toLowerCase()), { signal: ctl.signal });
      clearTimeout(t);
      if (!r.ok) return '';
      const j = await r.json();
      // The first two definitions of each part of speech, in the dictionary's order.
      const cands = [];
      let mi = 0;
      (Array.isArray(j) ? j : []).forEach((e) => (e.meanings || []).forEach((m) => {
        (m.definitions || []).slice(0, 2).forEach((d, k) => { if (d && d.definition) cands.push({ pos: m.partOfSpeech || '', def: d.definition.replace(/\.$/, ''), k, mi }); });
        mi++;
      }));
      if (!cands.length) return '';
      const self = new RegExp('\\b' + word.toLowerCase().replace(/[^a-z' -]/g, '') + '\\b', 'i'); // "to run" does not explain "run"
      // the dictionary's own order, skipping definitions with a usage label, old or slang senses, or the word itself
      const bad = (c) => /^\(/.test(c.def) || /obsolete|archaic|slang|euphemis|dated|rare\b/i.test(c.def) || self.test(c.def);
      const score = (c) => (bad(c) ? 1000 : 0) + c.mi * 10 + c.k * 5;
      const best = cands.sort((a, b) => score(a) - score(b))[0];
      const def = best.def;
      return (best.pos ? `(${best.pos}) ` : '') + (def.length > 110 ? def.slice(0, 107).replace(/\s+\S*$/, '') + '…' : def);
    } catch (e) { return ''; }
  }

  $('mForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = clean($('mEs').value);
    if (!text) return;
    if (!/^[¿¡]?[\p{L} '’-]+[?!]?$/u.test(text)) { msg(`Please type only letters${ES ? ' (you can use the buttons for á, ñ…)' : ''}.`); return; }
    resetAdd();
    const same = (w) => plain(w.es) === plain(text) || plain(w.es.replace(/^(el|la|los|las) /, '')) === plain(text);
    const mine = mineWords().find(same);
    if (mine) {
      const box = $('mCheck');
      box.innerHTML = `<p>“<b lang="${L.code}">${esc(mine.es)}</b>” is already in your library (${esc(mine.en)}).</p>
        <div class="row" style="margin-top:0"><button type="button" class="btn ghost small" id="kLib">📚 Open My library</button>
        <button type="button" class="btn ghost small" id="kCards">🃏 Practise my library</button></div>`;
      show('mCheck');
      $('kLib').onclick = () => showTab('library');
      $('kCards').onclick = () => practiseLibrary('cards');
      return;
    }
    const built = BUILT.find(same);
    if (built) { showPreview(built.es, true, built.en, `It is in the ${topicName(built.topic)} list too.`); return; }
    const btn = $('mCheckBtn');
    btn.disabled = true; btn.textContent = 'Checking…'; msg('');
    const res = await checkSpelling(text);
    btn.disabled = false; btn.textContent = '✓ Check word';
    if (res.error) { msg('Could not reach the spell checker, so the spelling was not checked.'); showPreview(text, false); return; }
    if (res.ok) { showPreview(text, true); return; }
    // looks misspelled: offer the closest words
    const box = $('mCheck');
    box.innerHTML = `<p>⚠ <b lang="${L.code}">“${esc(res.bad)}”</b> doesn't look like ${ES ? 'a Spanish' : 'an English'} word.</p>
      ${res.sugs.length ? `<p class="muted">Did you mean:</p><div class="sugs">${res.sugs.map((sg) => `<button type="button" class="btn ghost small sug" lang="${L.code}" data-sug="${esc(sg)}">${esc(sg)}</button>`).join('')}</div>`
        : `<p class="muted">No close ${esc(L.name)} words found.</p>`}
      <div class="row" style="margin-top:0">
        <button type="button" class="btn ghost small" id="mKeep">Use “${esc(text)}” anyway</button>
        <button type="button" class="btn ghost small" id="mEdit">Edit it myself</button>
      </div>`;
    show('mCheck');
    box.querySelectorAll('[data-sug]').forEach((b) => { b.onclick = () => {
      $('mEs').value = text.slice(0, res.offset) + b.dataset.sug + text.slice(res.offset + res.length);
      hide('mCheck');
      $('mForm').requestSubmit(); // check again (a phrase can have more than one mistake)
    }; });
    $('mKeep').onclick = () => { hide('mCheck'); showPreview(text, false); };
    $('mEdit').onclick = () => { hide('mCheck'); $('mEs').focus(); $('mEs').select(); };
  });

  // ---- say a word: the browser turns speech into text; the learner picks the right guess ----
  async function sayToAdd() {
    const btn = $('mSayBtn');
    if (!SR) { msg('Saying a word works in Chrome and Edge. Please type it instead.'); return; }
    if (rec) { rec.stop(); return; }
    if (canSpeak) speechSynthesis.cancel();
    resetAdd(); msg('');
    btn.classList.add('on'); btn.textContent = '👂 Listening… say one word';
    const { alts, error } = await hear();
    btn.classList.remove('on'); btn.textContent = '🎙️ Say a word';
    const seen = new Set(), guesses = [];
    alts.map((a) => clean(a).replace(/[.,;:!?¿¡"“”]/g, '').split(' ').slice(0, 5).join(' '))
      .map((g) => (/^[A-Z][a-z]/.test(g) || /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(g) ? g[0].toLowerCase() + g.slice(1) : g))
      .forEach((g) => { if (g && !seen.has(plain(g))) { seen.add(plain(g)); guesses.push(g); } });
    const box = $('mCheck');
    if (!guesses.length) {
      box.innerHTML = `<p>${error === 'not-allowed' || error === 'service-not-allowed' ? 'Please allow the microphone for this site (click the lock icon in the address bar), then try again.' : 'I could not catch a word. Try again and say it clearly, or type it.'}</p>
        <div class="row" style="margin-top:0"><button type="button" class="btn ghost small" id="sayAgain">🎙️ Try again</button></div>`;
    } else {
      box.innerHTML = `<p>🎙️ Did you say:</p>
        <div class="sugs">${guesses.slice(0, 5).map((g, i) => `<button type="button" class="btn ${i ? 'ghost' : 'primary'} small heard-pick" lang="${L.code}" data-w="${esc(g)}">${esc(g)}</button>`).join('')}</div>
        <div class="row" style="margin-top:6px"><button type="button" class="btn ghost small" id="sayAgain">🎙️ No, say it again</button>
        <button type="button" class="btn ghost small" id="sayType">⌨️ Type it instead</button></div>`;
    }
    show('mCheck');
    box.querySelectorAll('.heard-pick').forEach((b) => { b.onclick = () => { $('mEs').value = b.dataset.w; hide('mCheck'); $('mForm').requestSubmit(); }; });
    const again = $('sayAgain'); if (again) again.onclick = sayToAdd;
    const type = $('sayType'); if (type) type.onclick = () => { hide('mCheck'); $('mEs').focus(); };
  }
  $('mSayBtn').addEventListener('click', sayToAdd);
  if (!SR) $('mSayBtn').title = 'Saying a word works in Chrome and Edge';

  async function showPreview(text, checked, knownMeaning = '', note = '') {
    pending = text; pendingPron = null;
    $('pEs').textContent = text; $('pEs').lang = L.code;
    $('pChecked').textContent = checked ? '✓ correct spelling' : '';
    if (note) msg(note);
    $('pIpa').textContent = ipaOf(text);
    $('pSyl').innerHTML = sylHtml(text);
    $('mEn').value = '';
    $('mEn').placeholder = 'Looking up the meaning…';
    show('mPreview');
    say(text);
    if (!ES && window.EN_PRON) {
      // American pronunciation from the dictionary
      $('pIpa').textContent = 'Looking up the pronunciation…';
      window.EN_PRON.lookup(text).then((pr) => {
        if (pending !== text) return;
        pendingPron = pr;
        $('pIpa').textContent = pr ? '/' + pr.ipa + '/' : 'No American pronunciation found for this word.';
        $('pSyl').innerHTML = pr ? sylHtml({ es: text, syl: pr.syllables }) : '';
      }).catch(() => { if (pending === text) $('pIpa').textContent = ''; });
    }
    const en = knownMeaning || await meaningOf(text);
    if (pending !== text) return;
    $('mEn').placeholder = ES ? 'Write the English meaning' : 'Write the meaning';
    if (en && !$('mEn').value) $('mEn').value = en;
    if (!en) msg('No meaning found. Please write it yourself.');
    $('mEn').focus();
  }
  $('pSay').addEventListener('click', () => say(pending));
  $('pSlow').addEventListener('click', () => say(pending, true));
  $('mSuggest').addEventListener('click', async () => {
    if (!pending) return;
    $('mSuggest').disabled = true;
    const en = await meaningOf(pending);
    $('mSuggest').disabled = false;
    if (en) { $('mEn').value = en; msg(''); } else msg('No meaning found. Please write it yourself.');
  });
  $('mEn').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('mAdd').click(); } });
  $('mAdd').addEventListener('click', () => {
    const es = pending, en = clean($('mEn').value);
    if (!es) return;
    if (!en) { msg(`Please write the ${ES ? 'English ' : ''}meaning first.`); $('mEn').focus(); return; }
    const entry = { es, en, added: todayKey() };
    if (!ES && pendingPron) { entry.ipa = pendingPron.ipa; entry.syl = pendingPron.syllables.map((x) => (x.gap ? { gap: true } : { text: x.text, stress: x.stress })); }
    db.mine.push(entry);
    topic = 'mine'; topicPicked = false; // Learn opens on My library
    ['cTopic', 'qTopic'].forEach((id) => { delete $(id).dataset.picked; });
    day().newWords++;
    save(); updateChip();
    resetAdd();
    $('mEs').value = '';
    msg('');
    $('dWord').textContent = `“${es}”`;
    $('dCard').innerHTML = cardHtml({ ...entry, topic: 'mine' });
    show('mDone');
    $('mDone').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    $('dCards').focus();
  });
  $('dCard').addEventListener('click', onCards);
  $('dCards').addEventListener('click', () => practiseLibrary('cards'));
  $('dQuiz').addEventListener('click', () => practiseLibrary('quiz'));
  $('dLib').addEventListener('click', () => showTab('library'));
  $('dMore').addEventListener('click', () => { hide('mDone'); $('mEs').focus(); });
  $('mCancel').addEventListener('click', () => { resetAdd(); msg(''); $('mEs').focus(); });
  // Spanish letters for an English keyboard
  if (ES) {
    const inp = $('mEs');
    const bar = document.createElement('div');
    bar.className = 'accent-keys left';
    bar.innerHTML = ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ', '¿', '¡'].map((c) => `<button type="button" tabindex="-1" data-ch="${c}">${c}</button>`).join('');
    bar.addEventListener('mousedown', (e) => e.preventDefault());
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ch]'); if (!b) return;
      const a = inp.selectionStart ?? inp.value.length, z = inp.selectionEnd ?? a;
      inp.value = inp.value.slice(0, a) + b.dataset.ch + inp.value.slice(z);
      inp.setSelectionRange(a + 1, a + 1); inp.focus();
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
    inp.insertAdjacentElement('afterend', bar);
  }

  // ---------- ⭐ Favorite sentences ----------
  // db.sents: [{ id, text, en (Spanish: English meaning), added, tries, best, lastPct, last }]
  const sid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const smsg = (t) => { $('sMsg').textContent = t; };
  $('sNew').placeholder = ES ? 'Paste or type sentences here, one per line.\nPor ejemplo: Más vale tarde que nunca.' : 'Paste or type sentences here, one per line.\nFor example: Better late than never.';
  $('sHint').innerHTML = `Paste, type (one per line) or say a sentence.`;
  // Spanish letters for the sentence box
  if (ES) {
    const box = $('sNew');
    const bar = document.createElement('div');
    bar.className = 'accent-keys left';
    bar.style.marginTop = '8px';
    bar.innerHTML = ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ', '¿', '¡'].map((c) => `<button type="button" tabindex="-1" data-ch="${c}">${c}</button>`).join('');
    bar.addEventListener('mousedown', (e) => e.preventDefault());
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ch]'); if (!b) return;
      const a = box.selectionStart ?? box.value.length, z = box.selectionEnd ?? a;
      box.value = box.value.slice(0, a) + b.dataset.ch + box.value.slice(z);
      box.setSelectionRange(a + 1, a + 1); box.focus();
    });
    box.insertAdjacentElement('afterend', bar);
  }
  // Lines and sentence ends (. ? !) split the text into sentences.
  function splitSentences(text) {
    const out = [];
    String(text || '').replace(/\r/g, '').split('\n').forEach((line) => {
      clean(line).split(/(?<=[.!?…])\s+(?=[¿¡"“'(]?\p{Lu})/u).forEach((x) => { x = clean(x); if (x && /\p{L}/u.test(x)) out.push(x); });
    });
    return out;
  }
  const capital = (t) => { const m = t.match(/^[¿¡"“'(]*/)[0]; return m + (t[m.length] || '').toUpperCase() + t.slice(m.length + 1); };
  async function translate(text) {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
      const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 480))}&langpair=es|en`, { signal: ctl.signal });
      clearTimeout(t);
      const tr = clean((((await r.json()) || {}).responseData || {}).translatedText || '').replace(/\s*~.*$/, ''); // drop tags like "~ English Proverb"
      return tr && plain(tr) !== plain(text) && !/MYMEMORY WARNING|INVALID/i.test(tr) ? tr : '';
    } catch (e) { return ''; }
  }
  $('sAdd').addEventListener('click', async () => {
    const list = splitSentences($('sNew').value).map(capital);
    if (!list.length) { smsg('Paste, type or say a sentence first.'); $('sNew').focus(); return; }
    let added = 0, had = 0;
    const fresh = [];
    list.forEach((text) => {
      if (db.sents.some((x) => plain(x.text) === plain(text))) { had++; return; }
      const it = { id: sid(), text, en: '', added: todayKey(), tries: 0, best: 0, lastPct: null, last: 0 };
      db.sents.unshift(it); fresh.push(it); added++;
    });
    save();
    $('sNew').value = '';
    smsg(added ? `⭐ Added ${added} sentence${added === 1 ? '' : 's'}.${had ? ` ${had} ${had === 1 ? 'was' : 'were'} already saved.` : ''} Practise it now: 🔁 Listen, then repeat (below).` : 'These sentences are already saved.');
    renderSents(fresh.map((x) => x.id));
    const first = fresh[0] && $('sList').querySelector(`.sent-item[data-id="${fresh[0].id}"]`);
    if (first) { first.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); first.querySelector('[data-sact=go]').focus(); }
    if (fresh[0]) SC ? SC.speak(fresh[0].text, { box: first && first.querySelector('.sent-text'), voice: voice(), rate: rate() }) : say(fresh[0].text);
    // the English meaning (looked up again by id: the saved data may have been reloaded meanwhile, e.g. after signing in)
    if (ES) for (const it of fresh) { const en = await translate(it.text); const cur = db.sents.find((x) => x.id === it.id); if (en && cur) { cur.en = en; save(); showMeaning(cur); } }
  });
  // 🎙️ Say a sentence: what the browser hears goes into the box, so it can be checked before adding.
  let sRec = null;
  function hearSentence() {
    return new Promise((resolve) => {
      const r = new SR();
      let text = '', error = '';
      r.lang = L.bcp; r.maxAlternatives = 1; r.interimResults = false; r.continuous = false;
      r.onresult = (e) => { text = Array.from(e.results).map((x) => x[0].transcript).join(' '); };
      r.onerror = (e) => { error = e.error; };
      r.onend = () => { sRec = null; resolve({ text: clean(text), error }); };
      sRec = r;
      try { r.start(); } catch (e) { sRec = null; resolve({ text: '', error: 'busy' }); }
    });
  }
  $('sSayBtn').addEventListener('click', async () => {
    if (!SR) { smsg('Saying a sentence works in Chrome and Edge. Please type it instead.'); return; }
    if (sRec) { sRec.stop(); return; }
    if (canSpeak) speechSynthesis.cancel();
    const btn = $('sSayBtn');
    btn.classList.add('on'); btn.textContent = '👂 Listening… (click to stop)'; smsg('');
    const { text, error } = await hearSentence();
    btn.classList.remove('on'); btn.textContent = '🎙️ Say a sentence';
    if (!text) { smsg(error === 'not-allowed' || error === 'service-not-allowed' ? 'Please allow the microphone for this site, then try again.' : 'I could not catch a sentence. Try again and speak clearly, or type it.'); return; }
    let t = capital(text);
    if (!/[.!?]$/.test(t)) {
      // a question starts with a question word (or, in English, a helping verb): end it with ? (Spanish: ¿…?)
      const first = plain(t.split(' ')[0]);
      const Q = ES ? /^(que|quien|quienes|cual|cuales|como|donde|adonde|cuando|cuanto|cuanta|cuantos|cuantas|por)$/
        : /^(what|where|when|why|who|whom|whose|which|how|do|does|did|is|are|was|were|can|could|will|would|should|have|has|may)$/i;
      const q = Q.test(first) && (first !== 'por' || plain(t.split(' ')[1] || '') === 'que');
      t += q ? '?' : '.';
      if (q && ES) t = '¿' + t;
    }
    const box = $('sNew');
    box.value = (box.value.trim() ? box.value.trim() + '\n' : '') + t;
    smsg(`🎙️ I heard: “${t}”. Check the text in the box (fix it if needed), then click ⭐ Add.`);
    box.focus();
  });

  // ---- Shadowing practice for a sentence (the same engine and score as the Shadowing page) ----
  const SC = window.SHADOW_CORE ? window.SHADOW_CORE(L) : null;
  const voices = {}; // sentence id -> my last recording
  const rate = () => ($('sSlowAll').checked ? 0.7 : 0.95);
  let shadowBusy = null; // { stop } while one try is going on
  // compareSentence: words only (kept for developer checks)
  function compareSentence(target, heard) {
    const tw = clean(target).split(' ').filter((w) => plain(w));
    const T = tw.map(plain), H = plain(heard).split(' ').filter(Boolean);
    const eq = (a, b) => a === b || (ES && P && P.key(a) === P.key(b));
    const n = T.length, m = H.length, Lc = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) Lc[i][j] = eq(T[i], H[j]) ? Lc[i + 1][j + 1] + 1 : Math.max(Lc[i + 1][j], Lc[i][j + 1]);
    let i = 0, j = 0, hits = 0;
    while (i < n && j < m) { if (eq(T[i], H[j])) { hits++; i++; j++; } else if (Lc[i + 1][j] >= Lc[i][j + 1]) i++; else j++; }
    return { pct: n ? Math.round((hits / n) * 100) : 0 };
  }
  // One try: the voice reads the sentence (words light up), then the learner repeats it; then the score.
  // ui: { box (sentence with .sw words), go (button), mine (My voice button), out (result), status (optional) }
  async function shadowSentence(it, ui) {
    if (shadowBusy) { shadowBusy.stop(); return null; }
    if (!SC) { ui.out.innerHTML = '<p class="feedback wrong">The practice tools did not load. Reload the page.</p>'; return null; }
    if (!SC.hasSR && !SC.canRecord) { ui.out.innerHTML = '<p class="feedback wrong">Recording is not supported in this browser. Try Chrome or Edge.</p>'; return null; }
    let stopped = false;
    shadowBusy = { stop: () => { stopped = true; if (canSpeak) speechSynthesis.cancel(); SC.stopMic(); } };
    const label = ui.go.textContent;
    const status = (t) => { if (ui.status) ui.status.innerHTML = t; };
    ui.go.classList.add('on'); ui.out.innerHTML = '';
    try {
      ui.go.textContent = '👂 Listen… (click to stop)'; status('Listen to the voice…');
      const est = Math.max(2, SC.wordsOf(it.text).length * 0.45 * (rate() < 0.9 ? 1.4 : 1));
      const modelSec = await SC.speak(it.text, { box: ui.box, voice: voice(), rate: rate() });
      if (stopped) return null;
      ui.go.textContent = '🎙️ Your turn! (click when done)'; status('<b>Your turn:</b> say it now, the same way.');
      const r = await SC.listenOnce(Math.max(modelSec, est) * 2 + 4);
      status('');
      if (stopped && !r.heard && !r.audio) return null;
      if (r.error && !r.heard && SC.micMessage(r.error)) { ui.out.innerHTML = `<p class="feedback wrong">${esc(SC.micMessage(r.error))}</p>`; return null; }
      status('Checking…');
      let a = null;
      if (r.audio) { try { a = await SC.analyse(r.audio); } catch (e) { console.warn('Analysis failed', e); } }
      const res = await SC.scoreTry({ text: it.text }, r.heard, a, SC.hasSR, POINTS);
      status('');
      if (r.audio) { if (voices[it.id]) URL.revokeObjectURL(voices[it.id]); voices[it.id] = r.audio; }
      if (ui.mine) { ui.mine.disabled = !voices[it.id]; ui.mine.title = voices[it.id] ? 'Hear your last try' : 'Say the sentence first'; }
      if (res.pct !== null) {
        const cur = db.sents.find((x) => x.id === it.id) || it;
        cur.tries = (cur.tries || 0) + 1; cur.best = Math.max(cur.best || 0, res.pct); cur.lastPct = res.pct; cur.last = Date.now();
        const d = day(); d.tries++; if (res.pct >= 80) { d.correct++; d.score += POINTS; }
        save(); updateChip();
      }
      ui.out.innerHTML = res.html;
      return res.pct;
    } finally {
      shadowBusy = null;
      ui.go.classList.remove('on'); ui.go.textContent = label === '🔁 Listen, then repeat' ? '🔁 Again' : label;
      if (ui.go.textContent === '👂 Listen… (click to stop)' || ui.go.textContent === '🎙️ Your turn! (click when done)') ui.go.textContent = '🔁 Again';
    }
  }
  let playing = null;
  function playVoice(id) {
    const url = voices[id];
    if (!url) return;
    if (canSpeak) speechSynthesis.cancel();
    if (playing) playing.pause();
    playing = new Audio(url); playing.play().catch(() => {});
  }
  const sentenceBox = (it) => (SC ? SC.sentenceHtml(it.text) : esc(it.text));

  function sentHtml(it, fresh) {
    const meta = it.tries ? `best ${it.best}% · last ${it.lastPct}% · ${it.tries} ${it.tries === 1 ? 'try' : 'tries'}` : 'not practised yet';
    return `<div class="sent-item${fresh ? ' fresh' : ''}" data-id="${esc(it.id)}">
      <div class="sent-text s-show" lang="${L.code}">${sentenceBox(it)}</div>
      ${it.en ? `<div class="sent-en">${esc(it.en)}</div>` : ''}
      <div class="sent-meta">${meta}</div>
      <div class="sent-acts">
        <button type="button" class="btn listen-btn small" data-sact="say">▶ Listen</button>
        <button type="button" class="btn ghost small" data-sact="slow">🐢 Slowly</button>
        <button type="button" class="btn mic-btn small" data-sact="go">🔁 Listen, then repeat</button>
        <button type="button" class="btn voice-btn small" data-sact="mine"${voices[it.id] ? '' : ' disabled title="Say the sentence first"'}>🎧 My voice</button>
        <button type="button" class="del" data-sact="del" title="Delete">✕</button>
      </div>
      <p class="s-status sent-status" aria-live="polite"></p>
      <div class="sent-res" aria-live="polite"></div>
    </div>`;
  }
  // Put the meaning into the sentence's card without redrawing the list (a practice try may be going on in it).
  function showMeaning(it) {
    const item = $('sList').querySelector(`.sent-item[data-id="${it.id}"]`);
    if (!item) return;
    let el = item.querySelector('.sent-en');
    if (!el) { el = document.createElement('div'); el.className = 'sent-en'; item.querySelector('.sent-text').insertAdjacentElement('afterend', el); }
    el.textContent = it.en;
  }
  let lastFresh = [];
  function renderSents(freshIds = lastFresh) {
    lastFresh = freshIds;
    const q = plain($('sSearch').value);
    const list = db.sents.filter((x) => !q || plain(x.text).includes(q) || plain(x.en || '').includes(q));
    $('sCount').textContent = db.sents.length ? `(${db.sents.length})` : '';
    $('sEmpty').classList.toggle('hidden', db.sents.length > 0);
    $('sReview').disabled = !db.sents.length;
    $('sList').innerHTML = list.map((x) => sentHtml(x, freshIds.includes(x.id))).join('') || (db.sents.length ? '<p class="empty">No sentences found.</p>' : '');
  }
  $('sSearch').addEventListener('input', () => renderSents());
  $('sList').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-sact]'), item = e.target.closest('.sent-item');
    if (!b || !item) return;
    const it = db.sents.find((x) => x.id === item.dataset.id);
    if (!it) return;
    const act = b.dataset.sact;
    if (act === 'say') SC ? SC.speak(it.text, { box: item.querySelector('.sent-text'), voice: voice(), rate: rate() }) : say(it.text);
    else if (act === 'slow') SC ? SC.speak(it.text, { box: item.querySelector('.sent-text'), voice: voice(), rate: 0.7 }) : say(it.text, true);
    else if (act === 'mine') playVoice(it.id);
    else if (act === 'del') { if (confirm(`Delete this sentence?\n\n${it.text}`)) { db.sents = db.sents.filter((x) => x !== it); save(); renderSents(); } }
    else if (act === 'go') {
      const pct = await shadowSentence(it, { box: item.querySelector('.sent-text'), go: b, mine: item.querySelector('[data-sact=mine]'), out: item.querySelector('.sent-res'), status: item.querySelector('.sent-status') });
      if (pct !== null && pct !== undefined) item.querySelector('.sent-meta').textContent = `best ${it.best}% · last ${it.lastPct}% · ${it.tries} ${it.tries === 1 ? 'try' : 'tries'}`;
    }
  });

  // ---- Review: one sentence after another, weakest first, with the same shadowing practice ----
  const rv = { list: [], i: 0, scores: [] };
  $('sReview').addEventListener('click', () => {
    if (!db.sents.length) return;
    rv.list = db.sents.slice().sort((a, b) => (a.tries ? a.best : -1) - (b.tries ? b.best : -1) || (a.last || 0) - (b.last || 0));
    rv.i = 0; rv.scores = [];
    hide('sAddCard', 'sListCard', 'sDone'); show('sRun');
    reviewStep();
  });
  function showReviewText(it) {
    $('sShow').innerHTML = `<div class="sent-text s-show" lang="${L.code}">${sentenceBox(it)}</div>${it.en ? `<div class="sent-en">${esc(it.en)}</div>` : ''}`;
    $('sTune').innerHTML = SC ? SC.expectedTune(it.text).why : '';
    hide('sReveal');
  }
  function reviewStep() {
    const it = rv.list[rv.i];
    const hidden = $('sHide').checked;
    $('sProgress').textContent = `Sentence ${rv.i + 1} of ${rv.list.length}`;
    $('sBar').style.width = Math.round((rv.i / rv.list.length) * 100) + '%';
    if (hidden) { $('sShow').innerHTML = '<div class="sent-hidden">• • • listen and repeat • • •</div>'; $('sTune').innerHTML = ''; show('sReveal'); }
    else showReviewText(it);
    $('sResult').innerHTML = ''; $('sStatus').textContent = '';
    $('sTest').textContent = '🔁 Listen, then repeat';
    $('sMine').disabled = !voices[it.id];
    $('sNext').textContent = rv.i + 1 >= rv.list.length ? 'Finish ✓' : 'Next ⏭';
    if (SC) SC.speak(it.text, { box: $('sShow').querySelector('.sent-text'), voice: voice(), rate: rate() }); else say(it.text);
  }
  $('sListen').addEventListener('click', () => { const it = rv.list[rv.i]; if (SC) SC.speak(it.text, { box: $('sShow').querySelector('.sent-text'), voice: voice(), rate: rate() }); else say(it.text); });
  $('sSlow').addEventListener('click', () => { const it = rv.list[rv.i]; if (SC) SC.speak(it.text, { box: $('sShow').querySelector('.sent-text'), voice: voice(), rate: 0.7 }); else say(it.text, true); });
  $('sReveal').addEventListener('click', () => showReviewText(rv.list[rv.i]));
  $('sMine').addEventListener('click', () => playVoice(rv.list[rv.i].id));
  $('sTest').addEventListener('click', async () => {
    const it = rv.list[rv.i];
    const pct = await shadowSentence(it, { box: $('sShow').querySelector('.sent-text'), go: $('sTest'), mine: $('sMine'), out: $('sResult'), status: $('sStatus') });
    if (pct !== null && pct !== undefined) { rv.scores[rv.i] = Math.max(rv.scores[rv.i] || 0, pct); if ($('sHide').checked) showReviewText(it); }
  });
  function reviewDone() {
    if (shadowBusy) shadowBusy.stop();
    if (canSpeak) speechSynthesis.cancel();
    hide('sRun'); show('sDone');
    const done = rv.scores.filter((x) => x !== undefined);
    const avg = done.length ? Math.round(done.reduce((a, b) => a + b, 0) / done.length) : null;
    const weak = rv.list.filter((x, k) => rv.scores[k] !== undefined && rv.scores[k] < 80);
    $('sSummary').innerHTML = `<div class="big-num">${avg === null ? '–' : avg + '%'}</div>
      <div class="line">average match over ${done.length} practised sentence${done.length === 1 ? '' : 's'} (of ${rv.list.length}) · today's score: <b>${(db.days[todayKey()] || {}).score || 0}</b> points</div>
      ${weak.length ? `<div class="line">To practise again: ${weak.map((x) => `<b lang="${L.code}">${esc(x.text)}</b>`).join(' · ')}</div>` : ''}`;
  }
  $('sNext').addEventListener('click', () => { if (shadowBusy) shadowBusy.stop(); rv.i++; if (rv.i >= rv.list.length) reviewDone(); else reviewStep(); });
  $('sStop').addEventListener('click', reviewDone);
  $('sBack').addEventListener('click', () => { hide('sDone', 'sRun'); show('sAddCard', 'sListCard'); renderSents(); });

  // ---------- tabs ----------
  let curTab = 'learn';
  function showTab(name) {
    curTab = name;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === 'tab-' + name));
    if (canSpeak) speechSynthesis.cancel();
    if (name === 'learn') renderLearn();
    if (name === 'cards') fillTopicSelect($('cTopic'));
    if (name === 'quiz') fillTopicSelect($('qTopic'));
    if (name === 'library') renderMine();
    if (name === 'sents') { if (!$('sRun').classList.contains('hidden') || !$('sDone').classList.contains('hidden')) { /* keep the review */ } else renderSents(); }
  }
  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));
  // Progress of words that are no longer in the library (the old built-in lists) is dropped.
  function prune() {
    const keep = new Set(db.mine.map((m) => m.es));
    let changed = false;
    Object.keys(db.words).forEach((k) => { if (!keep.has(k)) { delete db.words[k]; changed = true; } });
    if (changed) save();
  }
  function refresh() { prune(); updateChip(); showTab(curTab); }
  window.__peweVocabTest = { saidRight, ipaOf, wordsOf, db: () => db, splitSentences, compareSentence }; // for developer checks
  refresh();
})();
