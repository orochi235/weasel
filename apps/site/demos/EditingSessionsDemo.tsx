import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { CanvasView, SceneCanvas, useEditingSession, useScene, viewPreset } from '@weasel-js/core';
import type { Scene } from '@weasel-js/core';
import { DemoStage, DemoStageGroup } from './DemoStage';
import { makeRandomScene, pipView, PIP } from './CanvasViewDemo';
import styles from './EditingSessionsDemo.module.css';
import { movePreset, pickPreset } from '@weasel-js/editing';

type LayerId = 'default';
type Item = ReturnType<typeof makeRandomScene>[number];
type DocScene = Scene<Item['data'], LayerId, Item['pose']>;

const W = 380, H = 360;

/** What a session has selected. A session's `subscribe` hears its own selection and every document edit. */
function Selected({ session }: { session: DocScene }) {
  useSyncExternalStore(session.subscribe, session.getVersion);
  const ids = session.getSelection();
  return <span className={styles.readout}>selected: {ids.length === 0 ? 'nothing' : ids.join(', ')}</span>;
}

/** One canvas over `session`: what it selects, previews and scrolls is that session's. */
function SessionCanvas({ session, children }: { session: DocScene; children?: ReactNode }) {
  return (
    <div className={styles.column}>
      <DemoStage width={W} height={H}>
        <SceneCanvas features={[viewPreset, pickPreset, movePreset]} className="ckd-canvas" scene={session}
          selectionOptions={{ mode: 'multiple' }}>
          {children}
        </SceneCanvas>
      </DemoStage>
      <Selected session={session} />
    </div>
  );
}

export function EditingSessionsDemo() {
  const [initial] = useState(makeRandomScene);
  // The scene is the document and its own default session.
  const scene = useScene<Item['data'], LayerId, Item['pose']>({ systemLayers: [{ id: 'default' }], initial });
  // A second session over the same document: its own selection, previews and scroll.
  const session = useEditingSession(scene);

  return (
    <div className={styles.demo}>
      <DemoStageGroup>
        <div className={styles.pair}>
          <SessionCanvas session={scene}>
            {/* A view acts on its canvas's session: it shares the left canvas's selection. */}
            <CanvasView
              id="pip"
              bounds={(_outer, dims) => ({ x: PIP.margin, y: dims.height - PIP.height - PIP.margin, width: PIP.width, height: PIP.height })}
              defaultView={pipView(initial)}
              background="rgba(0,0,0,0.4)"
            />
          </SessionCanvas>
          <SessionCanvas session={session} />
        </div>
      </DemoStageGroup>
    </div>
  );
}
