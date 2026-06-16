/**
 * heuristics.js — Rule-based filters for daily logbook entries.
 *
 * Detects four categories of bad input:
 *   1. Repetitive characters / substrings
 *   2. Keyboard smashing / gibberish
 *   3. Trivially short entries
 *   4. Placeholder / boilerplate content
 *
 * Usage:
 *   const { validateEntry } = require("./heuristics");
 *   const result = validateEntry("Implemented JWT auth for the Express API");
 *   // result.isValid  → true | false
 *   // result.checks   → per-category { pass, reason }
 */

// ─── 1. Repetitive-Character / Substring Detection ─────────────────────────

/**
 * Returns true when a single character dominates the text.
 * Threshold: most-frequent char accounts for > 60 % of all characters.
 */
function hasSingleCharRepetition(text) {
  const cleaned = text.replace(/\s/g, "").toLowerCase();
  if (cleaned.length === 0) return false;

  const freq = {};
  for (const ch of cleaned) {
    freq[ch] = (freq[ch] || 0) + 1;
  }
  const maxFreq = Math.max(...Object.values(freq));
  return maxFreq / cleaned.length > 0.6;
}

/**
 * Returns true when a short substring (2–20 chars) repeats to form ≥ 70 %
 * of the input.  Works by checking every possible substring length.
 */
function hasSubstringRepetition(text) {
  const cleaned = text.replace(/\s/g, "").toLowerCase();
  if (cleaned.length < 6) return false; // too short to judge

  for (let len = 2; len <= Math.min(20, Math.floor(cleaned.length / 2)); len++) {
    const pattern = cleaned.slice(0, len);
    let count = 0;
    let idx = 0;
    while (idx <= cleaned.length - len) {
      if (cleaned.slice(idx, idx + len) === pattern) {
        count++;
        idx += len;
      } else {
        idx++;
      }
    }
    const coverage = (count * len) / cleaned.length;
    if (count >= 3 && coverage >= 0.7) return true;
  }
  return false;
}

function checkRepetitive(text) {
  if (hasSingleCharRepetition(text)) {
    return {
      pass: false,
      reason: "Entry contains excessively repeated characters.",
    };
  }
  if (hasSubstringRepetition(text)) {
    return {
      pass: false,
      reason: "Entry contains a repeating pattern of text.",
    };
  }
  return { pass: true, reason: "" };
}

// ─── 2. Keyboard-Smash / Gibberish Detection ───────────────────────────────

const KEYBOARD_ROWS = [
  new Set("qwertyuiop"),
  new Set("asdfghjkl"),
  new Set("zxcvbnm"),
];

const VOWELS = new Set("aeiou");

/**
 * Curated word-list of common English + software-engineering terms.
 * Used to estimate whether the input contains "real" words.
 */
