const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * The kit's one hex color reader: `#rgb`, `#rgba`, `#rrggbb`, or `#rrggbbaa`,
 * in any case, as four 0..255 channels with alpha last (255 when the color
 * names none). `null` for anything else, a missing `#` included.
 */
export function parseHexBytes(input: string): [number, number, number, number] | null {
  if (!HEX.test(input)) return null;
  const digits = input.slice(1);
  const long = digits.length <= 4 ? digits.replace(/./g, '$&$&') : digits;
  const byte = (i: number): number => Number.parseInt(long.slice(i, i + 2), 16);
  return [byte(0), byte(2), byte(4), long.length === 8 ? byte(6) : 255];
}

/** A hex color's red, green, and blue as 0..255, its alpha dropped. Throws on anything {@link parseHexBytes} does not read. */
export function hexToRgbBytes(input: string): [number, number, number] {
  const bytes = parseHexBytes(input);
  if (!bytes) throw new Error(`not a hex color: "${input}"`);
  return [bytes[0], bytes[1], bytes[2]];
}
