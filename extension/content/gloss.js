// English -> ASL gloss using simple rules.
// ASL gloss = ASL words written in CAPITALS in ASL order.
//   "What is your name?"          -> YOUR NAME WHAT
//   "I am going to the store today" -> TODAY ME GOING STORE
// These rules are a starting point, not full ASL grammar.
(function (root) {
  const SB = (root.SignBuddy = root.SignBuddy || {});

  const CONTRACTIONS = {
    "i'm": 'i am', "you're": 'you are', "we're": 'we are', "they're": 'they are',
    "he's": 'he is', "she's": 'she is', "it's": 'it is', "that's": 'that is',
    "what's": 'what is', "where's": 'where is', "who's": 'who is', "how's": 'how is',
    "there's": 'there is', "here's": 'here is', "let's": 'let us',
    "i've": 'i have', "you've": 'you have', "we've": 'we have', "they've": 'they have',
    "i'll": 'i will', "you'll": 'you will', "we'll": 'we will', "they'll": 'they will',
    "i'd": 'i would', "you'd": 'you would',
    "don't": 'do not', "doesn't": 'does not', "didn't": 'did not', "can't": 'can not',
    "cannot": 'can not', "won't": 'will not', "isn't": 'is not', "aren't": 'are not',
    "wasn't": 'was not', "weren't": 'were not', "shouldn't": 'should not',
    "couldn't": 'could not', "wouldn't": 'would not', "haven't": 'have not', "hasn't": 'has not'
  };

  // Multi-word phrases that are ONE sign.
  const PHRASES = [
    [/\bthank you\b/g, ' THANK-YOU '],
    [/\bthank u\b/g, ' THANK-YOU '],
    [/\bthanks\b/g, ' THANK-YOU '],
    [/\bi love you\b/g, ' I-LOVE-YOU ']
  ];

  // English words that map to a known sign.
  const SYNONYMS = {
    hello: 'HELLO', hi: 'HELLO', hey: 'HELLO', hiya: 'HELLO',
    yes: 'YES', yeah: 'YES', yep: 'YES', yup: 'YES',
    no: 'NO', nope: 'NO', nah: 'NO',
    please: 'PLEASE',
    stop: 'STOP', stops: 'STOP', stopped: 'STOP', stopping: 'STOP',
    help: 'HELP', helps: 'HELP', helped: 'HELP', helping: 'HELP',
    i: 'ME', me: 'ME', myself: 'ME',
    you: 'YOU', yourself: 'YOU', u: 'YOU'
  };

  // Small words ASL usually leaves out.
  const DROP = new Set([
    'a', 'an', 'the', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
    'to', 'of', 'do', 'does', 'did', 'will', 'shall',
    'um', 'uh', 'uhm', 'erm', 'hmm', 'oh', 'ah', 'just', 'really', 'very', 'actually', 'basically'
  ]);

  const WH = new Set(['what', 'where', 'when', 'why', 'who', 'how', 'which']);
  const TIME = new Set(['today', 'tomorrow', 'yesterday', 'tonight', 'now', 'later', 'soon',
    'morning', 'afternoon', 'evening', 'week', 'month', 'year', 'weekend']);
  const TIME_PREFIX = new Set(['next', 'last', 'this']);
  const YESNO_START = new Set(['do', 'does', 'did', 'are', 'is', 'can', 'will', 'could', 'would', 'should', 'have', 'has']);

  function normalise(text) {
    return String(text)
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      .replace(/[a-z]+'[a-z]+/g, (w) => CONTRACTIONS[w] || w.replace(/'s$/, '').replace(/'/g, ''));
  }

  function sentenceToGloss(sentence, endsWithQuestionMark) {
    let s = normalise(sentence);
    const firstWord = (s.match(/[a-z]+/) || [''])[0];
    for (const [re, rep] of PHRASES) s = s.replace(re, rep);
    const words = s.replace(/[^A-Za-z0-9\- ]+/g, ' ').split(/\s+/).filter(Boolean);

    let question = endsWithQuestionMark || YESNO_START.has(firstWord);
    const time = [];
    const wh = [];
    const rest = [];

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (/[A-Z]/.test(w)) { rest.push(w); continue; }          // already a gloss (from PHRASES)
      if (TIME_PREFIX.has(w) && TIME.has(words[i + 1])) {        // "next week" stays together
        time.push(w.toUpperCase() + '-' + words[i + 1].toUpperCase());
        i++; continue;
      }
      if (TIME.has(w)) { time.push(w.toUpperCase()); continue; }
      if (WH.has(w)) { wh.push(w.toUpperCase()); question = true; continue; }
      if (DROP.has(w)) continue;
      rest.push(SYNONYMS[w] || w.toUpperCase());
    }

    const tokens = [...time, ...rest, ...wh];
    // Remove the same sign twice in a row ("yes yes yes" -> YES).
    const deduped = tokens.filter((t, i) => t !== tokens[i - 1]);
    // 'wh' = WH-question (eyebrows down), 'yn' = yes/no question (eyebrows up)
    const qtype = wh.length ? 'wh' : question ? 'yn' : null;
    return { tokens: deduped, question, qtype };
  }

  // Returns a list of sentences: [{ tokens: ['HELLO', 'YOU'], question: false }, ...]
  function toGloss(text) {
    const parts = String(text).match(/[^.!?]+[.!?]?/g) || [];
    return parts
      .map((p) => sentenceToGloss(p, /\?\s*$/.test(p)))
      .filter((s) => s.tokens.length);
  }

  // Clean up whatever the optional LLM sends back.
  function parseLLM(str) {
    return String(str)
      .toUpperCase()
      .replace(/\bIX-1\b|\bIX-ME\b|\bI\b/g, 'ME')
      .replace(/\bIX-2\b|\bIX-YOU\b/g, 'YOU')
      .replace(/[^A-Z0-9\- ]+/g, ' ')
      .split(/\s+/)
      .map((t) => t.replace(/^-+|-+$/g, ''))
      .filter(Boolean)
      .map((t) => SYNONYMS[t.toLowerCase()] || t);
  }

  SB.gloss = { toGloss, parseLLM, sentenceToGloss };
  if (typeof module !== 'undefined' && module.exports) module.exports = SB.gloss;
})(typeof self !== 'undefined' ? self : globalThis);
