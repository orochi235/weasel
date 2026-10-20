const MAX_PER_BLOCK = 100;

const hex4 = (n: number) => n.toString(16).toUpperCase().padStart(4, '0');

function utf16Hex(cp: number): string {
  if (cp <= 0xffff) return hex4(cp);
  const v = cp - 0x10000;
  return hex4(0xd800 + (v >> 10)) + hex4(0xdc00 + (v & 0x3ff));
}

/** A ToUnicode CMap for a two-byte identity-encoded font: glyph id to the codepoint it was drawn for. */
export function toUnicodeCMap(glyphs: ReadonlyMap<number, number>): string {
  const entries = [...glyphs].sort((a, b) => a[0] - b[0]);
  const lines = [
    '/CIDInit /ProcSet findresource begin',
    '12 dict begin',
    'begincmap',
    '/CMapName /Adobe-Identity-UCS def',
    '/CMapType 2 def',
    '1 begincodespacerange',
    '<0000> <FFFF>',
    'endcodespacerange',
  ];
  for (let i = 0; i < entries.length; i += MAX_PER_BLOCK) {
    const block = entries.slice(i, i + MAX_PER_BLOCK);
    lines.push(`${block.length} beginbfchar`);
    for (const [gid, cp] of block) lines.push(`<${hex4(gid)}> <${utf16Hex(cp)}>`);
    lines.push('endbfchar');
  }
  lines.push('endcmap', 'CMapName currentdict /CMap defineresource pop', 'end', 'end');
  return lines.join('\n');
}
