require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@libsql/client');

// 1. VALIDASI ENVIRONMENT VARIABLES
if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error('ERROR: TURSO_DATABASE_URL atau TURSO_AUTH_TOKEN belum diatur di file .env');
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key_tokokita_2026';

// 2. INISIALISASI EXPRESS & DATABASE (WAJIB DI ATAS)
const app = express();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// 3. MIDDLEWARE UTAMA
app.use(cors({
  origin: [
    'http://127.0.0.1:5500', 
    'http://localhost:5500', 
    'http://127.0.0.1:5000', 
    'http://localhost:5000',
    'http://127.0.0.1:3000', 
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. HELPER FUNCTIONS & MIDDLEWARES AUTH

const generateSlug = (text) => 
  text.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '-');

// helper generate OTP & Token
const crypto = require('crypto');
const { error } = require('console');

// generate OTP 6 digit
function generateOTP (){
  return Math.floor(1000 + Math.random * 900000).toString();
}

// Middleware Verifikasi JWT Token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  // Perbaikan bug split spasi
  const token = authHeader && authHeader.split(' ')[1]; 

  if (!token) {
    return res.status(401).json({ error: 'Akses ditolak. Token tidak ditemukan.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token tidak valid atau sudah kadaluarsa.' });
    }
    req.user = user;
    next();
  });
};

// Middleware Proteksi Rute Admin
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Akses ditolak. Membutuhkan hak akses Admin.' });
  }
};

// -------------------------------------------------------------
// 5. AUTHENTICATION ENDPOINTS
// -------------------------------------------------------------

// POST /api/auth/register (Registrasi User Baru)
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role = 'customer' } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nama, email, dan password wajib diisi.' });
  }

  try {
    // Cek ketersediaan email
    const existing = await db.execute({
      sql: `SELECT id FROM users WHERE email = ?`,
      args: [email.toLowerCase().trim()]
    });

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email sudah terdaftar.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert ke database
    const result = await db.execute({
      sql: `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`,
      args: [name.trim(), email.toLowerCase().trim(), hashedPassword, role]
    });

    return res.status(201).json({
      message: 'Registrasi berhasil! Silakan login.',
      userId: Number(result.lastInsertRowid)
    });
  } catch (err) {
    console.error('[AUTH ERROR] Register:', err);
    return res.status(500).json({ error: 'Gagal melakukan registrasi pengguna.' });
  }
});

// endpoint Verifikasi OTP
app.post('/api/auth/verify-otp', async (req, res) => {
  const { user_id, otp_code } = req.body || {};

  if (!user_id || !otp_code) {
    return res.status(400).json({ error: 'User ID dan Kode OTP wajib diisi.' });
  }

  try {
    // 1. Cari OTP yang aktif & belum expired
    const result = await db.execute({
      sql: `
        SELECT id FROM email_verifications 
        WHERE user_id = ? AND otp_code = ? AND expires_at > CURRENT_TIMESTAMP
        ORDER BY id DESC LIMIT 1
      `,
      args: [user_id, otp_code.trim()]
    });

    if (!result.rows || result.rows.length === 0) {
      return res.status(400).json({ error: 'Kode OTP tidak valid atau sudah kedaluwarsa.' });
    }

    // 2. Perbarui kolom is_verified menjadi 1
    await db.execute({
      sql: `UPDATE users SET is_verified = 1 WHERE id = ?`,
      args: [user_id]
    });

    // 3. Bersihkan record OTP yang sudah digunakan
    await db.execute({
      sql: `DELETE FROM email_verifications WHERE user_id = ?`,
      args: [user_id]
    });

    return res.json({ message: 'Verifikasi email berhasil! Silakan login.' });
  } catch (err) {
    console.error('[AUTH ERROR] Verify OTP:', err);
    return res.status(500).json({ error: 'Terjadi kesalahan saat memproses verifikasi.' });
  }
  });
