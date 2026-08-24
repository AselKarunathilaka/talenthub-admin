/**
 * leaveReasonValidation.test.js — Unit tests for leave request reason validation
 *
 * Run: node backend/tests/leaveReasonValidation.test.js
 */

const assert = require("assert");
const { validateLeaveReason } = require("../utils/leaveValidation");

let passed = 0;
let failed = 0;

function test(label, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✔  ${label}`);
  } catch (err) {
    failed++;
    console.log(`  ✘  ${label}`);
    console.log(`     → ${err.message}`);
  }
}

function expectInvalid(text, label) {
  test(`REJECT  "${String(text).slice(0, 40)}"  (${label})`, () => {
    const result = validateLeaveReason(text);
    assert.strictEqual(
      result.isValid,
      false,
      `Expected "${text}" to be INVALID, but got isValid=true`,
    );
    assert.ok(result.error && result.error.length > 0, "Expected non-empty error message");
  });
}

function expectValid(text, label) {
  test(`ACCEPT  "${String(text).slice(0, 40)}"  (${label})`, () => {
    const result = validateLeaveReason(text);
    assert.strictEqual(
      result.isValid,
      true,
      `Expected "${text}" to be VALID, but got isValid=false (${result.error})`,
    );
    assert.strictEqual(result.error, "");
  });
}

console.log("\n═══ 1. Repeated Single Characters (Test Case) ═══\n");

expectInvalid("aaaaaaaaaa", "repeated single char 'a'");
expectInvalid("AAAAAAAAAA", "uppercase repeated single char 'A'");
expectInvalid("Aaaaaaaa", "mixed case repeated single char");
expectInvalid("bbbbbbbbbb", "repeated single char 'b'");
expectInvalid("zzzzzzzzzzzz", "repeated single char 'z'");
expectInvalid("a a a a a a a a a a", "spaced repeated single char");
expectInvalid("a, a, a, a, a, a, a, a", "comma separated repeated char");

console.log("\n═══ 2. Repeated Symbols & Digits ═══\n");

expectInvalid("1111111111", "repeated digit '1'");
expectInvalid("999999999999", "repeated digit '9'");
expectInvalid("..........", "repeated period");
expectInvalid("----------", "repeated hyphen");
expectInvalid("**********", "repeated asterisk");

console.log("\n═══ 3. Repetitive Substring Patterns ═══\n");

expectInvalid("abcabcabcabc", "repeating pattern 'abc'");
expectInvalid("asdfasdfasdf", "repeating pattern 'asdf'");
expectInvalid("hahahahahaha", "repeating pattern 'ha'");
expectInvalid("123123123123", "repeating digits '123'");

console.log("\n═══ 4. Too Short or Empty / Non-alphabetic ═══\n");

expectInvalid("", "empty string");
expectInvalid(null, "null");
expectInvalid(undefined, "undefined");
expectInvalid("short", "less than 10 characters");
expectInvalid("1234567890", "digits without letters");
expectInvalid("!@#$%^&*()_+", "symbols without letters");

console.log("\n═══ 5. Valid Descriptive Reasons ═══\n");

expectValid(
  "Preparing for university final year examinations",
  "legitimate academic study leave reason",
);
expectValid(
  "Attending family medical emergency and doctor appointment",
  "legitimate personal emergency reason",
);
expectValid(
  "Official company training and workshop in Colombo",
  "legitimate official duty reason",
);
expectValid(
  "Need to complete final year software engineering dissertation presentation",
  "detailed educational reason",
);

console.log("\n──────────────────────────────────────────");
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("──────────────────────────────────────────\n");

if (failed > 0) {
  process.exit(1);
}
