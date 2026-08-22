import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { marked } from 'marked';
import type { PluginOption } from 'vite';
import type { ChangelogEntry, Release } from '../apps/shared/releases';

/**
 * Virtual module exposing every package CHANGELOG as one release history,
 * newest version first. The site's Releases view imports it:
 *
 *   import RELEASES from 'virtual:changelogs';
 *
 * All packages ship as one changesets `fixed` group, so a given version
 * number moves every package at once and the thirteen CHANGELOG files are
 * thirteen views of the same release. Entries are therefore keyed by their
 * changeset hash and merged across packages — one entry naming the packages
 * it touched, rather than the same prose repeated thirteen times.
 *
 * `Updated dependencies` stanzas are dropped: they are an artifact of the
 * fixed group (every release bumps every package's peers) and carry nothing
 * a reader wants.
 *
 * Pending `.changeset/*.md` files lead the list as an "Unreleased" entry. The
 * site deploys from `main` on every push but publishes to npm only on a
 * release, so without it the page is stale against the build it ships in.
 *
 * Markdown is rendered to HTML here, at build time, so the client bundle
 * carries no markdown parser.
 */

/** The version label given to pending, unpublished changesets. */
export const UNRELEASED = 'Unreleased';

export function changelogs(opts: { root?: string } = {}): PluginOption {
  const VIRTUAL_ID = 'virtual:changelogs';
  const RESOLVED_ID = '\0' + VIRTUAL_ID;
  const root = opts.root ?? process.cwd();

  return {
    name: 'changelogs',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      return null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      return `export default ${JSON.stringify(readReleases(root), null, 2)};`;
    },
    configureServer(server) {
      server.watcher.on('change', (file) => {
        if (!file.endsWith('CHANGELOG.md') && !file.includes('.changeset')) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
      });
    },
  };
}

/** One package's changelog, as the pure parser wants it. */
export interface ChangelogSource {
  /** Unscoped package directory name, used as the chip label. */
  pkg: string;
  text: string;
}

function readReleases(root: string): Release[] {
  const packagesDir = resolve(root, 'packages');
  const sources: ChangelogSource[] = [];
  if (existsSync(packagesDir)) {
    for (const dir of readdirSync(packagesDir, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      const file = resolve(packagesDir, dir.name, 'CHANGELOG.md');
      if (existsSync(file)) sources.push({ pkg: dir.name, text: readFileSync(file, 'utf8') });
    }
  }

  const releases = releasesFromChangelogs(sources);
  for (const release of releases) {
    release.date = releaseDate(release.version, sources, root);
  }

  const pending = readPendingChangesets(root);
  return pending ? [pending, ...releases] : releases;
}

/**
 * Merge per-package changelogs into one release history, newest first. Pure —
 * the plugin supplies the file contents and stamps dates afterwards.
 */
export function releasesFromChangelogs(sources: readonly ChangelogSource[]): Release[] {
  const byVersion = new Map<string, Map<string, ChangelogEntry>>();

  for (const source of sources) {
    for (const raw of parseChangelog(source.text, source.pkg)) {
      let entries = byVersion.get(raw.version);
      if (!entries) byVersion.set(raw.version, (entries = new Map()));

      const existing = entries.get(raw.id);
      if (existing) {
        if (!existing.packages.includes(raw.pkg)) existing.packages.push(raw.pkg);
        continue;
      }
      entries.set(raw.id, makeEntry(raw.id, raw.pkg, raw.level, raw.body));
    }
  }

  const releases: Release[] = [];
  for (const [version, entries] of byVersion) {
    releases.push({ version, entries: finishEntries(entries) });
  }
  return releases.sort((a, b) => compareVersions(b.version, a.version));
}

/**
 * The pending changesets, as a leading "Unreleased" pseudo-release, or null
 * when `.changeset/` holds nothing but its own config.
 */
export function readPendingChangesets(root: string): Release | null {
  const dir = resolve(root, '.changeset');
  if (!existsSync(dir)) return null;

  const entries = new Map<string, ChangelogEntry>();
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.md') || file.toUpperCase() === 'README.MD') continue;
    const parsed = parseChangeset(readFileSync(resolve(dir, file), 'utf8'));
    if (!parsed) continue;
    const id = file.replace(/\.md$/, '');
    const entry = makeEntry(id, parsed.packages[0] ?? '', parsed.level, parsed.body);
    entry.packages = parsed.packages;
    entries.set(id, entry);
  }
  if (entries.size === 0) return null;
  return { version: UNRELEASED, entries: finishEntries(entries) };
}

/**
 * A single `.changeset/*.md`: YAML-ish frontmatter naming the packages and
 * their bump level, then the entry prose.
 */
export function parseChangeset(
  text: string,
): { packages: string[]; level: ChangelogEntry['level']; body: string } | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text.trim());
  if (!match) return null;

  const packages: string[] = [];
  let level: ChangelogEntry['level'] = 'patch';
  for (const line of match[1].split('\n')) {
    const pair = /^\s*['"]?(@?[\w./-]+)['"]?\s*:\s*(major|minor|patch)\s*$/.exec(line);
    if (!pair) continue;
    packages.push(unscope(pair[1]));
    if (pair[2] === 'major' || (pair[2] === 'minor' && level === 'patch')) {
      level = pair[2] as ChangelogEntry['level'];
    }
  }

  const body = match[2].trim();
  if (!body) return null;
  return { packages, level, body };
}

