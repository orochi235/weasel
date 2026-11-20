import { type CSSProperties, type RefObject, useLayoutEffect, useRef } from 'react';
import { f } from '../../config/builder';
import { defineInstrument } from '../../instrument/defineInstrument';
import type { Instrument } from '../../instrument/types';
import { CalibrationPicture } from './CalibrationPicture';
import { CalibrationResults, PICTURE_TARGET } from './CalibrationResults';
import {
  type CalibrationConfig,
  DEFAULT_CONDITION,
  pictureSize,
  SCALES,
  SCROLLED_SHOWS,
  SCROLLED_STARTS,
  targetView,
  ZOOMS,
} from './condition';
import { CONTENT, EXERCISES } from './exercises';
import { type TrialPictures, trialPictures, useTrialPicture } from './trialPictures';
import './Calibration.less';

function schema(start: CalibrationConfig) {
  return f.schema({
    scale: f
      .enum(
        start.scale,
        SCALES.map((v) => ({ value: v, label: `${v}×` })),
      )
      .label('Scale'),
    scrolled: f.boolean(start.scrolled).label('In a scrolled pane'),
    zoom: f
      .enum(
        start.zoom,
        ZOOMS.map((v) => ({ value: v, label: `${v}×` })),
      )
      .label('Zoom'),
    focus: f
      .enum(
        start.focus,
        EXERCISES.map((e) => ({ value: e.id, label: e.instruction })),
      )
      .label('Zoom onto'),
  });
}

/** The picture's markup over its whole content box at 1×, whatever window a zoom has it showing: an export draws
 *  marks over the content box. */
function wholePicture(el: HTMLElement | null): string {
  const svg = el?.querySelector('svg')?.cloneNode(true);
  if (!(svg instanceof SVGSVGElement)) return '';
  svg.setAttribute('viewBox', `0 0 ${CONTENT.width} ${CONTENT.height}`);
  svg.setAttribute('width', String(CONTENT.width));
  svg.setAttribute('height', String(CONTENT.height));
  return svg.outerHTML;
}

/** The picture, inside a pane that shows part of it and starts scrolled partway when the condition asks. */
function Stage({
  config,
  picture,
}: {
  config: CalibrationConfig;
  picture: RefObject<HTMLDivElement | null>;
}) {
  const frame = useRef<HTMLDivElement | null>(null);
  const size = pictureSize(config);
  useLayoutEffect(() => {
    if (config.scrolled && frame.current) frame.current.scrollTop = size.height * SCROLLED_STARTS;
  }, [config.scrolled, size.height]);
  // The scrolled pane's height follows the picture's, which only the condition knows.
  const height = {
    ['--lk-cal-frame-h' as string]: `${size.height * SCROLLED_SHOWS}px`,
  } as CSSProperties;
  return (
    <div
      ref={frame}
      className={config.scrolled ? 'lk-cal__frame lk-cal__frame--scrolled' : 'lk-cal__frame'}
      style={config.scrolled ? height : undefined}
      data-testid="calibration-frame"
    >
      <div ref={picture} className="lk-cal__picture" data-testid="calibration-picture">
        <CalibrationPicture config={config} />
      </div>
    </div>
  );
}

function Trial({
  config,
  trial,
  pictures,
}: {
  config: CalibrationConfig;
  trial: string;
  pictures: TrialPictures;
}) {
  const ref = useTrialPicture(pictures, trial);
  return (
    <div className="lk-cal">
      <Stage config={config} picture={ref} />
      <CalibrationResults config={config} picture={ref} />
    </div>
  );
}

/**
 * A coloring book for annotation marks: faint guides to trace with the lab's annotation tools, each scored against
 * the mark drawn on it. `start` sets the condition a new trial opens in.
 */
export function calibrationInstrument(
  start: Partial<CalibrationConfig> = {},
): Instrument<Record<string, never>, CalibrationConfig> {
  // One picture element per trial: every trial declares the same target id, and each must track its own.
  // Released when the trial unmounts, so the map holds only the trials on screen.
  const pictures = trialPictures();
  const { pictureFor } = pictures;
  return defineInstrument<Record<string, never>, CalibrationConfig>({
    name: 'Calibration',
    config: schema({ ...DEFAULT_CONDITION, ...start }),
    initialState: () => ({}),
    render: ({ config, trial }) => <Trial config={config} trial={trial.id} pictures={pictures} />,
    annotations: {
      tools: ['pointer', 'select', 'stroke', 'line', 'arrow', 'rect', 'ellipse', 'text'],
      targets: (_state, config, trial) => {
        const view = targetView(config);
        return [
          {
            id: PICTURE_TARGET,
            ref: pictureFor(trial.id),
            content: CONTENT,
            // Each draws the picture at another size, so a mark made under one is stale under the next and the
            // results score only this condition's. `scrolled` and `focus` only move it.
            positionDependsOn: ['scale', 'zoom'],
            ...(view ? { view } : {}),
            base: () => ({ kind: 'svg', markup: wholePicture(pictureFor(trial.id).current) }),
          },
        ];
      },
    },
  });
}
