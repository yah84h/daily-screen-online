import {scryptSync,timingSafeEqual} from 'node:crypto';
export const ownerUsername='Archo';
export const ownerInternalEmail='archo@staff.daily-screen.invalid';
export const legacyOwnerUsername='3looolyyy@gmail.com';
export const bootstrapHash={salt:'3ec78dd686f8fc7c721813f6e35bbc00',hash:'959844f295baf516e14133f9e585ef85bea60ead8d551233e2f6c79d8665f5f413ef71bbf6729ccc1b1c6eaf4a34bc3aaa726efadcf997867468106abcc2e328'};
export function isStarterPassword(value){if(typeof value!=='string'||value.length>128)return false;return timingSafeEqual(scryptSync(value,bootstrapHash.salt,64),Buffer.from(bootstrapHash.hash,'hex'));}
