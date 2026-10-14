import type { ClassSymbol, MemberKind } from '../../../shared/reference';
import { Prose } from '../../Prose';
import { CodeLine } from './CodeLine';
import { Members } from './Members';

/** A class's members by what they are, in the order a reader looks for them. */
const SECTIONS: readonly { title: string; kinds: readonly MemberKind[] }[] = [
  { title: 'Constructor', kinds: ['constructor'] },
  { title: 'Properties', kinds: ['property', 'index'] },
  { title: 'Accessors', kinds: ['accessor'] },
  { title: 'Methods', kinds: ['method', 'call'] },
];

/** A class: its declaration and comment, then its constructor, properties, accessors, and methods. */
export function ClassPage({ symbol }: { symbol: ClassSymbol }) {
  return (
    <>
      <CodeLine code={symbol.code} />
      <Prose blocks={symbol.doc} />
      {SECTIONS.map(({ title, kinds }) => (
        <Members key={title} title={title} members={symbol.members.filter((member) => kinds.includes(member.kind))} />
      ))}
    </>
  );
}
