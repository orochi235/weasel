import { createRef, type RefObject, useEffect } from 'react';

type PictureRef = RefObject<HTMLDivElement | null>;

/** Each trial's picture element, held while the trial is mounted (`useTrialPicture`) and released once it goes. */
export function trialPictures() {
  const pictures = new Map<string, PictureRef>();
  const pictureFor = (trial: string): PictureRef => {
    let ref = pictures.get(trial);
    if (!ref) {
      ref = createRef<HTMLDivElement>();
      pictures.set(trial, ref);
    }
    return ref;
  };
  return { pictures, pictureFor };
}

export type TrialPictures = ReturnType<typeof trialPictures>;

/** `trial`'s picture, held in `p` for as long as the calling component is mounted. */
export function useTrialPicture(p: TrialPictures, trial: string): PictureRef {
  const ref = p.pictureFor(trial);
  useEffect(() => {
    p.pictures.set(trial, ref);
    return () => {
      if (p.pictures.get(trial) === ref) p.pictures.delete(trial);
    };
  }, [p, trial, ref]);
  return ref;
}
