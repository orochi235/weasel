import { InlineMarkdown } from '@weasel-js/ui/components/InlineMarkdown';
import { packageRoute, splitReferencePath } from '../../../shared/packageRoutes';
import type { PackageReference, ReferenceSymbol } from '../../../shared/reference';
import { Prose } from '../../Prose';
import { ClassPage } from './ClassPage';
import { FunctionPage } from './FunctionPage';
import { ModuleIndex } from './ModuleIndex';
import { TypePage } from './TypePage';
import s from './Reference.module.css';

/** A loaded reference at one address: a module's index, or the page of one export. */
export function ReferenceView({ reference, rest }: { reference: PackageReference; rest: string }) {
  const { module: moduleName, symbol } = splitReferencePath(rest, reference.modules.map((m) => m.name));
  const module = reference.modules.find((m) => m.name === moduleName);
  if (!module) return <p className={s.note}>{reference.specifier} has no entry named <code>{moduleName}</code>.</p>;
  if (symbol === null) return <ModuleIndex reference={reference} module={module} />;

  // A type and a value may share a name; the page shows every declaration of it.
  const declared = module.symbols.filter((candidate) => candidate.name === symbol);
  return (
    <div className={s.symbolPage}>
      <a className={s.back} href={`#${packageRoute(reference.package, 'reference', module.name)}`}>
        ← {module.specifier}
      </a>
      {declared.length === 0 && <p className={s.note}>{module.specifier} exports nothing named <code>{symbol}</code>.</p>}
      {declared.map((one) => <SymbolSection key={one.kind} symbol={one} />)}
    </div>
  );
}

const KIND_LABELS: Record<ReferenceSymbol['kind'], string> = {
  function: 'function',
  interface: 'interface',
  type: 'type',
  variable: 'variable',
  enum: 'enum',
  class: 'class',
  alias: 're-export',
};

function SymbolSection({ symbol }: { symbol: ReferenceSymbol }) {
  return (
    <section className={s.symbol}>
      <header className={s.symbolHeader}>
        <span className={s.kind}>{KIND_LABELS[symbol.kind]}</span>
        <h3 className={s.symbolName}>{symbol.name}</h3>
      </header>
      {symbol.deprecated && (
        <div className={s.deprecated}>
          <strong>Deprecated</strong>
          <Prose blocks={symbol.deprecated} />
        </div>
      )}
      <SymbolBody symbol={symbol} />
      {symbol.source && (
        <p className={s.source}>
          Declared in{' '}
          {symbol.source.url
            ? <a href={symbol.source.url} target="_blank" rel="noreferrer">{symbol.source.file}:{symbol.source.line}</a>
            : <code>{symbol.source.file}:{symbol.source.line}</code>}
        </p>
      )}
    </section>
  );
}

function SymbolBody({ symbol }: { symbol: ReferenceSymbol }) {
  switch (symbol.kind) {
    case 'function':
      return <FunctionPage symbol={symbol} />;
    case 'class':
      return <ClassPage symbol={symbol} />;
    case 'alias':
      return (
        <>
          {symbol.summary && <p><InlineMarkdown text={symbol.summary} links="text" /></p>}
          <p className={s.note}>
            {symbol.to
              ? <>Re-exported. <a href={`#${symbol.to}`}>See where it is declared.</a></>
              : 'Re-exported from a package this reference does not document.'}
          </p>
        </>
      );
    default:
      return <TypePage symbol={symbol} />;
  }
}
