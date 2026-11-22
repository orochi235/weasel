import { useEffect, useState } from 'react';
import { DrawCanvas } from '@weasel-js/core';
import { pathFromD } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import { loadShaper, type ShapedGlyph, type TextShaper } from '@weasel-js/text-shaping';
import { SegmentedBar } from '@weasel-js/ui/components/Segmented';
import arabicUrl from '../assets/fonts/noto-sans-arabic-subset.ttf';
import devanagariUrl from '../assets/fonts/noto-sans-devanagari-subset.ttf';
import { DemoStage } from './DemoStage';
import { visualOrder } from './shapedVisualOrder';
import s from './TextShapingDemo.module.css';

const W = 520, H = 260, EM = 72;
type Face = 'arabic' | 'devanagari';
const FACE_URLS: Record<Face, string> = { arabic: arabicUrl, devanagari: devanagariUrl };

const SAMPLES = [
  { value: 'कि', label: 'कि', face: 'devanagari' },
  { value: 'क्ष', label: 'क्ष', face: 'devanagari' },
  { value: 'بيت', label: 'بيت', face: 'arabic' },
  { value: 'سلام', label: 'سلام', face: 'arabic' },
] as const satisfies readonly { value: string; label: string; face: Face }[];

const INK = { paint: { color: '#1a1a1a' } };

/** Separately shaped strings, in logical order, as paths along one line at `baseline`, in ems. */
function line(shaper: TextShaper, face: ArrayBuffer, shaped: readonly (readonly ShapedGlyph[])[], baseline: number): DrawCommand[] {
  let pen = 0;
  return visualOrder(shaped).flatMap((g) => {
    const d = shaper.glyphD(face, g.gid, pen + g.dx, baseline + g.dy);
    pen += g.advance;
    return d ? [{ kind: 'path' as const, path: pathFromD(d), fill: INK }] : [];
  });
}

type Loaded = { shaper: TextShaper; faces: Record<Face, ArrayBuffer> };

export function TextShapingDemo() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState<string>(SAMPLES[0].value);

  useEffect(() => {
    let live = true;
    const bytes = (url: string) => fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
      return r.arrayBuffer();
    });
    Promise.all([loadShaper(), bytes(FACE_URLS.arabic), bytes(FACE_URLS.devanagari)])
      .then(([shaper, arabic, devanagari]) => { if (live) setLoaded({ shaper, faces: { arabic, devanagari } }); })
      .catch((e: unknown) => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, []);

  const sample = SAMPLES.find((x) => x.value === text)!;
  const shaped = loaded ? loaded.shaper.shape(loaded.faces[sample.face], text) : [];
  const apart = loaded ? [...text].map((c) => loaded.shaper.shape(loaded.faces[sample.face], c)) : [];
  const commands = loaded ? [
    ...line(loaded.shaper, loaded.faces[sample.face], apart, 1.1),
    ...line(loaded.shaper, loaded.faces[sample.face], [shaped], 2.7),
  ] : [];

  return (
    <div className={s.demo}>
      <div className="ckd-toolbar">
        <SegmentedBar items={SAMPLES} value={text} onChange={(v) => v && setText(v)} aria-label="Sample" size="sm" />
        {error && <span role="alert" className={s.error}>{error}</span>}
      </div>
      <div className={s.stage}>
        <dl className={s.rows}>
          <div><dt>one glyph per character</dt><dd className={s.count}>{apart.flat().length}</dd></div>
          <div><dt>shaped</dt><dd className={s.count} aria-label="shaped glyphs">{shaped.length}</dd></div>
        </dl>
        <DemoStage width={W} height={H}>
          <DrawCanvas
            className="ckd-canvas"
            background={{ kind: 'solid', color: '#ffffff' }}
            view={{ x: -0.4, y: 0, scale: { x: EM, y: EM } }}
            draw={commands}
          />
        </DemoStage>
      </div>
    </div>
  );
}
