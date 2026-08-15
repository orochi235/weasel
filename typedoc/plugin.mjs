import { Comment, CommentTag, Converter } from 'typedoc';
import { categoryOf } from './categoryOf.mjs';

/** @param {import('typedoc').Application} app */
export function load(app) {
  // TypeDoc's CategoryPlugin reads @category on this same event at priority
  // -200, and higher priority runs first, so the default 0 lands before it.
  app.converter.on(Converter.EVENT_RESOLVE_END, (context) => {
    /** @type {string[]} */
    const uncategorized = [];

    for (const child of context.project.children ?? []) {
      const sourcePath = child.sources?.[0]?.fileName ?? '';
      const category = categoryOf(sourcePath, child.name);

      if (!category) {
        uncategorized.push(`    ${child.name.padEnd(28)}${sourcePath || '(no source)'}`);
        continue;
      }

      child.comment ??= new Comment();
      if (child.comment.blockTags.some((t) => t.tag === '@category')) continue;

      child.comment.blockTags.push(new CommentTag('@category', [{ kind: 'text', text: category }]));
    }

    if (uncategorized.length > 0) {
      throw new Error(
        `${uncategorized.length} export(s) match no category rule:\n` +
          `${uncategorized.join('\n')}\n\n` +
          `  Add a rule to typedoc/categories.mjs`,
      );
    }
  });
}
