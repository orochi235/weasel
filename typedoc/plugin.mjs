import { Comment, CommentTag, Converter, ReflectionKind } from 'typedoc';
import { categoryOf } from './categoryOf.mjs';
import { specifierOf } from './packageOptions.mjs';

/** The one package whose exports are sorted into navigation categories. */
const CATEGORIZED = '@weasel-js/core';

/** @param {import('typedoc').Application} app */
export function load(app) {
  // TypeDoc's CategoryPlugin reads @category on this same event at priority
  // -200, and higher priority runs first, so the default 0 lands before it.
  app.converter.on(Converter.EVENT_RESOLVE_END, (context) => {
    const modules = (context.project.children ?? []).filter((c) => c.kind === ReflectionKind.Module);
    for (const module of modules) nameBySpecifier(module);

    if (context.project.name !== CATEGORIZED) return;
    // A package with one entry has no modules: its exports hang off the project.
    const owners = modules.length > 0 ? modules : [context.project];
    categorize(owners.flatMap((owner) => owner.children ?? []));
  });
}

/**
 * TypeDoc names a module for its file path, `import-shims/math`; a reader knows it
 * by what they import, `@weasel-js/core/math`.
 *
 * @param {import('typedoc').DeclarationReflection} module
 */
function nameBySpecifier(module) {
  const specifier = specifierOf(module.sources?.[0]?.fullFileName ?? '');
  if (specifier) module.name = specifier;
}

/** @param {import('typedoc').DeclarationReflection[]} exports */
function categorize(exports) {
  /** @type {string[]} */
  const uncategorized = [];

  for (const child of exports) {
    // An alias of a symbol the barrel also exports under its own name is a
    // reference with no source of its own; it belongs where its target lives.
    const target = child.variant === 'reference' ? child.tryGetTargetReflection?.() : undefined;
    // `fileName` is relative to whatever TypeDoc picked as the base; the rules name `packages/`.
    const sourcePath = (target ?? child).sources?.[0]?.fullFileName ?? '';
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
}
