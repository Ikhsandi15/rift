const app = document.querySelector('#app');
const sessionActions = document.querySelector('#session-actions');
const toast = document.querySelector('#toast');

let state = { user: null, avatars: [], roles: [], quests: [], cards: [], events: [] };
let authMode = 'login';
let selected = null;
let cardToken = location.pathname.match(/^\/card\/([^/]+)/)?.[1] || new URLSearchParams(location.search).get('card') || '';
let cardState = null;
let currentEncounter = null;
let gameLoaded = false;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(path, options = {}) {
  const r = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const t = await r.text();
  let d = {};
  try { d = t ? JSON.parse(t) : {}; } catch { d = { error: t }; }
  if (!r.ok) throw Error(d.error || 'Request gagal.');
  return d;
}

function notify(m) {
  toast.textContent = m;
  toast.classList.add('show');
  clearTimeout(notify.t);
  notify.t = setTimeout(() => toast.classList.remove('show'), 3500);
}

// Lazy load game bundle (Phaser + game engine) only when combat starts
async function ensureGameLoaded() {
  if (gameLoaded && window.RiftboundGame) return;
  const loadScript = src => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.body.appendChild(s);
  });
  await loadScript('/vendor/phaser.js');
  await loadScript('/game.js');
  gameLoaded = true;
}

function avatarCard(a) {
  const pct = Math.min(100, Math.round(a.xp / a.nextLevelXp * 100));
  const isClaimTarget = cardToken && cardState?.state === 'unclaimed' && !a.card;

  return `
    <article class="avatar-card ${isClaimTarget ? 'claim-highlight' : ''}" style="--accent:${a.color}">
      <div class="avatar-card__top">
        <span>${a.icon} ${esc(a.roleName)}</span>
        <span class="pill">LV ${a.level}</span>
      </div>
      <div class="avatar-art">${a.icon}</div>
      <h3>${esc(a.name)}</h3>
      <p class="muted">${esc(a.archetype)}</p>
      <p class="lore">${esc(a.lore)}</p>
      <div class="stat-row">
        <div class="stat"><b>${a.attack}</b><small>ATK</small></div>
        <div class="stat"><b>${a.defense}</b><small>DEF</small></div>
        <div class="stat"><b>${a.gold}</b><small>GOLD</small></div>
        <div class="stat"><b>${a.wins}</b><small>WINS</small></div>
      </div>
      <div class="progress"><span style="width:${pct}%"></span></div>
      <p class="tiny">${a.xp}/${a.nextLevelXp} XP · HP ${a.hp}/${a.maxHp} · Stamina ${a.stamina}/${a.maxStamina}</p>
      
      <div class="card-tools">
        ${a.card ? `
          <a class="button small secondary" href="${a.card.publicUrl}" target="_blank" rel="noopener">Kartu Publik ↗</a>
          <a class="button small ghost" href="${a.card.publicUrl}/print" target="_blank" rel="noopener">Print QR</a>
        ` : (cardToken && cardState?.state === 'unclaimed' ? `
          <button class="button small primary" data-act="claim" data-id="${a.id}">⚡ Hubungkan Kartu Ini</button>
        ` : '')}
        <button class="button small ${a.card ? 'primary' : 'ghost'}" data-act="play" data-id="${a.id}">⚔️ Enter Rift</button>
      </div>
    </article>
  `;
}

