// ==========================================
// KAS TRK KELAS B — app.js v2
// Redesign: Charts lengkap, UI baru, Export CSV
// ==========================================

let state = {
  summary: { totalIncome: 0, totalExpense: 0, balance: 0, duesPaidCount: 0 },
  members: [],
  transactions: [],
  activeTab: 'dashboard',
  ledgerFilter: 'all',
  ledgerSearch: '',
  defaultDuesAmount: 5000,
  totalWeeks: 16,
  isLoggedIn: false,
  userType: 'guest',
  studentId: null,
  studentName: '',
  studentNim: '',
  isAdmin: false,
  adminPassword: ''
};

const API_BASE = '';

// ── Rupiah formatter ─────────────────────
const formatRupiah = (val) =>
  new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', minimumFractionDigits:0 }).format(val);

const formatRupiahShort = (val) => {
  if (val >= 1_000_000) return `Rp ${(val/1_000_000).toFixed(1)}jt`;
  if (val >= 1_000)     return `Rp ${(val/1_000).toFixed(0)}rb`;
  return `Rp ${val}`;
};

// ── Toast ────────────────────────────────
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  const icon  = toast.querySelector('.toast-icon');
  const msgEl = toast.querySelector('.toast-message');
  toast.className = 'toast-notification show';
  if (type === 'success') { toast.classList.add('success-toast'); icon.textContent = 'check_circle'; }
  else if (type === 'error') { toast.classList.add('error-toast'); icon.textContent = 'error'; }
  else { icon.textContent = 'info'; }
  msgEl.textContent = message;
  setTimeout(() => toast.classList.remove('show'), 4000);
}

// ── Session UI ───────────────────────────
function updateSessionUI() {
  const loginScreen = document.getElementById('login-screen');
  const appContainer = document.querySelector('.app-container');
  const icon  = document.getElementById('admin-icon');
  const title = document.getElementById('role-title');
  const status= document.getElementById('role-status');

  if (state.isLoggedIn) {
    if (loginScreen) loginScreen.style.display = 'none';
    if (appContainer) appContainer.style.display = 'flex';

    if (state.userType === 'admin') {
      document.body.classList.add('mode-admin');
      if (icon) { icon.textContent = 'admin_panel_settings'; icon.style.color = 'var(--amber)'; }
      if (title) title.textContent = 'Bendahara Kelas';
      if (status) status.textContent = 'Mode Administrator';
    } else if (state.userType === 'student') {
      document.body.classList.remove('mode-admin');
      if (icon) { icon.textContent = 'person'; icon.style.color = 'var(--green)'; }
      if (title) title.textContent = state.studentName;
      if (status) status.textContent = `NIM: ${state.studentNim}`;
    } else {
      document.body.classList.remove('mode-admin');
      if (icon) { icon.textContent = 'visibility'; icon.style.color = 'var(--text-3)'; }
      if (title) title.textContent = 'Pengunjung';
      if (status) status.textContent = 'Mode Baca-Saja';
    }
  } else {
    if (loginScreen) loginScreen.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';
    document.body.classList.remove('mode-admin');
  }
}

// ── API Calls ────────────────────────────
async function fetchSummary() {
  try { const r = await fetch(`${API_BASE}/api/summary`); state.summary = await r.json(); }
  catch(e) { console.error('summary fetch failed', e); }
}
async function fetchMembers() {
  try { const r = await fetch(`${API_BASE}/api/members`); state.members = await r.json(); }
  catch(e) { console.error('members fetch failed', e); }
}
async function fetchTransactions() {
  try { const r = await fetch(`${API_BASE}/api/transactions`); state.transactions = await r.json(); }
  catch(e) { console.error('transactions fetch failed', e); }
}
async function refreshAllData() {
  await Promise.all([fetchSummary(), fetchMembers(), fetchTransactions()]);
  renderAll();
}

// ══════════════════════════════════════════
// CHARTS
// ══════════════════════════════════════════

