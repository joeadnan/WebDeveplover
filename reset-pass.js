require('dotenv').config();
const bcrypt = require('bcryptjs');
const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// GANTI EMAIL DAN PASSWORD BARU DI SINI:
const TARGET_EMAIL = 'admin@tokokita.com'; // Masukkan email akun Anda
const NEW_PASSWORD = 'password123';         // Password baru yang Anda inginkan

async function resetPassword() {
  try {
    console.log(`Mereset password untuk: ${TARGET_EMAIL}...`);
    
    // 1. Hash password baru
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(NEW_PASSWORD, salt);

    // 2. Update di database Turso
    const result = await db.execute({
      sql: `UPDATE users SET password = ? WHERE email = ?`,
      args: [hashedPassword, TARGET_EMAIL.toLowerCase().trim()]
    });

    if (result.rowsAffected > 0) {
      console.log('✅ BERHASIL! Password telah diperbarui.');
      console.log(`Email    : ${TARGET_EMAIL}`);
      console.log(`Password : ${NEW_PASSWORD}`);
    } else {
      console.log('❌ GAGAL: Email tidak ditemukan di database.');
    }
  } catch (err) {
    console.error('❌ Error saat mereset password:', err);
  }
}

resetPassword();