import { clients } from '../lib/staff.mjs';
import { createTurnHandler } from '../lib/turn.mjs';
export const handler = createTurnHandler(clients);
