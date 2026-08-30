import { useEffect, useRef } from 'react';

const CLIENT = import.meta.env.VITE_ADSENSE_CLIENT?.trim();
const SLOT = import.meta.env.VITE_ADSENSE_SLOT?.trim();
const SCRIPT_ID = 'lut-lab-adsense';

type Props = {
  hidden?: boolean;
};

/** Footer ad slot — panel bottom only, never over the preview canvas. */
export function AdSlot({ hidden = false }: Props) {
  const insRef = useRef<HTMLModElement>(null);
  const enabled = Boolean(CLIENT && SLOT && !hidden);

  useEffect(() => {
    if (!enabled || !insRef.current) return;

    const pushAd = () => {
      try {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
      } catch {
        /* blocked by ad blocker */
      }
    };

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.async = true;
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        script!.dataset.loaded = 'true';
        pushAd();
      };
      document.head.appendChild(script);
      return;
    }

    if (script.dataset.loaded === 'true') {
      pushAd();
      return;
    }

    script.addEventListener('load', pushAd, { once: true });
  }, [enabled]);

  if (!CLIENT || !SLOT || hidden) return null;

  return (
    <div className="ad-slot" aria-label="Advertisement">
      <p className="ad-slot-label">Sponsored</p>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={CLIENT}
        data-ad-slot={SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
