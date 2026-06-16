/**
 * templateRegistry.js
 *
 * Central registry of all available PDF templates.
 * To add a new university template:
 *   1. Create `yourUniTemplate.js` in this folder.
 *   2. `require` it here and add it to the TEMPLATES array.
 */

const defaultTemplate = require("./defaultTemplate");
//const nsbmTemplate = require("./NsbmTemplate");
const sliitTemplate = require("./SliitTemplate");
const iitTemplate = require("./IitTemplate");

/**
 * Each entry must export:
 *   id       {string}  — URL-safe identifier used in the request query (?template=...)
 *   label    {string}  — Human-readable name shown in the UI dropdown
 *   generate {async fn(records, opts) => Buffer}
 */
const TEMPLATES = [
  defaultTemplate, // id: "default"  — Standard SLT template
  //nsbmTemplate, // id: "nsbm"     — NSBM Green University
  sliitTemplate, // id: "sliit"    — SLIIT
  iitTemplate, // id: "iit"      — IIT
];

/** Map for O(1) lookup by id. */
const TEMPLATE_MAP = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));

/**
 * Resolve a template by its id string.
 * Falls back to the default template when the id is unknown.
 */
const getTemplate = (id) => TEMPLATE_MAP[id] ?? defaultTemplate;

/**
 * Returns all templates as { id, label } pairs, suitable for sending to the
 * frontend so it can populate the dropdown.
 */
const listTemplates = () => TEMPLATES.map(({ id, label }) => ({ id, label }));

module.exports = { getTemplate, listTemplates, TEMPLATES };
