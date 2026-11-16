import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, it } from 'vitest';
import type { CameraView } from '../canvas/CameraInput';
import { CameraPublishContext } from '../canvas/cameraRegistry';
import { useSceneCamera } from './useSceneCamera';

it("reads the host's size in its own px when an ancestor draws it at twice its size", () => {
  const host = document.createElement('div');
  Object.defineProperty(host, 'offsetWidth', { value: 300 });
  Object.defineProperty(host, 'offsetHeight', { value: 200 });
  host.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 600, height: 400 });
  let published: CameraView | null = null;
  const publish = (camera: CameraView) => {
    published = camera;
    return () => {};
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <CameraPublishContext.Provider value={publish}>{children}</CameraPublishContext.Provider>
  );
  renderHook(() => useSceneCamera({ current: null }, { current: host }), { wrapper });
  expect((published as CameraView | null)?.hostSize?.()).toEqual({ width: 300, height: 200 });
});