const COMMON_WORDS = new Set([
  // ── Articles / prepositions / conjunctions ──
  "a", "an", "the", "and", "or", "but", "if", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "as", "is", "it", "be", "was", "are", "were",
  "been", "has", "had", "have", "do", "did", "does", "will", "would", "can",
  "could", "shall", "should", "may", "might", "not", "no", "yes", "so",
  "up", "out", "about", "into", "over", "after", "before", "between",
  "under", "above", "below", "through", "during", "since", "until",
  "this", "that", "these", "those", "my", "your", "his", "her", "its",
  "our", "their", "we", "they", "he", "she", "me", "him", "them", "us",
  "i", "you", "who", "what", "where", "when", "how", "which", "than",
  "then", "also", "just", "more", "some", "any", "all", "each", "every",
  "both", "few", "most", "other", "such", "only", "own", "same", "very",
  "here", "there", "now", "well", "too",

  // ── Common verbs ──
  "added", "add", "apply", "applied", "build", "built", "change", "changed",
  "check", "checked", "clean", "cleaned", "close", "closed", "code", "coded",
  "complete", "completed", "configure", "configured", "connect", "connected",
  "create", "created", "debug", "debugged", "define", "defined", "delete",
  "deleted", "deploy", "deployed", "design", "designed", "develop", "developed",
  "discuss", "discussed", "document", "documented", "download", "downloaded",
  "edit", "edited", "enable", "enabled", "ensure", "error", "errors", "execute",
  "executed", "explore", "explored", "export", "exported", "fetch", "fetched",
  "find", "finish", "finished", "fix", "fixed", "format", "formatted",
  "generate", "generated", "get", "got", "handle", "handled", "help",
  "helped", "identify", "identified", "implement", "implemented", "import",
  "imported", "improve", "improved", "include", "included", "initialize",
  "initialized", "inspect", "install", "installed", "integrate", "integrated",
  "investigate", "investigated", "join", "keep", "launch", "launched",
  "learn", "learned", "link", "linked", "list", "load", "loaded", "log",
  "logged", "make", "made", "manage", "managed", "map", "mapped", "merge",
  "merged", "migrate", "migrated", "modify", "modified", "monitor", "monitored",
  "move", "moved", "need", "needed", "open", "opened", "optimize", "optimized",
  "parse", "parsed", "plan", "planned", "prepare", "prepared", "process",
  "processed", "publish", "published", "push", "pushed", "query", "queried",
  "read", "receive", "received", "refactor", "refactored", "release", "released",
  "remove", "removed", "render", "rendered", "replace", "replaced", "report",
  "reported", "request", "requested", "require", "required", "research",
  "researched", "resolve", "resolved", "restart", "restarted", "restore",
  "restored", "restructure", "restructured", "retrieve", "retrieved", "review",
  "reviewed", "revise", "revised", "run", "running", "save", "saved", "scan",
  "scanned", "schedule", "scheduled", "search", "searched", "secure", "secured",
  "send", "sent", "serve", "served", "set", "setup", "show", "shown", "solve",
  "solved", "sort", "sorted", "split", "start", "started", "stop", "stopped",
  "store", "stored", "structure", "structured", "study", "studied", "submit",
  "submitted", "support", "supported", "sync", "synced", "take", "test",
  "tested", "trace", "traced", "track", "tracked", "transfer", "transferred",
  "trigger", "triggered", "troubleshoot", "try", "tried", "update", "updated",
  "upgrade", "upgraded", "upload", "uploaded", "use", "used", "using",
  "validate", "validated", "verify", "verified", "view", "viewed", "work",
  "worked", "working", "write", "wrote", "written",

  // ── Software-engineering nouns ──
  "access", "account", "admin", "algorithm", "analytics", "api", "app",
  "application", "architecture", "array", "asset", "auth", "authentication",
  "authorization", "aws", "azure", "backend", "backup", "batch", "blockchain",
  "boolean", "branch", "browser", "buffer", "bug", "bugs", "cache", "callback",
  "certificate", "channel", "chart", "ci", "class", "client", "cloud",
  "cluster", "column", "command", "commit", "communication", "compiler",
  "component", "components", "config", "configuration", "connection",
  "console", "constant", "container", "content", "context", "controller",
  "cookie", "cors", "cpu", "credential", "cron", "crud", "css", "csv",
  "dashboard", "data", "database", "dataset", "db", "dependency", "deployment",
  "development", "device", "devops", "directory", "docker", "dom", "domain",
  "driver", "email", "encryption", "endpoint", "engine", "entry", "enum",
  "environment", "event", "exception", "express", "extension", "feature",
  "feedback", "field", "file", "files", "filter", "firebase", "firewall",
  "fix", "flag", "flask", "flow", "folder", "font", "footer", "form",
  "format", "framework", "frontend", "function", "functions", "gateway",
  "git", "github", "gitlab", "graphql", "grid", "gui", "handler", "header",
  "hook", "hooks", "host", "hosting", "hotfix", "html", "http", "https",
  "icon", "ide", "image", "index", "infrastructure", "input", "instance",
  "interface", "internet", "issue", "issues", "java", "javascript", "jest",
  "jira", "job", "join", "json", "jwt", "kafka", "kernel", "key", "kotlin",
  "kubernetes", "lambda", "language", "layout", "level", "library", "linux",
  "loader", "local", "localhost", "logic", "login", "logout", "loop",
  "machine", "memory", "menu", "message", "method", "microservice",
  "middleware", "migration", "mobile", "mock", "modal", "model", "module",
  "mongodb", "mongoose", "mysql", "navbar", "navigation", "network", "nginx",
  "node", "notification", "npm", "null", "number", "oauth", "object",
  "observer", "operator", "option", "orm", "os", "output", "package",
  "padding", "page", "panel", "parameter", "parser", "password", "patch",
  "path", "pattern", "payload", "pdf", "performance", "permission",
  "pipeline", "platform", "plugin", "pod", "popup", "port", "postgres",
  "postman", "priority", "production", "profile", "program", "progress",
  "project", "promise", "prompt", "properties", "protocol", "provider",
  "proxy", "pull", "python", "queue", "react", "readme", "redis", "reducer",
  "redux", "reference", "regex", "register", "release", "remote", "renderer",
  "repo", "repository", "request", "response", "rest", "restful", "result",
  "role", "rollback", "route", "router", "routing", "runtime", "sass",
  "schema", "scope", "script", "sdk", "security", "selector", "server",
  "serverless", "service", "session", "settings", "sidebar", "signup",
  "slack", "snippet", "socket", "software", "solution", "source", "sprint",
  "sql", "ssh", "ssl", "stack", "staging", "state", "status", "storage",
  "store", "stream", "string", "style", "stylesheet", "subscription",
  "swagger", "switch", "symbol", "syntax", "system", "table", "tag",
  "tailwind", "task", "tasks", "team", "template", "terminal", "testing",
  "thread", "ticket", "timeout", "timestamp", "tls", "toast", "token",
  "tool", "tooltip", "tracking", "traffic", "transaction", "tree", "trigger",
  "troubleshooting", "typescript", "ubuntu", "ui", "unit", "unix", "url",
  "user", "users", "util", "utility", "ux", "validation", "value",
  "variable", "version", "virtual", "vm", "vue", "web", "webhook",
  "webpack", "websocket", "widget", "window", "wizard", "workflow", "wrapper",
  "xml", "yaml", "yarn",

  // ── Common adjectives / adverbs used in logbooks ──
  "new", "old", "first", "last", "next", "previous", "main", "current",
  "initial", "final", "full", "partial", "basic", "advanced", "complete",
  "remaining", "existing", "pending", "successful", "failed", "minor",
  "major", "critical", "relevant", "related", "different", "specific",
  "additional", "multiple", "several", "various", "separate", "individual",
  "daily", "weekly", "monthly", "today", "yesterday", "done", "ongoing",
  "recently", "properly", "correctly", "successfully", "across", "along",
  "around", "still", "yet", "already", "again",

  // ── Meeting / process words ──
  "meeting", "standup", "scrum", "agile", "sprint", "backlog", "demo",
  "presentation", "review", "retrospective", "blocker", "blockers",
  "challenge", "challenges", "issue", "dependency", "deadline", "milestone",
  "release", "deployment", "production", "staging", "development",
  "environment", "progress", "status", "ticket", "story", "epic",
]);

