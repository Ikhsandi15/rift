const content = document.querySelector('#admin-content');
const authBar = document.querySelector('#admin-auth-bar');
const printArea = document.querySelector('#print-area');

let adminKey = sessionStorage.getItem('rift_admin_key') || '';
let currentTab = 'monitor'; // 'monitor' | 'issue'
let currentFilter = 'all'; // 'all' | 'claimed' | 'issued'
let searchQuery = '';
let cachedData = null;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function init() {
  if (!adminKey) {
    renderLogin();
  } else {
    loadDashboard();
  }
}

function renderLogin(error = '') {
  authBar.innerHTML = '';
  content.innerHTML = `
    <section class="panel claim-panel">
      <div class="eyebrow">INTERNAL ACCESS · SECURE AREA</div>
      <h1>Admin Command Center</h1>
      <p class="muted">Masukkan server ADMIN_KEY untuk memantau status kartu fisik, statistik pemain, atau menerbitkan batch baru.</p>
      ${error ? `<div class="error">${esc(error)}</div>` : ''}
      <form id="login-form" class="form">
        <div class="field">
          <label>Admin Key</label>
          <input name="key" type="password" placeholder="Masukkan ADMIN_KEY server" autocomplete="off" required>
        </div>
        <button class="button primary">Buka Dashboard Admin</button>
      </form>
    </section>
  `;

  document.querySelector('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const key = new FormData(e.target).get('key').trim();
    if (!key) return;
    adminKey = key;
    await loadDashboard();
  });
}

async function api(path, options = {}) {
  const r = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': adminKey,
      ...(options.headers || {})
    }
  });
  if (r.status === 404 || r.status === 401) {
    sessionStorage.removeItem('rift_admin_key');
    adminKey = '';
    renderLogin('Admin Key tidak valid atau salah.');
    throw new Error('Unauthorized');
  }
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Request gagal');
  return data;
}

async function loadDashboard() {
  content.innerHTML = `<div class="panel claim-panel" style="text-align:center"><p class="muted">Memuat data kartu & statistik pemain...</p></div>`;
  try {
    const data = await api('/api/admin/cards');
    cachedData = data;
    sessionStorage.setItem('rift_admin_key', adminKey);
    renderDashboard();
  } catch (err) {
    if (err.message !== 'Unauthorized') {
      content.innerHTML = `<div class="panel claim-panel"><div class="error">${esc(err.message)}</div><button class="button ghost" style="margin-top:12px" data-act="retry">Coba Lagi</button></div>`;
      document.querySelector('[data-act="retry"]')?.addEventListener('click', loadDashboard);
    }
  }
}

function renderDashboard() {
  const { stats, cards } = cachedData;
  const total = stats.total_cards || cards.length || 0;
  const claimed = stats.total_claimed || 0;
  const issued = stats.total_issued || 0;

  authBar.innerHTML = `
    <span class="muted" style="font-size:.8rem; display:inline-flex; align-items:center; gap:6px;">
      <span style="color:#45d4cd">●</span> Admin Aktif
    </span>
    <button class="button ghost small" id="btn-logout" style="margin-left:8px">Ganti Key</button>
  `;

  document.querySelector('#btn-logout')?.addEventListener('click', () => {
    sessionStorage.removeItem('rift_admin_key');
    adminKey = '';
    renderLogin();
  });

  // Filter cards
  let filtered = cards;
  if (currentFilter !== 'all') {
    filtered = filtered.filter(c => c.status === currentFilter);
  }
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(c =>
      c.id.toLowerCase().includes(q) ||
      c.publicToken.toLowerCase().includes(q) ||
      (c.ownerUsername && c.ownerUsername.toLowerCase().includes(q)) ||
      (c.avatar && c.avatar.name.toLowerCase().includes(q)) ||
      (c.avatar && c.avatar.role.toLowerCase().includes(q))
    );
  }

  content.innerHTML = `
    <div class="dashboard-head">
      <div>
        <div class="eyebrow">RIFTBOUND PHYSICAL AVATAR ENGINE</div>
        <h1>Command & Monitoring</h1>
        <p class="muted">Pantau status kartu beredar, keterkaitan akun pemain, dan progres karakter di dalam Rift.</p>
      </div>
      <button class="button ghost small" id="btn-refresh">↻ Refresh Data</button>
    </div>

    <!-- Summary Metrics -->
    <div class="admin-metrics">
      <div class="metric-box">
        <b>${total}</b>
        <small>Total Kartu Dicetak</small>
      </div>
      <div class="metric-box" style="border-color: rgba(69,212,205,.35);">
        <b style="color: #45d4cd;">${claimed}</b>
        <small>Terdaftar (Claimed) · ${total ? Math.round((claimed/total)*100) : 0}%</small>
      </div>
      <div class="metric-box" style="border-color: rgba(255,188,92,.35);">
        <b style="color: #ffbc5c;">${issued}</b>
        <small>Belum Terdaftar (Issued)</small>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="admin-tabs">
      <button class="tab-btn ${currentTab === 'monitor' ? 'active' : ''}" data-tab="monitor">📊 Daftar Kartu & Player (${filtered.length})</button>
      <button class="tab-btn ${currentTab === 'issue' ? 'active' : ''}" data-tab="issue">➕ Cetak Batch Baru (Issue)</button>
    </div>

    <!-- Tab Content -->
    ${currentTab === 'monitor' ? renderMonitorTab(filtered) : renderIssueTab()}
  `;

  bindEvents();
}