function renderAuth(error = '') {
  sessionActions.innerHTML = '';
  const token = cardToken;
  const cardGate = token ? `
    <div class="tip" style="margin-bottom:16px;">
      <b>✦ Kartu Fisik Terdeteksi!</b><br>
      Login atau buat akun baru, pilih karakter Guardian kamu, lalu hubungkan ke kartu fisik ini.
    </div>
  ` : '';

  app.innerHTML = `
    <section class="auth-wrap">
      <div class="hero">
        <div class="eyebrow">RIFTBOUND · PHYSICAL AVATAR RPG</div>
        <h1>Close the Rift.<br><span>Keep the story.</span></h1>
        <p>Enam penjaga. Satu dunia retak. Kartu fisik menyimpan identitas avatarmu, sementara petualangan dan progresnya hidup di server.</p>
        <div class="lore-panel">
          <b>AFTER THE FIRST BELL</b>
          <p>Saat lonceng Khar berbunyi dua kali, dunia membuka jahitan yang tak pernah terlihat. Para penjaga datang dari tempat berbeda—masing-masing mendengar panggilan yang berbeda.</p>
        </div>
        <div class="role-mini">
          ${state.roles.map(r => `<span title="${esc(r.archetype)}">${r.icon} ${esc(r.name)}</span>`).join('')}
        </div>
      </div>
      <div class="panel auth-panel">
        <div class="eyebrow">${token ? 'PENDAFTARAN KARTU FISIK' : authMode === 'login' ? 'AKSES PEMAIN' : 'BERGABUNG DENGAN WARDEN'}</div>
        <h2>${token ? 'Hubungkan Kartu ke Akun' : authMode === 'login' ? 'Masuk ke Riftbound' : 'Buat Akun Baru'}</h2>
        <p class="muted">${token ? 'Satu kartu · daftar sekali · URL langsung menampilkan avatarmu' : 'Beta · roster original · progres tersimpan aman'}</p>
        ${cardGate}
        ${error ? `<div class="error">${esc(error)}</div>` : ''}
        <form class="form" id="auth-form">
          <div class="field">
            <label>Username</label>
            <input name="username" placeholder="huruf kecil, angka, underscore" minlength="3" maxlength="18" required autocomplete="username">
          </div>
          <div class="field">
            <label>Password</label>
            <input type="password" name="password" placeholder="minimal 10 karakter" minlength="10" required autocomplete="current-password">
          </div>
          <button class="button primary" id="auth-submit-btn">${authMode === 'login' ? 'Masuk' : 'Daftar Sekarang'}</button>
        </form>
        <div class="switch">
          ${authMode === 'login' ? 'Belum punya akun?' : 'Sudah terdaftar?'}
          <button data-act="toggle">${authMode === 'login' ? 'Buat Akun' : 'Login'}</button>
        </div>
      </div>
    </section>
  `;
}

