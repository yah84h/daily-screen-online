import { useEffect, useRef } from 'react';
import { useRemoteMedia, type ScreenReport } from '@/lib/remoteMedia';
import { changeDevicePlayback, useDevicePlayback } from '@/lib/devicePlayback';
import { useCacheTasks } from '@/lib/cacheStatus';
export function RemoteMediaReceiver({ screen, token }: { screen: string; token: string }) {
  const remote = useRemoteMedia(screen, token);
  const device = useDevicePlayback();
  const tasks = useCacheTasks();
  const latest = useRef({ device, tasks, state: remote.state });
  latest.current = { device, tasks, state: remote.state };
  const send = useRef(remote.send);
  send.current = remote.send;
  const reportNow = useRef(() => {});
  const commandKey = 'daily-screen-last-media-command:' + screen + ':' + token;
  const lastCommand = useRef('');
  useEffect(() => {
    try {
      lastCommand.current = localStorage.getItem(commandKey) || '';
    } catch {}
  }, [commandKey]);
  useEffect(() => {
    if (remote.state)
      changeDevicePlayback({
        paused: remote.state.paused,
        volume: remote.state.volume,
        downloadsPaused: remote.state.downloadsPaused,
        remoteActive: true,
      });
  }, [remote.state?.paused, remote.state?.volume, remote.state?.downloadsPaused]);
  useEffect(() => {
    const command = remote.state?.command;
    if (!command || command.id === lastCommand.current || Date.now() - command.at > 120000) return;
    const apply = () => {
      if (command.action === 'seek') {
        const selector =
          command.target === 'video'
            ? '.tv video'
            : command.target === 'audio'
              ? '.tv audio'
              : '.tv video,.tv audio';
        const elements = Array.from(document.querySelectorAll<HTMLMediaElement>(selector)).filter(
          (media) => Number.isFinite(media.duration) && media.duration > 0,
        );
        if (!elements.length) return false;
        for (const media of elements)
          media.currentTime = Math.max(
            0,
            Math.min(
              media.duration,
              command.mode === 'absolute'
                ? command.seconds || 0
                : media.currentTime + (command.seconds || 0),
            ),
          );
      } else if (command.action === 'play' || command.action === 'pause') {
        document.querySelectorAll<HTMLMediaElement>('.tv video,.tv audio').forEach((media) => {
          if (command.action === 'pause') media.pause();
          else setTimeout(() => void media.play().catch(() => {}), 0);
        });
      } else
        window.dispatchEvent(
          new CustomEvent('daily-screen-playlist-command', { detail: command.action }),
        );
      lastCommand.current = command.id;
      try {
        localStorage.setItem(commandKey, command.id);
      } catch {}
      return true;
    };
    if (apply()) return;
    const timer = setInterval(() => {
      if (apply()) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [remote.state?.command?.id, commandKey]);
  useEffect(() => {
    let active = true,
      sending = false;
    let first = true;
    const report = async () => {
      if (sending || !active || (!first && (latest.current.state?.watchUntil || 0) < Date.now()))
        return;
      first = false;
      sending = true;
      const video = document.querySelector<HTMLVideoElement>(
        '.tv .video-playlist video,.tv .screen-image video,.tv .screen-media video',
      );
      const audio = document.querySelector<HTMLAudioElement>(
        '.tv audio[data-background-audio],.tv .full-audio-player audio',
      );
      const media = video || audio;
      const playlist = document.querySelector('.tv .video-playlist'),
        presentation = document.querySelector('.tv .presentation-player');
      const feedback: Omit<ScreenReport, 'label' | 'at'> = {
        paused: media ? media.paused : latest.current.device.paused,
        volume: media?.volume ?? latest.current.device.volume,
        position: media?.currentTime || 0,
        duration: media && Number.isFinite(media.duration) ? media.duration : 0,
        kind: video
          ? 'video'
          : audio
            ? 'audio'
            : presentation
              ? 'presentation'
              : playlist
                ? 'photos'
                : 'none',
        index: Number(
          playlist?.getAttribute('data-playlist-index') ||
            presentation?.getAttribute('data-slide') ||
            0,
        ),
        tasks: latest.current.tasks,
        audio: audio
          ? {
              position: audio.currentTime || 0,
              duration: Number.isFinite(audio.duration) ? audio.duration : 0,
              paused: audio.paused,
            }
          : null,
        video: video
          ? {
              position: video.currentTime || 0,
              duration: Number.isFinite(video.duration) ? video.duration : 0,
              paused: video.paused,
            }
          : null,
        blocked: !!media && !latest.current.device.paused && media.paused && media.readyState >= 2,
      };
      try {
        await send.current({ action: 'report', report: feedback });
      } catch {
        /* Read/command errors are shown in admin; reports retry on the next heartbeat. */
      } finally {
        sending = false;
      }
    };
    reportNow.current = () => void report();
    const timer = setInterval(report, 5000);
    void report();
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [screen, token]);
  useEffect(() => {
    if ((remote.state?.watchUntil || 0) > Date.now()) reportNow.current();
  }, [remote.state?.watchUntil]);
  return null;
}
