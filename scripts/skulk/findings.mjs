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
