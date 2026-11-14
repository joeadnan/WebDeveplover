// Konfigurasi URL Backend Express
const API_BASE_URL = 'http://localhost:5000/api';

// State Utama Aplikasi
const state = {
  products: [],
  cart: JSON.parse(localStorage.getItem('tokokita_cart')) || [],
  filterCategory: 'all',
  sortBy: 'default',
  token: localStorage.getItem('tokokita_token') || null,
  user: JSON.parse(localStorage.getItem('tokokita_user')) || null
};

// --- HELPER AUTHENTICATION ---

// Header Authorization untuk request API Admin
function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${state.token}`
  };
}

function logout() {
  localStorage.removeItem('tokokita_token');
  localStorage.removeItem('tokokita_user');
  state.token = null;
  state.user = null;
  alert('Anda telah logout.');
  updateNavAuth();
  window.location.hash = '#/login';
}

function updateNavAuth() {
  const navContainer = document.querySelector('.nav-links');
  if (!navContainer) return;

  // Hapus tombol auth lama jika ada
  const existingAuthBtn = document.getElementById('nav-auth-btn');
  if (existingAuthBtn) existingAuthBtn.remove();

  const authElement = document.createElement('div');
  authElement.id = 'nav-auth-btn';
  authElement.style.display = 'inline-block';

  if (state.token && state.user) {
    authElement.innerHTML = `
      <span style="font-size:0.85rem; margin-right:0.5rem; color: var(--text-muted, #64748b);">Halo, <strong>${state.user.name}</strong></span>
      <button onclick="logout()" class="btn btn-danger" style="padding:0.3rem 0.6rem; font-size:0.8rem;">Logout</button>
    `;
  } else {
    authElement.innerHTML = `
      <a href="#/login" class="nav-link">Login</a>
      <a href="#/register" class="nav-link" style="margin-left:0.5rem;">Daftar</a>
    `;
  }

  navContainer.appendChild(authElement);
}

// --- HALAMAN LOGIN ---
function renderLogin() {
  cleanupEventListeners();
  const app = document.getElementById('app-root');

  app.innerHTML = `
    <div class="cart-container" style="max-width: 400px; margin: 2rem auto;">
      <h2>Login Ke TokoKita</h2>
      <br>
      <form id="login-form">
        <div class="form-group" style="margin-bottom:1rem;">
          <label>Email</label>
          <input type="email" id="login-email" placeholder="admin@tokokita.com" required />
        </div>
        <div class="form-group" style="margin-bottom:1.5rem;">
          <label>Password</label>
          <input type="password" id="login-password" placeholder="******" required />
        </div>
        <button type="submit" class="btn" style="width:100%;">Masuk</button>
      </form>
      <br>
      <p style="font-size:0.9rem; text-align:center;">
        Belum punya akun? <a href="#/register">Daftar sekarang</a>
      </p>
    </div>
  `;

  addManagedEventListener(document.getElementById('login-form'), 'submit', async (e) => {
    e.preventDefault();
    const payload = {
      email: document.getElementById('login-email').value,
      password: document.getElementById('login-password').value
    };

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('tokokita_token', data.token);
        localStorage.setItem('tokokita_user', JSON.stringify(data.user));
        state.token = data.token;
        state.user = data.user;

        alert('Login berhasil!');
        updateNavAuth();

        if (data.user.role === 'admin') {
          window.location.hash = '#/admin';
        } else {
          window.location.hash = '#/';
        }
      } else {
        alert(data.error || 'Login gagal.');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan koneksi server.');
    }
  });
}

// --- HALAMAN REGISTER ---
function renderRegister() {
  cleanupEventListeners();
  const app = document.getElementById('app-root');

  app.innerHTML = `
    <div class="cart-container" style="max-width: 400px; margin: 2rem auto;">
      <h2>Daftar Akun Baru</h2>
      <br>
      <form id="register-form">
        <div class="form-group" style="margin-bottom:1rem;">
          <label>Nama Lengkap</label>
          <input type="text" id="reg-name" placeholder="Budi Santoso" required />
        </div>
        <div class="form-group" style="margin-bottom:1rem;">
          <label>Email</label>
          <input type="email" id="reg-email" placeholder="budi@example.com" required />
        </div>
        <div class="form-group" style="margin-bottom:1.5rem;">
          <label>Password</label>
          <input type="password" id="reg-password" placeholder="Minimal 6 karakter" required minlength="6" />
        </div>
        <button type="submit" class="btn" style="width:100%;">Daftar</button>
      </form>
      <br>
      <p style="font-size:0.9rem; text-align:center;">
        Sudah punya akun? <a href="#/login">Login di sini</a>
      </p>
    </div>
  `;

  addManagedEventListener(document.getElementById('register-form'), 'submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('reg-name').value,
      email: document.getElementById('reg-email').value,
      password: document.getElementById('reg-password').value
    };

    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        alert('Registrasi berhasil! Silakan login.');
        window.location.hash = '#/login';
      } else {
        alert(data.error || 'Registrasi gagal.');
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan koneksi server.');
    }
  });
}

// --- UTILS & HELPERS ---
function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount || 0);
}

function saveCart() {
  localStorage.setItem('tokokita_cart', JSON.stringify(state.cart));
  updateCartBadge();
}

function updateCartBadge() {
  const totalItems = state.cart.reduce((sum, item) => sum + item.qty, 0);
  const badge = document.getElementById('cart-count');
  if (badge) badge.textContent = totalItems;
}

// Event Listener Cleanup Manager (Cegah Memory Leak)
const activeEventListeners = [];
function addManagedEventListener(element, event, handler) {
  if (element) {
    element.addEventListener(event, handler);
    activeEventListeners.push({ element, event, handler });
  }
}
function cleanupEventListeners() {
  activeEventListeners.forEach(({ element, event, handler }) => {
    element.removeEventListener(event, handler);
  });
  activeEventListeners.length = 0;
}

// Fetch Produk dari Backend
async function fetchProducts() {
  try {
    const response = await fetch(`${API_BASE_URL}/products`);
   
    state.products = await response.json();
    if (window.location.hash === '#/' || window.location.hash === '') {
      renderCatalog();
    }
  } catch (error) {
    console.error('Error fetching products:', error);
  }
}

// --- 1. RENDER KATALOG PRODUK ---
function renderCatalog() {
  cleanupEventListeners();
  const app = document.getElementById('app-root');

  let filteredProducts = state.filterCategory === 'all'
    ? [...state.products]
    : state.products.filter(p => p.category === state.filterCategory);

  if (state.sortBy === 'low') {
    filteredProducts.sort((a, b) => a.price - b.price);
  } else if (state.sortBy === 'high') {
    filteredProducts.sort((a, b) => b.price - a.price);
  }

  app.innerHTML = `
    <div class="controls">
      <div class="filter-group">
        <label for="filter-select">Kategori:</label>
        <select id="filter-select">
          <option value="all" ${state.filterCategory === 'all' ? 'selected' : ''}>Semua Kategori</option>
          <option value="pakaian" ${state.filterCategory === 'pakaian' ? 'selected' : ''}>Pakaian</option>
          <option value="sepatu" ${state.filterCategory === 'sepatu' ? 'selected' : ''}>Sepatu</option>
          <option value="aksesoris" ${state.filterCategory === 'aksesoris' ? 'selected' : ''}>Aksesoris</option>
        </select>
      </div>
      <div class="sort-group">
        <label for="sort-select">Urutkan Harga:</label>
        <select id="sort-select">
          <option value="default" ${state.sortBy === 'default' ? 'selected' : ''}>Bawaan</option>
          <option value="low" ${state.sortBy === 'low' ? 'selected' : ''}>Terendah ke Tertinggi</option>
          <option value="high" ${state.sortBy === 'high' ? 'selected' : ''}>Tertinggi ke Terendah</option>
        </select>
      </div>
    </div>
    <div class="product-grid" id="product-grid"></div>
  `;

  const grid = document.getElementById('product-grid');

  if (filteredProducts.length === 0) {
    grid.innerHTML = `<div class="empty-state">Tidak ada produk ditemukan.</div>`;
  } else {
    const fragment = document.createDocumentFragment();
    filteredProducts.forEach(product => {
      const card = document.createElement('div');
      card.className = 'product-card';
      card.innerHTML = `
        <img src="${product.image}" alt="${product.name}" class="product-img" loading="lazy" />
        <div class="product-info">
          <span class="product-category">${product.category_name}</span>
          <h3 class="product-title">${product.name}</h3>
          <div class="product-price">${formatRupiah(product.price)}</div>
          <button class="btn add-cart-btn" data-id="${product.id}">+ Keranjang</button>
        </div>
      `;
      fragment.appendChild(card);
    });
    grid.appendChild(fragment);
  }

  addManagedEventListener(document.getElementById('filter-select'), 'change', (e) => {
    state.filterCategory = e.target.value;
    renderCatalog();
  });

  addManagedEventListener(document.getElementById('sort-select'), 'change', (e) => {
    state.sortBy = e.target.value;
    renderCatalog();
  });

  addManagedEventListener(grid, 'click', (e) => {
    const btn = e.target.closest('.add-cart-btn');
    if (btn) {
      const productId = parseInt(btn.dataset.id);
      addToCart(productId);
    }
  });
}

function addToCart(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  const existing = state.cart.find(item => item.id === productId);
  if (existing) {
    existing.qty += 1;
  } else {
    state.cart.push({ ...product, qty: 1 });
  }
  saveCart();
  alert('Produk berhasil ditambahkan ke keranjang!');
}

// --- 2. RENDER KERANJANG ---
function renderCart() {
  cleanupEventListeners();
  const app = document.getElementById('app-root');

  if (state.cart.length === 0) {
    app.innerHTML = `
      <div class="cart-container empty-state">
        <h2>Keranjang Belanja Anda Kosong</h2>
        <br>
        <a href="#/" class="btn">Lihat Katalog</a>
      </div>
    `;
    return;
  }

  const total = state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  app.innerHTML = `
    <div class="cart-container">
      <h2>Keranjang Belanja</h2>
      <br>
      <table class="cart-table">
        <thead>
          <tr>
            <th>Produk</th>
            <th>Harga</th>
            <th>Jumlah</th>
            <th>Subtotal</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody id="cart-rows"></tbody>
      </table>
      <div class="cart-summary">
        <div class="cart-total">Total: ${formatRupiah(total)}</div>
        <a href="#/checkout" class="btn">Lanjut ke Checkout</a>
      </div>
    </div>
  `;

  const tbody = document.getElementById('cart-rows');
  const fragment = document.createDocumentFragment();

  state.cart.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${item.name}</strong></td>
      <td>${formatRupiah(item.price)}</td>
      <td>
        <div class="qty-controls">
          <button class="qty-btn dec-btn" data-id="${item.id}">-</button>
          <span>${item.qty}</span>
          <button class="qty-btn inc-btn" data-id="${item.id}">+</button>
        </div>
      </td>
      <td>${formatRupiah(item.price * item.qty)}</td>
      <td>
        <button class="btn btn-danger del-btn" data-id="${item.id}" style="padding:0.3rem 0.6rem; font-size:0.8rem;">Hapus</button>
      </td>
    `;
    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);

  addManagedEventListener(tbody, 'click', (e) => {
    const id = parseInt(e.target.dataset.id);
    if (!id) return;

    if (e.target.classList.contains('inc-btn')) {
      const item = state.cart.find(i => i.id === id);
      if (item) item.qty += 1;
    } else if (e.target.classList.contains('dec-btn')) {
      const item = state.cart.find(i => i.id === id);
      if (item && item.qty > 1) {
        item.qty -= 1;
      } else {
        state.cart = state.cart.filter(i => i.id !== id);
      }
    } else if (e.target.classList.contains('del-btn')) {
      state.cart = state.cart.filter(i => i.id !== id);
    }

    saveCart();
    renderCart();
  });
}

