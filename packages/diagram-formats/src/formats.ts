/** The formats a diagram reads from and writes to, and how a file finds its format. */
import type { DiagramFormat, ImportResult } from './document';
import { DIAGRAM_JSON } from './jsonFormat';
import { DRAW_XML } from './drawXml/format';

/** Every format this package reads or writes. */
export const DIAGRAM_FORMATS: readonly DiagramFormat[] = [DIAGRAM_JSON, DRAW_XML];

const extensionOf = (format: DiagramFormat, fileName: string): boolean =>
  format.extensions.some((ext) => fileName.toLowerCase().endsWith(ext.toLowerCase()));

/**
 * The format `text` is in: among those whose content test passes, the first
 * that claims `fileName`'s extension, else the first. `null` when none
 * passes, whatever the extension says, since an extension such as `.xml` names
 * many formats.
 */
export function detectFormat(
  text: string, fileName?: string, formats: readonly DiagramFormat[] = DIAGRAM_FORMATS,
): DiagramFormat | null {
  const passing = formats.filter((f) => f.detect(text));
  if (fileName !== undefined) {
    const named = passing.find((f) => extensionOf(f, fileName));
    if (named !== undefined) return named;
  }
  return passing[0] ?? null;
}

/** Reads `text` with the format {@link detectFormat} picks. Rejects when none reads it. */
export async function readDocument(
  text: string, fileName?: string, formats: readonly DiagramFormat[] = DIAGRAM_FORMATS,
): Promise<ImportResult> {
  const format = detectFormat(text, fileName, formats.filter((f) => f.read !== undefined));
  if (format === null) throw new Error(`${fileName ?? 'The text'} is not a diagram file this package reads`);
  return format.read!(text);
}
