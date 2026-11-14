// Fails when a story title's last segment, the name the Components view gives it, is not a component name, or when a
// ui story is not titled for the component folder it sits in.
import { resolve } from 'node:path';
import { folderExports } from './exportNames.ts';
import { repoEntries, repoRoot } from './repoIndex.ts';

const { titleReport } = await import('../src/vite/titleReport.ts');
const { folderTitleReport } = await import('../src/vite/folderTitles.ts');

const entries = await repoEntries();
const rule = { library: 'ui', src: 'packages/ui/src', components: 'components' };
const reports = [
  titleReport(entries, repoRoot),
  folderTitleReport(entries, rule, (folder) => folderExports(resolve(repoRoot, rule.src, rule.components, folder)), repoRoot),
];
console.log(reports.flatMap((report) => report.lines).join('\n'));
process.exit(reports.every((report) => report.ok) ? 0 : 1);
