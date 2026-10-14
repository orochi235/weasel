// Write a GitHub release for each package a release run published, with that
// package's changelog section as the body.
//
//   PUBLISHED='[{"name":"@weasel-js/core","version":"1.10.0"}]' node scripts/github-releases.mjs
//
// `changesets/action` can do this itself, but it sends the section whole, and
// GitHub refuses a body over 125,000 characters: 1.10.0's core section was
// 135,412, and the step failed after every package was on npm. Needs `gh`
// authenticated (GH_TOKEN) and GITHUB_REPOSITORY, both set in the release job.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { changelogSection, releaseBody } from './lib/release-notes.mjs';
import { publishableWorkspaces, repoRoot } from './lib/workspaces.mjs';

const published = JSON.parse(process.env.PUBLISHED ?? '[]');
const repository = process.env.GITHUB_REPOSITORY;
if (!repository) throw new Error('github-releases: GITHUB_REPOSITORY is not set');

const dirs = new Map(publishableWorkspaces().map(({ dir, manifest }) => [manifest.name, dir]));
const scratch = mkdtempSync(join(tmpdir(), 'weasel-release-notes-'));
const gh = (args, stdio = 'inherit') => execFileSync('gh', args, { stdio });

const failed = [];
try {
  published.forEach(({ name, version }, i) => {
    const tag = `${name}@${version}`;
    const position = `${i + 1}/${published.length}`;
    try {
      const dir = dirs.get(name);
      if (!dir) throw new Error('not a publishable workspace');
      try {
        gh(['release', 'view', tag, '--json', 'tagName'], 'ignore');
        console.log(`${position} ${tag}: already released`);
        return;
      } catch {}
      const section = changelogSection(readFileSync(join(dir, 'CHANGELOG.md'), 'utf8'), version);
      if (section === null) throw new Error(`CHANGELOG.md has no "## ${version}"`);
      const changelogUrl = `https://github.com/${repository}/blob/${tag}/${relative(repoRoot, dir)}/CHANGELOG.md`;
      const body = releaseBody(section, { changelogUrl });
      const notes = join(scratch, `${i}.md`);
      writeFileSync(notes, body);
      const args = ['release', 'create', tag, '--verify-tag', '--title', tag, '--notes-file', notes];
      if (version.includes('-')) args.push('--prerelease');
      gh(args);
      const cut = body === section ? '' : `, cut from ${section.length} characters`;
      console.log(`${position} ${tag}: released${cut}`);
    } catch (error) {
      failed.push(tag);
      console.error(`${position} ${tag}: ${error.message}`);
    }
  });
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

if (failed.length > 0) {
  console.error(`\ngithub-releases: ${failed.length} of ${published.length} not written: ${failed.join(', ')}`);
  process.exit(1);
}
