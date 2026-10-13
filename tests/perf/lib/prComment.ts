/**
 * The pull request comment `.github/workflows/perf-pr.yml` posts: the
 * `perf:compare` report for the base and head revisions.
 */

/** First line of the comment, so a later run finds and rewrites its own. */
export const COMMENT_MARKER = '<!-- weasel-perf-compare -->';

/** GitHub refuses a comment body past 65,536 characters. */
export const MAX_COMMENT_CHARS = 60_000;

export function commentBody(report: string, shas: { base: string; head: string }): string {
  const head = [
    COMMENT_MARKER,
    '### Benchmarks',
    '',
    `a is the commit this branch forked from, \`${shas.base.slice(0, 10)}\`; b is this pull request, \`${shas.head.slice(0, 10)}\`. ` +
      'Both ran back to back on the same machine. Nothing here gates the build: read a ratio against ' +
      'the spread of its neighbors before believing it (`tests/perf/README.md`).',
    '',
  ].join('\n');

  const text = report.trim();
  if (!text) return `${head}\nNo benchmark wrote a result on both revisions; see the job log.\n`;

  const cutNote = '\nThe report was cut short to fit a comment; the job\'s artifact holds every result file.\n';
  const fence = (s: string) => `\`\`\`\n${s}\n\`\`\`\n`;
  const room = MAX_COMMENT_CHARS - head.length - fence('').length - cutNote.length;
  if (text.length <= room) return head + fence(text);
  const cut = text.slice(0, room);
  return head + fence(cut.slice(0, cut.lastIndexOf('\n'))) + cutNote;
}
