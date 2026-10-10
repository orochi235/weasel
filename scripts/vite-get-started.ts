import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { marked } from 'marked';
import type { PluginOption } from 'vite';

/** The README sections the site's "Get started" page is made of, in order. */
export const GET_STARTED_SECTIONS = ['Install', 'How it fits together'] as const;

const README = 'packages/core/README.md';

/**
 * Virtual module exposing core's README sections named above as HTML, so the
 * site's "Get started" page and the README on npm are one piece of writing:
 *
 *   import html from 'virtual:get-started';
 *
 * Rendered at build time, as `virtual:changelogs` is, so the client bundle
 * carries no markdown parser.
 */
export function getStarted(opts: { root?: string } = {}): PluginOption {
  const VIRTUAL_ID = 'virtual:get-started';
  const RESOLVED_ID = '\0' + VIRTUAL_ID;
  const file = resolve(opts.root ?? process.cwd(), README);

  return {
    name: 'get-started',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      this.addWatchFile(file);
      const markdown = sliceSections(readFileSync(file, 'utf8'), GET_STARTED_SECTIONS);
      return `export default ${JSON.stringify(marked.parse(markdown, { async: false }))};`;
    },
  };
}

/**
 * The named `## ` sections of a markdown document, headings included, in the
 * order asked for. Throws on a heading the document lacks: a renamed README
 * section should fail the build, not ship a page with a hole in it.
 */
export function sliceSections(markdown: string, headings: readonly string[]): string {
  const sections = new Map<string, string[]>();
  let current: string[] | null = null;
  let fenced = false;

  for (const line of markdown.split('\n')) {
    if (line.startsWith('```')) fenced = !fenced;
    const heading = fenced ? null : /^(#{1,2}) +(.+?) *$/.exec(line);
    if (heading) {
      current = heading[1] === '##' ? [] : null;
      if (current) sections.set(heading[2], current);
    }
    current?.push(line);
  }

  return headings
    .map((name) => {
      const lines = sections.get(name);
      if (!lines) throw new Error(`${README} has no "## ${name}" section`);
      return lines.join('\n').trimEnd();
    })
    .join('\n\n');
}