/**
 * Returns true if > 70 % of the alphabetic characters live on a single
 * keyboard row (QWERTY layout).
 */
function hasKeyboardRowBias(text) {
  const alpha = text.toLowerCase().replace(/[^a-z]/g, "");
  if (alpha.length < 5) return false;

  for (const row of KEYBOARD_ROWS) {
    let count = 0;
    for (const ch of alpha) {
      if (row.has(ch)) count++;
    }
    if (count / alpha.length > 0.7) return true;
  }
  return false;
}

/**
 * Returns true when the vowel ratio among alphabetic characters is
 * suspiciously low (< 15 %), which almost never happens in natural language.
 */
function hasLowVowelRatio(text) {
  const alpha = text.toLowerCase().replace(/[^a-z]/g, "");
  if (alpha.length < 8) return false;

  let vowelCount = 0;
  for (const ch of alpha) {
    if (VOWELS.has(ch)) vowelCount++;
  }
  return vowelCount / alpha.length < 0.15;
}

/**
 * Returns the fraction of space-separated tokens that appear in COMMON_WORDS.
 */
function realWordRatio(text) {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (tokens.length === 0) return 0;

  let hits = 0;
  for (const token of tokens) {
    if (COMMON_WORDS.has(token)) hits++;
  }
  return hits / tokens.length;
}

/**
 * Returns true if the text is entirely (or almost entirely) non-alphabetic,
 * e.g. "16896168181351358" or "!@#$%&$^&%^**^&(".
 */
function isNonAlphaGibberish(text) {
  const cleaned = text.replace(/\s/g, "");
  if (cleaned.length < 3) return false;

  const alpha = cleaned.replace(/[^a-zA-Z]/g, "");
  return alpha.length / cleaned.length < 0.3;
}

function checkKeyboardSmash(text) {
  // Pure non-alpha gibberish (numbers-only, symbols-only)
  if (isNonAlphaGibberish(text)) {
    return {
      pass: false,
      reason: "Entry appears to be random numbers or symbols.",
    };
  }

  // Keyboard-row bias
  if (hasKeyboardRowBias(text)) {
    return {
      pass: false,
      reason: "Entry looks like keyboard smashing (characters from one keyboard row).",
    };
  }

  // Low vowel ratio
  if (hasLowVowelRatio(text)) {
    return {
      pass: false,
      reason: "Entry appears to be random characters (very few vowels detected).",
    };
  }

  // Low real-word ratio (only apply to entries long enough to judge)
  const tokens = text.trim().split(/\s+/);
  if (tokens.length >= 3 && realWordRatio(text) < 0.3) {
    return {
      pass: false,
      reason: "Entry does not appear to contain meaningful words.",
    };
  }

  return { pass: true, reason: "" };
}

