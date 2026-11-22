<p align="center">
  <img src="favicon.svg" width="72" alt="Practice with Sharaf logo">
</p>

<h1 align="center">Practice with Sharaf</h1>

<p align="center">
  <b>Practise English 🇬🇧 or Spanish 🇪🇸: shadow real speakers from YouTube, train your pronunciation, and build your listening and spelling — free, in your browser.</b>
</p>

<p align="center">
  <a href="https://ehsansharafianm.github.io/practice-with-sharaf/"><b>▶ Open the website</b></a>
  ·
  <a href="https://ehsansharafianm.github.io/practice-with-sharaf/shadowing/">Shadow a YouTube video</a>
  ·
  <a href="https://ehsansharafianm.github.io/practice-with-sharaf/pronunciation/">Pronunciation</a>
  ·
  <a href="https://ehsansharafianm.github.io/practice-with-sharaf/dictation/">Dictation</a>
</p>

<p align="center">
  <img src="docs/images/home.png" alt="The home page of Practice with Sharaf" width="820">
</p>

## 🇬🇧 🇪🇸 English or Spanish

Pick your language at the top of any page. Every tool works in both:

| | English | Spanish |
|---|---|---|
| Voices and speech recognition | American English | Spain (es-ES) |
| Shadow a YouTube video | English captions | Spanish captions |
| Pronunciation | IPA, syllables and stress from the CMU dictionary | IPA (Spain: c/z = θ), syllables and stress worked out from the spelling |
| Notes on each sentence | wanna/gonna, the American T, linking, weak forms | joined vowels (sinalefa), linking, the Spanish th, j and rr sounds, silent h |
| Typing | — | one-click buttons for á é í ó ú ü ñ ¿ ¡ |

Your English and Spanish words, sentences and scores are kept apart.

## 🎬 Shadow any YouTube video

Shadowing means listening to a native speaker and repeating right after them, copying their rhythm and melody.
It is one of the fastest ways to sound natural, and now you can do it with **any English or Spanish video you like**.

1. **Paste a YouTube link.** The page finds every sentence in the video, with its time.
2. **Listen to the real speaker.** Each sentence plays straight from the video, then pauses.
3. **Repeat it.** The page records you and gives you a score for your words, your speed and your melody.
4. **Compare.** Play the speaker and your own voice side by side, as many times as you want.
5. **Keep going.** Turn on *Go on by itself* and shadow a whole talk, sentence after sentence.
6. **Come back to it.** *My videos* keeps every video you practised, with your place and scores. Continue where you stopped, jump to your weak sentences, or start over for a new round.

<p align="center">
  <img src="docs/images/shadow-video.png" alt="Shadowing a TED talk sentence by sentence" width="820">
</p>

Every sentence comes with notes on **how it really sounds**:

- **Intonation:** does the voice go up ↗ or down ↘ at the end, and why.
- **Stress:** the important words are in **bold**. Say them louder, longer and higher.
- **Connected speech:** *want to* → “wanna”, the American T in *water* → “wa-der”, words that link together (*pick‿it‿up*), and the short “weak” forms of small words.

<p align="center">
  <img src="docs/images/shadow-video-dark.png" alt="A sentence with its intonation and connected-speech notes, in dark mode" width="720">
</p>

## 🗣️ Pronunciation

Type or say any word to see its pronunciation: phonetics (IPA), syllables and stress, in **American English** or **Spain Spanish**.
Hear a woman's and a man's voice, record yourself, and get feedback on the word and its stress. Then practise your saved words until they are easy.

<p align="center">
  <img src="docs/images/pronunciation.png" alt="The pronunciation of the word opportunity, with syllables and stress" width="820">
</p>

## ⭐ Your own favorite sentences

Bring the sentences you love and want to say perfectly. Paste them one per line, edit them any time,
and practise them, weakest first. You can also shadow a single sentence or a whole text with a natural American voice.

<p align="center">
  <img src="docs/images/favorites.png" alt="A list of favorite sentences to practise" width="820">
</p>

## 📚 Vocabulary and your own word library

**Add word:** type a word or just **say it** 🎙️. If the spelling looks wrong you get the closest real words to choose from; then you see
its **sounds (IPA)**, its **stressed syllable** and its **meaning** (found for you), and it goes into **your library**, in English or in Spanish.
Learn your words with **flashcards** (words you miss come back sooner) and a **quiz** (word → meaning, meaning → word, or just listening).
Vocabulary has no ready-made lists: it is only the words you add.

**⭐ Sentences:** keep the sentences you love. Paste or type them, or just **say** them 🎙️. Each one is read aloud ▶ (also slowly),
you can **test yourself** (say it and see which words were right, with a score), and **review** them all, weakest first, even with the text hidden
for listening practice. Spanish sentences get their English meaning.

## ✍️ Dictation

Listen to a word and write it. Learn new words, review old ones (weaker words come back more often), and track your daily score.

## Everything in one place

