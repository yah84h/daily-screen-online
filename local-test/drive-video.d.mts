export const DRIVE_CHUNK: number;
export function parseDriveLink(
  input: string,
): { id: string; resourcekey: string; url: string } | null;
export function driveVideoResponse(
  request: Request,
  options?: { fetcher?: typeof fetch },
): Promise<Response>;