// ── 1. Trend Line Chart ──────────────────
function drawTrendChart() {
  const svg = document.getElementById('svg-trend');
  if (!svg) return;
  svg.innerHTML = '';

  const cronTx = [...state.transactions].reverse();
  let bal = 0;
  const pts = [{ bal: 0, date: 'Awal', type: null }];
  cronTx.forEach(tx => {
    bal += tx.type === 'income' ? tx.amount : -tx.amount;
    pts.push({ bal, date: tx.date, type: tx.type });
  });

  const last = pts.slice(-20);
  if (last.length < 2) {
    // Draw empty state
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', '300'); text.setAttribute('y', '100');
    text.setAttribute('fill', 'var(--text-3)'); text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '13'); text.textContent = 'Belum ada data transaksi';
    svg.appendChild(text);
    return;
  }

  const W = 600, H = 200, px = 12, py = 20;
  const minV = Math.min(...last.map(p => p.bal));
  const maxV = Math.max(...last.map(p => p.bal), minV + 1);
  const rng  = maxV - minV || 1;

  const gx = (i) => px + (i * (W - px*2)) / (last.length - 1);
  const gy = (v) => H - py - ((v - minV) / rng) * (H - py*2);

  // Defs: gradient fill
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#63eb84" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#63eb84" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="trendStroke" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#63eb84"/>
      <stop offset="100%" stop-color="#29d4f5"/>
    </linearGradient>
  `;
  svg.appendChild(defs);

  // Grid lines
  [0, 0.5, 1].forEach(t => {
    const y = gy(minV + rng * t);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', px); line.setAttribute('y1', y);
    line.setAttribute('x2', W-px); line.setAttribute('y2', y);
    line.setAttribute('stroke', 'rgba(255,255,255,0.05)'); line.setAttribute('stroke-dasharray', '4');
    svg.appendChild(line);

    const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    lbl.setAttribute('x', px-4); lbl.setAttribute('y', y+4);
    lbl.setAttribute('fill', 'var(--text-3)'); lbl.setAttribute('font-size', '9');
    lbl.setAttribute('text-anchor', 'end');
    lbl.textContent = formatRupiahShort(minV + rng * t);
    svg.appendChild(lbl);
  });

  // Build path coords
  let pathD = '', areaD = '';
  last.forEach((p, i) => {
    const x = gx(i), y = gy(p.bal);
    if (i === 0) {
      pathD = `M ${x} ${y}`;
      areaD = `M ${x} ${H-py} L ${x} ${y}`;
    } else {
      // Smooth bezier
      const prev = last[i-1];
      const px2 = gx(i-1), py2 = gy(prev.bal);
      const cpx = (px2 + x) / 2;
      pathD += ` C ${cpx} ${py2} ${cpx} ${y} ${x} ${y}`;
      areaD += ` C ${cpx} ${py2} ${cpx} ${y} ${x} ${y}`;
    }
    if (i === last.length-1) areaD += ` L ${x} ${H-py} Z`;
  });

  const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  area.setAttribute('d', areaD); area.setAttribute('fill', 'url(#trendFill)');
  svg.appendChild(area);

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  line.setAttribute('d', pathD); line.setAttribute('fill', 'none');
  line.setAttribute('stroke', 'url(#trendStroke)'); line.setAttribute('stroke-width', '2.5');
  line.setAttribute('stroke-linecap', 'round'); line.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(line);

  // Dots with tooltip
  last.forEach((p, i) => {
    const x = gx(i), y = gy(p.bal);
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', '4');
    c.setAttribute('fill', p.type === 'expense' ? 'var(--rose)' : 'var(--green)');
    c.setAttribute('stroke', 'var(--bg-base)'); c.setAttribute('stroke-width', '1.5');
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    t.textContent = `${p.date}: ${formatRupiah(p.bal)}`;
    c.appendChild(t);
    svg.appendChild(c);
  });
}

// ── 2. Donut Chart: Kategori Pengeluaran ──
function drawDonutChart() {
  const svg = document.getElementById('svg-donut');
  const legend = document.getElementById('donut-legend');
  if (!svg || !legend) return;
  svg.innerHTML = '';
  legend.innerHTML = '';

  const expenses = state.transactions.filter(tx => tx.type === 'expense');
  const catTotals = {};
  expenses.forEach(tx => {
    catTotals[tx.category] = (catTotals[tx.category] || 0) + tx.amount;
  });

  const entries = Object.entries(catTotals).sort((a,b) => b[1]-a[1]);
  const total   = entries.reduce((s,[,v]) => s+v, 0);

  const COLORS = ['#63eb84','#29d4f5','#f6a832','#f9647c','#4f9cf9','#a78bfa'];
  const CAT_LABEL = {
    dues:'Uang Kas', donation:'Donasi', social:'Sosial',
    photocopies:'Fotokopi', consumption:'Konsumsi', other:'Lain-lain'
  };

  const cx = 80, cy = 80, r = 60, ir = 40;

  if (total === 0) {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x','80'); text.setAttribute('y','85');
    text.setAttribute('fill','var(--text-3)'); text.setAttribute('text-anchor','middle');
    text.setAttribute('font-size','10'); text.textContent = 'Belum ada pengeluaran';
    svg.appendChild(text);
    return;
  }

  let startAngle = -Math.PI / 2;
  entries.forEach(([cat, val], idx) => {
    const slice = (val / total) * 2 * Math.PI;
    const endAngle = startAngle + slice;
    const color = COLORS[idx % COLORS.length];

    const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle),   y2 = cy + r * Math.sin(endAngle);
    const xi1= cx + ir * Math.cos(startAngle), yi1= cy + ir * Math.sin(startAngle);
    const xi2= cx + ir * Math.cos(endAngle),   yi2= cy + ir * Math.sin(endAngle);
    const large = slice > Math.PI ? 1 : 0;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${xi1} ${yi1} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${ir} ${ir} 0 ${large} 0 ${xi1} ${yi1} Z`);
    path.setAttribute('fill', color);
    path.setAttribute('opacity', '0.85');
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    t.textContent = `${CAT_LABEL[cat]||cat}: ${formatRupiah(val)}`;
    path.appendChild(t);
    svg.appendChild(path);

    // Legend entry
    const pct = ((val/total)*100).toFixed(0);
    const item = document.createElement('div');
    item.className = 'donut-legend-item';
    item.innerHTML = `
      <span class="donut-legend-label">
        <span class="color-dot-sm" style="background:${color};border-radius:2px;"></span>
        ${CAT_LABEL[cat]||cat}
      </span>
      <span class="donut-legend-value">${pct}%</span>
    `;
    legend.appendChild(item);

    startAngle = endAngle;
  });

  // Center label
  const totalLbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  totalLbl.setAttribute('x','80'); totalLbl.setAttribute('y','77');
  totalLbl.setAttribute('fill','var(--text-1)'); totalLbl.setAttribute('text-anchor','middle');
  totalLbl.setAttribute('font-size','11'); totalLbl.setAttribute('font-weight','700');
  totalLbl.textContent = formatRupiahShort(total);
  svg.appendChild(totalLbl);

  const subLbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  subLbl.setAttribute('x','80'); subLbl.setAttribute('y','90');
  subLbl.setAttribute('fill','var(--text-3)'); subLbl.setAttribute('text-anchor','middle');
  subLbl.setAttribute('font-size','8'); subLbl.textContent = 'Total Keluar';
  svg.appendChild(subLbl);
}

