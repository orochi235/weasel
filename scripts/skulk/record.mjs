/** The round's written record: `docs/audits/round-<N>/README.md` and its row in `docs/hardening.md`. */

const num = (n, width = 5) => (n === undefined ? '-' : n.toFixed(1)).padStart(width);
const mtok = (n) => `${(n / 1e6).toFixed(2)}M`;
const usd = (n) => `$${n.toFixed(2)}`;
const ceiling = (s) => (s.budgetHit?.length ? `; ${s.budgetHit.join(', ')} stopped at its dollar ceiling` : '');

/** The README of round `round`, from each area's summary (`area.json`) and what became of its branch. */
export const roundReadme = ({ round, commit, date, areas, outcomes }) => {
  const rows = areas.map((s) => {
    const fate = outcomes[s.id] ?? '';
    const prev = s.previous ? `${num(s.previous.unfound)} (r${s.previous.round})` : '-';
    const fresh = s.newCode ? `${s.newCode.findings} in ${s.newCode.changedFiles} changed` : '-';
    return `| \`${s.id}\` | ${s.files.length} | ${s.read.A}/${s.read.B} | ${s.a} | ${s.b} | ${s.m} | ${s.distinct} | ${num(s.chapman)} | ${num(s.unfound)} | ${prev} | ${fresh} | ${s.patches} | ${s.questions} | ${mtok(s.jobs.tokens)} | ${usd(s.jobs.costUsd)} | ${fate}${ceiling(s)} |`;
  });
  const total = (k) => areas.reduce((sum, s) => sum + s[k], 0);
  return [
    `# Audit round ${round}`,
    '',
    `Blind pairs at \`${commit}\` (${date}), run by \`scripts/skulk\`. Each area's directory holds its file`,
    'list (`files.txt`), both reviewers\' findings (`A.md`, `B.md`), the matching (`match.json`), the fixer\'s',
    'report (`fix.md`) and the numbers below (`area.json`). The method is `docs/hardening.md`, "Blind pairs".',
    '',
    '"Read" is how many listed files each reviewer says it read. "Est." is Chapman\'s estimate of what the area held,',
    '"left" that less the distinct findings, and "last left" the previous pass\'s figure, which this pass tests.',
    '"New code" counts findings citing a file changed since that pass. "Commits" is what the fixer committed.',
    '"Tokens" adds input, output, cache creation and cache reads over the area\'s jobs; "cost" is list price.',
    'One record per job is in `usage.jsonl`. The shas in `fix.md` are the fixer\'s, on its node; the same commits',
    'as applied here are `fixCommits` in `area.json`.',
    '',
    '| Area | Files | Read A/B | A | B | Shared | Distinct | Est. | Left | Last left | New code | Commits | Questions | Tokens | Cost | Branch |',
    '|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|---|',
    ...rows,
    '',
    `Totals: ${total('distinct')} distinct findings, ${total('patches')} fix commits, ${total('questions')} questions, `
      + `${mtok(areas.reduce((s, a) => s + a.jobs.tokens, 0))} tokens, ${usd(areas.reduce((s, a) => s + a.jobs.costUsd, 0))}.`,
    '',
  ].join('\n');
};

/** The record row for `docs/hardening.md`. */
export const hardeningRow = ({ round, date, areas }) => {
  const found = areas.reduce((s, a) => s + a.distinct, 0);
  const fixed = areas.reduce((s, a) => s + a.patches, 0);
  const each = areas.map((a) => `${a.id} ${a.a}/${a.b}/${a.m}, est. ${a.chapman.toFixed(1)}`).join('; ');
  return `| ${date} | ${areas.map((a) => a.id).join(', ')} (audit round ${round}, nightly) | blind pairs | 0 | ${found} / ${fixed} commits | `
    + `Run by \`scripts/skulk\` with one file list per area; raw lists in \`docs/audits/round-${round}/\`. A/B/shared and Chapman's estimate per area: ${each}. |`;
};

/** `hardening` with `row` appended to the end of its Record table. */
export const appendRecordRow = (hardening, row) => {
  const lines = hardening.split('\n');
  const head = lines.findIndex((l) => /^## Record\b/.test(l));
  if (head < 0) throw new Error('docs/hardening.md has no "## Record" section');
  let last = -1;
  for (let i = head + 1; i < lines.length && !/^## /.test(lines[i]); i++) if (lines[i].startsWith('|')) last = i;
  if (last < 0) throw new Error('docs/hardening.md\'s Record section has no table');
  lines.splice(last + 1, 0, row);
  return lines.join('\n');
};
