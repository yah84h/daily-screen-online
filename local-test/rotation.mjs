export function rotationOptions(value) {
  return {
    enabled: value?.enabled === true,
    normal: ['daily', 'photos', 'loop', 'media'].includes(value?.normal) ? value.normal : 'daily',
    normalSeconds: Math.max(5, Math.min(600, Number(value?.normalSeconds) || 20)),
    leaderboardSeconds: Math.max(5, Math.min(600, Number(value?.leaderboardSeconds) || 15)),
  };
}
export function rotationPhase(seconds, value) {
  const r = rotationOptions(value);
  return r.enabled &&
    Math.max(0, seconds) % (r.normalSeconds + r.leaderboardSeconds) >= r.normalSeconds
    ? 'leaderboard'
    : 'normal';
}
