import { defineInstrument, type RenderContext, type ViewportSize } from '@weasel-js/labkit';
import { Badge, lookProps } from '@weasel-js/ui/components/Badge';
import type { CSSProperties } from 'react';
import { effectSpecs } from '../effects';
import { type ComposeConfig, composeConfig, composedBaseParams, composedPadding } from './composeConfig';
import { PresetsPanel } from './PresetsPanel';
import s from './Compose.module.css';

type Ctx = RenderContext<Record<string, never>, ComposeConfig>;

const STAGE = { width: 360, height: 200 };
const MAX_OPENING_ZOOM = 3;

/** The stage scaled up to fill the view, to at most three times its size, and centered. */
function opening(viewport: ViewportSize) {
  const fit = Math.min(viewport.width / STAGE.width, viewport.height / STAGE.height);
  const zoom = Math.max(0.1, Math.min(MAX_OPENING_ZOOM, fit));
  return { zoom, pan: { x: (viewport.width - STAGE.width * zoom) / 2, y: (viewport.height - STAGE.height * zoom) / 2 } };
}

// Dragged offsets and type settings vary per edit, so the label takes them as an inline style.
function labelStyle({ look, type }: Pick<ComposeConfig, 'look' | 'type'>): CSSProperties {
  return {
    transform: `translate(${look.labelX}px, ${look.labelY}px)`,
    fontFamily: type.font === 'inherit' ? undefined : type.font,
    fontSize: type.sizeDelta !== 0 ? `calc(1em + ${type.sizeDelta}px)` : undefined,
    fontWeight: type.bold ? 700 : undefined,
    fontStyle: type.italic ? 'italic' : undefined,
    fontVariantCaps: type.caps !== 'normal' ? type.caps : undefined,
  };
}

function Preview({ config }: { config: ComposeConfig }) {
  const { shape, look } = config;
  return (
    <div className={s.stage}>
      <Badge
        base={shape.base}
        baseParams={composedBaseParams(shape) as never}
        effects={effectSpecs(shape.effects)}
        {...lookProps(look.look, look.tint)}
        variant={look.variant}
        bloat={look.bloat}
        size={look.size}
        padding={composedPadding(config.padding)}
        crawl={look.crawl ? look.crawlSpeed : undefined}
      >
        <span className={s.labelText} style={labelStyle(config)}>{look.label}</span>
      </Badge>
    </div>
  );
}

/** A badge composed from a base and a stack of effects, with every param on the panel and presets to start from. */
export const ComposeInstrument = defineInstrument<Record<string, never>, ComposeConfig>({
  name: 'badge-compose',
  title: 'Compose',
  config: composeConfig,
  initialState: () => ({}),
  undo: {},
  stage: { size: STAGE, initialView: opening, maxZoom: 12 },
  chrome: [{
    id: 'presets',
    region: 'sidebar',
    render: (chrome) => <PresetsPanel config={chrome.config as ComposeConfig} setConfig={chrome.setConfig} />,
  }],
  render: (ctx: Ctx) => <Preview config={ctx.config} />,
});
