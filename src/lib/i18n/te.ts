// Telugu translations, keyed by the English text used in the code, one file per area.
// Have a Telugu-speaking staff member review them; anything missing shows in English.
import { COMMON } from './te/common';
import { PATIENTS } from './te/patients';
import { MONEY } from './te/money';
import { STOCK } from './te/stock';
import { STAFF_SETUP } from './te/staff-setup';

export const TE: Record<string, string> = { ...COMMON, ...PATIENTS, ...MONEY, ...STOCK, ...STAFF_SETUP };
