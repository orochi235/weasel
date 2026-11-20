import { mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createStoryIndex } from './storyIndex.ts';

const story = (title: string, name: string) => `export default { title: '${title}' };\nexport const ${name} = {};\n`;
const resolveImport = async () => null;

describe('createStoryIndex', () => {
  let dir = '';
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const indexIn = (files: Record<string, string>) => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), 'forge-story-index-')));
    for (const [name, code] of Object.entries(files)) writeFileSync(join(dir, name), code);
    const errors: unknown[] = [];
    const index = createStoryIndex({
      stories: ['*.stories.tsx'],
      root: () => dir,
      logger: () => undefined,
      logError: (err) => errors.push(err),
    });
    return { index, errors };
  };

  it('indexes a story file added while it failed to parse once an edit fixes it', async () => {
    const { index, errors } = indexIn({ 'a.stories.tsx': story('ui/A', 'First') });
    expect(index.index().map((e) => e.id)).toEqual(['ui-a--first']);

    const added = join(dir, 'b.stories.tsx');
    writeFileSync(added, 'export default {');
    expect(await index.update(added, 'add', resolveImport)).toBeNull();
    expect(errors).toHaveLength(1);

    writeFileSync(added, story('ui/B', 'Fixed'));
    const update = await index.update(added, 'change', resolveImport);
    expect(update?.index.map((e) => e.id)).toEqual(['ui-a--first', 'ui-b--fixed']);
    expect(update?.importablesChanged).toBe(true);
  });

  it('skips a dangling symlink the story globs match', () => {
    const { index } = indexIn({ 'a.stories.tsx': story('ui/A', 'First') });
    symlinkSync(join(dir, 'gone.tsx'), join(dir, 'dangling.stories.tsx'));
    expect([...index.files().keys()]).toEqual([join(dir, 'a.stories.tsx')]);
  });
});
