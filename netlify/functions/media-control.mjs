import { clients } from '../lib/staff.mjs';
import { createMediaControlHandler } from '../lib/media-control.mjs';
export const handler = createMediaControlHandler(clients);