// ── 3. Bar Chart: Pemasukan vs Pengeluaran ─
function drawBarChart() {
  const container = document.getElementById('bar-chart-container');
  if (!container) return;
  container.innerHTML = '';

  // Group last 8 transactions
  const items = state.transactions.slice(0, 8).reverse();
  if (items.length === 0) {
    container.innerHTML = '<div class="empty-state"><span class="material-symbols-outlined">bar_chart</span><p>Belum ada data transaksi</p></div>';
    return;
  }

  const maxAmt = Math.max(...items.map(t => t.amount), 1);

  items.forEach(tx => {
    const pct = (tx.amount / maxAmt * 100).toFixed(1);
    const color = tx.type === 'income' ? 'var(--green)' : 'var(--rose)';
    const div = document.createElement('div');
    div.className = 'bar-item';
    div.innerHTML = `
      <span class="bar-label" title="${tx.description}">${tx.description.slice(0,14)}</span>
      <div class="bar-track">
        <div class="bar-fill" style="width:${pct}%;background:${color};"></div>
      </div>
      <span class="bar-value">${formatRupiahShort(tx.amount)}</span>
    `;
    container.appendChild(div);
  });
}

// ── 4. Dues Progress Chart ────────────────
function drawDuesProgressChart() {
  const container = document.getElementById('dues-progress-chart');
  if (!container) return;
  container.innerHTML = '';

  if (state.members.length === 0) {
    container.innerHTML = '<div class="empty-state"><span class="material-symbols-outlined">people</span><p>Belum ada anggota</p></div>';
    return;
  }

  // Sort by paidWeeks descending
  const sorted = [...state.members].sort((a,b) => b.paidWeeks.length - a.paidWeeks.length);
  const top = sorted.slice(0, 12);

  top.forEach(m => {
    const pct = Math.round((m.paidWeeks.length / state.totalWeeks) * 100);
    const color = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--rose)';
    const shortName = m.name.split(' ').slice(0,2).join(' ');
    const div = document.createElement('div');
    div.className = 'dpc-row';
    div.innerHTML = `
      <span class="dpc-name" title="${m.name}">${shortName}</span>
      <div class="dpc-track"><div class="dpc-fill" style="width:${pct}%;background:${color};"></div></div>
      <span class="dpc-pct">${pct}%</span>
    `;
    container.appendChild(div);
  });
}

// ══════════════════════════════════════════
// RENDER VIEWS
// ══════════════════════════════════════════
function renderAll() {
  const titleEl    = document.getElementById('page-title');
  const subtitleEl = document.getElementById('page-subtitle');

  if (state.activeTab === 'dashboard') {
    titleEl.textContent    = 'Dashboard Utama';
    subtitleEl.textContent = 'Ringkasan keuangan dan statistik kas kelas';
    renderDashboard();
  } else if (state.activeTab === 'uang-kas') {
    titleEl.textContent    = 'Uang Kas Mingguan';
    subtitleEl.textContent = 'Manajemen pembayaran iuran mingguan semester (16 Pekan)';
    renderDuesGrid();
  } else if (state.activeTab === 'ledger') {
    titleEl.textContent    = 'Audit Buku Kas (Ledger)';
    subtitleEl.textContent = 'Daftar audit mutasi kas masuk dan keluar';
    renderLedger();
  } else if (state.activeTab === 'members') {
    titleEl.textContent    = 'Daftar Anggota Kelas';
    subtitleEl.textContent = 'Kelola profil teman sekelas dan cek kontribusi kas';
    renderMembers();
  }
}

