import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PlotPage } from '../../document';
import { DIAGRAM_MERMAID } from '../format';
import { readMermaidPacket } from './read';
import { writeMermaidPacket } from './write';

const fixture = (name: string) => readFileSync(join(__dirname, '..', '..', '__fixtures__', 'mermaid', 'packet', name), 'utf8');
const plotOf = (text: string) => readMermaidPacket(text).document.pages[0] as PlotPage;

describe('reading a Mermaid packet diagram', () => {
  it('reads its fields onto one plot page, titled by the front matter', () => {
    const { document, warnings } = readMermaidPacket(fixture('tcp.mmd'));
    const page = document.pages[0] as PlotPage;
    expect(page).toMatchObject({ kind: 'plot', id: 'page-1', name: 'TCP Packet', width: 800, height: 400 });
    if (page.data.kind !== 'packet') throw new Error('not a packet');
    expect(page.data.title).toBe('TCP Packet');
    expect(page.data.fields).toHaveLength(17);
    expect(page.data.fields[0]).toEqual({ start: 0, end: 15, label: 'Source Port' });
    expect(page.data.fields[6]).toEqual({ start: 106, end: 106, label: 'URG' });
    expect(warnings).toEqual([]);
  });

  it('reads bit counts after the field before, single bits, gaps and its own title', () => {
    expect(plotOf(fixture('udp.mmd')).data).toEqual({
      kind: 'packet',
      title: 'UDP Packet',
      fields: [
        { start: 0, end: 15, label: 'Source Port', relative: true },
        { start: 16, end: 31, label: 'Destination Port', relative: true },
        { start: 32, end: 47, label: 'Length' },
        { start: 52, end: 52, label: 'Flag' },
        { start: 53, end: 63, label: 'Checksum tail', relative: true },
        { start: 64, end: 95, label: 'Data (variable length)' },
      ],
    });
  });

  it('warns on what it drops, a bits-per-row directive among them', () => {
    const { warnings } = readMermaidPacket('%%{init: {"packet": {"bitsPerRow": 16}}}%%\npacket-beta\n  accDescr: about\n  0: "a"');
    expect(warnings).toEqual(['Mermaid configuration directives were dropped.', 'Mermaid accessible descriptions were dropped.']);
  });

  it('throws, naming the line, on what it cannot read', () => {
    expect(() => readMermaidPacket('packet-beta\n  0-15: "a"\n  10-20: "b"')).toThrow('Mermaid, line 3: the field at 10 overlaps the one before, which ends at bit 15');
    expect(() => readMermaidPacket('packet-beta\n\n  15-10: "a"')).toThrow('Mermaid, line 3: a field runs from its first bit to its last, and 15-10 runs backward');
    expect(() => readMermaidPacket('packet-beta\n  +0: "a"')).toThrow('Mermaid, line 2: a field takes at least one bit');
    expect(() => readMermaidPacket('packet-beta\n  0-15 Source')).toThrow('Mermaid, line 2: "0-15 Source" is not a packet field');
    expect(() => readMermaidPacket('packet-alpha\n  0: "a"')).toThrow('Mermaid, line 1: "packet-alpha" is not a packet header');
  });
});

describe('writing a Mermaid packet diagram', () => {
  it('round-trips each fixture', () => {
    for (const name of ['tcp.mmd', 'udp.mmd']) {
      const page = plotOf(fixture(name));
      const { text, warnings } = writeMermaidPacket(page);
      expect(warnings).toEqual([]);
      expect(plotOf(text).data).toEqual(page.data);
    }
  });

  it('writes ranges, single bits and bit counts as it read them', () => {
    expect(writeMermaidPacket(plotOf(fixture('udp.mmd'))).text).toBe([
      'packet-beta',
      '  title UDP Packet',
      '  +16: "Source Port"',
      '  +16: "Destination Port"',
      '  32-47: "Length"',
      '  52: "Flag"',
      '  +11: "Checksum tail"',
      '  64-95: "Data (variable length)"',
      '',
    ].join('\n'));
  });

  it('warns on what Mermaid cannot hold, and throws on another kind of chart', () => {
    const page: PlotPage = {
      kind: 'plot', id: 'p', width: 1, height: 1,
      data: {
        kind: 'packet', bitsPerRow: 16,
        fields: [{ start: 0, end: 7, label: 'a' }, { start: 4, end: 9, label: 'b' }, { start: 10, end: 11, label: 'c', relative: true }, { start: 20, end: 21, label: 'd', relative: true }],
      },
    };
    const { text, warnings } = writeMermaidPacket(page);
    expect(text).toBe('packet-beta\n  0-7: "a"\n  10-11: "c"\n  20-21: "d"\n');
    expect(warnings).toEqual([
      'Mermaid reads bits per row from its configuration only; it was dropped.',
      'Mermaid reads fields in order of their bits, never overlapping; fields that run backward or overlap were dropped.',
      'Mermaid counts a field\'s bits from the end of the one before; fields after a gap were written as ranges.',
    ]);
    expect(() => writeMermaidPacket({ ...page, data: { kind: 'pie', slices: [] } })).toThrow(/as a packet diagram only; the page holds a pie/);
  });
});

describe('the Mermaid format', () => {
  it('reads a packet diagram by its header and writes it back as one', async () => {
    const { document } = await DIAGRAM_MERMAID.read!(fixture('tcp.mmd'));
    expect((document.pages[0] as PlotPage).data.kind).toBe('packet');
    expect(DIAGRAM_MERMAID.detect(fixture('udp.mmd'))).toBe(true);
    expect(DIAGRAM_MERMAID.write!(document).text.startsWith('packet-beta\n')).toBe(true);
  });
});
