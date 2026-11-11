require('dotenv').config();
const {creteClient} = require('@libsql/client');

const db = creteClient ({
    url : process.env.TURSO_DATEBASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function checkUsers() {
    try {
        console.log('Mengambil data pengguna dari database Turso...\n');

        const result = await db.execute(`
            SELECT id, name, email, role created_at
            FROM users
            ORDER BY id ASC
            `);

            if(!result.rows || result.rows.length === 0){
                console.log('Tabel user masih kosong.');
                return;
            }
    } catch (err) {
        console.error('Gagal mengambil data users', err.message);
    }
}
checkUsers();