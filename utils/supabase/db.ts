// lib/db.ts
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, {
  max: 1,              // important on Vercel serverless
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false,      // required for Supabase Transaction pooler
})

export default sql