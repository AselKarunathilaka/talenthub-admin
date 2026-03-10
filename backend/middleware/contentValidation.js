/**
 * Content Validation Middleware — v2
 * Detects dummy, fake, and off-topic content in trainee daily record submissions.
 *
 * Fields validated: task, stack, progress (challenges), blockers (plans)
 *
 * Checks per field:
 *  1. Minimum length & word count
 *  2. Exact blacklist match (full-text only, no substring)
 *  3. Keyboard mashing — per-token AND whole-text entropy
 *  4. Repetitive phrase/word detection
 *  5. Regex-based off-topic sentence detection (food, personal, entertainment)
 *  6. Insufficient unique vocabulary
 */

// ─── Blacklisted exact-match phrases ────────────────────────────────────────
// Only matched against the ENTIRE field text (trimmed, lowercase).
const BLACKLISTED_EXACT = [
    "nothing", "test", "n/a", "na", "same as yesterday", "same as before",
    "no task", "done", "ok", "okay", "abc", "xyz", "aaa", "bbb", "ccc",
    "todo", "tbd", "hello", "hi", "hey", "lol", "idk",
    "i don't know", "not sure", "no idea", "blah",
    "as usual", "as always", "like yesterday", "same thing",
    "some work", "a lot of work", "worked on stuff",
    "no progress", "nothing to report", "nothing much", "nothing done",
    "no challenges", "no plans", "same plan", "same as before",
];

// ─── Off-topic patterns (regex-based, sentence-level) ────────────────────────
// Only match PERSONAL/NON-WORK sentences — avoids false positives on work context.
const OFF_TOPIC_PATTERNS = [
    // Food & eating
    /\bi\s+(ate|had|ordered|cooked|prepared)\s+(breakfast|lunch|dinner|food|pizza|burger|rice|curry|noodles|coffee|tea)/i,
    /\bgot\s+(hungry|thirsty|full)\b/i,
    /\bwent\s+(out\s+)?to\s+(eat|lunch|dinner|breakfast|a\s+restaurant|a\s+cafe)/i,

    // Sleeping / waking
    /\b(woke\s+up|got\s+up)\s+(late|early|at\s+\d)/i,
    /\b(slept|went\s+to\s+bed|took\s+a\s+nap)\b/i,

    // Personal hygiene
    /\b(took|had)\s+(a\s+)?(bath|shower)\b/i,

    // Health (personal, not work-impacting context)
    /\b(felt|was)\s+(sick|tired|unwell|ill|dizzy)\s+(all\s+day|today|this\s+morning)/i,
    /\b(had|got)\s+(a\s+)?(fever|headache|stomachache|cold|flu)\b/i,

    // Relationships / people
    /\b(my\s+)?(girlfriend|boyfriend|wife|husband|mom|dad|mother|father|brother|sister)\b/i,
    /\b(went\s+to\s+a?\s+)?(wedding|birthday\s+party|party|family\s+gathering)\b/i,

    // Entertainment
    /\bwatched\s+(a\s+)?(movie|film|netflix|youtube|tiktok|anime|series|show)\b/i,
    /\b(played|was\s+playing)\s+(games?|cricket|football|chess|video\s+games?)\b/i,

    // Shopping & outings
    /\bwent\s+(shopping|to\s+the\s+mall|to\s+the\s+market|to\s+the\s+store)\b/i,
    /\bwent\s+on\s+(a\s+)?(trip|vacation|holiday|picnic)\b/i,
    /\bvisited\s+(the\s+)?(beach|temple|church|mosque|park|zoo)\b/i,
];

// ─── Work-related keywords (positive signal) ─────────────────────────────────
const WORK_KEYWORDS = [
    "implemented", "developed", "created", "built", "designed", "coded",
    "debugged", "fixed", "resolved", "refactored", "optimized", "deployed",
    "tested", "reviewed", "merged", "committed", "pushed", "pulled",
    "api", "database", "frontend", "backend", "ui", "ux", "component",
    "function", "module", "class", "method", "endpoint", "route",
    "react", "node", "express", "mongodb", "javascript", "python", "java",
    "html", "css", "sql", "git", "docker", "aws", "server", "client",
    "meeting", "discussion", "review", "presentation", "report",
    "requirement", "feature", "bug", "issue", "task", "project",
    "documentation", "research", "analysis", "planning", "sprint",
    "integration", "configuration", "setup", "installation",
    "validation", "authentication", "authorization", "performance",
    "workflow", "pipeline", "deployment", "monitoring", "logging",
    "worked on", "working on", "completed", "finished", "in progress",
    "pull request", "code review", "unit test",
];