// ─── 3. Too-Short Entry Detection ──────────────────────────────────────────

const MIN_CHAR_LENGTH = 20;
const MIN_WORD_COUNT = 4;

function checkTooShort(text) {
  const trimmed = text.trim();
  const wordCount = trimmed.split(/\s+/).filter((w) => w.length > 0).length;

  if (trimmed.length < MIN_CHAR_LENGTH || wordCount < MIN_WORD_COUNT) {
    return {
      pass: false,
      reason: `Entry is too short. Please provide at least ${MIN_WORD_COUNT} words and ${MIN_CHAR_LENGTH} characters.`,
    };
  }
  return { pass: true, reason: "" };
}

// ─── 4. Placeholder / Boilerplate Detection ────────────────────────────────

const PLACEHOLDER_PHRASES = [
  "lorem ipsum",
  "dolor sit amet",
  "this is a task",
  "this is a challenge",
  "this is a test",
  "test entry",
  "sample text",
  "sample entry",
  "placeholder",
  "example text",
  "example entry",
  "enter text here",
  "type here",
  "write something",
  "nothing to report",
  "n/a",
  "nil",
  "none",
  "no update",
  "no updates",
  "no progress",
  "not applicable",
  "todo",
  "to do",
  "tbd",
  "asdf",
  "qwerty",
  "foobar",
  "foo bar",
  "hello world",
  "blah blah",
  "abc123",
  "testing 123",
  "testing testing",
  "just a test",
];

function checkPlaceholder(text) {
  const lower = text.trim().toLowerCase();

  for (const phrase of PLACEHOLDER_PHRASES) {
    if (lower.includes(phrase)) {
      return {
        pass: false,
        reason: `Entry contains placeholder text ("${phrase}").`,
      };
    }
  }

  // Also flag if the entire entry (trimmed) exactly matches a very
  // generic single-word or two-word pattern
  const EXACT_MATCHES = new Set([
    "done", "completed", "finished", "ok", "okay", "yes", "no",
    "working", "in progress", "wip", "pending", "submitted",
    "nothing", "same", "same as yesterday", "same as before",
    "refer above", "see above", "as above", "ditto",
  ]);

  if (EXACT_MATCHES.has(lower)) {
    return {
      pass: false,
      reason: "Entry is a generic placeholder and does not describe actual work.",
    };
  }

  return { pass: true, reason: "" };
}

// ─── Top-level validator ───────────────────────────────────────────────────

/**
 * Validate a logbook entry against all heuristic rules.
 *
 * @param {string} text — The raw text of a single logbook field.
 * @returns {{
 *   isValid: boolean,
 *   checks: {
 *     repetitive:    { pass: boolean, reason: string },
 *     keyboardSmash: { pass: boolean, reason: string },
 *     tooShort:      { pass: boolean, reason: string },
 *     placeholder:   { pass: boolean, reason: string }
 *   }
 * }}
 */
function validateEntry(text) {
  if (typeof text !== "string") {
    return {
      isValid: false,
      checks: {
        repetitive: { pass: false, reason: "Entry must be a string." },
        keyboardSmash: { pass: true, reason: "" },
        tooShort: { pass: true, reason: "" },
        placeholder: { pass: true, reason: "" },
      },
    };
  }

  const trimmed = text.trim();

  // Empty or whitespace-only entries fail immediately
  if (trimmed.length === 0) {
    return {
      isValid: false,
      checks: {
        repetitive: { pass: true, reason: "" },
        keyboardSmash: { pass: true, reason: "" },
        tooShort: { pass: false, reason: "Entry is empty." },
        placeholder: { pass: true, reason: "" },
      },
    };
  }

  const tooShort = checkTooShort(trimmed);
  const placeholder = checkPlaceholder(trimmed);
  const repetitive = checkRepetitive(trimmed);
  const keyboardSmash = checkKeyboardSmash(trimmed);

  const isValid =
    tooShort.pass && placeholder.pass && repetitive.pass && keyboardSmash.pass;

  return {
    isValid,
    checks: {
      repetitive,
      keyboardSmash,
      tooShort,
      placeholder,
    },
  };
}

/**
 * Strict fallback when Gemini is unavailable — approximates YELLOW/GREEN via word ratio.
 */
function passesStrictQualityFallback(text) {
  const trimmed = (text || "").trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  return realWordRatio(trimmed) > 0.5 && wordCount >= 6;
}

module.exports = {
  validateEntry,
  passesStrictQualityFallback,
  // Expose individual checkers for granular use / testing
  checkRepetitive,
  checkKeyboardSmash,
  checkTooShort,
  checkPlaceholder,
};
