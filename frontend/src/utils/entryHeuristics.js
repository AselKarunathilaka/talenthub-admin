/**
 * entryHeuristics.js — Client-side entry quality assessment for logbook fields.
 *
 * Mirrors the backend heuristics (backend/utils/heuristics.js) and adds a
 * three-tier quality level used by the EntryFeedbackIndicator component.
 *
 * Levels:
 *   1 (RED)    — Bad entry (types 1-4: repetitive, keyboard smash, too short, placeholder)
 *   2 (YELLOW) — Passes hard rules but lacks technical specificity
 *   3 (GREEN)  — Good, work-related, specific and descriptive entry
 */

// ─── 1. Repetitive Characters / Substrings ──────────────────────────────────

function hasSingleCharRepetition(text) {
  const cleaned = text.replace(/\s/g, "").toLowerCase();
  if (cleaned.length === 0) return false;
  const freq = {};
  for (const ch of cleaned) freq[ch] = (freq[ch] || 0) + 1;
  const maxFreq = Math.max(...Object.values(freq));
  return maxFreq / cleaned.length > 0.6;
}

function hasSubstringRepetition(text) {
  const cleaned = text.replace(/\s/g, "").toLowerCase();
  if (cleaned.length < 6) return false;
  for (let len = 2; len <= Math.min(20, Math.floor(cleaned.length / 2)); len++) {
    const pattern = cleaned.slice(0, len);
    let count = 0;
    let idx = 0;
    while (idx <= cleaned.length - len) {
      if (cleaned.slice(idx, idx + len) === pattern) { count++; idx += len; }
      else { idx++; }
    }
    if (count >= 3 && (count * len) / cleaned.length >= 0.7) return true;
  }
  return false;
}

function checkRepetitive(text) {
  if (hasSingleCharRepetition(text))
    return { pass: false, reason: "Entry contains excessively repeated characters." };
  if (hasSubstringRepetition(text))
    return { pass: false, reason: "Entry contains a repeating pattern of text." };
  return { pass: true, reason: "" };
}

// ─── 2. Keyboard Smash / Gibberish ──────────────────────────────────────────

const KEYBOARD_ROWS = [
  new Set("qwertyuiop"),
  new Set("asdfghjkl"),
  new Set("zxcvbnm"),
];
const VOWELS = new Set("aeiou");

