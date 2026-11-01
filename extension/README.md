# SignBuddy (version 1.1 – 3D character)

A Chrome extension that puts a small character in the corner of your meeting
(Google Meet, Zoom web, Teams web, YouTube). It listens to the meeting audio,
turns speech into text, and the character signs it in ASL, with captions below.

## How it works (the pipeline)

```
Meeting tab audio ──► offscreen page ──► speech-to-text ──► background ──► meeting page
 (chrome.tabCapture)   (plays audio back    (Web Speech API)    (post office)   (content script)
                        so you still hear it)                                    text ► ASL gloss ► character signs
```

1. **Popup** – you press Start. It asks Chrome for the tab's audio stream id.
2. **Background** (`background.js`) – opens the hidden offscreen page and passes messages around.
3. **Offscreen page** (`offscreen/`) – turns the stream id into audio, plays it back (capturing
   a tab mutes it otherwise), and runs speech-to-text on it.
4. **Content script** (`content/overlay.js`) – shows the floating card. Each finished sentence is
   turned into ASL gloss (`content/gloss.js`) and queued on the character (`content/avatar.js`).
5. **Character** – a 3D signer made with three.js (`content/avatar3d.js`). It plays a stored
   animation for known signs (`content/signs3d.js`) and fingerspells anything else, letter by letter.
   If a computer can't draw 3D, it switches to the simple 2D character automatically.

## How the 3D character works

- **Body and face** are smooth 3D shapes built in code, so there is no model file to download
  and it works offline. Dark clothes + skin-coloured hands, like real interpreters, so hands stand out.
- **Hands** have 5 fingers with 3 joints each. A handshape is just a list of bend angles
  (see `HANDSHAPES3D` in `signs3d.js`).
- **Arms** use inverse kinematics: a sign only says *where the palm goes*, *which way the fingers
  point* and *which way the palm faces*; the code works out the elbow.
- **Face grammar**: eyebrows go up for yes/no questions, down for WH-questions (what, where, who…),
  and the head shakes for NOT / NO. The gloss step tells it which kind of sentence it is.

To add a sign, add an entry to `SIGNS` in `content/signs3d.js` with 1–4 key poses, then try it in the
playground.

## Folder structure

```
signbuddy/
├── manifest.json          Extension settings: permissions, popup, shortcut, which sites
├── background.js          Starts/stops capture, routes messages, optional Ollama call
├── offscreen/
│   ├── offscreen.html     Hidden page that is allowed to hold audio
│   └── offscreen.js       Captures tab audio, plays it back, runs speech-to-text
├── stt/
│   ├── stt.js             "Plug socket" for speech engines (register / create)
│   └── webspeech.js       Engine #1: browser Web Speech API
├── content/
│   ├── gloss.js           English → ASL gloss rules
│   ├── handshapes.js      Finger positions for A–Z, 0–9 and word shapes
│   ├── signs.js           The sign dictionary (key poses) + fingerspelling builder
│   ├── avatar.js          Simple 2D character (backup)
│   ├── signs3d.js         3D handshapes (finger angles) + 3D signs (palm position/direction)
│   ├── avatar3d.js        The 3D character: body, hands, arm IK, face, animation
│   └── overlay.js         The floating card: drag, sizes, hide, captions, catching-up
├── lib/three.min.js       three.js r159 (MIT licence), bundled so it works offline
├── popup/                 Start/Stop button and settings
├── test/
│   ├── playground.html    Try the character without a meeting (type or speak)
│   ├── playground.js
│   └── gloss.test.js      `node test/gloss.test.js`
└── icons/
```

## Load it in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the `signbuddy` folder (the one with `manifest.json`).
4. Pin SignBuddy from the puzzle-piece menu so the 🤟 icon is in your toolbar.

After you edit any file, click the ↻ reload button on the SignBuddy card in `chrome://extensions`,
then reload the meeting tab.

## Test it (easiest first)

1. **Playground (no meeting needed):** click the icon → *Open test playground*. Type a sentence and
   press *Sign it*, or click any word / letter button. Use this to tune signs.
