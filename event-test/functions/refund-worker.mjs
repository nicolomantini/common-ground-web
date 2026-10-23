import {refundOne} from '../lib/billing.mjs';
export default async()=>{await refundOne();return new Response(null,{status:204});};
export const config={schedule:'*/5 * * * *'};