| | |
|---|---|
| 🇬🇧 🇪🇸 **English or Spanish** | Every tool in both languages, with separate progress |
| 🎬 **Shadow a video** | Shadow real speakers from YouTube, sentence by sentence |
| 📚 **Vocabulary** | Your own word library (type or say a word), meanings, IPA and stress, flashcards and a quiz |
| ⭐ **Sentences** | Save sentences you like (paste, type or say them), listen, test yourself and review |
| 🔁 **Shadow a sentence or text** | Repeat after a natural American voice, with a melody chart of your voice |
| ⭐ **Favorites** | Your own sentences to practise again and again |
| 🗣️ **Pronunciation** | IPA, syllables and stress for any word, with recording and feedback |
| ✍️ **Dictation** | Listen-and-write practice with a spell check and daily scores |
| 🌗 **Light and dark mode** | Easy on the eyes, day and night |
| 👩‍🏫 **Accounts and teacher dashboard** | Students sign in to keep their progress; the teacher sees everyone's scores |

Free to use. Works best in **Chrome** or **Microsoft Edge** on a computer (they understand speech, and Edge has very natural American and Spanish voices).
Allow the microphone when the page asks.

---

# For developers

No build step: plain HTML, CSS and JavaScript, hosted on GitHub Pages.
A small Cloudflare Worker (in `worker/`) finds YouTube captions for *Shadow a video*.

## Structure

```
index.html        Home page (list of practice tools)
style.css         Shared styles
site.js           Shared top bar (logo, page tabs, light/dark slider)
account.js        Student accounts: sign-in dialog and saving to Firebase
firebase-config.js  Firebase project settings (accounts are off while empty)
firestore.rules   Database security rules (paste into the Firebase console)
favicon.svg       Logo / browser tab icon
teacher/          Teacher dashboard (all students' scores)
dictation/        Dictation Practice
  index.html
  app.js
  words.txt       English word list for the spell check
pronunciation/    Pronunciation Practice
  index.html
  app.js
  data/*.txt      American pronunciations (syllables + stress), one file per first letter
tools/build_pron.py  Builds pronunciation/data from the CMU Pronouncing Dictionary
shadowing/        Shadowing Practice
  index.html
  app.js
vocabulary/       Vocabulary: the learner's own word library (one per language), flashcards, quiz
  index.html
  app.js
spanish.js        Spanish (Spain) syllables, stress and IPA from the spelling, plus pronunciation tips
english.js        American English IPA and syllables from the CMU dictionary files (pronunciation/data)
worker/           Caption helper for "Shadow a video" (Cloudflare Worker)
  src/index.js
  wrangler.toml
```

Each new practice tool gets its own folder, a card on the home page, and an entry in the `PAGES` list in `site.js`.

The language being practised (English or Spanish) is chosen in the top bar and kept in `localStorage` (`pewe-lang`).
`site.js` sets `window.PEWE_L` (voices, speech recognition, names) and `window.PEWE_KEY(key)`, which adds `-es` to
storage keys so Spanish data never mixes with English. Signed-in students' Spanish data is saved in the `es` field
of their account (`es.dict`, `es.pron`, `es.shad`, `es.vocab`).

The pages load shared files with a version tag (`style.css?v=...`). Change the tag in all `index.html` files
when you publish changes to those files, so browsers load the new version instead of an old saved copy.

## Dictation Practice

- **New word** – the trainer types a word (and an optional meaning). The learner hears it and types it 10 times.
  The box turns green while the spelling is on track and red when it goes wrong. The answer is checked automatically
  as soon as the last letter is typed (Enter also works). After 10 tries the word is saved to the library.
- **Spell check** – when the trainer adds a word, it is checked against an English word list (about 275,000 words).
  If it looks misspelled, the site suggests corrections. The trainer can pick a suggestion, edit the word, or keep it anyway.
- **Review** – practise words from the library. The word is read aloud and hidden; the learner types it.
  Weaker words appear more often. At the end you see the accuracy for the round and the total score for the day.
- **Library** – all words with accuracy and number of tries. Search, delete, export and import a backup file.
- **Today** – score, accuracy, tries and new words for today, plus the last 7 days.

Scoring: each correct answer = 10 points. Checking ignores upper/lower case and extra spaces.

### Data

Guests: everything is saved in the browser (`localStorage`), so each device has its own library.
Use **Export** and **Import** in the Library tab to move words between devices.

Signed-in students: words and scores are also saved to their account (Firestore), so they work on any
device and the teacher can see them. Guest practice on a device moves into the account at first sign-in.

## Student accounts and teacher dashboard

Sign-in is optional (Google or email + password). The teacher dashboard is at `/teacher/`.

Setup (once):
1. Create a Firebase project. Turn on **Authentication** with the **Google** and **Email/Password** providers,
   and add `ehsansharafianm.github.io` under *Authentication → Settings → Authorized domains*.
2. Create a **Firestore** database (production mode) and publish the rules from `firestore.rules`.
3. Register a web app and paste its `firebaseConfig` values into `firebase-config.js`.
4. Sign in on the site once, then in Firestore create a collection `teachers` with a document whose ID is
   your user ID (shown on the teacher page). That account can now open the dashboard.