const COMMON_WORDS = new Set([
  "a","an","the","and","or","but","if","in","on","at","to","for","of","with",
  "by","from","as","is","it","be","was","are","were","been","has","had","have",
  "do","did","does","will","would","can","could","shall","should","may","might",
  "not","no","yes","so","up","out","about","into","over","after","before",
  "between","under","above","below","through","during","since","until","this",
  "that","these","those","my","your","his","her","its","our","their","we",
  "they","he","she","me","him","them","us","i","you","who","what","where",
  "when","how","which","than","then","also","just","more","some","any","all",
  "each","every","both","few","most","other","such","only","own","same","very",
  "here","there","now","well","too",
  // Common verbs
  "added","add","apply","applied","build","built","change","changed","check",
  "checked","clean","cleaned","close","closed","code","coded","complete",
  "completed","configure","configured","connect","connected","create","created",
  "debug","debugged","define","defined","delete","deleted","deploy","deployed",
  "design","designed","develop","developed","discuss","discussed","document",
  "documented","download","downloaded","edit","edited","enable","enabled",
  "ensure","error","errors","execute","executed","explore","explored","export",
  "exported","fetch","fetched","find","finish","finished","fix","fixed",
  "format","formatted","generate","generated","get","got","handle","handled",
  "help","helped","identify","identified","implement","implemented","import",
  "imported","improve","improved","include","included","initialize",
  "initialized","inspect","install","installed","integrate","integrated",
  "investigate","investigated","join","keep","launch","launched","learn",
  "learned","link","linked","list","load","loaded","log","logged","make",
  "made","manage","managed","map","mapped","merge","merged","migrate",
  "migrated","modify","modified","monitor","monitored","move","moved","need",
  "needed","open","opened","optimize","optimized","parse","parsed","plan",
  "planned","prepare","prepared","process","processed","publish","published",
  "push","pushed","query","queried","read","receive","received","refactor",
  "refactored","release","released","remove","removed","render","rendered",
  "replace","replaced","report","reported","request","requested","require",
  "required","research","researched","resolve","resolved","restart","restarted",
  "restore","restored","restructure","restructured","retrieve","retrieved",
  "review","reviewed","revise","revised","run","running","save","saved","scan",
  "scanned","schedule","scheduled","search","searched","secure","secured",
  "send","sent","serve","served","set","setup","show","shown","solve","solved",
  "sort","sorted","split","start","started","stop","stopped","store","stored",
  "structure","structured","study","studied","submit","submitted","support",
  "supported","sync","synced","take","test","tested","trace","traced","track",
  "tracked","transfer","transferred","trigger","triggered","troubleshoot",
  "try","tried","update","updated","upgrade","upgraded","upload","uploaded",
  "use","used","using","validate","validated","verify","verified","view",
  "viewed","work","worked","working","write","wrote","written",
  // Software-engineering nouns
  "access","account","admin","algorithm","analytics","api","app","application",
  "architecture","array","asset","auth","authentication","authorization","aws",
  "azure","backend","backup","batch","blockchain","boolean","branch","browser",
  "buffer","bug","bugs","cache","callback","certificate","channel","chart","ci",
  "class","client","cloud","cluster","column","command","commit","communication",
  "compiler","component","components","config","configuration","connection",
  "console","constant","container","content","context","controller","cookie",
  "cors","cpu","credential","cron","crud","css","csv","dashboard","data",
  "database","dataset","db","dependency","deployment","development","device",
  "devops","directory","docker","dom","domain","driver","email","encryption",
  "endpoint","engine","entry","enum","environment","event","exception","express",
  "extension","feature","feedback","field","file","files","filter","firebase",
  "firewall","fix","flag","flask","flow","folder","font","footer","form",
  "format","framework","frontend","function","functions","gateway","git",
  "github","gitlab","graphql","grid","gui","handler","header","hook","hooks",
  "host","hosting","hotfix","html","http","https","icon","ide","image","index",
  "infrastructure","input","instance","interface","internet","issue","issues",
  "java","javascript","jest","jira","job","json","jwt","kafka","kernel","key",
  "kotlin","kubernetes","lambda","language","layout","level","library","linux",
  "loader","local","localhost","logic","login","logout","loop","machine",
  "memory","menu","message","method","microservice","middleware","migration",
  "mobile","mock","modal","model","module","mongodb","mongoose","mysql",
  "navbar","navigation","network","nginx","node","notification","npm","null",
  "number","oauth","object","observer","operator","option","orm","os","output",
  "package","padding","page","panel","parameter","parser","password","patch",
  "path","pattern","payload","pdf","performance","permission","pipeline",
  "platform","plugin","pod","popup","port","postgres","postman","priority",
  "production","profile","program","progress","project","promise","prompt",
  "properties","protocol","provider","proxy","pull","python","queue","react",
  "readme","redis","reducer","redux","reference","regex","register","release",
  "remote","renderer","repo","repository","request","response","rest","restful",
  "result","role","rollback","route","router","routing","runtime","sass",
  "schema","scope","script","sdk","security","selector","server","serverless",
  "service","session","settings","sidebar","signup","slack","snippet","socket",
  "software","solution","source","sprint","sql","ssh","ssl","stack","staging",
  "state","status","storage","store","stream","string","style","stylesheet",
  "subscription","swagger","switch","symbol","syntax","system","table","tag",
  "tailwind","task","tasks","team","template","terminal","testing","thread",
  "ticket","timeout","timestamp","tls","toast","token","tool","tooltip",
  "tracking","traffic","transaction","tree","trigger","troubleshooting",
  "typescript","ubuntu","ui","unit","unix","url","user","users","util",
  "utility","ux","validation","value","variable","version","virtual","vm",
  "vue","web","webhook","webpack","websocket","widget","window","wizard",
  "workflow","wrapper","xml","yaml","yarn",
  // Common adjectives / adverbs
  "new","old","first","last","next","previous","main","current","initial",
  "final","full","partial","basic","advanced","complete","remaining","existing",
  "pending","successful","failed","minor","major","critical","relevant",
  "related","different","specific","additional","multiple","several","various",
  "separate","individual","daily","weekly","monthly","today","yesterday","done",
  "ongoing","recently","properly","correctly","successfully","across","along",
  "around","still","yet","already","again",
  // Meeting / process words
  "meeting","standup","scrum","agile","sprint","backlog","demo","presentation",
  "review","retrospective","blocker","blockers","challenge","challenges",
  "issue","dependency","deadline","milestone","release","deployment",
  "production","staging","development","environment","progress","status",
  "ticket","story","epic",
]);

function hasKeyboardRowBias(text) {
  const alpha = text.toLowerCase().replace(/[^a-z]/g, "");
  if (alpha.length < 5) return false;
  for (const row of KEYBOARD_ROWS) {
    let count = 0;
    for (const ch of alpha) if (row.has(ch)) count++;
    if (count / alpha.length > 0.7) return true;
  }
  return false;
}

