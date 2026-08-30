/** Public AdSense publisher ID (visible in page source). */
export const ADSENSE_CLIENT = 'ca-pub-8588643882726955';

/** Display ad unit slot — set VITE_ADSENSE_SLOT in .env or GitHub Actions secrets. */
export const ADSENSE_SLOT =
  import.meta.env.VITE_ADSENSE_SLOT?.trim() ||
  '';