function renderMonitorTab(cards) {
  return `
    <div class="panel">
      <div class="admin-toolbar">
        <div class="admin-filters">
          <button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">Semua (${cachedData.cards.length})</button>
          <button class="filter-btn ${currentFilter === 'claimed' ? 'active' : ''}" data-filter="claimed">Terdaftar (${cachedData.stats.total_claimed || 0})</button>
          <button class="filter-btn ${currentFilter === 'issued' ? 'active' : ''}" data-filter="issued">Belum Diklaim (${cachedData.stats.total_issued || 0})</button>
        </div>
        <div style="min-width: 260px; max-width: 380px; width: 100%;">
          <input id="search-input" type="text" placeholder="Cari token, username, guardian..." value="${esc(searchQuery)}" style="padding: 8px 12px; font-size:.85rem;">
        </div>
      </div>

      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Token / URL Kartu</th>
              <th>Pemilik Akun</th>
              <th>Guardian / Avatar</th>
              <th>Statistik Karakter</th>
              <th>Waktu</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${cards.length === 0 ? `
              <tr>
                <td colspan="7" style="text-align:center; padding: 32px; color: var(--muted);">
                  Tidak ada kartu yang cocok dengan kriteria filter/pencarian.
                </td>
              </tr>
            ` : cards.map(c => `
              <tr>
                <td>
                  <span class="badge-status ${c.status}">
                    ${c.status === 'claimed' ? '✦ Terdaftar' : c.status === 'issued' ? '⏳ Belum Klaim' : 'Revoked'}
                  </span>
                </td>
                <td>
                  <span class="token-code" title="${esc(c.publicToken)}">${esc(c.publicToken.slice(0, 10))}…</span>
                </td>
                <td>
                  ${c.ownerUsername ? `
                    <div class="player-tag">
                      <b>@${esc(c.ownerUsername)}</b>
                    </div>
                  ` : `<span class="muted" style="font-size:.78rem;">- Belum di-bind -</span>`}
                </td>
                <td>
                  ${c.avatar ? `
                    <div class="player-tag">
                      <b>${esc(c.avatar.name)}</b>
                      <small>${esc(c.avatar.role)} · LV ${c.avatar.level}</small>
                    </div>
                  ` : `<span class="muted" style="font-size:.78rem;">-</span>`}
                </td>
                <td>
                  ${c.avatar ? `
                    <div style="font-size:.78rem; display:flex; gap:8px;">
                      <span>⚔️ <b>${c.avatar.wins}</b> wins</span>
                      <span>💰 <b>${c.avatar.gold}</b> gold</span>
                    </div>
                  ` : `<span class="muted" style="font-size:.78rem;">-</span>`}
                </td>
                <td>
                  <div style="font-size:.72rem; color:var(--muted); line-height:1.4;">
                    <div>Buat: ${new Date(c.createdAt).toLocaleDateString('id-ID')}</div>
                    ${c.claimedAt ? `<div style="color:#45d4cd;">Klaim: ${new Date(c.claimedAt).toLocaleDateString('id-ID')}</div>` : ''}
                  </div>
                </td>
                <td>
                  <div style="display:flex; gap:6px;">
                    <a class="button small ghost" href="${c.publicUrl}" target="_blank" rel="noopener" title="Buka URL Kartu">Buka ↗</a>
                    <a class="button small secondary" href="${c.publicUrl}/print" target="_blank" rel="noopener" title="Cetak Kartu Fisik">Print</a>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderIssueTab() {
  return `
    <section class="panel claim-panel" style="margin: 0 auto;">
      <div class="eyebrow">BATCH CARD ISSUANCE</div>
      <h2>Terbitkan Kartu Fisik Baru</h2>
      <p class="muted">Kartu yang diterbitkan akan menghasilkan URL pendaftaran bearer. Simpan URL dengan aman atau cetak QR ke kartu fisik sebelum diserahkan ke pemain.</p>
      <form id="issue-form" class="form">
        <div class="field">
          <label>Jumlah Kartu dalam Batch (1–50)</label>
          <input name="count" type="number" min="1" max="50" value="5" required>
        </div>
        <button class="button primary" id="btn-issue">⚡ Generate Batch Kartu</button>
      </form>
      <div id="issue-result"></div>
    </section>
  `;
}

function bindEvents() {
  document.querySelector('#btn-refresh')?.addEventListener('click', loadDashboard);

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      renderDashboard();
    });
  });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;
      renderDashboard();
    });
  });

  const searchInput = document.querySelector('#search-input');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      searchQuery = e.target.value;
      // Re-render monitor area without full dashboard reload for smooth typing
      const monitorContainer = document.querySelector('.table-wrap');
      if (monitorContainer) {
        let filtered = cachedData.cards;
        if (currentFilter !== 'all') filtered = filtered.filter(c => c.status === currentFilter);
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          filtered = filtered.filter(c =>
            c.id.toLowerCase().includes(q) ||
            c.publicToken.toLowerCase().includes(q) ||
            (c.ownerUsername && c.ownerUsername.toLowerCase().includes(q)) ||
            (c.avatar && c.avatar.name.toLowerCase().includes(q)) ||
            (c.avatar && c.avatar.role.toLowerCase().includes(q))
          );
        }
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = renderMonitorTab(filtered);
        const newTable = tempDiv.querySelector('.table-wrap');
        monitorContainer.replaceWith(newTable);
      }
    });
  }

  const issueForm = document.querySelector('#issue-form');
  if (issueForm) {
    issueForm.addEventListener('submit', async e => {
      e.preventDefault();
      const count = Number(new FormData(issueForm).get('count'));
      const btn = document.querySelector('#btn-issue');
      const result = document.querySelector('#issue-result');
      btn.disabled = true;
      btn.textContent = 'Membuat batch...';

      try {
        const d = await api('/api/admin/cards/issue', {
          method: 'POST',
          body: JSON.stringify({ count })
        });

        result.innerHTML = `
          <div class="tip" style="margin:18px 0">
            Batch berhasil dibuat (${d.cards.length} kartu).
          </div>
          <div class="table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Card ID</th>
                  <th>URL Pendaftaran</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                ${d.cards.map(c => `
                  <tr>
                    <td><code>${c.id.slice(0, 8)}</code></td>
                    <td><a href="${c.publicUrl}" target="_blank" rel="noopener">${c.publicUrl}</a></td>
                    <td><a class="button small secondary" href="${c.publicUrl}/print" target="_blank" rel="noopener">Print</a></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div class="actions" style="margin-top:14px; display:flex; gap:8px;">
            <button id="copy-csv" class="button ghost small">📋 Copy CSV URLs</button>
            <button id="print-batch" class="button primary small">🖨️ Print Semua Batch</button>
            <button id="back-to-monitor" class="button small secondary">Lihat di Tabel Monitoring</button>
          </div>
        `;

        document.querySelector('#copy-csv').addEventListener('click', () => {
          navigator.clipboard.writeText(['card_id,card_url', ...d.cards.map(c => `${c.id},${c.publicUrl}`)].join('\n'));
          alert('Semua URL berhasil di-copy ke clipboard!');
        });

        document.querySelector('#print-batch').addEventListener('click', () => {
          printArea.style.display = 'grid';
          printArea.innerHTML = d.cards.map(c => `
            <article class="issued-card">
              <div class="issued-head"><b>✦ RIFTBOUND</b><span>PHYSICAL AVATAR</span></div>
              <div class="issued-art">⟡</div>
              <h2>Guardian Card</h2>
              <p>Scan to register or view this avatar</p>
              <img src="/api/card/qr.png?token=${encodeURIComponent(c.publicToken)}" alt="Card QR">
              <code>${c.publicToken.slice(0, 8).toUpperCase()}</code>
              <small>Simpan kartu dengan aman sebelum registrasi</small>
            </article>
          `).join('');
          window.print();
          printArea.style.display = 'none';
        });

        document.querySelector('#back-to-monitor').addEventListener('click', () => {
          currentTab = 'monitor';
          loadDashboard();
        });

      } catch (err) {
        result.innerHTML = `<div class="error" style="margin-top:14px">${esc(err.message)}</div>`;
      } finally {
        btn.disabled = false;
        btn.textContent = '⚡ Generate Batch Kartu';
      }
    });
  }
}

init();
