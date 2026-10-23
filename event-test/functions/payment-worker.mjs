import {transaction} from '../lib/core.mjs';
import {session,reconcile} from '../lib/billing.mjs';
export default async()=>{await transaction(async db=>{const rows=await db.q("SELECT s.booking_id FROM stripe_checkouts s JOIN bookings b ON b.id=s.booking_id WHERE b.status='pending' ORDER BY s.created LIMIT 1");for(const r of rows)await reconcile(db,r.booking_id,await session(db,r.booking_id));});return new Response(null,{status:204});};
export const config={schedule:'*/5 * * * *'};