function hasLowVowelRatio(text) {
  const alpha = text.toLowerCase().replace(/[^a-z]/g, "");
  if (alpha.length < 8) return false;
  let v = 0;
  for (const ch of alpha) if (VOWELS.has(ch)) v++;
  return v / alpha.length < 0.15;
}

function realWordRatio(text) {
  const tokens = text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;
  let hits = 0;
  for (const t of tokens) if (COMMON_WORDS.has(t)) hits++;
  return hits / tokens.length;
}

function isNonAlphaGibberish(text) {
  const cleaned = text.replace(/\s/g, "");
  if (cleaned.length < 3) return false;
  const alpha = cleaned.replace(/[^a-zA-Z]/g, "");
  return alpha.length / cleaned.length < 0.3;
}

function checkKeyboardSmash(text) {
  if (isNonAlphaGibberish(text))
    return { pass: false, reason: "Entry appears to be random numbers or symbols." };
  if (hasKeyboardRowBias(text))
    return { pass: false, reason: "Entry looks like keyboard smashing." };
  if (hasLowVowelRatio(text))
    return { pass: false, reason: "Entry appears to be random characters." };
  const tokens = text.trim().split(/\s+/);
  if (tokens.length >= 3 && realWordRatio(text) < 0.3)
    return { pass: false, reason: "Entry does not contain meaningful words." };
  return { pass: true, reason: "" };
}

// ─── 3. Too Short ───────────────────────────────────────────────────────────

const MIN_CHARS = 20;
const MIN_WORDS = 4;

function checkTooShort(text) {
  const trimmed = text.trim();
  const wc = trimmed.split(/\s+/).filter(Boolean).length;
  if (trimmed.length < MIN_CHARS || wc < MIN_WORDS)
    return { pass: false, reason: `Please provide at least ${MIN_WORDS} words and ${MIN_CHARS} characters.` };
  return { pass: true, reason: "" };
}

// ─── 4. Placeholder Content ────────────────────────────────────────────────

const PLACEHOLDER_PHRASES = [
  "lorem ipsum","dolor sit amet","this is a task","this is a challenge",
  "this is a test","test entry","sample text","sample entry","placeholder",
  "example text","example entry","enter text here","type here",
  "write something","nothing to report","n/a","nil","none","no update",
  "no updates","no progress","not applicable","todo","to do","tbd","asdf",
  "qwerty","foobar","foo bar","hello world","blah blah","abc123",
  "testing 123","testing testing","just a test",
];

const EXACT_PLACEHOLDERS = new Set([
  "done","completed","finished","ok","okay","yes","no","working",
  "in progress","wip","pending","submitted","nothing","same",
  "same as yesterday","same as before","refer above","see above",
  "as above","ditto",
]);

function checkPlaceholder(text) {
  const lower = text.trim().toLowerCase();
  for (const p of PLACEHOLDER_PHRASES) {
    if (lower.includes(p))
      return { pass: false, reason: `Entry contains placeholder text ("${p}").` };
  }
  if (EXACT_PLACEHOLDERS.has(lower))
    return { pass: false, reason: "Entry is a generic placeholder and does not describe actual work." };
  return { pass: true, reason: "" };
}

// ─── Top-level quality assessment ──────────────────────────────────────────

/**
 * Synchronous fast check for local RED rules only.
 * Returns null if it passes the local heuristics.
 */
export function evaluateLocalHeuristicsSync(text) {
  if (typeof text !== "string" || text.trim().length === 0) {
    return { level: 0, label: "", color: "", feedback: "" };
  }

  const trimmed = text.trim();
  const results = [
    checkTooShort(trimmed),
    checkPlaceholder(trimmed),
    checkRepetitive(trimmed),
    checkKeyboardSmash(trimmed),
  ];

  const failed = results.find((r) => !r.pass);
  if (failed) {
    return {
      level: 1,
      label: "Poor Quality",
      color: "red",
      feedback: failed.reason,
    };
  }
  return null;
}

/**
 * Formats batch API result for EntryFeedbackIndicator (YELLOW or GREEN).
 */
export function formatValidationResult(valid, reason = "") {
  if (!valid) {
    return {
      level: 2,
      label: "Needs Improvement",
      feedback:
        reason ||
        "This doesn't look work-related. Try describing your internship tasks.",
      color: "yellow",
    };
  }
  return {
    level: 3,
    label: "Good Entry",
    feedback: "Work-related and acceptable.",
    color: "green",
  };
}

/**
 * Maps legacy { valid, reason } objects to indicator assessment.
 */
export function validationResultToAssessment(apiResult) {
  if (!apiResult) return null;
  if (typeof apiResult.level === "number") return apiResult;
  return formatValidationResult(apiResult.valid !== false, apiResult.reason);
}
