// The component's own entry, not the barrel: the barrel would bring every weasel-ui component into each frame.
import { InlineMarkdown } from '@weasel-js/ui/components/InlineMarkdown';

/** Splits JSDoc prose into paragraphs at blank lines, rejoining the lines a comment wrapped. */
export function paragraphsOf(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.split('\n').map((line) => line.trim()).filter(Boolean).join(' '))
    .filter(Boolean);
}

/** A story's or component's JSDoc description, a paragraph per `className`-ed `<p>`, its inline markdown drawn. */
export function Description({ text, className }: { text: string; className: string }) {
  return (
    <>
      {paragraphsOf(text).map((paragraph, i) => (
        <p key={i} className={className}>
          <InlineMarkdown text={paragraph} />
        </p>
      ))}
    </>
  );
}
