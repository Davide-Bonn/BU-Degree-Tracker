/**
 * Utility script to find which Supabase pooler region works for your project.
 * Tries connecting to each AWS region's pooler endpoint.
 *
 * Usage: Set DATABASE_URL in .env, then run:
 *   npx tsx scripts/find-pooler.ts
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;

const regions = [
  'eu-west-1', 'eu-west-2', 'eu-west-3',
  'eu-central-1', 'eu-central-2', 'eu-north-1',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1',
  'ap-south-1', 'sa-east-1', 'ca-central-1',
];

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not set in .env');
    process.exit(1);
  }

  // Extract credentials from DATABASE_URL
  const url = new URL(dbUrl);
  const user = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);

  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    const client = new Client({
      host, port: 6543,
      user,
      password,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });
    try {
      await client.connect();
      console.log('SUCCESS:', host);
      await client.end();
      return;
    } catch (e: any) {
      console.log('FAIL:', host, '-', e.message.split('\n')[0]);
    }
  }
}
main();
