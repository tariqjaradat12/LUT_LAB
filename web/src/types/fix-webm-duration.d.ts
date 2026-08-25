declare module 'fix-webm-duration' {
  function fixWebmDuration(
    blob: Blob,
    duration: number,
    callback: (fixed: Blob) => void,
    options?: { logger?: boolean | ((msg: string) => void) },
  ): void;
  export default fixWebmDuration;
}
