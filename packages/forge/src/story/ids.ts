// sanitize, storyId and storyNameFromExport are ports of storybook/internal/csf (10.4.0)'s
// sanitize, toId and storyNameFromExport; they must agree or links diverge.

/** Lower-case; runs of the listed separators become one dash. Everything else, non-ASCII letters included, survives. */
export function sanitize(part: string): string {
  return part
    .toLowerCase()
    .replace(/[ ’–—―′¿'`~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function sanitizeSafe(part: string, kind: 'kind' | 'name'): string {
  const sanitized = sanitize(part);
  if (sanitized === '') throw new Error(`Invalid ${kind} '${part}', must include alphanumeric characters`);
  return sanitized;
}

export function storyId(title: string, exportName: string): string {
  return `${sanitizeSafe(title, 'kind')}--${sanitizeSafe(exportName, 'name')}`;
}

/** `PrimaryButton` → `Primary Button`, `withIcon2` → `With Icon 2`. */
export function storyNameFromExport(exportName: string): string {
  return exportName
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\./g, ' ')
    .replace(/([^\n])([A-Z])([a-z])/g, (_, a: string, b: string, c: string) => `${a} ${b}${c}`)
    .replace(/([a-z])([A-Z])/g, (_, a: string, b: string) => `${a} ${b}`)
    .replace(/([a-z])([0-9])/gi, (_, a: string, b: string) => `${a} ${b}`)
    .replace(/([0-9])([a-z])/gi, (_, a: string, b: string) => `${a} ${b}`)
    .replace(/(\s|^)(\w)/g, (_, a: string, b: string) => `${a}${b.toUpperCase()}`)
    .replace(/ +/g, ' ')
    .trim();
}

/** A title for a file whose meta names none: its path under `root`, minus `.stories.tsx`.
 *  Not Storybook's auto-title, so such a story's id differs between the two tools. */
export function titleFromFile(file: string, root: string): string {
  const prefix = `${root.replace(/\/$/, '')}/`;
  const relative = file.startsWith(prefix) ? file.slice(prefix.length) : file;
  return relative.replace(/\.stories\.[jt]sx?$/, '');
}
