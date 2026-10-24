import { useState } from 'react';
import { Badge } from '@weasel-js/ui/components/Badge';
import { SHAPES } from '../shapes';
import { SHAPE_CONTROLS, defaultParamsFor } from '../shapeControls';
import { lookProps, type BadgeLook } from '../looks';
import type { BadgeShape, BadgeVariant } from '../types';
import { ParamControl } from './ParamControl';
import type { LabParams } from './snapshot';
import { defaultShapeParams, shapeParamsSnippet, type ShapeParamSets } from './snippets';
import controls from './controls.stories.module.css';
import s from './ShapeGallery.stories.module.css';

const CATEGORIES: { title: string; shapes: BadgeShape[] }[] = [
  { title: 'Basic', shapes: ['pill', 'plain', 'square', 'notched', 'hexagon', 'ribbon'] },
  { title: 'Detailed', shapes: ['shield', 'scalloped', 'perforated', 'postage', 'starburst', 'sparkler', 'plaque'] },
  { title: 'Themed', shapes: ['house', 'cloud', 'beavis', 'crest', 'urn', 'coffin', 'receipt', 'wood', 'quatrefoil'] },
];

/** A shape drawn by its own component rather than through the compose pipeline. The two CSS shapes are neither. */
const isLegacy = (shape: BadgeShape): boolean =>
  SHAPES[shape].compose === undefined && shape !== 'pill' && shape !== 'plain';

function ShapeCard({ shape, look, variant, label, params, onChange }: {
  shape: BadgeShape;
  look: BadgeLook;
  variant: BadgeVariant;
  label: string;
  params: LabParams;
  onChange: (key: string, value: number | string) => void;
}) {
  const shapeControls = SHAPE_CONTROLS[shape] ?? [];
  return (
    <div className={s.card}>
      <div className={s.sample}>
        <Badge shape={shape} {...lookProps(look)} variant={variant} shapeParams={params as never}>{label}</Badge>
      </div>
      <code className={s.name}>
        {shape}
        {isLegacy(shape) && (
          <span className={s.legacy} title="Legacy: rendered via custom Component, not the compose pipeline">LEGACY</span>
        )}
      </code>
      {shapeControls.length > 0 && (
        <div className={s.controls}>
          {shapeControls.map((c) => (
            <ParamControl key={c.key} dense control={c} value={params[c.key]} onChange={(v) => onChange(c.key, v)} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Every built-in shape with sliders for its params, and an export of the params moved off their defaults. */
export function ShapeGallery({ look, variant, label }: { look: BadgeLook; variant: BadgeVariant; label: string }) {
  const [allParams, setAllParams] = useState<ShapeParamSets>(defaultShapeParams);
  const [snippet, setSnippet] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const exportParams = () => {
    const text = shapeParamsSnippet(allParams);
    setSnippet(text);
    setCopied(false);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => setCopied(true)).catch(() => {});
    }
  };
  const reset = () => {
    setAllParams(defaultShapeParams());
    setSnippet(null);
  };

  return (
    <div className={s.gallery}>
      <div className={s.actions}>
        <button className={controls.button} onClick={exportParams}>Export non-default params</button>
        <button className={controls.button} onClick={reset}>Reset all</button>
        {copied && <span className={s.copied}>copied to clipboard</span>}
      </div>
      {snippet !== null && (
        <textarea readOnly className={controls.snippet} value={snippet} rows={Math.min(20, Math.max(4, snippet.split('\n').length + 1))} />
      )}
      {CATEGORIES.map((category) => (
        <section key={category.title}>
          <h3 className={s.categoryTitle}>{category.title}</h3>
          <div className={s.grid}>
            {category.shapes.map((shape) => (
              <ShapeCard
                key={shape}
                shape={shape}
                look={look}
                variant={variant}
                label={label}
                params={allParams[shape] ?? defaultParamsFor(shape)}
                onChange={(key, value) => setAllParams((prev) => ({ ...prev, [shape]: { ...prev[shape], [key]: value } }))}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
