import { useEffect, useRef, useState } from 'react';

export interface RevealOnScroll<T extends HTMLElement> {
  ref: React.RefObject<T | null>;
  /** True once the element has entered the viewport. Never returns to false. */
  revealed: boolean;
}

/**
 * Flips to `revealed` the first time the element scrolls into view.
 *
 * One-shot on purpose: replaying the entrance every time a card scrolls past
 * turns a calm page into a flickering one. The observer disconnects on the
 * first intersection, so a long page does not accumulate live observers.
 *
 * Content already on screen at mount intersects immediately, so above-the-fold
 * sections animate in on load without any separate code path.
 */
export const useRevealOnScroll = <T extends HTMLElement>(): RevealOnScroll<T> => {
  const ref = useRef<T>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;

    if (node === null) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      // Fires a little before the element is fully in view, so the entrance
      // finishes as it settles rather than starting after it has arrived.
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  return { ref, revealed };
};
