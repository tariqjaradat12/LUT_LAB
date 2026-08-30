import { useEffect, useRef } from 'react';
import { ADSENSE_CLIENT, ADSENSE_SLOT } from '../lib/adsConfig';

type Props = {
  hidden?: boolean;
};

/** Footer ad slot — tool panel bottom only, never on the preview canvas. */
export function AdSlot({ hidden = false }: Props) {
  const insRef = useRef<HTMLModElement>(null);
  const enabled = Boolean(ADSENSE_SLOT && !hidden);

  useEffect(() => {
    if (!enabled || !insRef.current) return;
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch {
      /* blocked by ad blocker */
    }
  }, [enabled]);

  if (!ADSENSE_SLOT || hidden) return null;

  return (
    <div className="ad-slot" aria-label="Advertisement">
      <p className="ad-slot-label">Sponsored</p>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={ADSENSE_SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
