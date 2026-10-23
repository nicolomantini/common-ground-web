import {emailOne} from '../lib/email.mjs';
export default async()=>{await emailOne();return new Response(null,{status:204});};
export const config={schedule:'* * * * *'};
