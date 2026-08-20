/* ============================================================
   EXPENSE & BUDGET VISUALIZER — script.js
   ============================================================ */

'use strict';

// ── Constants & Storage Keys ──────────────────────────────────
const STORAGE_KEY       = 'expenseApp_transactions';
const THEME_KEY         = 'expenseApp_theme';
const LIMIT_KEY         = 'expenseApp_budgetLimit';

const CATEGORY_COLORS = {
  Food:      '#f97316',
  Transport: '#3b82f6',
  Fun:       '#a855f7',
};

const CATEGORY_ICONS = {
  Food:      '🍔',
  Transport: '🚌',
  Fun:       '🎮',
};

// ── State ─────────────────────────────────────────────────────
let transactions = [];
let budgetLimit  = null;
let chartInstance = null;

// ── DOM References ────────────────────────────────────────────
const form            = document.getElementById('expenseForm');
const itemNameInput   = document.getElementById('itemName');
const amountInput     = document.getElementById('amount');
const categorySelect  = document.getElementById('category');
const itemNameError   = document.getElementById('itemNameError');
const amountError     = document.getElementById('amountError');
const categoryError   = document.getElementById('categoryError');

const totalAmountEl   = document.getElementById('totalAmount');
const balanceCard     = document.getElementById('balanceCard');
const limitWarning    = document.getElementById('limitWarning');
const limitValueEl    = document.getElementById('limitValue');

const budgetLimitInput     = document.getElementById('budgetLimit');
const setLimitBtn          = document.getElementById('setLimitBtn');
const clearLimitBtn        = document.getElementById('clearLimitBtn');
const currentLimitDisplay  = document.getElementById('currentLimitDisplay');

const transactionList = document.getElementById('transactionList');
const emptyState      = document.getElementById('emptyState');
const countBadge      = document.getElementById('countBadge');
const clearAllBtn     = document.getElementById('clearAllBtn');

const sortBy          = document.getElementById('sortBy');
const themeToggle     = document.getElementById('themeToggle');
const chartCanvas     = document.getElementById('expenseChart');
const chartEmpty      = document.getElementById('chartEmpty');

// ── Init ──────────────────────────────────────────────────────
function init() {
  loadFromStorage();
  applyStoredTheme();
  renderAll();

  // Event listeners
  form.addEventListener('submit', handleFormSubmit);
  themeToggle.addEventListener('click', toggleTheme);
  setLimitBtn.addEventListener('click', handleSetLimit);
  clearLimitBtn.addEventListener('click', handleClearLimit);
  sortBy.addEventListener('change', renderTransactionList);
  clearAllBtn.addEventListener('click', handleClearAll);

  // Live validation clear on input
  itemNameInput.addEventListener('input', () => clearError(itemNameInput, itemNameError));
  amountInput.addEventListener('input',   () => clearError(amountInput,   amountError));
  categorySelect.addEventListener('change', () => clearError(categorySelect, categoryError));
}

// ── Local Storage ─────────────────────────────────────────────
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    transactions = raw ? JSON.parse(raw) : [];
  } catch {
    transactions = [];
  }

  try {
    const lim = localStorage.getItem(LIMIT_KEY);
    budgetLimit = lim !== null ? parseFloat(lim) : null;
  } catch {
    budgetLimit = null;
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function saveBudgetLimit() {
  if (budgetLimit !== null) {
    localStorage.setItem(LIMIT_KEY, String(budgetLimit));
  } else {
    localStorage.removeItem(LIMIT_KEY);
  }
}

// ── Form Handling ─────────────────────────────────────────────
function handleFormSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const transaction = {
    id:        crypto.randomUUID(),
    name:      itemNameInput.value.trim(),
    amount:    parseFloat(amountInput.value),
    category:  categorySelect.value,
    timestamp: Date.now(),
  };

  transactions.push(transaction);
  saveTransactions();
  renderAll();
  form.reset();
  clearAllErrors();

  // Brief focus back to name input for quick consecutive entries
  itemNameInput.focus();
}

// ── Validation ────────────────────────────────────────────────
function validateForm() {
  let valid = true;

  const name = itemNameInput.value.trim();
  if (!name) {
    showError(itemNameInput, itemNameError, 'Nama item tidak boleh kosong.');
    valid = false;
  } else if (name.length < 2) {
    showError(itemNameInput, itemNameError, 'Nama item minimal 2 karakter.');
    valid = false;
  }

  const amt = parseFloat(amountInput.value);
  if (!amountInput.value || isNaN(amt)) {
    showError(amountInput, amountError, 'Masukkan jumlah yang valid.');
    valid = false;
  } else if (amt <= 0) {
    showError(amountInput, amountError, 'Jumlah harus lebih dari 0.');
    valid = false;
  }

  if (!categorySelect.value) {
    showError(categorySelect, categoryError, 'Pilih kategori terlebih dahulu.');
    valid = false;
  }

  return valid;
}

function showError(input, errEl, msg) {
  input.classList.add('invalid');
  errEl.textContent = msg;
}

function clearError(input, errEl) {
  input.classList.remove('invalid');
  errEl.textContent = '';
}

function clearAllErrors() {
  clearError(itemNameInput, itemNameError);
  clearError(amountInput,   amountError);
  clearError(categorySelect, categoryError);
}

// ── Delete ────────────────────────────────────────────────────
function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveTransactions();
  renderAll();
}

function handleClearAll() {
  if (!confirm('Hapus semua transaksi? Tindakan ini tidak dapat dibatalkan.')) return;
  transactions = [];
  saveTransactions();
  renderAll();
}

