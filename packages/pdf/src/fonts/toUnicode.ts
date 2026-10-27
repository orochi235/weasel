const MAX_PER_BLOCK = 100;

const hex4 = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');

/** `text` as UTF-16BE hex digits, astral code points as surrogate pairs. */
export function utf16Hex(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) out += hex4(text.charCodeAt(i));
  return out;
}

/** A ToUnicode CMap for a two-byte identity-encoded font: glyph id to the text it was drawn for. */
export function toUnicodeCMap(glyphs: ReadonlyMap<number, string>): string {
  const entries = [...glyphs].sort((a, b) => a[0] - b[0]);
  const lines = [
    '/CIDInit /ProcSet findresource begin',
    '12 dict begin',
    'begincmap',
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
    '/CMapName /Adobe-Identity-UCS def',
    '/CMapType 2 def',
    '1 begincodespacerange',
    '<0000> <FFFF>',
    'endcodespacerange',
  ];
  for (let i = 0; i < entries.length; i += MAX_PER_BLOCK) {
    const block = entries.slice(i, i + MAX_PER_BLOCK);
    lines.push(`${block.length} beginbfchar`);
    for (const [gid, text] of block) lines.push(`<${hex4(gid)}> <${utf16Hex(text)}>`);
    lines.push('endbfchar');
  }
  lines.push('endcmap', 'CMapName currentdict /CMap defineresource pop', 'end', 'end');
  return lines.join('\n');
}
