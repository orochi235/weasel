/** Reading a reviewer's findings file and checking the matcher's answer against the two lists. */
import { FIXED_MARK } from './progress.mjs';

/** The `##` sections of a findings file, each `{ claim, where, body }`. */
export const parseFindings = (text) => {
  const sections = text.split(/^## /m).slice(1);
  return sections.map((section) => {
    const [claim, ...rest] = section.split('\n');
    const body = rest.join('\n').replace(/<!--[\s\S]*?-->/g, '').trim();
    const where = /^- where:\s*(.+)$/m.exec(body)?.[1].trim() ?? '';
    return { claim: claim.trim(), where, body };
  }).filter((f) => f.claim.length > 0 && f.claim.toLowerCase() !== 'files read');
};

/** The files a reviewer says it read: the lines under a `## Files read` heading. */
export const parseFilesRead = (text) => {
  const m = /^## Files read\s*\n([\s\S]*?)(?=^## |<!--|$(?![\s\S]))/im.exec(text);
  if (!m) return [];
  return m[1].split('\n').map((line) => line.replace(/^[-*]\s*/, '').replace(/`/g, '').trim()).filter(Boolean);
};

const DONE = /<!--\s*done:/i;

/** Whether a reviewer's report reached the brief's closing `done` line. */
export const isFinished = (text) => DONE.test(text);

/**
 * A reviewer's report: its findings file once that ends in the brief's `done` line, else whichever of the
 * file and the reply holds more `##` sections. A reviewer can write the file early and finish only in the reply, and the file then
 * holds part of the pass.
 */
export const reviewText = (file, reply = '') => {
  if (DONE.test(file)) return file;
  const sections = (text) => text.match(/^## /gm)?.length ?? 0;
  return sections(reply) > sections(file) ? reply : file || reply;
};

/** The repo paths a finding's `where` line cites. */
export const citedPaths = (finding) => [...finding.where.matchAll(/((?:packages|apps)\/[\w./@-]+\.\w+)/g)].map((m) => m[1]);

/**
 * The pairs of a matcher reply, kept only where both indexes exist and neither is used twice:
 * Chapman counts each shared defect once.
 */
export const validPairs = (pairs, a, b) => {
  const usedA = new Set();
  const usedB = new Set();
  const kept = [];
  for (const pair of Array.isArray(pairs) ? pairs : []) {
    const [i, j] = pair;
    if (!Number.isInteger(i) || !Number.isInteger(j) || i < 0 || j < 0 || i >= a || j >= b) continue;
    if (usedA.has(i) || usedB.has(j)) continue;
    usedA.add(i);
    usedB.add(j);
    kept.push([i, j]);
  }
  return kept;
};

/** The first JSON object in a model's reply, which may wrap it in prose or a code fence. */
export const firstJson = (text) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('no JSON object in the reply');
  return JSON.parse(text.slice(start, end + 1));
};

/** The matcher's prompt: both lists, numbered from 0, claim and location only. */
export const matchPrompt = (brief, a, b) => {
  const list = (findings) => findings.map((f, i) => `${i}. ${f.claim}\n   where: ${f.where}`).join('\n');
  return `${brief}\n\n# List A\n\n${list(a) || '(empty)'}\n\n# List B\n\n${list(b) || '(empty)'}\n`;
};

/** A verdict whose note says it answers a finding another line already did. */
const DUPLICATE = /^\(?duplicate\b/i;

const TALLY = /^tally: (\d+) of (\d+) fixed, (\d+) extra fixed\s*$/im;
const VERDICT = /\bfixed (?:in )?`?[0-9a-f]{7,}|\bnot a defect\b|\bquestion\b|\bduplicate of\b|\bnot fixed\b|\bdeclined\b/i;
const EXTRAS = /^\W*(?:any )?extra\b/i;
const CHECKS = /^\W*checks\b/i;
const SOURCE = /\((A\+B|A|B|sweep)\)|,\s*(A\+B|A|B|sweep)\s*:/;
const SHAS = /^(?:fixed (?:in )?)?`?[0-9a-f]{7,}`?(?:(?:,| and) `?[0-9a-f]{7,}`?)*[-\w]*/i;

/** A report's text with markdown emphasis and list marks off. */
const plain = (text) => text.replace(/^\s*[-*]\s+/, '').replace(/\*\*/g, '').trim();

/** What a verdict paragraph says of its finding: fixed, not a defect, a question, or a duplicate. */
const verdictOf = (text) => (FIXED_MARK.test(text) ? 'fixed'
  : /\bnot a defect\b/i.test(text) ? 'not a defect'
  : /\bduplicate of\b/i.test(text) ? 'duplicate'
  : /\bquestion\b/i.test(text) ? 'question'
  : 'not fixed');

/**
 * One defect as a fixer's report tells it: what was broken (`claim`), which reviewer listed it (`from`, `extra` for one
 * the fixer found itself), what became of it, and what the fix changed (`note`), from either way fixers write a line:
 * `claim (A): fixed <sha>. note`, or `fixed <sha> | claim (A). note`.
 */
const itemOf = (para, extra) => {
  const text = plain(para);
  const source = SOURCE.exec(text);
  const from = extra ? 'extra' : source ? source[1] ?? source[2] : '';
  const verdict = verdictOf(text);
  const piped = /^([^|]{0,80})\|\s*(.*)$/s.exec(text);
  let claim; let note;
  if (piped && VERDICT.test(piped[1])) {
    const rest = piped[2];
    const at = source ? rest.indexOf(source[0]) : -1;
    claim = at === -1 ? rest.split(/(?<=\.)\s/)[0] : rest.slice(0, at);
    note = at === -1 ? rest.slice(claim.length) : rest.slice(at + source[0].length);
  } else {
    const at = text.search(VERDICT);
    claim = text.slice(0, at === -1 ? text.length : at);
    note = at === -1 ? '' : text.slice(at).replace(SHAS, '');
  }
  claim = claim.replace(SOURCE, '').replace(/[\s:,.;—-]+$/, '').trim();
  note = note.replace(/^[\s.:;,)—-]+/, '').replace(/^not a defect\b[\s.:;,—-]*/i, '').trim();
  return { claim, from, verdict, note };
};

/**
 * Every defect a fixer's report answers, in its order: those it was handed, then the extras it found, the checks left
 * out. A paragraph is a defect when it gives a verdict.
 */
export const reportItems = (report) => {
  const paras = report.split(/\n\s*\n|\n(?=\S)/).map((p) => p.trim()).filter(Boolean);
  const checks = paras.findIndex((p) => CHECKS.test(p));
  const body = checks === -1 ? paras : paras.slice(0, checks);
  const cut = body.findIndex((p) => EXTRAS.test(p));
  return body.flatMap((p, i) => (VERDICT.test(p) && !/^tally: /i.test(p) && !EXTRAS.test(p) ? [itemOf(p, cut !== -1 && i > cut)] : []));
};

/**
 * What a fixer's report says it did: of the `of` findings it answered, how many it `fixed`, and the `extra` defects
 * nobody had listed that it fixed besides. Counted from its verdicts ({@link reportItems}), each finding once: a fixer's own
 * `tally:` line miscounts (round 49's geom.part1 said "8 of 9" over eight fixed lines, one a duplicate, and an extra),
 * so it is read only when no verdict parses. The fixer's list splits and joins findings unlike the match, so `of` is
 * its count, not the round's. Null for a report with no verdicts.
 */
export const fixTallyOf = (report) => {
  const items = reportItems(report);
  const listed = items.filter((i) => i.from !== 'extra' && !DUPLICATE.test(i.note));
  if (listed.length === 0) {
    const t = TALLY.exec(report);
    return t ? { fixed: Number(t[1]), of: Number(t[2]), extra: Number(t[3]) } : null;
  }
  return { fixed: listed.filter((i) => i.verdict === 'fixed').length, of: listed.length, extra: items.filter((i) => i.from === 'extra' && i.verdict === 'fixed').length };
};