// ── Budget Limit ──────────────────────────────────────────────
function handleSetLimit() {
  const val = parseFloat(budgetLimitInput.value);
  if (isNaN(val) || val <= 0) {
    budgetLimitInput.classList.add('invalid');
    budgetLimitInput.focus();
    return;
  }
  budgetLimitInput.classList.remove('invalid');
  budgetLimit = val;
  saveBudgetLimit();
  budgetLimitInput.value = '';
  renderBalanceCard();
}

function handleClearLimit() {
  budgetLimit = null;
  saveBudgetLimit();
  renderBalanceCard();
}

// ── Sorting ───────────────────────────────────────────────────
function getSortedTransactions() {
  const copy = [...transactions];
  const val  = sortBy.value;

  switch (val) {
    case 'date-asc':
      return copy.sort((a, b) => a.timestamp - b.timestamp);
    case 'date-desc':
      return copy.sort((a, b) => b.timestamp - a.timestamp);
    case 'amount-asc':
      return copy.sort((a, b) => a.amount - b.amount);
    case 'amount-desc':
      return copy.sort((a, b) => b.amount - a.amount);
    case 'category-asc':
      return copy.sort((a, b) => a.category.localeCompare(b.category));
    case 'category-desc':
      return copy.sort((a, b) => b.category.localeCompare(a.category));
    default:
      return copy.sort((a, b) => b.timestamp - a.timestamp);
  }
}

// ── Render All ────────────────────────────────────────────────
function renderAll() {
  renderBalanceCard();
  renderTransactionList();
  renderChart();
}

// ── Balance Card ──────────────────────────────────────────────
function renderBalanceCard() {
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  totalAmountEl.textContent = formatRupiah(total);

  const overLimit = budgetLimit !== null && total > budgetLimit;

  if (overLimit) {
    balanceCard.classList.add('over-limit');
    limitWarning.classList.remove('hidden');
    limitValueEl.textContent = formatRupiah(budgetLimit);
  } else {
    balanceCard.classList.remove('over-limit');
    limitWarning.classList.add('hidden');
  }

  // Limit display text
  if (budgetLimit !== null) {
    currentLimitDisplay.textContent = `Limit aktif: ${formatRupiah(budgetLimit)}`;
  } else {
    currentLimitDisplay.textContent = 'Belum ada limit yang diset.';
  }
}

// ── Transaction List ──────────────────────────────────────────
function renderTransactionList() {
  const sorted = getSortedTransactions();
  countBadge.textContent = sorted.length;

  if (sorted.length === 0) {
    transactionList.innerHTML = '';
    emptyState.style.display  = 'block';
    clearAllBtn.style.display = 'none';
    transactionList.appendChild(emptyState);
    return;
  }

  emptyState.style.display  = 'none';
  clearAllBtn.style.display = 'block';

  // Build DOM fragment for performance
  const frag = document.createDocumentFragment();
  sorted.forEach(t => {
    frag.appendChild(createTransactionEl(t));
  });

  transactionList.innerHTML = '';
  transactionList.appendChild(frag);
}

function createTransactionEl(t) {
  const item = document.createElement('div');
  item.className = 'transaction-item';
  item.dataset.id = t.id;

  const catClass = `cat-${t.category.toLowerCase()}`;
  const date = new Date(t.timestamp).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  item.innerHTML = `
    <span class="category-dot ${catClass}" title="${t.category}"></span>
    <div class="item-info">
      <div class="item-name" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</div>
      <div class="item-meta">${CATEGORY_ICONS[t.category]} ${t.category} &bull; ${date}</div>
    </div>
    <span class="item-amount">${formatRupiah(t.amount)}</span>
    <button class="delete-btn" data-id="${t.id}" title="Hapus transaksi">🗑️</button>
  `;

  item.querySelector('.delete-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteTransaction(t.id);
  });

  return item;
}

// ── Chart ─────────────────────────────────────────────────────
function renderChart() {
  // Aggregate by category
  const totals = { Food: 0, Transport: 0, Fun: 0 };
  transactions.forEach(t => {
    if (totals[t.category] !== undefined) totals[t.category] += t.amount;
  });

  const labels  = Object.keys(totals).filter(k => totals[k] > 0);
  const data    = labels.map(k => totals[k]);
  const colors  = labels.map(k => CATEGORY_COLORS[k]);

  const hasData = data.length > 0;
  chartCanvas.style.display = hasData ? 'block' : 'none';
  chartEmpty.style.display  = hasData ? 'none'  : 'block';

  if (!hasData) {
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    return;
  }

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const legendColor = isDark ? '#9ca3af' : '#6b7280';

  if (chartInstance) {
    // Update existing chart
    chartInstance.data.labels          = labels;
    chartInstance.data.datasets[0].data   = data;
    chartInstance.data.datasets[0].backgroundColor = colors;
    chartInstance.options.plugins.legend.labels.color = legendColor;
    chartInstance.update('active');
  } else {
    chartInstance = new Chart(chartCanvas, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 3,
          borderColor: isDark ? '#1a1d27' : '#ffffff',
          hoverOffset: 12,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 18,
              font: { size: 13, weight: '600' },
              color: legendColor,
              usePointStyle: true,
              pointStyleWidth: 12,
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val   = ctx.parsed;
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct   = ((val / total) * 100).toFixed(1);
                return ` ${ctx.label}: ${formatRupiah(val)} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }
}

// ── Theme ─────────────────────────────────────────────────────
function applyStoredTheme() {
  const stored = localStorage.getItem(THEME_KEY) || 'light';
  document.documentElement.setAttribute('data-theme', stored);
  themeToggle.textContent = stored === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
  localStorage.setItem(THEME_KEY, next);

  // Re-render chart to update legend colours
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  renderChart();
}

// ── Utilities ─────────────────────────────────────────────────
function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Boot ──────────────────────────────────────────────────────
init();
