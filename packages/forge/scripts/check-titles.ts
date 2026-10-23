// Fails when a story title's last segment, the name the Components view gives it, is not a component name.
import { repoEntries, repoRoot } from './repoIndex.ts';

const { titleReport } = await import('../src/vite/titleReport.ts');

const { lines, ok } = titleReport(await repoEntries(), repoRoot);
console.log(lines.join('\n'));
process.exit(ok ? 0 : 1);