function renderDashboard() {
  if (cardToken && cardState?.state === 'claimed-locked') {
    sessionActions.innerHTML = `<button class="button ghost small" data-act="logout">Keluar</button>`;
    app.innerHTML = `
      <section class="panel claim-panel">
        <div class="eyebrow">KARTU SUDAH TERDAFTAR</div>
        <h1>Kartu ini milik akun lain</h1>
        <p class="muted">Silakan keluar dan masuk menggunakan akun yang mendaftarkan kartu ini. URL kepemilikan kartu terlindungi dan tidak bisa diambil alih oleh orang lain.</p>
        <button class="button primary" data-act="logout">Logout</button>
      </section>
    `;
    return;
  }

  if (cardToken && cardState?.state === 'unclaimed') {
    sessionActions.innerHTML = `<span class="muted">@${esc(state.user.username)}</span> <button class="button ghost small" data-act="logout">Keluar</button>`;
    const unboundAvatars = state.avatars.filter(a => !a.card);
    app.innerHTML = `
      <div class="dashboard-head">
        <div>
          <div class="eyebrow">REGISTRASI KARTU FISIK</div>
          <h1>Pilih Guardian Kamu</h1>
          <p class="muted">Pilih satu avatar di bawah ini untuk ditautkan secara permanen ke kartu fisik yang sedang kamu scan.</p>
        </div>
        <button class="button ghost" data-act="new-avatar">+ Awaken Guardian Baru</button>
      </div>
      <div class="grid cards">
        ${unboundAvatars.map(avatarCard).join('') || `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <h3>Belum ada Guardian yang tersedia</h3>
            <p class="muted">Semua karaktermu sudah memiliki kartu atau kamu belum membuat karakter.</p>
            <button class="button primary" style="margin-top:14px" data-act="new-avatar">+ Bangunkan Guardian Baru</button>
          </div>
        `}
      </div>
      <p class="tiny" style="margin-top:20px; text-align:center;">
        URL registrasi kartu ini hanya bisa diklaim sekali. Begitu terhubung, kartu langsung terkunci ke akun kamu.
      </p>
    `;
    return;
  }

  sessionActions.innerHTML = `<span class="muted">@${esc(state.user.username)}</span> <button class="button ghost small" data-act="logout">Keluar</button>`;
  app.innerHTML = `
    <div class="dashboard-head">
      <div>
        <div class="eyebrow">THE WARDEN ARCHIVE</div>
        <h1>Selamat Datang, ${esc(state.user.username)}.</h1>
        <p class="muted">Pilih jalanmu, tuntaskan encounter di dalam Rift, dan perkuat karaktermu.</p>
      </div>
      <button class="button primary" data-act="new-avatar">+ Awaken Guardian</button>
    </div>
    <section class="grid two">
      <div>
        <div class="section-title">
          <h2>Daftar Guardian Kamu</h2>
          <span class="pill">${state.avatars.length} / 6</span>
        </div>
        <div class="grid cards">
          ${state.avatars.map(avatarCard).join('') || '<div class="empty-state">Belum ada Guardian. Bangunkan karakter pertamamu!</div>'}
        </div>
      </div>
      <aside class="grid" style="align-content:start">
        <div class="panel">
          <div class="section-title" style="margin:0 0 12px">
            <h2>Chronicle</h2>
            <span class="tiny">aktivitas terbaru</span>
          </div>
          <div class="events">
            ${state.events.map(e => `
              <div class="event">
                <div class="event-icon">${e.type.includes('battle') || e.type.includes('encounter') ? '⚔️' : e.type === 'card_claim' ? '▣' : '✦'}</div>
                <div>
                  <b>${esc(e.message)}</b>
                  <small>${new Date(e.createdAt).toLocaleString('id-ID')}</small>
                </div>
              </div>
            `).join('') || '<div class="empty-state">Perjalananmu dimulai di sini.</div>'}
          </div>
        </div>
        <div class="panel">
          <div class="eyebrow">PANDUAN KARTU FISIK</div>
          <h2>Six paths. One fracture.</h2>
          <p class="muted" style="line-height:1.7;">
            ${state.roles.map(r => `${r.icon} <b>${esc(r.name)}</b> — ${esc(r.archetype)}`).join('<br>')}
          </p>
          <div class="tip" style="margin-top:14px;">
            Setiap kartu fisik memiliki NFC/QR unik. Hubungkan kartu ke karakter untuk mengaktifkan akses pertarungan Rift!
          </div>
        </div>
      </aside>
    </section>
    ${selected ? gameMarkup() : ''}
  `;

  if (selected) beginEncounter();
}

function gameMarkup() {
  const a = state.avatars.find(x => x.id === selected);
  return `
    <section class="section-title" style="margin-top:36px;">
      <div>
        <h2>Rift Encounter · ${esc(a.name)}</h2>
        <p class="tiny">WASD / Panah untuk bergerak · Spasi untuk menyerang · E untuk skill</p>
      </div>
      <button class="button ghost small" data-act="close-game">✕ Tinggalkan Arena</button>
    </section>
    <section class="arena">
      <div id="game-root"></div>
      <div class="arena-toolbar">
        <div>
          <b id="combat-status">Menyiapkan arena Rift...</b>
          <div class="tiny">${esc(a.roleName)} · ${esc(a.skill)}</div>
        </div>
        <div class="arena-actions">
          <button class="button small ghost" data-combat="dodge">Dodge (Hindar)</button>
          <button class="button small secondary" data-combat="attack">Attack (Serang)</button>
          <button class="button small primary" data-combat="skill">Skill Role</button>
          <button class="button small ghost" data-game="rest">Camp / Recharge</button>
        </div>
      </div>
    </section>
    <div class="grid two" style="margin-top:16px">
      <div class="panel">
        <div class="eyebrow">QUEST AKTIF</div>
        <h2>${esc(state.quests[0].title)}</h2>
        <p class="muted">${esc(state.quests[0].objective)} · Reward: ${state.quests[0].reward.xp} XP / ${state.quests[0].reward.gold} Gold</p>
      </div>
      <div class="panel">
        <div class="eyebrow">LOADOUT SKILL</div>
        <h2>${esc(a.skill)}</h2>
        <p class="muted">${esc(a.skillText)}</p>
        <p class="tiny">Passive: ${esc(a.passive)}</p>
      </div>
    </div>
  `;
}

