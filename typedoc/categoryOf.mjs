import { OVERRIDES, RULES } from './categories.mjs';

const ROOT = 'packages/';

/**
 * @param {string} sourcePath absolute or repo-relative path to the declaration
 * @param {string} symbolName the exported name
 * @returns {string | null} the category, or null when nothing matches
 */
export function categoryOf(sourcePath, symbolName) {
  const override = OVERRIDES[symbolName];
  if (override) return override;

  const normalized = sourcePath.replaceAll('\\', '/');
  const at = normalized.lastIndexOf(ROOT);
  const rel = at === -1 ? normalized : normalized.slice(at);

  for (const [prefix, category] of RULES) {
    if (rel === prefix || rel.startsWith(`${prefix}/`) || rel.startsWith(`${prefix}.`)) {
      return category;
    }
  }
  return null;
}
