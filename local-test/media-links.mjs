import { parseDriveLink } from './drive-video.mjs';
export function mediaLink(input, fallback = 'video') {
  const drive = parseDriveLink(input.trim());
  if (drive) return { url: drive.url, kind: fallback, drive: true };
  try {
    const url = new URL(input.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const extension = url.pathname.split('.').pop()?.toLowerCase(),
      kind = ['mp3', 'm4a', 'wav', 'ogg', 'flac', 'aac', 'opus'].includes(extension || '')
        ? 'audio'
        : ['mp4', 'webm', 'm4v', 'mov', 'ogv'].includes(extension || '')
          ? 'video'
          : fallback;
    return { url: url.href, kind, drive: false };
  } catch {
    return null;
  }
}
export function audioPlaybackURL(url) {
  const drive = parseDriveLink(url);
  return drive
    ? '/api/drive-video?id=' +
        encodeURIComponent(drive.id) +
        (drive.resourcekey ? '&resourcekey=' + encodeURIComponent(drive.resourcekey) : '') +
        '&audio=1'
    : url;
}
