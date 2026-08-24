import { drizzle } from "drizzle-orm/neon-http";
import { drizzle as drizzlePool } from "drizzle-orm/neon-serverless";
import { neon, Pool } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle({ client: sql });

// neon-http can only run single-statement requests — it has no BEGIN/COMMIT
// round trip, so `db.transaction()` throws. The handful of operations that
// need a real check-then-write guarantee (lock a row, re-check state, then
// insert) use this pooled, websocket-backed client instead.
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const txDb = drizzlePool({ client: pool });

export type Tx = Parameters<Parameters<typeof txDb.transaction>[0]>[0];
