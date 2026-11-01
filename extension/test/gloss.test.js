// Run with:  node test/gloss.test.js
const assert = require('assert');
const { toGloss, parseLLM } = require('../content/gloss.js');

const g = (t) => toGloss(t).map((s) => s.tokens.join(' ')).join(' | ');
const cases = [
  ['Hello, thank you for joining.', 'HELLO THANK-YOU FOR JOINING'],
  ['What is your name?', 'YOUR NAME WHAT'],
  ['I am going to the store today', 'TODAY ME GOING STORE'],
  ["I don't know", 'ME NOT KNOW'],
  ['Can you help me please', 'CAN YOU HELP ME PLEASE'],
  ['I love you', 'I-LOVE-YOU'],
  ['yes yes yes', 'YES'],
  ['Next week we will meet. Stop!', 'NEXT-WEEK WE MEET | STOP'],
  ["It's a big project", 'IT BIG PROJECT']
];
let pass = 0;
for (const [input, want] of cases) {
  const got = g(input);
  try { assert.strictEqual(got, want); pass++; console.log('ok   ', input, '->', got); }
  catch (e) { console.log('FAIL ', input, '->', got, '(wanted', want + ')'); }
}
assert.strictEqual(toGloss('What is your name')[0].question, true);
assert.strictEqual(toGloss('Are you there')[0].question, true);
assert.strictEqual(toGloss('You are there')[0].question, false);
assert.deepStrictEqual(parseLLM('IX-1 GO STORE, thank-you.'), ['ME', 'GO', 'STORE', 'THANK-YOU']);
console.log(`\n${pass}/${cases.length} gloss cases passed`);
if (pass !== cases.length) process.exit(1);
