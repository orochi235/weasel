import { defineInstrument, type RenderContext } from '@weasel-js/labkit';
import { copyText } from '@weasel-js/react';
import {
  Badge, type BadgeShape, badgeShapeRendering, lookProps,
} from '@weasel-js/ui/components/Badge';
import { Button } from '@weasel-js/ui/components/Button';
import { useState } from 'react';
import { badgeParams } from '../params';
import { SHAPE_PARAMS } from '../shapeParams';
import { type ShapesConfig, shapesConfig, shapeParamsSnippet } from './shapesConfig';
import s from './Shapes.module.css';

type Ctx = RenderContext<Record<string, never>, ShapesConfig>;

const CATEGORIES: { title: string; shapes: BadgeShape[] }[] = [
  { title: 'Basic', shapes: ['pill', 'plain', 'square', 'notched', 'hexagon', 'ribbon'] },
  { title: 'Detailed', shapes: ['shield', 'scalloped', 'perforated', 'postage', 'starburst', 'sparkler', 'plaque'] },
  { title: 'Themed', shapes: ['house', 'cloud', 'beavis', 'crest', 'urn', 'coffin', 'receipt', 'wood', 'quatrefoil'] },
];

function ShapeCard({ shape, ctx }: { shape: BadgeShape; ctx: Ctx }) {
  const { look, selected, params } = ctx.config;
  const own = SHAPE_PARAMS[shape];
  return (
    <li className={s.card}>
      <Button
        variant="ghost"
        pressed={selected === shape}
        aria-label={`Edit ${shape}`}
        onClick={() => ctx.setConfig('selected', shape)}
      >
        <Badge
          shape={shape}
          shapeParams={(own ? badgeParams(own, params[shape] ?? {}) : {}) as never}
          {...lookProps(look.look)}
          variant={look.variant}
        >
          {look.label}
        </Badge>
      </Button>
      <code className={s.name}>{shape}</code>
      {badgeShapeRendering(shape) === 'svg' && (
        <span className={s.note} title="Drawn by the shape's own outline, not composed from a base and effects">own SVG</span>
      )}
    </li>
  );
}

function Gallery({ ctx }: { ctx: Ctx }) {
  const [snippet, setSnippet] = useState<string | null>(null);
  const exportParams = () => {
    const text = shapeParamsSnippet(ctx.config.params);
    setSnippet(text);
    void copyText(text);
  };
  return (
    <div className={s.gallery}>
      <div className={s.actions}>
        <Button size="sm" onClick={exportParams}>Copy changed params</Button>
      </div>
      {snippet !== null && (
        <textarea readOnly aria-label="Changed params" className={s.snippet} value={snippet} rows={Math.min(20, snippet.split('\n').length + 1)} />
      )}
      {CATEGORIES.map((category) => (
        <section key={category.title}>
          <h3 className={s.title}>{category.title}</h3>
          <ul className={s.grid}>
            {category.shapes.map((shape) => <ShapeCard key={shape} shape={shape} ctx={ctx} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Every built-in shape in one look; press one to edit its params on the panel. */
export const ShapesInstrument = defineInstrument<Record<string, never>, ShapesConfig>({
  name: 'badge-shapes',
  title: 'Shapes',
  config: shapesConfig,
  initialState: () => ({}),
  undo: {},
  render: (ctx: Ctx) => <Gallery ctx={ctx} />,
});
