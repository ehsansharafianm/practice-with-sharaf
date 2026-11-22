// Student accounts (Firebase Auth + Firestore).
// Adds a "Sign in" button to the top bar, a sign-in dialog, and window.PEWE for the pages:
//   PEWE.enabled, PEWE.user, PEWE.isTeacher, PEWE.load(), PEWE.save(db), PEWE.savePron(p), PEWE.listStudents()
// Pages listen for the "pewe-auth" event, fired whenever someone signs in or out.
import { firebaseConfig } from './firebase-config.js';

const V = '10.14.1';
const api = { enabled: !!firebaseConfig.apiKey, ready: false, user: null, isTeacher: false };
window.PEWE = api;

function emit() {
  document.dispatchEvent(new CustomEvent('pewe-auth', { detail: { user: api.user, isTeacher: api.isTeacher } }));
}

function whenBar(cb) {
  if (window.__peweBar) cb(window.__peweBar);
  else document.addEventListener('pewe-bar', () => cb(window.__peweBar), { once: true });
}

const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

if (!api.enabled) {
  api.ready = true;
  emit();
} else {
  start().catch((err) => {
    console.error('Accounts could not start:', err);
    api.enabled = false; api.ready = true; emit();
  });
}

async function start() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`)
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  const fs = F.getFirestore(app);
  let pendingName = '';

  const userDoc = () => F.doc(fs, 'users', api.user.uid);
  const displayName = () => api.user.displayName || pendingName || (api.user.email || 'Student').split('@')[0];

  // English data lives at the top of the student's document (words, days, pron, shad), as before.
  // Spanish data lives in the "es" field: es.dict {words, days}, es.pron, es.shad, es.vocab.
  // load() gives each tool the data of the language being practised, in the English shape.
  const isEs = () => window.PEWE_LANG === 'es';
  api.load = async () => {
    const snap = await F.getDoc(userDoc());
    if (!snap.exists()) return null;
    const d = snap.data();
    if (!isEs()) return d;
    const es = d.es || {};
    return { ...d, words: (es.dict || {}).words || [], days: (es.dict || {}).days || {}, pron: es.pron || null, shad: es.shad || null, vocab: es.vocab || null };
  };
  // Saves one tool's data for the language being practised.
  const put = (field, value) => {
    const base = { name: displayName(), email: api.user.email || '', lastActive: F.serverTimestamp() };
    const data = isEs() ? { ...base, es: { [field]: value } } : { ...base, ...(field === 'dict' ? value : { [field]: value }) };
    return F.setDoc(userDoc(), data, { merge: true });
  };
  api.save = async (db) => {
    if (!api.user) return;
    await put('dict', JSON.parse(JSON.stringify({ words: db.words || [], days: db.days || {} })));
  };
  // Pronunciation Practice keeps its own words and daily scores in the "pron" field.
  api.savePron = async (p) => {
    if (!api.user) return;
    await put('pron', JSON.parse(JSON.stringify({ words: p.words || [], days: p.days || {} })));
  };
  // Shadowing Practice keeps its sentences and daily scores in the "shad" field.
  api.saveShad = async (d) => {
    if (!api.user) return;
    await put('shad', JSON.parse(JSON.stringify({ sentences: d.sentences || [], days: d.days || {}, videos: d.videos || [] })));
  };
  // Vocabulary keeps the learner's progress and own library in vocab (English) or es.vocab (Spanish).
  api.saveVocab = async (v) => {
    if (!api.user) return;
    await put('vocab', JSON.parse(JSON.stringify({ words: v.words || {}, mine: v.mine || [], sents: v.sents || [], days: v.days || {} })));
  };
  api.listStudents = async () => {
    const snap = await F.getDocs(F.collection(fs, 'users'));
    return snap.docs.map((d) => {
      const x = d.data();
      return { id: d.id, ...x, lastActive: x.lastActive && x.lastActive.toDate ? x.lastActive.toDate() : null };
    });
  };
  api.signOut = () => A.signOut(auth);

  A.onAuthStateChanged(auth, async (user) => {
    api.user = user;
    api.isTeacher = false;
    if (user) {
      try {
        const ref = F.doc(fs, 'users', user.uid);
        const snap = await F.getDoc(ref);
        if (!snap.exists()) {
          await F.setDoc(ref, { name: displayName(), email: user.email || '', createdAt: F.serverTimestamp(), lastActive: F.serverTimestamp(), words: [], days: {} });
        }
      } catch (e) { console.warn('Profile not saved:', e); }
      try { api.isTeacher = (await F.getDoc(F.doc(fs, 'teachers', user.uid))).exists(); } catch (e) { api.isTeacher = false; }
    }
    api.ready = true;
    paintBar();
    emit();
  });

  // ---------- top bar button + menu ----------
  let slot;
  whenBar((bar) => {
    slot = document.createElement('div');
    slot.className = 'acct';
    const sw = bar.querySelector('.theme-switch');
    sw.parentNode.insertBefore(slot, sw);
    paintBar();
  });

  function paintBar() {
    if (!slot) return;
    const nav = window.__peweBar.querySelector('.site-tabs');
    const old = nav.querySelector('.teacher-tab');
    if (old) old.remove();
    if (api.isTeacher) {
      const base = window.__peweBase || '';
      const t = document.createElement('a');
      t.className = 'site-tab teacher-tab';
      t.href = base + 'teacher/';
      t.textContent = 'Teacher';
      if (location.pathname.replace(/index\.html$/, '').endsWith('/teacher/')) t.classList.add('active');
      const soon = nav.querySelector('.soon');
      nav.insertBefore(t, soon);
    }
    if (!api.user) {
      slot.innerHTML = '<button type="button" class="acct-btn signin">Sign in</button>';
      slot.querySelector('button').onclick = openDialog;
      return;
    }
    const name = displayName();
    slot.innerHTML = `
      <button type="button" class="acct-btn me" aria-haspopup="true" aria-expanded="false" title="${esc(name)}">
        <span class="avatar">${esc(name[0].toUpperCase())}</span><span class="acct-name">${esc(name.split(' ')[0])}</span>
      </button>
      <div class="acct-menu" hidden>
        <div class="acct-who"><b>${esc(name)}</b><br><span class="muted">${esc(api.user.email || '')}</span></div>
        <p class="acct-note">Your words and scores are saved to your account${api.isTeacher ? '. You are signed in as the teacher.' : '.'}</p>
        <button type="button" class="btn ghost small acct-out">Sign out</button>
      </div>`;
    const btn = slot.querySelector('.me'), menu = slot.querySelector('.acct-menu');
    btn.onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden)); };
    document.addEventListener('click', (e) => { if (!slot.contains(e.target)) { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
    slot.querySelector('.acct-out').onclick = () => api.signOut();
  }

  // ---------- sign-in dialog ----------
  let dlg;
  function openDialog() {
    if (!dlg) buildDialog();
    setMode('in');
    dlg.showModal();
  }
  api.openSignIn = openDialog;

  let mode = 'in';
  function setMode(m) {
    mode = m;
    dlg.querySelector('.d-title').textContent = m === 'up' ? 'Create your account' : 'Sign in';
    dlg.querySelector('.d-name').hidden = m !== 'up';
    dlg.querySelector('.d-name input').required = m === 'up';
    dlg.querySelector('.d-submit').textContent = m === 'up' ? 'Create account' : 'Sign in';
    dlg.querySelector('.d-switch').innerHTML = m === 'up'
      ? 'Already have an account? <button type="button" class="link">Sign in</button>'
      : 'New here? <button type="button" class="link">Create an account</button>';
    dlg.querySelector('.d-switch button').onclick = () => setMode(m === 'up' ? 'in' : 'up');
    dlg.querySelector('.d-forgot').hidden = m === 'up';
    dlg.querySelector('input[name=password]').autocomplete = m === 'up' ? 'new-password' : 'current-password';
    msg('');
  }
  function msg(text, ok) {
    const el = dlg.querySelector('.d-msg');
    el.textContent = text;
    el.className = 'd-msg' + (ok ? ' ok' : text ? ' err' : '');
  }
  const friendly = (e) => ({
    'auth/invalid-credential': 'Email or password is not correct.',
    'auth/wrong-password': 'Email or password is not correct.',
    'auth/user-not-found': 'No account with this email. Create one below.',
    'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.',
    'auth/weak-password': 'Please use a password with at least 6 characters.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/popup-closed-by-user': 'The Google window was closed before signing in.',
    'auth/too-many-requests': 'Too many tries. Please wait a moment and try again.',
    'auth/network-request-failed': 'No internet connection.'
  }[e && e.code] || 'Something went wrong. Please try again.');

  function buildDialog() {
    dlg = document.createElement('dialog');
    dlg.className = 'auth-dialog';
    dlg.innerHTML = `
      <button type="button" class="d-close" aria-label="Close">✕</button>
      <h2 class="d-title">Sign in</h2>
      <p class="hint">Sign in to save your words and scores to your account, on any device.</p>
      <button type="button" class="btn google">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.8 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.8-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.8l7.8-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.8 6.1C6.6 42.6 14.6 48 24 48z"/></svg>
        Continue with Google
      </button>
      <div class="or"><span>or with email</span></div>
      <form class="d-form" novalidate>
        <label class="d-name">Your name<input name="name" type="text" maxlength="60" autocomplete="name"></label>
        <label>Email<input name="email" type="email" required autocomplete="email"></label>
        <label>Password<input name="password" type="password" required minlength="6" autocomplete="current-password"></label>
        <div class="d-msg" aria-live="polite"></div>
        <button type="submit" class="btn primary d-submit">Sign in</button>
        <button type="button" class="link d-forgot">Forgot password?</button>
      </form>
      <p class="d-switch"></p>`;
    document.body.appendChild(dlg);
    dlg.querySelector('.d-close').onclick = () => dlg.close();
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

    dlg.querySelector('.google').onclick = async () => {
      msg('');
      const provider = new A.GoogleAuthProvider();
      try {
        await A.signInWithPopup(auth, provider);
        dlg.close();
      } catch (e) {
        if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
          await A.signInWithRedirect(auth, provider);
        } else msg(friendly(e));
      }
    };

    dlg.querySelector('.d-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const email = f.email.value.trim(), pass = f.password.value, name = f.name.value.trim();
      if (mode === 'up' && !name) return msg('Please enter your name.');
      if (!email || !pass) return msg('Please enter your email and password.');
      const submit = f.querySelector('.d-submit');
      submit.disabled = true;
      try {
        if (mode === 'up') {
          pendingName = name;
          const cred = await A.createUserWithEmailAndPassword(auth, email, pass);
          await A.updateProfile(cred.user, { displayName: name });
          paintBar();
        } else {
          await A.signInWithEmailAndPassword(auth, email, pass);
        }
        f.reset();
        dlg.close();
      } catch (err) {
        msg(friendly(err));
      } finally {
        submit.disabled = false;
      }
    });

    dlg.querySelector('.d-forgot').onclick = async () => {
      const email = dlg.querySelector('input[name=email]').value.trim();
      if (!email) return msg('Type your email above first, then click "Forgot password?" again.');
      try {
        await A.sendPasswordResetEmail(auth, email);
        msg('We sent you an email with a link to reset your password.', true);
      } catch (err) { msg(friendly(err)); }
    };
  }
}
