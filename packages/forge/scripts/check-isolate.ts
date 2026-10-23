// Counts the stories the workshop renders in their own frame document and fails when there are more
// than it allows. Reads story sources statically and never starts vite, so it is fast.
import { repoEntries } from './repoIndex.ts';

// This number only goes down. Raising it is a reviewed edit to this file, and the story that
// needs it carries the reason in its `isolate`.
const ALLOWED = 1;

const { isolateReport } = await import('../src/vite/isolateReport.ts');

const { lines, ok } = isolateReport(await repoEntries(), ALLOWED);
console.log(lines.join('\n'));
process.exit(ok ? 0 : 1);