// POST /api/auth/login (Login User)
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email dan password wajib diisi.' });
  }

  try {
    const result = await db.execute({
      sql: `SELECT id, full_name, email, password_hash, role FROM users WHERE email = ?`,
      args: [email.toLowerCase().trim()]
    });

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Email atau password salah.' });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Email atau password salah.' });
    }

    // JWT token

    const tokenPayload = {
      id: user.id,
      name: user.full_name,
      email: user.email,
      role: user.role,
      is_verified: user.is_verified
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1d' });

    return res.json({
      message: 'Login berhasil!',
      token: token,
      user: {
        id: user.id,
        name: user.full_name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('[AUTH ERROR] Login:', err);
    return res.status(500).json({ error: 'Terjadi kesalahan saat login.' });
  }
});

// -------------------------------------------------------------
// 6. PUBLIC API ENDPOINTS
// -------------------------------------------------------------

// GET /api/products
app.get('/api/products', async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT 
        p.id, p.name, p.slug, p.description, p.image_url,
        c.name AS category_name, c.slug AS category_slug,
        pv.id AS variant_id, pv.price, pv.stock, pv.sku
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_variants pv ON p.id = pv.product_id
      WHERE p.status = 'published' AND (pv.is_active = 1 OR pv.is_active IS NULL)
      GROUP BY p.id
    `);

    const formattedProducts = (result.rows || []).map(p => ({
      id: p.id,
      name: p.name,
      price: p.price || 0,
      category: p.category_slug || 'umum',
      category_name: p.category_name || 'Umum',
      stock: p.stock || 0,
      variant_id: p.variant_id,
      image: p.image_url || 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500'
    }));

    return res.json(formattedProducts);
  } catch (err) {
    console.error('[API ERROR] GET /api/products:', err);
    return res.status(500).json([]);
  }
});

// POST /api/orders
app.post('/api/orders', async (req, res) => {
  const { 
    user_id = null,
    shipping_name, 
    shipping_phone, 
    shipping_address, 
    subtotal, 
    shipping_cost = 0, 
    discount_amount = 0,
    total_amount, 
    courier_name = 'REGULER', 
    courier_service = 'Standard',
    payment_method = 'bank_transfer',
    items = [] 
  } = req.body || {};

  try {
    const invoiceNumber = 'INV/' + Date.now() + '/' + Math.floor(1000 + Math.random() * 9000);

    const orderResult = await db.execute({
      sql: `
        INSERT INTO orders (
          invoice_number, user_id, shipping_name, shipping_phone, shipping_address,
          subtotal, shipping_cost, discount_amount, total_amount,
          courier_name, courier_service, payment_method, payment_status, order_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', 'pending')
      `,
      args: [
        invoiceNumber, user_id, shipping_name, shipping_phone, shipping_address,
        subtotal || 0, shipping_cost, discount_amount, total_amount || 0,
        courier_name, courier_service, payment_method
      ]
    });

    const orderId = Number(orderResult.lastInsertRowid);
    const batchStatements = [];

    for (const item of items) {
      batchStatements.push({
        sql: `
          INSERT INTO order_items (
            order_id, product_id, variant_id, product_name, variant_title, quantity, price_at_purchase
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          orderId, 
          item.id, 
          item.variant_id || null, 
          item.name, 
          item.variant_title || 'Default', 
          item.qty || 1, 
          item.price || 0
        ]
      });

      if (item.variant_id || item.id) {
        batchStatements.push({
          sql: `
            UPDATE product_variants 
            SET stock = stock - ? 
            WHERE (id = ? OR product_id = ?) AND stock >= ?
          `,
          args: [item.qty || 1, item.variant_id || 0, item.id, item.qty || 1]
        });
      }
    }

    if (batchStatements.length > 0) {
      await db.batch(batchStatements, 'write');
    }

    return res.status(201).json({
      message: 'Pesanan berhasil dibuat!',
      invoice_number: invoiceNumber,
      order_id: orderId
    });
  } catch (err) {
    console.error('[API ERROR] POST /api/orders:', err);
    return res.status(500).json({ error: 'Gagal memproses transaksi pesanan ke Turso' });
  }
});

// -------------------------------------------------------------
// 7. ADMIN API ENDPOINTS (DIPROTEKSI MIDDLEWARE)
// -------------------------------------------------------------

// GET /api/admin/stats
app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const totalSales = await db.execute(`SELECT SUM(total_amount) AS revenue FROM orders WHERE payment_status = 'paid' OR order_status = 'completed'`).catch(() => ({ rows: [{ revenue: 0 }] }));
    const totalOrders = await db.execute(`SELECT COUNT(*) AS count FROM orders`).catch(() => ({ rows: [{ count: 0 }] }));
    const totalProducts = await db.execute(`SELECT COUNT(*) AS count FROM products`).catch(() => ({ rows: [{ count: 0 }] }));
    const pendingOrders = await db.execute(`SELECT COUNT(*) AS count FROM orders WHERE order_status = 'pending'`).catch(() => ({ rows: [{ count: 0 }] }));

    return res.json({
      revenue: totalSales.rows[0]?.revenue || 0,
      orders: totalOrders.rows[0]?.count || 0,
      products: totalProducts.rows[0]?.count || 0,
      pending: pendingOrders.rows[0]?.count || 0,
    });
  } catch (err) {
    console.error('[API ERROR] GET /api/admin/stats:', err);
    return res.json({ revenue: 0, orders: 0, products: 0, pending: 0 });
  }
});