// --- 3. RENDER CHECKOUT ---
function renderCheckout() {
  cleanupEventListeners();
  const app = document.getElementById('app-root');

  if (state.cart.length === 0) {
    window.location.hash = '#/';
    return;
  }

  app.innerHTML = `
    <form class="checkout-form" id="checkout-form" novalidate>
      <h2>Formulir Pengiriman</h2>
      <div class="form-group" id="group-name">
        <label for="name">Nama Lengkap Penerima</label>
        <input type="text" id="name" required placeholder="Budi Santoso">
        <span class="error-msg">Nama minimal 3 karakter.</span>
      </div>
      <div class="form-group" id="group-email">
        <label for="email">Alamat Email</label>
        <input type="email" id="email" required placeholder="budi@example.com">
        <span class="error-msg">Format email tidak valid.</span>
      </div>
      <div class="form-group" id="group-phone">
        <label for="phone">Nomor Telepon</label>
        <input type="tel" id="phone" required placeholder="08123456789">
        <span class="error-msg">Format telepon harus diawali 08 (10-13 digit).</span>
      </div>
      <div class="form-group" id="group-address">
        <label for="address">Alamat Lengkap</label>
        <textarea id="address" rows="3" required placeholder="Jl. Sudirman No. 123"></textarea>
        <span class="error-msg">Alamat minimal 10 karakter.</span>
      </div>
      <div class="form-group" id="group-zip">
        <label for="zip">Kode Pos</label>
        <input type="text" id="zip" required placeholder="12345">
        <span class="error-msg">Kode pos harus 5 digit angka.</span>
      </div>
      <button type="submit" id="submit-btn" class="btn" disabled>Bayar Sekarang</button>
    </form>
  `;

  const form = document.getElementById('checkout-form');
  const submitBtn = document.getElementById('submit-btn');

  const validators = {
    name: val => val.trim().length >= 3,
    email: val => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    phone: val => /^08[0-9]{8,11}$/.test(val),
    address: val => val.trim().length >= 10,
    zip: val => /^\d{5}$/.test(val)
  };

  function validateForm() {
    let isValid = true;
    Object.keys(validators).forEach(fieldId => {
      const input = document.getElementById(fieldId);
      const group = document.getElementById(`group-${fieldId}`);
      const valid = validators[fieldId](input.value);

      if (input.value.length > 0) {
        if (!valid) {
          group.classList.add('invalid');
          isValid = false;
        } else {
          group.classList.remove('invalid');
        }
      } else {
        group.classList.remove('invalid');
        isValid = false;
      }
    });

    submitBtn.disabled = !isValid;
    return isValid;
  }

  addManagedEventListener(form, 'input', validateForm);

  addManagedEventListener(form, 'submit', async (e) => {
    e.preventDefault();
    if (validateForm()) {
      const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
      
      const payload = {
        user_id: state.user ? state.user.id : null,
        shipping_name: document.getElementById('name').value,
        shipping_phone: document.getElementById('phone').value,
        shipping_address: `${document.getElementById('address').value}, Kode Pos: ${document.getElementById('zip').value}`,
        subtotal: subtotal,
        shipping_cost: 15000,
        discount_amount: 0,
        total_amount: subtotal + 15000,
        courier_name: 'JNE',
        courier_service: 'REG',
        payment_method: 'bank_transfer',
        items: state.cart
      };

      try {
        const response = await fetch(`${API_BASE_URL}/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (response.ok) {
          alert(`Transaksi Berhasil!\nNomor Invoice: ${data.invoice_number}`);
          state.cart = [];
          saveCart();
          window.location.hash = '#/';
        } else {
          alert('Gagal memproses pesanan.');
        }
      } catch (err) {
        console.error(err);
        alert('Terjadi kesalahan koneksi server.');
      }
    }
  });
}

// --- 4. RENDER DASHBOARD ADMIN (LENGKAP FITUR CRUD PRODUK & PESANAN) ---
async function renderAdmin() {
  // Proteksi Rute Frontend: Cek Login & Role Admin
  if (!state.token || !state.user || state.user.role !== 'admin') {
    alert('Akses ditolak! Anda harus login sebagai Admin.');
    window.location.hash = '#/login';
    return;
  }
  cleanupEventListeners();
  const app = document.getElementById('app-root');

  app.innerHTML = `<div class="empty-state">Memuat data Dashboard Admin...</div>`;

  try {
    const [statsRes, ordersRes, productsRes] = await Promise.all([
      fetch(`${API_BASE_URL}/admin/stats`, { headers: getAuthHeaders() }),
      fetch(`${API_BASE_URL}/admin/orders`, { headers: getAuthHeaders() }),
      fetch(`${API_BASE_URL}/admin/products`, { headers: getAuthHeaders() })
    ]);

    if (statsRes.status === 401 || statsRes.status === 403) {
      logout();
      return;
    }

    const stats = await statsRes.json();
    const orders = await ordersRes.json();
    const products = await productsRes.json();

    app.innerHTML = `
      <div class="cart-container">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1.5rem;">
          <h2>Dashboard Admin</h2>
          <button id="add-product-btn" class="btn" style="background:#16a34a;">+ Tambah Produk</button>
        </div>
        
        <!-- Ringkasan Statistik -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin: 1.5rem 0;">
          <div style="background:#f1f5f9; padding: 1rem; border-radius: var(--radius); text-align: center;">
            <span style="font-size:0.85rem; color: var(--text-muted);">Total Pendapatan</span>
            <h3 style="color: var(--primary-color); margin-top:0.3rem;">${formatRupiah(stats?.revenue || 0)}</h3>
          </div>
          <div style="background:#f1f5f9; padding: 1rem; border-radius: var(--radius); text-align: center;">
            <span style="font-size:0.85rem; color: var(--text-muted);">Total Pesanan</span>
            <h3 style="margin-top:0.3rem;">${stats?.orders || 0}</h3>
          </div>
          <div style="background:#f1f5f9; padding: 1rem; border-radius: var(--radius); text-align: center;">
            <span style="font-size:0.85rem; color: var(--text-muted);">Pesanan Pending</span>
            <h3 style="color: var(--danger-color); margin-top:0.3rem;">${stats?.pending || 0}</h3>
          </div>
          <div style="background:#f1f5f9; padding: 1rem; border-radius: var(--radius); text-align: center;">
            <span style="font-size:0.85rem; color: var(--text-muted);">Total Produk</span>
            <h3 style="margin-top:0.3rem;">${stats?.products || 0}</h3>
          </div>
        </div>

        <!-- Form Modal (CREATE & UPDATE Produk) -->
        <div id="product-modal" style="display:none; background:#f8fafc; padding:1.5rem; border-radius:var(--radius); border:1px solid var(--border-color); margin-bottom:2rem;">
          <h3 id="form-title">Tambah Produk Baru</h3>
          <form id="product-form" style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-top:1rem;">
            <input type="hidden" id="prod-id" value="" />
            <div class="form-group">
              <label>Nama Produk</label>
              <input type="text" id="prod-name" placeholder="Nama Produk" required />
            </div>
            <div class="form-group">
              <label>Slug URL</label>
              <input type="text" id="prod-slug" placeholder="slug-produk" />
            </div>
            <div class="form-group">
              <label>Harga (Rp)</label>
              <input type="number" id="prod-price" placeholder="45000" required />
            </div>
            <div class="form-group">
              <label>Stok Varian</label>
              <input type="number" id="prod-stock" placeholder="10" required />
            </div>
            <div class="form-group">
              <label>SKU</label>
              <input type="text" id="prod-sku" placeholder="SKU-001" required />
            </div>
            <div class="form-group">
              <label>Kategori</label>
              <select id="prod-category">
                <option value="1">Pakaian</option>
                <option value="2">Sepatu</option>
                <option value="3">Aksesoris</option>
              </select>
            </div>
            
            <div class="form-group" style="grid-column: span 2;">
              <label>URL Gambar Produk</label>
              <input type="url" id="prod-image" placeholder="https://images.unsplash.com/photo-..." />
            </div>

            <div class="form-group" style="grid-column: span 2;">
              <label>Deskripsi</label>
              <textarea id="prod-desc" placeholder="Deskripsi ringkas..." rows="2"></textarea>
            </div>
            <div style="grid-column: span 2; display:flex; gap:0.5rem; justify-content:flex-end;">
              <button type="button" id="cancel-form-btn" class="btn" style="background:#64748b;">Batal</button>
              <button type="submit" class="btn">Simpan Data</button>
            </div>
          </form>
        </div>

        <!-- Tabel CRUD Produk -->
        <h3 style="margin-bottom: 1rem;">Manajemen Katalog Produk (CRUD)</h3>
        <table class="cart-table" style="margin-bottom: 2.5rem;">
          <thead>
            <tr>
              <th>ID</th><th>Nama Produk</th><th>Kategori</th><th>Harga</th><th>Stok</th><th>SKU</th><th>Aksi</th>
            </tr>
          </thead>
          <tbody id="admin-products-body"></tbody>
        </table>

        <!-- Tabel Pesanan Masuk -->
        <h3 style="margin-bottom: 1rem;">Manajemen Pesanan Masuk</h3>
        <table class="cart-table">
          <thead>
            <tr>
              <th>Invoice</th><th>Penerima</th><th>Total</th><th>Pembayaran</th><th>Status Order</th><th>Aksi</th>
            </tr>
          </thead>
          <tbody id="admin-orders-body"></tbody>
        </table>
      </div>
    `;

    // Render Tabel Produk
    const prodTbody = document.getElementById('admin-products-body');
    if (!products || products.length === 0) {
      prodTbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Belum ada produk di database.</td></tr>`;
    } else {
      const prodFragment = document.createDocumentFragment();
      products.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${p.id}</td>
          <td><strong>${p.name}</strong></td>
          <td>${p.category_name || 'Umum'}</td>
          <td>${formatRupiah(p.price)}</td>
          <td>${p.stock || 0}</td>
          <td><code>${p.sku || '-'}</code></td>
          <td>
            <button class="btn edit-prod-btn" data-id="${p.id}" style="padding:0.2rem 0.5rem; font-size:0.75rem; background:#f59e0b;">Edit</button>
            <button class="btn del-prod-btn" data-id="${p.id}" style="padding:0.2rem 0.5rem; font-size:0.75rem; background:#ef4444;">Hapus</button>
          </td>
        `;
        prodFragment.appendChild(tr);
      });
      prodTbody.appendChild(prodFragment);
    }

    // Render Tabel Orders
    const tbody = document.getElementById('admin-orders-body');
    if (!orders || orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Belum ada pesanan masuk.</td></tr>`;
    } else {
      const fragment = document.createDocumentFragment();
      orders.forEach(order => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${order.invoice_number}</strong></td>
          <td>${order.shipping_name}</td>
          <td>${formatRupiah(order.total_amount)}</td>
          <td>
            <span style="padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem; background: ${order.payment_status === 'paid' ? '#dcfce7' : '#fee2e2'}; color: ${order.payment_status === 'paid' ? '#15803d' : '#b91c1c'};">
              ${order.payment_status}
            </span>
          </td>
          <td>
            <select class="status-select" data-id="${order.id}">
              <option value="pending" ${order.order_status === 'pending' ? 'selected' : ''}>Pending</option>
              <option value="processing" ${order.order_status === 'processing' ? 'selected' : ''}>Diproses</option>
              <option value="shipped" ${order.order_status === 'shipped' ? 'selected' : ''}>Dikirim</option>
              <option value="completed" ${order.order_status === 'completed' ? 'selected' : ''}>Selesai</option>
              <option value="cancelled" ${order.order_status === 'cancelled' ? 'selected' : ''}>Batal</option>
            </select>
          </td>
          <td>
            <button class="btn update-order-btn" data-id="${order.id}" style="padding:0.3rem 0.6rem; font-size:0.8rem;">Simpan</button>
          </td>
        `;
        fragment.appendChild(tr);
      });
      tbody.appendChild(fragment);
    }

    // Registrasi Event Listeners Admin
    const modal = document.getElementById('product-modal');
    const prodForm = document.getElementById('product-form');

    addManagedEventListener(document.getElementById('add-product-btn'), 'click', () => {
      document.getElementById('form-title').textContent = 'Tambah Produk Baru';
      document.getElementById('prod-id').value = '';
      document.getElementById('prod-image').value = '';
      prodForm.reset();
      modal.style.display = 'block';
    });

    addManagedEventListener(document.getElementById('cancel-form-btn'), 'click', () => {
      modal.style.display = 'none';
      prodForm.reset();
    });

    addManagedEventListener(prodTbody, 'click', async (e) => {
      const id = e.target.dataset.id;
      if (!id) return;

      if (e.target.classList.contains('edit-prod-btn')) {
        try {
          const res = await fetch(`${API_BASE_URL}/admin/products/${id}`, { headers: getAuthHeaders() });
          const data = await res.json();

          document.getElementById('form-title').textContent = `Edit Produk #${data.id}`;
          document.getElementById('prod-id').value = data.id;
          document.getElementById('prod-name').value = data.name || '';
          document.getElementById('prod-slug').value = data.slug || '';
          document.getElementById('prod-price').value = data.price || 0;
          document.getElementById('prod-stock').value = data.stock || 0;
          document.getElementById('prod-sku').value = data.sku || '';
          document.getElementById('prod-category').value = data.category_id || 1;
          document.getElementById('prod-image').value = data.image_url || '';
          document.getElementById('prod-desc').value = data.description || '';

          modal.style.display = 'block';
          window.scrollTo({ top: modal.offsetTop - 80, behavior: 'smooth' });
        } catch (err) {
          console.error(err);
          alert('Gagal mengambil detail produk.');
        }
      }

      if (e.target.classList.contains('del-prod-btn')) {
        if (confirm(`Apakah Anda yakin ingin menghapus produk ID #${id}?`)) {
          try {
            const res = await fetch(`${API_BASE_URL}/admin/products/${id}`, { 
              method: 'DELETE',
              headers: getAuthHeaders() 
            });
            if (res.ok) {
              alert('Produk berhasil dihapus!');
              fetchProducts();
              renderAdmin();
            }
          } catch (err) {
            console.error(err);
            alert('Gagal menghapus produk.');
          }
        }
      }
    });

    addManagedEventListener(prodForm, 'submit', async (e) => {
      e.preventDefault();
      const prodId = document.getElementById('prod-id').value;
      const isEdit = Boolean(prodId);

      const payload = {
        category_id: parseInt(document.getElementById('prod-category').value),
        name: document.getElementById('prod-name').value,
        slug: document.getElementById('prod-slug').value,
        price: parseInt(document.getElementById('prod-price').value),
        stock: parseInt(document.getElementById('prod-stock').value),
        sku: document.getElementById('prod-sku').value,
        image_url: document.getElementById('prod-image').value,
        description: document.getElementById('prod-desc').value
      };

      const url = isEdit ? `${API_BASE_URL}/admin/products/${prodId}` : `${API_BASE_URL}/admin/products`;
      const method = isEdit ? 'PUT' : 'POST';

      try {
        const res = await fetch(url, {
          method: method,
          headers: getAuthHeaders(),
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          alert(`Produk berhasil ${isEdit ? 'diperbarui' : 'ditambahkan'}!`);
          modal.style.display = 'none';
          prodForm.reset();
          fetchProducts();
          renderAdmin();
        } else {
          const errData = await res.json();
          alert(errData.error || 'Gagal menyimpan produk.');
        }
      } catch (err) {
        console.error(err);
        alert('Gagal menyimpan produk.');
      }
    });

    addManagedEventListener(tbody, 'click', async (e) => {
      if (e.target.classList.contains('update-order-btn')) {
        const orderId = e.target.dataset.id;
        const select = tbody.querySelector(`select[data-id="${orderId}"]`);
        const newStatus = select.value;

        try {
          const res = await fetch(`${API_BASE_URL}/admin/orders/${orderId}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ 
              order_status: newStatus,
              payment_status: newStatus === 'completed' ? 'paid' : undefined 
            })
          });

          if (res.ok) {
            alert('Status pesanan berhasil diperbarui!');
            renderAdmin(); 
          }
        } catch (err) {
          console.error(err);
          alert('Gagal mengupdate status pesanan.');
        }
      }
    });

  } catch (error) {
    console.error('Error loading admin page:', error);
    app.innerHTML = `<div class="empty-state">Gagal memuat Dashboard Admin.</div>`;
  }
}

// --- ROUTER & INITIALIZATION ---
function router() {
  const hash = window.location.hash || '#/';

  if (hash === '#/' || hash === '') {
    renderCatalog();
  } else if (hash === '#/cart') {
    renderCart();
  } else if (hash === '#/checkout') {
    renderCheckout();
  } else if (hash === '#/admin') {
    renderAdmin();
  } else if (hash === '#/login') {
    renderLogin();
  } else if (hash === '#/register') {
    renderRegister();
  } else {
    document.getElementById('app-root').innerHTML = `
      <div class="empty-state">
        <h2>404 - Halaman Tidak Ditemukan</h2>
        <br>
        <a href="#/" class="btn">Kembali ke Katalog</a>
      </div>
    `;
  }
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();
  updateNavAuth();
  fetchProducts();
  router();
});