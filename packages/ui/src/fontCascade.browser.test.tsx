/// <reference types="vite/client" />
import '@weasel-js/theme/tokens.css';
import { FIXTURES } from './fontCascade.fixtures';
import { describeFontCascade, exportedComponents } from './testing/fontCascade';
import { storyCases } from './testing/teardown';

// Every ui story inside a container set in a face of its own; see `./testing/fontCascade.tsx`.
describeFontCascade('every ui story sets its text in its container’s face, or a role’s', {
  // Foundations is the token showcase: its faces are the subject.
  cases: [...(await storyCases(import.meta.glob(['./components/**/*.stories.tsx', '!./components/Foundations/**']))), ...FIXTURES],
  components: exportedComponents(Object.values(import.meta.glob<Record<string, unknown>>('./components/*/index.ts', { eager: true }))),
  unmounted: {
    BarItem: 'a marker a Bar reads its props from; Bar draws the item itself',
    BarDivider: 'a marker a Bar reads; it renders nothing',
    BarSpacer: 'a marker a Bar reads; it renders nothing',
  },
  skip: { './components/Slider/Slider.stories.tsx#Playground': "calls forge's useArgs, which only forge's frame provides" },
});
