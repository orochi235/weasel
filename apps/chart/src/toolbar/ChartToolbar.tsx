import { zoomAt, type Tool, type ToolsApi, type View } from '@weasel-js/core';
import { Bar } from '@weasel-js/ui/components/Bar';
import { Toolbar } from '@weasel-js/ui/components/Toolbar';
import { ToolPalette } from '@weasel-js/ui/components/ToolPalette';
import { useCallback, useMemo, type ReactElement } from 'react';
import { useChartPref } from '../prefs';
import { SPACING_PATH, TOOLBAR_ASSETS, ZOOM_PATH, type ToolbarAsset } from './toolbarAssets';
import './toolbar.css';

export interface ChartToolbarProps {
  /** Unset until the canvas has made its tools. */
  tools: ToolsApi | null;
  /** Which tools the palette shows. */
  include: (tool: Tool) => boolean;
  view: View;
  setView: (view: View) => void;
  /** The canvas's size, whose center a typed zoom holds still. */
  dims: { width: number; height: number };
}

/** What each asset's value leaves show, and where an edit of one goes. */
function useToolbarBinding({ view, setView, dims }: Pick<ChartToolbarProps, 'view' | 'setView' | 'dims'>) {
  const [spacing, setSpacing] = useChartPref('view.gridSpacing');
  const values = useMemo(() => ({ [ZOOM_PATH]: Math.abs(view.scale.x), [SPACING_PATH]: spacing }), [view, spacing]);
  const onChange = useCallback((path: string, value: unknown) => {
    if (typeof value !== 'number' || !(value > 0)) return;
    if (path === SPACING_PATH) setSpacing(value);
    else if (path === ZOOM_PATH) {
      setView(zoomAt(view, { x: dims.width / 2, y: dims.height / 2 }, value / Math.abs(view.scale.x)));
    }
  }, [view, setView, dims.width, dims.height, setSpacing]);
  return { values, onChange };
}

function AssetBar({ asset, values, onChange }: {
  asset: ToolbarAsset;
  values: Readonly<Record<string, unknown>>;
  onChange: (path: string, value: unknown) => void;
}): ReactElement {
  return (
    <Toolbar.Group aria-label={asset.label}>
      <Bar schema={asset.schema} values={values} onChange={onChange} />
    </Toolbar.Group>
  );
}

/** Chart mode's toolbar: the tool palette, then each asset in `TOOLBAR_ASSETS` as a bar. */
export function ChartToolbar({ tools, include, ...binding }: ChartToolbarProps): ReactElement {
  const { values, onChange } = useToolbarBinding(binding);
  return (
    <Toolbar className="wc-toolbar" aria-label="Chart" roving={false} wrap>
      <Toolbar.Group aria-label="Tools">
        {tools && <ToolPalette tools={tools} include={include} orientation="horizontal" />}
      </Toolbar.Group>
      {TOOLBAR_ASSETS.map((asset) => <AssetBar key={asset.id} asset={asset} values={values} onChange={onChange} />)}
    </Toolbar>
  );
}