function modal(content) {
  document.querySelector('#modal')?.remove();
  app.insertAdjacentHTML('beforeend', `
    <div class="modal-backdrop" id="modal">
      <div class="panel modal">
        <button class="modal-close" data-act="close-modal">×</button>
        ${content}
      </div>
    </div>
  `);
}

function avatarModal() {
  modal(`
    <div class="eyebrow">PILIH JALANMU</div>
    <h2>Bangunkan Guardian Baru</h2>
    <p class="muted">Role menentukan skill dan gaya tempur karaktermu di Rift.</p>
    <form id="avatar-form" class="form">
      <div class="field">
        <label>Nama Guardian</label>
        <input name="name" minlength="2" maxlength="24" placeholder="Contoh: Ash of Khar" required autofocus>
      </div>
      <div class="role-grid">
        ${state.roles.map((r, i) => `
          <label class="role-option" style="--accent:${r.color}">
            <input type="radio" name="role" value="${r.id}" ${i === 0 ? 'checked' : ''}>
            <span class="role-icon">${r.icon}</span>
            <b>${esc(r.name)}</b>
            <small>${esc(r.archetype)}</small>
            <em>${esc(r.skill)}</em>
            <p>${esc(r.lore)}</p>
          </label>
        `).join('')}
      </div>
      <button class="button primary" id="avatar-submit-btn">⚡ Bangunkan Karakter</button>
    </form>
  `);
}

async function refresh() {
  const d = await api('/api/me');
  state = { ...state, ...d.data };
  renderDashboard();
}

async function registerCardFor(avatarId, btn) {
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Menghubungkan kartu...';
  }

  try {
    const claimRes = await api('/api/cards/claim', {
      method: 'POST',
      body: JSON.stringify({ publicToken: cardToken, avatarId })
    });

    const targetAvatar = state.avatars.find(a => a.id === avatarId);
    const token = cardToken;
    cardToken = '';
    cardState = null;
    history.replaceState({}, '', '/');

    // Instant update
    await refresh();

    modal(`
      <div style="text-align:center; padding: 12px 6px;">
        <div style="font-size:3.5rem; margin-bottom:12px;">🎉</div>
        <div class="eyebrow" style="color:#45d4cd;">BERHASIL TERHUBUNG</div>
        <h2>Kartu Fisik Berhasil Didaftarkan!</h2>
        <p class="muted" style="margin: 12px 0 20px;">
          Guardian <b>${esc(targetAvatar?.name || 'Karaktermu')}</b> sekarang resmi terikat ke kartu ini. Scan QR kartu ini kapan saja untuk membuka profil publik atau bermain!
        </p>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <a class="button primary" href="/card/${encodeURIComponent(token)}" target="_blank" rel="noopener">
            🔍 Lihat Halaman Publik Kartu ↗
          </a>
          <button class="button ghost" data-act="close-modal">
            ⚔️ Lanjut Main di Dashboard
          </button>
        </div>
      </div>
    `);

    notify('Kartu fisik berhasil terhubung!');
  } catch (e) {
    notify(e.message);
    if (btn) {
      btn.disabled = false;
      btn.textContent = '⚡ Hubungkan Kartu Ini';
    }
  }
}

async function beginEncounter() {
  try {
    const status = document.querySelector('#combat-status');
    if (status) status.textContent = 'Menyiapkan arena pertempuran...';
    await ensureGameLoaded();

    const d = await api('/api/game/encounter/start', {
      method: 'POST',
      body: JSON.stringify({ avatarId: selected })
    });
    currentEncounter = d.encounter;
    window.RiftboundGame?.mount(state.avatars.find(a => a.id === selected), d.encounter);
  } catch (e) {
    notify(e.message);
  }
}