// ─── Stop words for vocabulary count ─────────────────────────────────────────
const STOP_WORDS = new Set([
    "i", "a", "an", "the", "and", "or", "but", "in", "on", "at",
    "to", "for", "of", "with", "by", "is", "was", "are", "were",
    "my", "me", "it", "this", "that", "had", "have", "has",
    "did", "do", "done", "be", "been", "from", "as", "up", "so",
    "we", "our", "us", "its", "not", "no", "if", "am", "also",
    "then", "when", "where", "which", "who", "what", "how",
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Detects keyboard mashing using two approaches:
 * 1. Keyboard-row pattern regex per individual word (asdf/qwert/zxcv runs of 6+)
 * 2. Per-token entropy: if ANY long single word has very low char diversity
 *
 * IMPORTANT: Pattern applied per-word, not on space-stripped full text,
 * to prevent cross-word false positives (e.g. "API routes" -> "APIroutes").
 */
function hasKeyboardMashing(text) {
    const keyboardRowPattern = /^[asdfghjkl]{6,}$|^[qwertyuiop]{6,}$|^[zxcvbnm]{6,}$|[asdfghjkl]{7,}|[qwertyuiop]{7,}|[zxcvbnm]{7,}/i;

    const tokens = text.split(/\s+/).filter(w => w.length >= 6);
    for (const token of tokens) {
        const lower = token.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (lower.length < 6) continue;

        // Pattern 1: Keyboard row run within a single word
        if (keyboardRowPattern.test(lower)) return true;

        // Pattern 2: Per-token entropy for long words only (>= 8 chars)
        if (lower.length >= 8) {
            const uniqueChars = new Set(lower.split(""));
            const ratio = uniqueChars.size / lower.length;
            if (ratio < 0.35) return true;
        }
    }

    return false;
}

/**
 * Returns true if a phrase repeats 3+ times in text.
 * e.g. "worked on react worked on react worked on react"
 */
function hasRepetitivePhrases(text) {
    // Char-level repetition e.g. "aaaaaaa"
    if (/(.)\1{5,}/.test(text)) return true;

    // Word-level: check if same bigram (2-word pair) repeats 3+ times
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    if (words.length < 6) return false;

    const bigrams = {};
    for (let i = 0; i < words.length - 1; i++) {
        const bigram = `${words[i]} ${words[i + 1]}`;
        bigrams[bigram] = (bigrams[bigram] || 0) + 1;
        if (bigrams[bigram] >= 3) return true;
    }

    // Single-word domination: >55% is same word
    const counts = {};
    for (const word of words) {
        if (STOP_WORDS.has(word)) continue;
        counts[word] = (counts[word] || 0) + 1;
    }
    const vals = Object.values(counts);
    if (vals.length === 0) return false;
    const maxRepeat = Math.max(...vals);
    const meaningfulWords = words.filter(w => !STOP_WORDS.has(w));
    return meaningfulWords.length > 4 && maxRepeat / meaningfulWords.length > 0.55;
}

/**
 * Checks if text is ENTIRELY a blacklisted phrase (exact full-text match).
 */
function isEntirelyBlacklisted(text) {
    const lower = text.toLowerCase().trim();
    return BLACKLISTED_EXACT.includes(lower);
}

/**
 * Detects off-topic personal content using regex sentence patterns.
 * Only flags if there is NO compensating work context.
 */
function detectOffTopicContent(text) {
    const lower = text.toLowerCase();
    const matchedPatterns = [];

    for (const pattern of OFF_TOPIC_PATTERNS) {
        if (pattern.test(lower)) {
            matchedPatterns.push(pattern.source.replace(/\\b|\\s\+|\(|\)|\/i/g, " ").trim().slice(0, 40));
        }
    }

    if (matchedPatterns.length === 0) {
        return { isOffTopic: false, matchedPatterns: [] };
    }

    // Check if there's enough work context to override the off-topic signal
    let workScore = 0;
    for (const keyword of WORK_KEYWORDS) {
        if (lower.includes(keyword)) workScore++;
    }

    // Off-topic wins only if very little work context
    const isOffTopic = workScore < 2;
    return { isOffTopic, matchedPatterns };
}

/**
 * Counts unique meaningful words (ignores stop words).
 */
function countUniqueWords(text) {
    const words = text.toLowerCase().split(/\s+/)
        .map(w => w.replace(/[^a-z]/g, ""))
        .filter(w => w.length > 2 && !STOP_WORDS.has(w));
    return new Set(words).size;
}

// ─── Field Validator ──────────────────────────────────────────────────────────

/**
 * Validates a single text field with all quality checks.
 * @param {string} text - Field content
 * @param {string} fieldLabel - Display name for error messages (e.g. "Task description")
 * @param {object} options - { minLength, minWords, checkOffTopic, skipIfDefault, defaultValues }
 * @returns {string[]} Array of validation error messages (empty = valid)
 */
function validateField(text, fieldLabel, options = {}) {
    const {
        minLength = 20,
        minWords = 5,
        checkOffTopic = true,
        skipIfDefault = false,
        defaultValues = [],
    } = options;

    const errors = [];

    if (!text || text.trim().length === 0) return errors;
    const trimmed = text.trim();

    // Skip if it matches a known default value
    if (skipIfDefault && defaultValues.includes(trimmed)) return errors;

    // 1. Minimum length
    if (trimmed.length < minLength) {
        errors.push(`${fieldLabel} is too short (minimum ${minLength} characters). Please be more descriptive.`);
    }

    // 2. Minimum word count
    const wordCount = trimmed.split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount < minWords) {
        errors.push(`${fieldLabel} needs more detail — use at least ${minWords} words.`);
    }

    // 3. Exact blacklist match
    if (isEntirelyBlacklisted(trimmed)) {
        errors.push(`${fieldLabel} appears to be a placeholder or generic phrase. Please describe your actual work.`);
    }

    // 4. Keyboard mashing
    if (hasKeyboardMashing(trimmed)) {
        errors.push(`${fieldLabel} appears to contain random/meaningless characters. Please enter real content.`);
    }

    // 5. Repetitive phrases
    if (hasRepetitivePhrases(trimmed)) {
        errors.push(`${fieldLabel} contains excessively repeated words or phrases. Please provide genuine details.`);
    }

    // 6. Off-topic content
    if (checkOffTopic) {
        const offTopic = detectOffTopicContent(trimmed);
        if (offTopic.isOffTopic) {
            errors.push(
                `${fieldLabel} appears to describe personal activities rather than work. ` +
                `Please describe your actual work-related activities.`
            );
        }
    }

    // 7. Unique vocabulary check (only for longer texts)
    if (trimmed.length >= 30) {
        const uniqueWords = countUniqueWords(trimmed);
        if (uniqueWords < 3) {
            errors.push(`${fieldLabel} lacks varied vocabulary. Please provide a more detailed and genuine description.`);
        }
    }

    return errors;
}

// ─── Main Validation Function ─────────────────────────────────────────────────

/**
 * Validates all daily record fields for quality and relevance.
 * @param {object} fields - { task, stack, progress, blockers, status }
 * @returns {{ valid: boolean, reasons: string[], flagged: boolean, flagReason: string|null }}
 */
function validateDailyRecordContent({ task, stack, progress, blockers, status }) {
    const reasons = [];

    // Skip all validation for leave records
    if (status === "leave") {
        return { valid: true, reasons: [], flagged: false, flagReason: null };
    }

    // ── Task / Tasks Completed ─────────────────────────────────────────────────
    reasons.push(...validateField(task, "Tasks Completed", {
        minLength: 20,
        minWords: 5,
        checkOffTopic: true,
    }));

    // ── Stack ──────────────────────────────────────────────────────────────────
    reasons.push(...validateField(stack, "Stack/Technology", {
        minLength: 2,
        minWords: 1,
        checkOffTopic: false, // Stack is usually just a tech name
    }));

    // ── Progress / Challenges Faced ────────────────────────────────────────────
    reasons.push(...validateField(progress, "Challenges Faced", {
        minLength: 10,
        minWords: 3,
        checkOffTopic: true,
        skipIfDefault: true,
        defaultValues: ["No challenges faced", "no challenges faced"],
    }));

    // ── Blockers / Plans for Tomorrow ──────────────────────────────────────────
    reasons.push(...validateField(blockers, "Plans for Tomorrow", {
        minLength: 10,
        minWords: 3,
        checkOffTopic: true,
        skipIfDefault: true,
        defaultValues: ["No specific plans", "no specific plans"],
    }));

    const valid = reasons.length === 0;

    // Determine primary flag reason for DB storage
    let flagReason = null;
    if (!valid) {
        if (reasons.some(r => r.includes("personal activities"))) flagReason = "off_topic_content";
        else if (reasons.some(r => r.includes("random"))) flagReason = "low_entropy";
        else if (reasons.some(r => r.includes("placeholder"))) flagReason = "blacklisted_phrase";
        else if (reasons.some(r => r.includes("too short"))) flagReason = "too_short";
        else if (reasons.some(r => r.includes("repeated"))) flagReason = "repetitive_content";
        else flagReason = "quality_check_failed";
    }

    return { valid, reasons, flagged: !valid, flagReason };
}

module.exports = {
    validateDailyRecordContent,
    // Export helpers for frontend-side use if needed
    detectOffTopicContent,
    hasKeyboardMashing,
};
