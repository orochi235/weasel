import type { TypeSymbol } from '../../../shared/reference';
import { Prose } from '../../Prose';
import { CodeLine } from './CodeLine';
import { Members } from './Members';

const MEMBERS_TITLE: Record<TypeSymbol['kind'], string> = {
  interface: 'Members',
  type: 'Fields',
  variable: 'Fields',
  enum: 'Values',
};

/** An interface, a type alias, a variable, or an enum: its declaration, its comment, and what it holds. */
export function TypePage({ symbol }: { symbol: TypeSymbol }) {
  return (
    <>
      <CodeLine code={symbol.code} />
      <Prose blocks={symbol.doc} />
      <Members title={MEMBERS_TITLE[symbol.kind]} members={symbol.members} />
    </>
  );
}
