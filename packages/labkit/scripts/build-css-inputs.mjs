import { join } from 'node:path';

/**
 * Every file build-css.mjs reads, in layer order. `resolveWindease` is
 * `require.resolve`; a name it cannot resolve is kept as the bare specifier.
 */
export function cssInputs(packages, resolveWindease) {
  let windease;
  try {
    windease = resolveWindease('windease/styles.css');
  } catch {
    windease = null;
  }
  return {
    faces: join(packages, 'theme/src/faces.css'),
    tokens: join(packages, 'theme/dist/tokens.css'),
    core: join(packages, 'core/dist/style.css'),
    ui: join(packages, 'ui/dist/style.css'),
    windease,
    labkit: join(packages, 'labkit/src/styles.less'),
  };
}

/**
 * For `--if-built`: the paths missing among the sheet and its inputs, or
 * `null` when all are there and the sheet should be rebuilt. A tree with a
 * partial dist has nothing to bring up to date yet; the build of whichever
 * package is missing ends by calling this again.
 */
export function skipIfBuilt(inputs, sheet, exists) {
  const missing = [sheet, ...Object.values(inputs).filter(Boolean)].filter((p) => !exists(p));
  if (!inputs.windease) missing.push('windease/styles.css');
  return missing.length > 0 ? missing : null;
}
