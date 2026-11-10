import {clients} from '../lib/staff.mjs';import {createPresentationHandler} from '../lib/presentation-control.mjs';
export const handler=createPresentationHandler(clients);
