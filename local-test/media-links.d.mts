export function mediaLink(
  input: string,
  fallback?: 'video' | 'audio',
): { url: string; kind: 'video' | 'audio'; drive: boolean } | null;
export function audioPlaybackURL(url: string): string;
