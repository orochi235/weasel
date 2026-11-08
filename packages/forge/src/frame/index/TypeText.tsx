// The component's own entry, not the barrel: the barrel would bring every weasel-ui component into each frame.
import { Focusable, Tooltip, TooltipTrigger } from '@weasel-js/ui/components/Tooltip';
import type { ApiTypeDef } from '../../story/api';
import { Description } from './Description';

/** Lines of a definition a tooltip shows before it says how many more there are: a tooltip cannot scroll. */
export const DEF_LINES = 20;

const PARTS = /([A-Za-z_$][\w$]*)/;

/** `text`, the lines past {@link DEF_LINES} replaced by a count of them. */
export function clipped(text: string): string {
  const lines = text.split('\n');
  if (lines.length <= DEF_LINES) return text;
  const more = lines.length - DEF_LINES;
  return `${lines.slice(0, DEF_LINES).join('\n')}\n… ${more} more line${more === 1 ? '' : 's'}`;
}

function Defined({ name, def }: { name: string; def: ApiTypeDef }) {
  return (
    <TooltipTrigger>
      <Focusable>
        <span role="img" aria-label={name} className="fg-index-api__defined">
          {name}
        </span>
      </Focusable>
      <Tooltip className="fg-index-api__tip" placement="bottom">
        {def.description ? <Description text={def.description} className="fg-index-api__tip-summary" /> : null}
        <pre className="fg-index-api__tip-def">
          <code>{clipped(def.text)}</code>
        </pre>
      </Tooltip>
    </TooltipTrigger>
  );
}

/** A type as written, each name of a type the project declares showing its definition on hover and on focus. */
export function TypeText({ text, types }: { text: string; types: Readonly<Record<string, ApiTypeDef>> | undefined }) {
  if (!types) return text;
  return text.split(PARTS).map((part, i) => {
    const def = i % 2 === 1 ? types[part] : undefined;
    return def ? <Defined key={i} name={part} def={def} /> : part;
  });
}
