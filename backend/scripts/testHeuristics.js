/**
 * testHeuristics.js — Standalone test script for backend/utils/heuristics.js
 *
 * Run:  node backend/scripts/testHeuristics.js
 *
 * Uses only built-in Node.js assert — no external test framework needed.
 */

const assert = require("assert");
const {
  validateEntry,
  checkRepetitive,
  checkKeyboardSmash,
  checkTooShort,
  checkPlaceholder,
} = require("../utils/heuristics");

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

// ─── Helper: assert entry is invalid ────────────────────────────────────────
function expectInvalid(text, label) {
  test(`REJECT  "${text.slice(0, 50)}…"  (${label})`, () => {
    const result = validateEntry(text);
    assert.strictEqual(
      result.isValid,
      false,
      `Expected "${text}" to be INVALID but got isValid=true`,
    );
  });
}

function expectValid(text, label) {
  test(`ACCEPT  "${text.slice(0, 50)}…"  (${label})`, () => {
    const result = validateEntry(text);
    assert.strictEqual(
      result.isValid,
      true,
      `Expected "${text}" to be VALID but got isValid=false — ` +
        JSON.stringify(result.checks),
    );
  });
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 1. Repetitive Characters / Substrings ═══\n");

expectInvalid("Aaaaaaaa", "single-char repeat");
expectInvalid("aaaaaaaaaaaaaaaaaaaaa", "single-char repeat (long)");
expectInvalid("abcabcabcabcabcabc", "substring repeat (abc)");
expectInvalid("pizzapizzapizzapizzapizza", "substring repeat (pizza)");
expectInvalid("haborhaboRhAbOrHABOR", "substring repeat mixed-case (habor)");
expectInvalid("123123123123123123", "substring repeat (digits)");

// Should NOT trigger for real sentences that happen to repeat a word once
expectValid(
  "Worked on the login module and tested the login flow end to end",
  "legitimate sentence with repeated word",
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 2. Keyboard Smashing ═══\n");

expectInvalid("Asdfghjkl", "home-row smash");
expectInvalid("qwertyuiop qwertyuiop qwert", "top-row smash");
expectInvalid("ncefosfvueuohevfiwhvboi", "gibberish string");
expectInvalid("16896168181351358", "random digits only");
expectInvalid("!@#$%&$^&%^**^&(", "random symbols only");
expectInvalid("zxcvbnm zxcvbnm zxcvbnm", "bottom-row smash");
expectInvalid("jjjkkklllsssdddfff", "keyboard-area repeat");
expectInvalid("bcdfghjklmnpqrstvwxyz", "all consonants");

// Should NOT flag real technical content
expectValid(
  "Configured CORS middleware on the Express backend to allow cross-origin requests",
  "legitimate technical sentence",
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 3. Too-Short Entries ═══\n");

expectInvalid("done", "single word");
expectInvalid("fixed bugs", "two words");
expectInvalid("I love pizza", "three words, non-work");
expectInvalid("ok", "ultra short");
expectInvalid("yes", "ultra short yes");
expectInvalid("   ", "whitespace only");

// Should NOT flag sufficiently long entries
expectValid(
  "Implemented the JWT token refresh logic for the auth service",
  "legitimate medium sentence",
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 4. Placeholder Content ═══\n");

expectInvalid(
  "lorem ipsum dolor sit amet consectetur adipiscing elit",
  "lorem ipsum",
);
expectInvalid("This is a task for today that I need to complete and finish on time", "this is a task");
expectInvalid("This is a challenge that I need to overcome and solve properly", "this is a challenge");
expectInvalid("Test entry for the daily logbook submission form", "test entry");
expectInvalid("Hello world this is my first test entry for the day", "hello world");
expectInvalid("Nothing to report for today and I have no updates", "nothing to report");
expectInvalid("N/A - not applicable at this time for this field", "n/a");
expectInvalid("Placeholder text goes here in this input field area", "placeholder");
expectInvalid("Blah blah blah I do not know what to write here now", "blah blah");

// Should NOT flag real entries that happen to contain common words
expectValid(
  "Resolved a critical bug in the authentication middleware that was causing token validation failures",
  "real work log",
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 5. Good Entries (should all PASS) ═══\n");

const goodEntries = [
  "Implemented JWT authentication middleware for the Express API",
  "Debugged CORS issues on the staging server and deployed hotfix",
  "Refactored the user registration flow to use React Hook Form with Zod validation",
  "Attended the sprint planning meeting and picked up two backend tickets",
  "Wrote unit tests for the payment processing service using Jest",
  "Set up Docker containers for the MongoDB and Redis dependencies",
  "Reviewed pull requests from team members and left feedback",
  "Migrated the legacy REST endpoints to GraphQL resolvers",
  "Investigated memory leak in the Node.js worker process",
  "Created Figma wireframes for the new dashboard analytics page",
  "Worked on implementing the search functionality with Elasticsearch",
  "Fixed pagination bug in the admin panel user listing component",
  "Integrated Stripe webhook handlers for subscription lifecycle events",
  "Optimized database queries by adding composite indexes on the orders table",
  "Set up GitHub Actions CI pipeline for automated testing and linting",
];

for (const entry of goodEntries) {
  expectValid(entry, "good logbook entry");
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n═══ 6. Edge Cases ═══\n");

// Non-string input
test("REJECT  non-string input (null)", () => {
  const result = validateEntry(null);
  assert.strictEqual(result.isValid, false);
});
test("REJECT  non-string input (number)", () => {
  const result = validateEntry(42);
  assert.strictEqual(result.isValid, false);
});
test("REJECT  empty string", () => {
  const result = validateEntry("");
  assert.strictEqual(result.isValid, false);
});

// Very long but good entry
expectValid(
  "Today I worked on implementing a comprehensive error handling strategy across the backend services. " +
    "This involved creating custom error classes for different types of failures such as validation errors, " +
    "authentication errors, and external service timeouts. I also added structured logging using Winston " +
    "to ensure all errors are captured with adequate context for debugging in production.",
  "long legitimate entry",
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(50));
console.log(`  Results:  ${passed} passed,  ${failed} failed`);
console.log("═".repeat(50) + "\n");

process.exit(failed > 0 ? 1 : 0);
