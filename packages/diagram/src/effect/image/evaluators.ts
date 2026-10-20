import type { EffectEvalContext, EffectEvalResult, EffectEvaluators } from '../runner/types';

const BLEND: Readonly<Record<string, GlobalCompositeOperation>> = { normal: 'source-over', screen: 'screen', multiply: 'multiply' };

/** An image of `width` × `height` that `paint` draws. */
function draw(width: number, height: number, paint: (ctx: OffscreenCanvasRenderingContext2D) => void): ImageBitmap {
  const canvas = new OffscreenCanvas(width, height);
  paint(canvas.getContext('2d')!);
  return canvas.transferToImageBitmap();
}

/** The value on input `port`, or a throw naming it. */
function need<T>(ctx: EffectEvalContext, port: string): T {
  const value = ctx.inputs[port];
  if (value === undefined) throw new Error(`${port} is not connected`);
  return value as T;
}

/** Which output a decision takes for `value`: the band it falls in when the
 *  stage splits, else its first output while `value` is above 0 and its second after. */
function decide(ctx: EffectEvalContext, value: number): string | undefined {
  const outs = ctx.stage.outputs ?? [];
  const split = ctx.stage.split;
  const index = split !== undefined ? split.at.filter((cut) => value >= cut).length : value > 0 ? 0 : 1;
  return outs[Math.min(index, outs.length - 1)]?.id;
}

/** Evaluators for `IMAGE_STAGE_TYPES`, drawing on `OffscreenCanvas` 2D. An
 *  image or mask is an `ImageBitmap`; a source puts out `sources.image`. */
export const imageEvaluators: EffectEvaluators = {
  source: ({ sources }) => {
    if (sources.image === undefined) throw new Error('no source image');
    return { outputs: { out: sources.image } };
  },
  blur: (ctx) => {
    const image = need<ImageBitmap>(ctx, 'in');
    const radius = Number(ctx.params.radius ?? 0);
    return {
      outputs: {
        out: draw(image.width, image.height, (g) => {
          g.filter = `blur(${radius}px)`;
          g.drawImage(image, 0, 0);
        }),
      },
    };
  },
  composite: (ctx) => {
    const base = need<ImageBitmap>(ctx, 'base');
    const top = need<ImageBitmap>(ctx, 'top');
    return {
      outputs: {
        out: draw(base.width, base.height, (g) => {
          g.drawImage(base, 0, 0);
          g.globalCompositeOperation = BLEND[String(ctx.params.blend)] ?? 'source-over';
          g.drawImage(top, 0, 0, base.width, base.height);
        }),
      },
    };
  },
  mask: (ctx) => {
    const image = need<ImageBitmap>(ctx, 'in');
    const mask = need<ImageBitmap>(ctx, 'mask');
    return {
      outputs: {
        out: draw(image.width, image.height, (g) => {
          g.drawImage(image, 0, 0);
          g.globalCompositeOperation = 'destination-in';
          g.drawImage(mask, 0, 0, image.width, image.height);
        }),
      },
    };
  },
  oscillator: ({ params, time }) => ({ outputs: { value: Math.sin(2 * Math.PI * Number(params.rate ?? 1) * time) } }),
  decision: (ctx): EffectEvalResult => {
    const tested = ctx.stage.split?.input ?? ctx.stage.inputs?.find((p) => p.type === 'number')?.id ?? 'test';
    const taken = decide(ctx, need<number>(ctx, tested));
    const type = ctx.stage.outputs?.find((p) => p.id === taken)?.type;
    const from = ctx.stage.inputs?.find((p) => p.type === type && ctx.inputs[p.id] !== undefined);
    return { outputs: taken !== undefined && from !== undefined ? { [taken]: ctx.inputs[from.id] } : {}, ...(taken !== undefined ? { taken } : {}) };
  },
  out: () => ({ outputs: {} }),
};