// GET /api/admin/orders
app.get('/api/admin/orders', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT id, invoice_number, shipping_name, total_amount, payment_status, order_status, created_at
      FROM orders
      ORDER BY id DESC
    `);
    return res.json(result.rows || []);
  } catch (err) {
    console.error('[API ERROR] GET /api/admin/orders:', err);
    return res.json([]);
  }
});

// GET /api/admin/products
app.get('/api/admin/products', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT 
        p.id, p.name, p.slug, p.description, p.category_id, p.image_url, p.status,
        c.name AS category_name,
        pv.id AS variant_id, pv.sku, pv.price, pv.stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_variants pv ON p.id = pv.product_id
      GROUP BY p.id
      ORDER BY p.id DESC
    `);
    return res.json(result.rows || []);
  } catch (err) {
    console.error('[API ERROR] GET /api/admin/products:', err);
    return res.json([]);
  }
});

// GET /api/admin/products/:id
app.get('/api/admin/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.execute({
      sql: `
        SELECT 
          p.id, p.name, p.slug, p.description, p.category_id, p.image_url, p.status,
          pv.id AS variant_id, pv.sku, pv.price, pv.stock
        FROM products p
        LEFT JOIN product_variants pv ON p.id = pv.product_id
        WHERE p.id = ?
        LIMIT 1
      `,
      args: [id]
    });

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Produk tidak ditemukan' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[API ERROR] GET /api/admin/products/:id:', err);
    return res.status(500).json({ error: 'Gagal mengambil detail produk' });
  }
});

// POST /api/admin/products
app.post('/api/admin/products', authenticateToken, requireAdmin, async (req, res) => {
  const { category_id, name, slug, description, image_url, price, stock, sku } = req.body || {};

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Nama produk wajib diisi' });
  }

  const finalSlug = slug && slug.trim() !== '' ? slug : generateSlug(name);
  const finalSku = sku && sku.trim() !== '' ? sku : `SKU-${Date.now()}`;
  const defaultImg = image_url && image_url.trim() !== '' 
    ? image_url 
    : 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500';

  try {
    const prodRes = await db.execute({
      sql: `INSERT INTO products (category_id, name, slug, description, image_url, status) VALUES (?, ?, ?, ?, ?, 'published')`,
      args: [category_id || 1, name.trim(), finalSlug, description || '', defaultImg]
    });
    const productId = Number(prodRes.lastInsertRowid);

    await db.execute({
      sql: `INSERT INTO product_variants (product_id, sku, title, price, stock, weight_grams) VALUES (?, ?, 'Default', ?, ?, 200)`,
      args: [productId, finalSku, price || 0, stock || 0]
    });

    return res.status(201).json({ message: 'Produk berhasil ditambahkan', productId });
  } catch (err) {
    console.error('[API ERROR] POST /api/admin/products:', err);
    return res.status(500).json({ error: 'Gagal menambahkan produk' });
  }
});

// PUT /api/admin/products/:id
app.put('/api/admin/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { category_id, name, slug, description, image_url, price, stock, sku } = req.body || {};

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Nama produk wajib diisi' });
  }

  const finalSlug = slug && slug.trim() !== '' ? slug : generateSlug(name);

  try {
    await db.execute({
      sql: `
        UPDATE products 
        SET category_id = ?, name = ?, slug = ?, description = ?, image_url = COALESCE(?, image_url), updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      args: [category_id || 1, name.trim(), finalSlug, description || '', image_url || null, id]
    });

    await db.execute({
      sql: `
        UPDATE product_variants 
        SET sku = COALESCE(?, sku), price = ?, stock = ?
        WHERE product_id = ?
      `,
      args: [sku || null, price || 0, stock || 0, id]
    });

    return res.json({ message: 'Produk berhasil diperbarui' });
  } catch (err) {
    console.error('[API ERROR] PUT /api/admin/products/:id:', err);
    return res.status(500).json({ error: 'Gagal memperbarui produk' });
  }
});

// DELETE /api/admin/products/:id
app.delete('/api/admin/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    await db.execute({
      sql: `DELETE FROM product_variants WHERE product_id = ?`,
      args: [id]
    });

    await db.execute({
      sql: `DELETE FROM products WHERE id = ?`,
      args: [id]
    });

    return res.json({ message: 'Produk berhasil dihapus' });
  } catch (err) {
    console.error('[API ERROR] DELETE /api/admin/products/:id:', err);
    return res.status(500).json({ error: 'Gagal menghapus produk' });
  }
});

// PATCH /api/admin/orders/:id
app.patch('/api/admin/orders/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { order_status, payment_status } = req.body || {};

  try {
    await db.execute({
      sql: `
        UPDATE orders 
        SET order_status = COALESCE(?, order_status), 
            payment_status = COALESCE(?, payment_status), 
            updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `,
      args: [order_status || null, payment_status || null, id]
    });
    return res.json({ message: 'Status pesanan berhasil diperbaharui' });
  } catch (err) {
    console.error('[API ERROR] PATCH /api/admin/orders/:id:', err);
    return res.status(500).json({ error: 'Gagal memperbaharui status pesanan' });
  }
});

// -------------------------------------------------------------
// 8. JALANKAN SERVER
// -------------------------------------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server API TokoKita terhubung ke Turso & berjalan di http://localhost:${PORT}`);
});