/** `@weasel-js/core` → `core`; `weasel-js` is already bare. */
function unscope(name: string): string {
  return name.startsWith('@') ? name.slice(name.indexOf('/') + 1) : name;
}

function makeEntry(
  id: string,
  pkg: string,
  level: ChangelogEntry['level'],
  body: string,
): ChangelogEntry {
  const [summary, rest] = splitSummary(body);
  return {
    id,
    packages: pkg ? [pkg] : [],
    titleHtml: renderInline(summary),
    bodyHtml: renderBlock(rest),
    level,
  };
}

/** Sort each entry's packages, then order entries by breadth of impact. */
function finishEntries(entries: Map<string, ChangelogEntry>): ChangelogEntry[] {
  for (const entry of entries.values()) entry.packages.sort();
  return [...entries.values()].sort((a, b) => b.packages.length - a.packages.length);
}

interface RawEntry {
  id: string;
  pkg: string;
  version: string;
  level: ChangelogEntry['level'];
  body: string;
}

/**
 * Pull `## <version>` / `### <Level> Changes` / `- ` bullets out of one
 * changesets-authored CHANGELOG. Continuation lines are indented two spaces;
 * the dedent has to happen before markdown sees them or every multi-line
 * entry renders as an indented code block.
 */
function parseChangelog(text: string, pkg: string): RawEntry[] {
  const out: RawEntry[] = [];
  let version: string | null = null;
  let level: ChangelogEntry['level'] = 'patch';
  let bullet: string[] | null = null;

  const flush = () => {
    if (!bullet || !version) return (bullet = null), undefined;
    const body = dedent(bullet).join('\n').trim();
    bullet = null;
    if (!body || /^Updated dependencies\b/.test(body)) return;
    const hash = /^([0-9a-f]{7,40}):\s*/.exec(body);
    out.push({
      id: hash ? hash[1] : `${pkg}-${version}-${out.length}`,
      pkg,
      version,
      level,
      body: hash ? body.slice(hash[0].length) : body,
    });
  };

  for (const line of text.split('\n')) {
    const versionHeading = /^## +(\d\S*)\s*$/.exec(line);
    if (versionHeading) {
      flush();
      version = versionHeading[1];
      level = 'patch';
      continue;
    }
    const levelHeading = /^### +(Major|Minor|Patch) Changes\s*$/.exec(line);
    if (levelHeading) {
      flush();
      level = levelHeading[1].toLowerCase() as ChangelogEntry['level'];
      continue;
    }
    if (/^- /.test(line)) {
      flush();
      bullet = [line.slice(2)];
      continue;
    }
    // Blank lines and indented continuations belong to the open bullet.
    if (bullet && (line.trim() === '' || /^\s{2,}/.test(line))) bullet.push(line);
    else if (bullet) flush();
  }
  flush();
  return out;
}

/** Strip the two-space continuation indent, leaving nested markdown
 *  (sub-lists, fences, tables) at its own relative depth. */
function dedent(lines: string[]): string[] {
  return lines.map((line, i) => (i === 0 ? line : line.replace(/^ {2}/, '')));
}

/**
 * Split an entry into its opening paragraph and the rest. Changeset prose is
 * hard-wrapped, so splitting on the first newline cuts mid-sentence — the
 * boundary is the first blank line. The summary is unwrapped so it can be
 * rendered inline as a heading.
 */
export function splitSummary(body: string): [summary: string, rest: string] {
  const brk = body.search(/\n[ \t]*\n/);
  if (brk === -1) return [unwrap(body), ''];
  const summary = body.slice(0, brk);
  // A fence, list or table opening the entry is not a summary paragraph.
  if (/^\s*(```|[-*+] |\d+\. |#|\|)/.test(summary)) return ['', body.trim()];
  return [unwrap(summary), body.slice(brk).trim()];
}

function unwrap(text: string): string {
  return text.trim().replace(/\s*\n\s*/g, ' ');
}

function renderInline(markdown: string): string {
  if (!markdown) return '';
  return marked.parseInline(markdown, { async: false });
}

function renderBlock(markdown: string): string {
  if (!markdown) return '';
  return marked.parse(markdown, { async: false, gfm: true });
}

/**
 * When this version's heading first appeared. Changesets records no dates, so
 * the `chore: version packages` commit that wrote the heading is the release.
 */
function releaseDate(
  version: string,
  sources: readonly ChangelogSource[],
  cwd: string,
): string | undefined {
  const heading = new RegExp(`^## ${version.replace(/\./g, '\\.')}$`, 'm');
  const source = sources.find((s) => heading.test(s.text));
  if (!source) return undefined;
  const pattern = `^## ${version.replace(/\./g, '\\.')}$`;
  try {
    const log = execSync(
      `git log -G"${pattern}" --format=%aI -- "packages/${source.pkg}/CHANGELOG.md"`,
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return log.trim().split('\n').filter(Boolean).pop() ?? undefined;
  } catch {
    return undefined;
  }
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.-]/);
  const pb = b.split(/[.-]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = Number(pa[i]);
    const nb = Number(pb[i]);
    if (Number.isNaN(na) || Number.isNaN(nb)) {
      const cmp = (pa[i] ?? '').localeCompare(pb[i] ?? '');
      if (cmp) return cmp;
      continue;
    }
    if (na !== nb) return na - nb;
  }
  return 0;
}
