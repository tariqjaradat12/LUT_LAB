import { useEffect, useState, type ChangeEvent } from 'react';
import { formatTimecode } from '../lib/videoIO';

type Props = {
  video: HTMLVideoElement;
  duration: number;
};

export function VideoTransport({ video, duration }: Props) {
  const [playing, setPlaying] = useState(() => !video.paused);
  const [current, setCurrent] = useState(() => video.currentTime);

  useEffect(() => {
    const onTime = () => setCurrent(video.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('seeked', onTime);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    setPlaying(!video.paused);
    setCurrent(video.currentTime);
    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('seeked', onTime);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [video]);

  const toggle = () => {
    if (video.paused) void video.play();
    else video.pause();
  };

  const onScrub = (e: ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value);
    if (!Number.isFinite(t)) return;
    video.currentTime = t;
    setCurrent(t);
  };

  const max = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const value = Math.min(Math.max(0, current), max || 0);

  return (
    <div className="video-transport">
      <button
        type="button"
        className="video-transport-play"
        onClick={toggle}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? 'Pause' : 'Play'}
      </button>
      <span className="video-transport-time">{formatTimecode(current)}</span>
      <input
        type="range"
        className="video-transport-scrub"
        min={0}
        max={max}
        step={0.01}
        value={value}
        onChange={onScrub}
        aria-label="Scrub"
      />
      <span className="video-transport-time">{formatTimecode(duration)}</span>
    </div>
  );
}
