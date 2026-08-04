import { useEffect, useRef, useState } from "react";
import { useAppState } from "../app/AppStateProvider";

export const backgroundMusicSource = "/audio/background.mp3";
export const defaultMusicVolume = 0.35;

export function BackgroundMusic() {
  const { state, dispatch } = useAppState();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState<string>();
  const volume = state.settings.musicVolume ?? defaultMusicVolume;
  const volumePercent = Math.round(volume * 100);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      return;
    }

    try {
      setPlaybackError(undefined);
      await audio.play();
    } catch {
      setPlaybackError("浏览器暂时没有允许播放，请再点一次播放");
    }
  }

  return (
    <section className="music-player surface-card" aria-label="背景音乐控制">
      <div className="music-player__track">
        <span className="music-player__note" aria-hidden="true">♫</span>
        <span><strong>背景音乐</strong><small>我真的特别想你</small></span>
      </div>
      <button
        type="button"
        className="button music-player__toggle"
        onClick={() => void togglePlayback()}
      >
        {playing ? "暂停音乐" : "播放音乐"}
      </button>
      <div className="music-player__volume">
        <label htmlFor="background-music-volume">音量</label>
        <input
          id="background-music-volume"
          type="range"
          min="0"
          max="100"
          step="1"
          value={volumePercent}
          onChange={(event) => dispatch({
            type: "settings/music-volume",
            value: Number(event.target.value) / 100
          })}
        />
        <output htmlFor="background-music-volume">{volumePercent}%</output>
      </div>
      <audio
        ref={audioRef}
        data-testid="background-music-audio"
        src={backgroundMusicSource}
        loop
        preload="metadata"
        aria-hidden="true"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onCanPlay={() => setPlaybackError(undefined)}
        onError={() => setPlaybackError("背景音乐加载失败，请刷新后重试")}
      />
      {playbackError && <p className="music-player__error" role="alert">{playbackError}</p>}
    </section>
  );
}
