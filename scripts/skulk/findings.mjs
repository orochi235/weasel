/** Reading a reviewer's findings file and checking the matcher's answer against the two lists. */

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

const TALLY = /^tally: (\d+) of (\d+) fixed, (\d+) extra fixed\s*$/im;

/**
 * What a fixer's report says it did, from its closing `tally:` line: how many of the `of` findings it was given it
 * fixed, and how many defects nobody had listed it fixed besides. Null for a report with no tally, as every report
 * before round 47's later fixers has: their prose lists findings split and merged unlike the match, so no count read
 * from it is comparable with the round's.
 */
export const fixTallyOf = (report) => {
  const t = TALLY.exec(report);
  return t ? { fixed: Number(t[1]), of: Number(t[2]), extra: Number(t[3]) } : null;
};
