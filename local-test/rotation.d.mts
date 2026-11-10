export type DisplayRotation={enabled:boolean;normal:'daily'|'photos'|'loop'|'media';normalSeconds:number;leaderboardSeconds:number};
export function rotationOptions(value?:Partial<DisplayRotation>):DisplayRotation;
export function rotationPhase(seconds:number,value?:Partial<DisplayRotation>):'leaderboard'|'normal';