// ── Dashboard ─────────────────────────────
function renderDashboard() {
  document.getElementById('kpi-balance').textContent   = formatRupiah(state.summary.balance);
  document.getElementById('kpi-income').textContent    = formatRupiah(state.summary.totalIncome);
  document.getElementById('kpi-expense').textContent   = formatRupiah(state.summary.totalExpense);
  document.getElementById('kpi-dues-count').textContent= `${state.summary.duesPaidCount} Setoran`;

  // Populate member select
  const sel = document.getElementById('tx-member');
  const saved = sel.value;
  sel.innerHTML = '<option value="">-- Tanpa Siswa --</option>';
  state.members.forEach(m => {
    const o = document.createElement('option');
    o.value = m.id; o.textContent = m.name;
    sel.appendChild(o);
  });
  sel.value = saved;

  // Recent transactions (last 5)
  const tbody = document.getElementById('recent-transactions-tbody');
  tbody.innerHTML = '';
  const recent = state.transactions.slice(0, 5);
  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px 0;"><div class="empty-state"><span class="material-symbols-outlined">receipt_long</span><p>Belum ada transaksi. Tambahkan melalui form di samping!</p></div></td></tr>`;
  } else {
    recent.forEach(tx => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="color:var(--text-2);font-size:12px;">${tx.date}</td>
        <td><span class="badge badge-category">${tx.category}</span></td>
        <td style="font-weight:500;">${tx.description}</td>
        <td style="color:var(--text-2);">${tx.member_name || '—'}</td>
        <td><span class="${tx.type==='income'?'amount-income':'amount-expense'}">${tx.type==='income'?'+':'-'}${formatRupiah(tx.amount)}</span></td>
        <td><span class="badge ${tx.type==='income'?'badge-income':'badge-expense'}">${tx.type==='income'?'Masuk':'Keluar'}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Draw all charts
  drawTrendChart();
  drawDonutChart();
  drawBarChart();
  drawDuesProgressChart();
}

// ── Dues Grid ─────────────────────────────
function renderDuesGrid(searchQuery = '') {
  const headerRow = document.getElementById('dues-table-header');
  const tbody     = document.getElementById('dues-table-tbody');

  headerRow.innerHTML = `<th>Nama Siswa</th><th>Total Bayar</th>`;
  for (let w = 1; w <= state.totalWeeks; w++) {
    const th = document.createElement('th');
    th.textContent = `W${w}`; headerRow.appendChild(th);
  }

  const searchLower = searchQuery.toLowerCase().trim();
  const filtered = searchLower
    ? state.members.filter(m => m.name.toLowerCase().includes(searchLower))
    : state.members;

  // Personal card logic
  const card = document.getElementById('personal-dues-card');
  if (searchLower.length >= 2) {
    const match = state.members.find(m => m.name.toLowerCase().includes(searchLower));
    if (match) renderPersonalDuesCard(match);
    else card.style.display = 'none';
  } else if (state.userType === 'student') {
    const self = state.members.find(m => m.id === state.studentId);
    if (self) renderPersonalDuesCard(self);
    else card.style.display = 'none';
  } else {
    card.style.display = 'none';
  }

  tbody.innerHTML = '';
  if (state.members.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${state.totalWeeks+2}" style="text-align:center;padding:30px 0;"><div class="empty-state"><span class="material-symbols-outlined">group_add</span><p>Daftar siswa kosong. Daftarkan siswa di menu "Daftar Kelas" terlebih dahulu!</p></div></td></tr>`;
    return;
  }
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${state.totalWeeks+2}" style="text-align:center;padding:20px 0;color:var(--text-3);">Tidak ada siswa bernama "${searchQuery}"</td></tr>`;
    return;
  }

  filtered.forEach(member => {
    const tr = document.createElement('tr');
    if (state.userType === 'student' && state.studentId === member.id) tr.className = 'highlight-self';

    tr.innerHTML = `<td>${member.name}</td><td>${formatRupiah(member.totalDuesPaid)}</td>`;

    for (let w = 1; w <= state.totalWeeks; w++) {
      const td = document.createElement('td');
      td.className = 'dues-cell' + (member.paidWeeks.includes(w) ? ' paid' : '');
      td.innerHTML = `<div class="due-checkbox"></div>`;
      td.addEventListener('click', () => {
        if (!state.isAdmin) { showToast('Mode Baca-Saja: Silakan masuk sebagai Admin.', 'info'); return; }
        toggleDuesPayment(member.id, w, !member.paidWeeks.includes(w));
      });
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });

  // Summary row (only when no search)
  if (!searchLower) {
    const summaryTr = document.createElement('tr');
    summaryTr.className = 'summary-row';
    let totalAll = 0;
    let summaryHTML = `<td>Total Per Pekan</td><td id="aggregate-dues-total">—</td>`;
    for (let w = 1; w <= state.totalWeeks; w++) {
      const paid = state.members.filter(m => m.paidWeeks.includes(w)).length;
      const sum  = paid * state.defaultDuesAmount;
      totalAll += sum;
      summaryHTML += `<td>${sum > 0 ? formatRupiahShort(sum) : '—'}</td>`;
    }
    summaryTr.innerHTML = summaryHTML;
    tbody.appendChild(summaryTr);
    const el = document.getElementById('aggregate-dues-total');
    if (el) el.textContent = formatRupiah(totalAll);
  }
}

// ── Personal Dues Card ────────────────────
function renderPersonalDuesCard(member) {
  const card = document.getElementById('personal-dues-card');
  const paid = member.paidWeeks.length;
  const total = state.totalWeeks;
  const pct = Math.round((paid / total) * 100);
  const isAll = paid >= total;

  let weeksHTML = '';
  for (let w = 1; w <= total; w++) {
    const p = member.paidWeeks.includes(w);
    weeksHTML += `
      <div class="personal-week-box ${p?'paid':'unpaid'}">
        <span class="personal-week-num">W${w}</span>
        <div class="personal-week-status-icon">
          ${p ? '<span class="material-symbols-outlined">done</span>' : ''}
        </div>
      </div>`;
  }

  card.innerHTML = `
    <button class="personal-card-close" id="personal-card-close-btn">
      <span class="material-symbols-outlined" style="font-size:18px;">close</span>
    </button>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
      <div class="logo-icon" style="width:38px;height:38px;border-radius:50%;">
        <span class="material-symbols-outlined" style="font-size:18px;color:#080c12;">person</span>
      </div>
      <div>
        <span style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:1px;font-weight:600;">Kartu Iuran Pribadi</span>
        <p class="personal-name-heading">${member.name}</p>
      </div>
    </div>
    <div class="personal-dues-grid">
      <div class="personal-info-side">
        <span class="personal-status-badge ${isAll?'all-paid':''}">
          ${isAll ? '✦ Lunas Penuh' : `${paid} dari ${total} Pekan`}
        </span>
        <div>
          <div class="personal-stat-value">${formatRupiah(member.totalDuesPaid)}</div>
          <div class="personal-stat-label">Total Disetor</div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
            <span style="font-size:12px;color:var(--text-2);">Progress Iuran</span>
            <span style="font-size:12px;font-weight:700;color:var(--green);">${pct}%</span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar" style="width:${pct}%;"></div>
          </div>
        </div>
        <div>
          <div class="personal-stat-label" style="margin-bottom:4px;">Sisa Tunggakan</div>
          <div style="font-size:20px;font-weight:800;color:${total-paid>0?'var(--rose)':'var(--green)'};">
            ${total-paid > 0 ? `${total-paid} Pekan` : 'Tidak Ada ✓'}
          </div>
        </div>
      </div>
      <div>
        <div style="font-size:10.5px;color:var(--text-2);text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin-bottom:10px;">Status Mingguan</div>
        <div class="personal-weeks-grid">${weeksHTML}</div>
      </div>
    </div>
  `;
  card.style.display = 'block';
  document.getElementById('personal-card-close-btn').addEventListener('click', () => {
    card.style.display = 'none';
    const s = document.getElementById('dues-search');
    if (s) s.value = '';
    renderDuesGrid();
  });
}

// ── Ledger ────────────────────────────────
function renderLedger() {
  const tbody = document.getElementById('ledger-transactions-tbody');
  tbody.innerHTML = '';

  let filtered = state.transactions;
  if (state.ledgerFilter !== 'all') filtered = filtered.filter(tx => tx.type === state.ledgerFilter);
  if (state.ledgerSearch.trim()) {
    const s = state.ledgerSearch.toLowerCase();
    filtered = filtered.filter(tx =>
      (tx.description||'').toLowerCase().includes(s) ||
      (tx.member_name||'').toLowerCase().includes(s) ||
      (tx.category||'').toLowerCase().includes(s)
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><span class="material-symbols-outlined">search_off</span><p>Tidak ada transaksi yang cocok.</p></div></td></tr>`;
    return;
  }

  filtered.forEach(tx => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:var(--text-2);font-size:12px;">${tx.date}</td>
      <td><span class="badge badge-category">${tx.category}</span></td>
      <td style="font-weight:500;">${tx.description}</td>
      <td style="color:var(--text-2);">${tx.member_name || '—'}</td>
      <td><span class="${tx.type==='income'?'amount-income':'amount-expense'}">${tx.type==='income'?'+':'-'}${formatRupiah(tx.amount)}</span></td>
      <td><span class="badge ${tx.type==='income'?'badge-income':'badge-expense'}">${tx.type==='income'?'Masuk':'Keluar'}</span></td>
      <td class="admin-only" style="text-align:center;">
        <button class="btn btn-icon delete-tx-btn" data-id="${tx.id}">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </td>
    `;
    tr.querySelector('.delete-tx-btn').addEventListener('click', () => deleteTransaction(tx.id, tx.description));
    tbody.appendChild(tr);
  });
}

// ── Members ────────────────────────────────
function renderMembers() {
  const tbody = document.getElementById('members-list-tbody');
  tbody.innerHTML = '';

  if (state.members.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><span class="material-symbols-outlined">group_add</span><p>Siswa belum terdaftar. Masukkan nama siswa di form sebelah kiri!</p></div></td></tr>`;
    return;
  }

  state.members.forEach(m => {
    const tr = document.createElement('tr');
    if (state.userType === 'student' && state.studentId === m.id) tr.className = 'highlight-self';
    const cov = ((m.paidWeeks.length / state.totalWeeks) * 100).toFixed(0);
    const isDeletable = !m.is_locked && m.paidWeeks.length === 0;
    const covColor = cov >= 80 ? 'var(--green)' : cov >= 50 ? 'var(--amber)' : 'var(--rose)';

    tr.innerHTML = `
      <td style="font-weight:600;">${m.name}</td>
      <td style="font-family:monospace;font-size:12px;color:var(--text-2);">${m.nim || '—'}</td>
      <td>${m.paidWeeks.length} / ${state.totalWeeks} Pekan</td>
      <td style="font-weight:700;color:var(--green);">${formatRupiah(m.totalDuesPaid)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:12px;color:${covColor};font-weight:600;">${cov}%</span>
          <div class="progress-bar-container" style="width:80px;">
            <div class="progress-bar" style="width:${cov}%;background:${covColor};"></div>
          </div>
        </div>
      </td>
      <td class="admin-only" style="text-align:center;">
        <button class="btn btn-icon btn-lock toggle-lock-btn ${m.is_locked?'locked':''}" data-id="${m.id}"
          title="${m.is_locked?'Buka Kunci':'Kunci Hapus'}" style="border-radius:var(--r-sm);width:auto;height:auto;padding:6px;background:none;">
          <span class="material-symbols-outlined">${m.is_locked?'lock':'lock_open'}</span>
        </button>
      </td>
      <td class="admin-only" style="text-align:center;">
        <button class="btn btn-icon delete-member-btn" data-id="${m.id}"
          ${!isDeletable ? 'disabled' : ''} title="${!isDeletable?'Tidak bisa dihapus':'Hapus Siswa'}">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </td>
    `;

    tr.querySelector('.toggle-lock-btn').addEventListener('click', () =>
      toggleMemberLock(m.id, !m.is_locked, m.name));

    if (isDeletable)
      tr.querySelector('.delete-member-btn').addEventListener('click', () =>
        deleteMember(m.id, m.name));

    tbody.appendChild(tr);
  });
}

// ══════════════════════════════════════════
// ACTIONS / MUTATIONS
// ══════════════════════════════════════════
async function toggleDuesPayment(memberId, weekNum, setPaid) {
  try {
    const res = await fetch(`${API_BASE}/api/dues/toggle`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'x-admin-password': state.adminPassword },
      body: JSON.stringify({ member_id:memberId, week_number:weekNum, paid:setPaid, amount:state.defaultDuesAmount })
    });
    const result = await res.json();
    if (res.ok) {
      showToast(`Pekan ${weekNum} diubah ke ${setPaid?'Lunas':'Belum Lunas'}`, 'success');
      await refreshAllData();
    } else {
      showToast(`Error: ${result.error}`, 'error');
    }
  } catch(e) { showToast('Koneksi server terputus', 'error'); }
}

async function deleteTransaction(txId, description) {
  if (!confirm(`Hapus transaksi "${description}"?`)) return;
  try {
    const res = await fetch(`${API_BASE}/api/transactions/${txId}`, {
      method:'DELETE', headers:{ 'x-admin-password': state.adminPassword }
    });
    if (res.ok) { showToast('Transaksi berhasil dihapus', 'success'); await refreshAllData(); }
    else showToast('Gagal menghapus transaksi', 'error');
  } catch(e) { showToast('Koneksi server terputus', 'error'); }
}

async function deleteMember(memberId, name) {
  if (!confirm(`Hapus siswa "${name}"? Seluruh data iurannya akan dihapus.`)) return;
  try {
    const res = await fetch(`${API_BASE}/api/members/${memberId}`, {
      method:'DELETE', headers:{ 'x-admin-password': state.adminPassword }
    });
    if (res.ok) { showToast(`Siswa "${name}" dihapus`, 'success'); await refreshAllData(); }
    else { const e = await res.json(); showToast(`Gagal: ${e.error}`, 'error'); }
  } catch(e) { showToast('Koneksi server terputus', 'error'); }
}

async function toggleMemberLock(memberId, isLocked, name) {
  try {
    const res = await fetch(`${API_BASE}/api/members/${memberId}/toggle-lock`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'x-admin-password': state.adminPassword },
      body: JSON.stringify({ is_locked: isLocked })
    });
    if (res.ok) {
      showToast(`Proteksi "${name}" ${isLocked?'diaktifkan':'dinonaktifkan'}`, 'success');
      await refreshAllData();
    }
  } catch(e) { showToast('Koneksi server terputus', 'error'); }
}

// ══════════════════════════════════════════
// EXPORT CSV
// ══════════════════════════════════════════
function exportTransactionsCSV() {
  const rows = [['Tanggal','Kategori','Deskripsi','Anggota','Nominal','Tipe']];
  state.transactions.forEach(tx => {
    rows.push([tx.date, tx.category, tx.description, tx.member_name||'', tx.amount, tx.type]);
  });
  downloadCSV(rows, 'laporan-kas-trk-b.csv');
}

function exportMembersCSV() {
  const rows = [['Nama','NIM','Pekan Terbayar','Total Setoran','Persentase']];
  state.members.forEach(m => {
    const pct = ((m.paidWeeks.length / state.totalWeeks)*100).toFixed(0);
    rows.push([m.name, m.nim||'', `${m.paidWeeks.length}/${state.totalWeeks}`, m.totalDuesPaid, `${pct}%`]);
  });
  downloadCSV(rows, 'anggota-kas-trk-b.csv');
}

function exportDashboardCSV() {
  const rows = [
    ['Laporan Kas TRK Kelas B'],
    ['Saldo', state.summary.balance],
    ['Total Pemasukan', state.summary.totalIncome],
    ['Total Pengeluaran', state.summary.totalExpense],
    ['Setoran Diterima', state.summary.duesPaidCount],
    [],
    ['=== TRANSAKSI ==='],
    ['Tanggal','Kategori','Deskripsi','Anggota','Nominal','Tipe'],
    ...state.transactions.map(tx => [tx.date, tx.category, tx.description, tx.member_name||'', tx.amount, tx.type])
  ];
  downloadCSV(rows, 'laporan-lengkap-kas-trk-b.csv');
}

function downloadCSV(rows, filename) {
  const content = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + content], { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast(`File "${filename}" berhasil diunduh!`, 'success');
}

// ══════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════
function switchTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll('.menu-item').forEach(btn =>
    btn.classList.toggle('active', btn.getAttribute('data-target') === tabId));
  document.querySelectorAll('.app-view').forEach(view =>
    view.classList.toggle('active', view.id === `view-${tabId}`));
  renderAll();
}

// ══════════════════════════════════════════
// EVENT LISTENERS
// ══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {

  // Navigation
  document.querySelectorAll('.menu-item').forEach(btn =>
    btn.addEventListener('click', () => switchTab(btn.getAttribute('data-target'))));

  // Date
  const today = new Date().toISOString().split('T')[0];
  const txDate = document.getElementById('tx-date');
  if (txDate) txDate.value = today;
  const dateEl = document.getElementById('current-date');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('id-ID', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  // Add Transaction
  document.getElementById('quick-add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      type:        document.getElementById('tx-type').value,
      category:    document.getElementById('tx-category').value,
      amount:      parseFloat(document.getElementById('tx-amount').value),
      date:        document.getElementById('tx-date').value,
      description: document.getElementById('tx-desc').value,
      member_id:   document.getElementById('tx-member').value ? parseInt(document.getElementById('tx-member').value) : null
    };
    try {
      const res = await fetch(`${API_BASE}/api/transactions`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'x-admin-password': state.adminPassword },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        showToast('Transaksi berhasil disimpan!', 'success');
        document.getElementById('tx-amount').value = '';
        document.getElementById('tx-desc').value   = '';
        txDate.value = today;
        document.getElementById('tx-member').value = '';
        await refreshAllData();
      } else {
        const err = await res.json();
        showToast(`Gagal: ${err.error}`, 'error');
      }
    } catch(e) { showToast('Koneksi server gagal', 'error'); }
  });

  // Add Member
  document.getElementById('add-member-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameEl = document.getElementById('member-name');
    const nimEl  = document.getElementById('member-nim');
    try {
      const res = await fetch(`${API_BASE}/api/members`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'x-admin-password': state.adminPassword },
        body: JSON.stringify({ name: nameEl.value, nim: nimEl.value })
      });
      if (res.ok) {
        showToast(`Siswa "${nameEl.value}" berhasil didaftarkan!`, 'success');
        nameEl.value = ''; nimEl.value = '';
        await refreshAllData();
      } else {
        const err = await res.json();
        showToast(`Gagal: ${err.error}`, 'error');
      }
    } catch(e) { showToast('Koneksi server gagal', 'error'); }
  });

  // Ledger filters
  document.querySelectorAll('.filter-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.ledgerFilter = btn.getAttribute('data-filter');
      renderLedger();
    })
  );

  // Ledger search
  document.getElementById('ledger-search').addEventListener('input', (e) => {
    state.ledgerSearch = e.target.value;
    renderLedger();
  });

  // Dues search
  document.getElementById('dues-search').addEventListener('input', (e) =>
    renderDuesGrid(e.target.value));

  // Dues amount setting
  document.getElementById('settings-dues-amount').addEventListener('change', (e) => {
    const val = parseInt(e.target.value);
    if (val && val >= 1000) { state.defaultDuesAmount = val; renderDuesGrid(); }
  });

  // Export buttons
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) exportBtn.addEventListener('click', exportDashboardCSV);
  const exportLedgerBtn = document.getElementById('export-ledger-btn');
  if (exportLedgerBtn) exportLedgerBtn.addEventListener('click', exportTransactionsCSV);
  const exportMembersBtn = document.getElementById('export-members-btn');
  if (exportMembersBtn) exportMembersBtn.addEventListener('click', exportMembersCSV);

  // ── Login logic ────────────────────────
  const tabStudent = document.getElementById('tab-student-btn');
  const tabAdmin   = document.getElementById('tab-admin-btn');
  const formStudent= document.getElementById('student-login-form');
  const formAdmin  = document.getElementById('admin-login-form');

  if (tabStudent && tabAdmin) {
    tabStudent.addEventListener('click', () => {
      tabStudent.classList.add('active'); tabAdmin.classList.remove('active');
      formStudent.classList.add('active'); formAdmin.classList.remove('active');
    });
    tabAdmin.addEventListener('click', () => {
      tabAdmin.classList.add('active'); tabStudent.classList.remove('active');
      formAdmin.classList.add('active'); formStudent.classList.remove('active');
    });
  }

  if (formStudent) {
    formStudent.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nim = document.getElementById('student-nim-input').value;
      try {
        const res = await fetch(`${API_BASE}/api/login/student`, {
          method:'POST', headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ nim })
        });
        const result = await res.json();
        if (res.ok) {
          Object.assign(state, { isLoggedIn:true, userType:'student', isAdmin:false,
            studentId:result.member.id, studentName:result.member.name, studentNim:result.member.nim });
          localStorage.setItem('isLoggedIn','true'); localStorage.setItem('userType','student');
          localStorage.setItem('studentId', result.member.id);
          localStorage.setItem('studentName', result.member.name);
          localStorage.setItem('studentNim', result.member.nim);
          updateSessionUI();
          showToast(`Selamat datang, ${state.studentName}!`, 'success');
          switchTab('uang-kas');
          await refreshAllData();
        } else { showToast(result.error || 'NIM tidak ditemukan', 'error'); }
      } catch(e) { showToast('Koneksi server gagal', 'error'); }
    });
  }

  if (formAdmin) {
    formAdmin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pw = document.getElementById('admin-password-input').value;
      try {
        const res = await fetch(`${API_BASE}/api/admin/verify`, { headers:{ 'x-admin-password': pw } });
        if (res.ok) {
          Object.assign(state, { isLoggedIn:true, userType:'admin', isAdmin:true, adminPassword:pw });
          localStorage.setItem('isLoggedIn','true'); localStorage.setItem('userType','admin');
          localStorage.setItem('adminPassword', pw);
          updateSessionUI();
          showToast('Akses Administrator diaktifkan!', 'success');
          document.getElementById('admin-password-input').value = '';
          await refreshAllData();
        } else { showToast('Password salah!', 'error'); }
      } catch(e) { showToast('Koneksi server gagal', 'error'); }
    });
  }

  const guestBtn = document.getElementById('guest-login-btn');
  if (guestBtn) {
    guestBtn.addEventListener('click', async () => {
      Object.assign(state, { isLoggedIn:true, userType:'guest', isAdmin:false });
      localStorage.setItem('isLoggedIn','true'); localStorage.setItem('userType','guest');
      updateSessionUI();
      showToast('Masuk sebagai Pengunjung (Baca-Saja)', 'info');
      await refreshAllData();
    });
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      Object.assign(state, { isLoggedIn:false, userType:'guest', isAdmin:false,
        adminPassword:'', studentId:null, studentName:'', studentNim:'' });
      ['isLoggedIn','userType','adminPassword','studentId','studentName','studentNim']
        .forEach(k => localStorage.removeItem(k));
      updateSessionUI();
      showToast('Berhasil keluar akun', 'info');
      const nim = document.getElementById('student-nim-input');
      const pw  = document.getElementById('admin-password-input');
      if (nim) nim.value = ''; if (pw) pw.value = '';
    });
  }

  // ── Restore session ────────────────────
  const storedLogin   = localStorage.getItem('isLoggedIn') === 'true';
  const storedType    = localStorage.getItem('userType') || 'guest';
  if (storedLogin) {
    state.isLoggedIn = true; state.userType = storedType;
    if (storedType === 'admin') {
      state.isAdmin = true; state.adminPassword = localStorage.getItem('adminPassword') || '';
    } else if (storedType === 'student') {
      state.isAdmin = false;
      state.studentId   = parseInt(localStorage.getItem('studentId'));
      state.studentName = localStorage.getItem('studentName');
      state.studentNim  = localStorage.getItem('studentNim');
    }
    updateSessionUI();
    refreshAllData();
  } else {
    updateSessionUI();
  }
});