Each student is one document `users/{uid}` with `name`, `email`, `words`, `days`, `createdAt`, `lastActive`,
and `pron` (Pronunciation Practice words and days).

### Word list

`dictation/words.txt` is the SCOWL-based English list from the `word-list` package, plus common contractions,
days, months, countries and a few common names. Words are ordered from most to least common
(using `wordfreq`), so the most likely suggestions come first.

## Pronunciation Practice

- **Add new word** – type a word, or click **Say a word** and say it (the page shows what it heard, with other
  guesses, "say it again" and "type it instead"); typed words get a spelling check is checked, with suggestions, or keep it anyway) to see its American pronunciation: IPA phonetics, the syllables, and which syllable
  is stressed (the big coloured one; secondary stress has a coloured border). Each syllable also has a simple
  "sounds like" spelling (e.g. pruh · nun · see · AY · shuhn). Listen with a woman's or a man's US voice (normal or
  slow),. Then click **Say it**: the browser checks what you
  said (Chrome/Edge), and the page analyses your recording (loudness, pitch and length of each syllable) to see
  which syllable you stressed. You get a match score, a bar chart of your stress against the correct stress, and tips.
  You can play back your own voice to compare. The analysis is approximate: it checks stress, not single sounds. Looked-up words are saved to **My words**.
- **Practice** – "Say the word" (3 tries per word) or "Find the stress" (click the stressed syllable),
  with words from My words, from Dictation, or both. Weaker words come first. 10 points per correct answer.
- **My words** – all words with phonetics and how often you got them right, plus today's totals.

Pronunciations come from the CMU Pronouncing Dictionary (BSD licence), split into syllables by `tools/build_pron.py`
(`python tools/build_pron.py cmudict.dict pronunciation/data`). Phonetics for words missing from the list come from the free dictionaryapi.dev. Voices are the device's own; Microsoft Edge has the most natural ones.
Signed-in students' pronunciation data is saved in the `pron` field of their `users/{uid}` document.

## Shadowing Practice

- Add a sentence (up to 20 words) by typing it or saying it. A missing end mark is added (? for questions).
- The sentence is shown with the stressed (content) words in bold and an arrow for the melody at the end:
  statements and wh- questions fall ↘, yes/no questions rise ↗.
- **Listen, then repeat**: an American voice reads it (each word lights up), then the learner repeats it.
  Or **Speak along** at the same time (with headphones). Voice choice and slow speed; Microsoft Edge has natural voices.
- The page checks the words (Chrome/Edge speech recognition; same-sounding words count as right), the melody at the
  end (pitch from the recording), how lively the voice is, and the speed. It shows a match score, the words heard,
  a melody chart and tips. 80% or more = 10 points.
- **Shadow a text** – paste a text or import a .txt file. It is split into sentences (long ones are cut at commas;
  those parts should keep the voice up). The page then goes through them by itself: reads a sentence, records the
  learner, scores it, short break (2/4/7 s), next sentence. Pause, Repeat sentence, Skip, Stop, and "Done speaking" while
  recording. Each sentence row has ▶ (voice), 🎧 (your voice) and 🔁 (practise it again); click a row to open its
  analysis and melody chart. At the end: average, score per sentence, and "practise the sentences under 80% again". Up to 60 sentences.
- **My sentences** – best and last score per sentence; "Practise my sentences" starts with the weakest.
- **⭐ Favorites** – the learner's own favorite sentences. Paste them one per line, or click ☆ next to any sentence
  (in My sentences or on the shadowing card). "Practise my favorites" goes through them, weakest first.
  Stored as `fav: true` on the sentence, so favorites are saved to the account too.
- **Shadow a video** – paste a YouTube link. The caption helper (`worker/`) gets the video's English captions with
  their times; the page cuts them into sentences, plays each one from the video (YouTube player), records the learner
  and scores the try. Each sentence shows its melody, stressed words and connected-speech notes (wanna, American T,
  linking, weak forms). If the helper cannot get the captions, the learner pastes YouTube's "Show transcript" text instead.
  *My videos* keeps the last 15 videos (`shad.videos`: id, title, sentences with times, current place, a score per sentence,
  round number and best round) so a student can continue, practise the weak sentences, or start over.
- Signed-in students' data is saved in the `shad` field of their `users/{uid}` document.

## Caption helper (worker/)

A small Cloudflare Worker (free plan) at https://pewe-captions.practice-english-ehsan.workers.dev.
`GET /captions?v=<YouTube link or id>` answers with the captions as JSON. It only answers this site and localhost.
It uses YouTube's unofficial player address, so it can stop working if YouTube changes it; the page then asks for the transcript.

```
cd worker
npm install
npm run dev      # local helper on http://127.0.0.1:8787 (used by the page on localhost)
npx wrangler deploy   # publish changes (after `npx wrangler login`)
```

## Run locally

From this folder run `python -m http.server 8765` and open http://localhost:8765/.
(The spell check needs a web server; opening the file directly skips it.)
