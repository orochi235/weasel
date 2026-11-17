import type { FeaturePreset } from '@weasel-js/core';
import { createEllipseTool } from '../tools/ellipse/useEllipseTool';
import { createLassoTool } from '../tools/lasso/useLassoTool';
import { createSelectToolWith, type SelectAdapter } from '../tools/select/useSelectToolWith';
import { createLineTool } from '../tools/line/useLineTool';
import { createPolygonTool } from '../tools/polygon/usePolygonTool';
import { createRectTool } from '../tools/rect/useRectTool';
import { createStarTool } from '../tools/star/useStarTool';
import { SELECT_TOOLS, SHAPE_TOOLS } from '../tools/toolSets';
import type {} from '../tools/toolOptions';
import { areaSelectAction } from '../actions/select/areaSelect';
import { clearSelectionAction } from '../actions/select/clearSelection';
import { lassoSelectAction } from '../actions/lassoSelect/action';
import { RegionSelectDeps } from '../deps/presetDeps';
import { insertPreset } from './insert';
import { selectionPreset } from './selection';

/** Offers the select tool and the lasso by id, mounted where something names them: `selectToolsPreset`,
 *  `defaultTools={['lasso']}`. The select tool picks with the canvas's pickers and its `selectTool` options. */
export const selectToolKitPreset: FeaturePreset = {
  id: 'toolkit:select',
  label: 'Selection tools, offered',
  toolActions: [areaSelectAction, lassoSelectAction, clearSelectionAction],
  components: [RegionSelectDeps],
  build: (ctx) => ({
    tools: {
      select: createSelectToolWith(() => ctx.adapter() as unknown as SelectAdapter<{ id: string }, unknown>, () => {
        const { pickBest, extendClickLocked } = ctx.selectTool();
        return {
          pickEvery: ctx.pick.everyIn, between: ctx.pick.between,
          ...(pickBest ? { pickBest } : {}), ...(extendClickLocked ? { extendClickLocked } : {}),
        };
      }),
      lasso: createLassoTool(ctx.toolOptions.lasso ?? {}),
    },
  }),
  includes: [selectionPreset],
};

/** Offers the shape tools by id, mounted where something names them: `shapeToolsPreset`, `defaultTools={['rect']}`.
 *  `toolOptions.insert` reaches every one. */
export const shapeToolKitPreset: FeaturePreset = {
  id: 'toolkit:shape',
  label: 'Shape tools, offered',
  build: (ctx) => {
    const insert = ctx.toolOptions.insert ?? {};
    const onCountChange = () => { ctx.requestRedraw(); };
    return {
      tools: {
        rect: createRectTool(insert),
        ellipse: createEllipseTool(insert),
        line: createLineTool(insert),
        polygon: createPolygonTool({ ...insert, onCountChange }),
        star: createStarTool({ ...insert, onCountChange }),
      },
    };
  },
  includes: [insertPreset],
};

/** The select tool and the lasso. */
export const selectToolsPreset: FeaturePreset = {
  id: 'tools:select', label: 'Selection tools', tools: [SELECT_TOOLS], includes: [selectToolKitPreset],
};
/** The tools that drag out a primitive: rect, ellipse, line, polygon, star. */
export const shapeToolsPreset: FeaturePreset = {
  id: 'tools:shape', label: 'Shape tools', tools: [SHAPE_TOOLS], includes: [shapeToolKitPreset],
};
