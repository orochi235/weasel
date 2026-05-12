import { UnknownIcon } from '@orochi235/weasel';
import type { AnyTool, ToolsApi } from '@orochi235/weasel';
import s from './ToolPalette.module.css';

export interface ToolPaletteProps {
  tools: ToolsApi;
  orientation?: 'vertical' | 'horizontal';
  className?: string;
}

export function ToolPalette(props: ToolPaletteProps) {
  const { tools, orientation = 'vertical', className } = props;
  const list = Object.values(tools.registry);
  const cls = [s.palette, orientation === 'horizontal' && s.horizontal, className]
    .filter(Boolean).join(' ');

  return (
    <div className={cls} role="toolbar" aria-label="Tools">
      {list.map((tool: AnyTool) => {
        const label = tool.presentation?.label ?? tool.id;
        const rawIcon = tool.presentation?.icon;
        const icon =
          rawIcon == null
            ? <UnknownIcon />
            : typeof rawIcon === 'function'
            ? rawIcon(undefined)
            : rawIcon;
        const isActive = tools.active === tool.id;
        return (
          <button
            key={tool.id}
            type="button"
            className={[s.button, isActive && s.active].filter(Boolean).join(' ')}
            aria-current={isActive ? 'true' : undefined}
            onClick={() => tools.setActive(tool.id)}
          >
            <span className={s.icon} aria-hidden="true">{icon}</span>
            <span className={s.label}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
