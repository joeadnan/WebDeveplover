require('dotenv').config();
const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function test() {
  console.log('Mencoba menghubungkan ke Turso...');
  try {
    const start = Date.now();
    const result = await db.execute('SELECT 1 + 1 AS test');
    console.log(`✅ Berhasil terhubung dalam ${Date.now() - start}ms!`);
    console.log('Hasil Test:', result.rows);
  } catch (err) {
    console.error('❌ GAGAL TERHUBUNG KE TURSO:');
    console.error(err);
  }
}

test();