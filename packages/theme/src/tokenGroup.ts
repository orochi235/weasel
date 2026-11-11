/** Prefixes that share a group with their siblings rather than standing alone. */
const MERGED_GROUPS: Readonly<Record<string, string>> = { danger: 'status', warning: 'status', success: 'status' };

/** The group a token is listed under, from its name without `--wzl-`: its first word, or the group that word merges into. */
export function tokenGroupOf(name: string): string {
  const prefix = name.includes('-') ? name.slice(0, name.indexOf('-')) : name;
  return Object.hasOwn(MERGED_GROUPS, prefix) ? MERGED_GROUPS[prefix]! : prefix;
}
