import {transaction,expire} from '../lib/core.mjs';
import {schedules} from '../lib/dashboard.mjs';
export default async()=>{await transaction(async db=>{await expire(db);await schedules(db);});return new Response(null,{status:204});};
export const config={schedule:'*/5 * * * *'};
