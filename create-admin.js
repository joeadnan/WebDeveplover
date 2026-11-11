require('dotenv').config();
const bcrypt = require('bcryptjs');
const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function createAdmin() {
  const name = 'Admin TokoKita';
  const email = 'admin@tokokita.com';
  const rawPassword = 'password123';

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(rawPassword, salt);

    const result = await db.execute({
      sql: `
        INSERT INTO users (full_name, email, phone_number, password_hash, role, is_verified)
        VALUES (?, ?, '08123456789', ?, 'admin', 1)
      `,
      args: [name, email.toLowerCase(), passwordHash]
    });

    console.log('✅ Akun Admin Berhasil Dibuat!');
    console.log(`Email    : ${email}`);
    console.log(`Password : ${rawPassword}`);
  } catch (err) {
    console.error('❌ Gagal:', err.message);
  }
}

createAdmin();