async function combatAction(action) {
  if (!currentEncounter) {
    await beginEncounter();
    return;
  }
  try {
    const d = await api('/api/game/encounter/act', {
      method: 'POST',
      body: JSON.stringify({ encounterId: currentEncounter.id, action })
    });
    currentEncounter = d.encounter;
    const status = document.querySelector('#combat-status');
    if (status) status.textContent = d.message;
    window.RiftboundGame?.sync(d);
    if (d.rewards) {
      await refresh();
      notify(d.message);
    }
  } catch (e) {
    notify(e.message);
  }
}

window.addEventListener('rift-combat', e => combatAction(e.detail));

document.addEventListener('submit', async e => {
  if (e.target.id === 'auth-form') {
    e.preventDefault();
    const btn = document.querySelector('#auth-submit-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Memproses...';
    }
    const f = new FormData(e.target);
    try {
      await api(`/api/auth/${authMode}`, {
        method: 'POST',
        body: JSON.stringify({ username: f.get('username'), password: f.get('password') })
      });
      await load();
      notify('Selamat datang di Riftbound.');
    } catch (x) {
      renderAuth(x.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = authMode === 'login' ? 'Masuk' : 'Daftar Sekarang';
      }
    }
  }

  if (e.target.id === 'avatar-form') {
    e.preventDefault();
    const btn = document.querySelector('#avatar-submit-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Membangunkan...';
    }
    const f = new FormData(e.target);
    try {
      await api('/api/avatars', {
        method: 'POST',
        body: JSON.stringify({ name: f.get('name'), role: f.get('role') })
      });
      document.querySelector('#modal')?.remove();
      await refresh();
      notify('Guardian berhasil dibangunkan!');
    } catch (x) {
      notify(x.message);
      if (btn) {
        btn.disabled = false;
        btn.textContent = '⚡ Bangunkan Karakter';
      }
    }
  }
});

document.addEventListener('click', async e => {
  const btn = e.target.closest('[data-act],[data-game],[data-combat]');
  if (!btn) return;

  try {
    const act = btn.dataset.act;
    if (act === 'toggle') {
      authMode = authMode === 'login' ? 'register' : 'login';
      renderAuth();
    }
    if (act === 'logout') {
      await api('/api/auth/logout', { method: 'POST' });
      state = { user: null, avatars: [], roles: [] };
      renderAuth();
    }
    if (act === 'new-avatar') avatarModal();
    if (act === 'close-modal') document.querySelector('#modal')?.remove();
    if (act === 'claim') {
      await registerCardFor(btn.dataset.id, btn);
    }
    if (act === 'play') {
      selected = btn.dataset.id;
      renderDashboard();
    }
    if (act === 'close-game') {
      selected = null;
      currentEncounter = null;
      renderDashboard();
    }
    if (btn.dataset.game === 'rest') {
      const d = await api('/api/game/action', {
        method: 'POST',
        body: JSON.stringify({ avatarId: selected, action: 'rest', idempotencyKey: crypto.randomUUID() })
      });
      await refresh();
      notify(d.message);
    }
    if (btn.dataset.combat) await combatAction(btn.dataset.combat);
  } catch (x) {
    notify(x.message);
  }
});

async function load() {
  try {
    const [me, content] = await Promise.all([api('/api/me'), api('/api/content')]);
    state.roles = content.roles;
    state.quests = content.quests;
    state.items = content.items;

    if (cardToken) {
      try {
        cardState = await api(`/api/card/state?token=${encodeURIComponent(cardToken)}`);
      } catch {
        cardState = null;
      }
    }

    if (!me.user) {
      renderAuth();
    } else {
      state = { ...state, ...content, ...me.data };
      if (cardToken && cardState?.state === 'claimed') {
        history.replaceState({}, '', `/card/${encodeURIComponent(cardToken)}`);
        renderDashboard();
      } else if (cardToken && cardState?.state === 'claimed-locked') {
        cardToken = '';
        cardState = null;
        renderAuth('Kartu ini sudah terdaftar ke akun lain.');
      } else {
        renderDashboard();
      }
    }
  } catch (e) {
    renderAuth(e.message);
  }
}

load();