2. **Gloss rules:** in a terminal, `node test/gloss.test.js`.
3. **A YouTube video:** open any talk on YouTube, press play, click the icon → **Start**.
   Captions should appear within a few seconds and the character starts signing.
4. **A real meeting:** join a Google Meet (open a second meeting on your phone and talk into it),
   then Start. Use **Alt+Shift+S** to hide/show the character.

If something doesn't work, open `chrome://extensions` → SignBuddy → *service worker* (for background
logs) or *offscreen.html*, and the page's own DevTools console (for the overlay).

## Settings (popup)

- **Listen to:** *Meeting audio* (tabCapture) or *Microphone* (backup option).
- **Signing speed:** slow / normal / fast.
- **Character:** 3D or Simple 2D (use 2D on slow laptops).
- **Character size:** small / medium / large (also S/M/L on the card).
- **Show captions:** on/off.
- **Better grammar (local Ollama):** sends each sentence to `http://localhost:11434`.
  Start Ollama with extension access allowed, for example:
  - Windows (PowerShell): `$env:OLLAMA_ORIGINS="chrome-extension://*"; ollama serve`
  - macOS/Linux: `OLLAMA_ORIGINS="chrome-extension://*" ollama serve`
  and pull a small model: `ollama pull llama3.2`. If Ollama isn't reachable it falls back to the rules.
- **On-device speech (experimental):** asks Chrome to recognise speech offline where supported.

## Switching to Whisper later

Create `stt/whisper.js` that calls `SignBuddy.STT.register('whisper', (opts) => ({ start(track){…}, stop(){…} }))`
and calls `opts.onText(text, isFinal)`. Load it in `offscreen.html` and change `'webspeech'` to
`'whisper'` in `offscreen.js`. Nothing else changes.

## Honest limitations of version 1

- **Tab audio + Web Speech needs a recent Chrome.** Passing an audio track to `SpeechRecognition.start()`
  is new and experimental. On older Chrome it falls back to the microphone, which only hears the
  meeting if it comes out of your speakers.
- **Web Speech is not offline.** Chrome sends the audio to Google's servers unless on-device
  recognition is available and turned on. The character, gloss rules and signs are fully offline.
- **The gloss is rule-based**, so it gets simple sentences right and long or complex ones only
  roughly. It is not real ASL grammar (no classifiers, spatial references, verb directions).
- **Hand-made poses, not motion capture.** The 3D hands are much clearer than 2D, but a few letters
  are still approximate (F, R, M/N, and letters seen from the side like G/H). The face has eyebrows,
  blinking and head shakes, but no real mouth shapes. Have it checked by Deaf ASL users before
  presenting it as an accessibility tool.
- **The character is stylised**, built from simple shapes, not a realistic human model.
- **19 word signs + A–Z + 0–9.** Most words are still fingerspelled, which is slow, so it will often
  show "catching up…" and skip ahead to stay live.
- **3D uses more battery** than 2D. It slows to ~30 fps when idle; switch to 2D on weak laptops.
- **No speaker labels.** It can't tell who is talking.
- **Waits for finished sentences,** so signing starts 1–3 seconds after speech.

## Ideas for version 2

1. **Whisper** (whisper.cpp / Transformers.js in the browser) for real offline speech-to-text.
2. **A bigger sign library**: record signs with your MediaPipe translator and save the hand/arm
   landmarks as animations, so one recording = one new sign (aim for the 200–300 most used words).
3. **Motion-captured signs**: drive the 3D hands straight from MediaPipe hand landmarks instead of
   hand-made poses (the hand already has the same 21-point joint layout MediaPipe uses).
4. **A realistic model**: swap the built-in body for a rigged .glb/VRM character with finger bones
   and face blendshapes (mouth shapes for ASL mouth morphemes).
5. **Better grammar**: run the LLM step by default, plus a sign-order check.
6. **Read the meeting's own captions** (Meet/Teams/Zoom) as another text source, with speaker names.
7. **Facial expressions and mouth shapes** for questions, negation and emotions.
8. **Feedback button** so Deaf users can mark wrong signs.
