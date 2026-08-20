/* ═══════════════════════════════════════════════════════
   FashionAI — Main Application JavaScript
   ═══════════════════════════════════════════════════════ */

// ─── State ───────────────────────────────────────────────
const state = {
  currentDesign: null,
  gallery: JSON.parse(localStorage.getItem('fashionai_gallery') || '[]'),
  budget: 'mid',
  productsLoaded: false,
  adviceLoaded: false,
  theme: localStorage.getItem('fashionai_theme') || 'dark',
};

// ─── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(state.theme);
  checkApiStatus();
  initPalettePreview();
  initParticles();
  initThemeToggle();
  initBudgetToggle();
  initPaletteChange();
  renderGallery();
});

// ─── Theme ────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  state.theme = theme;
  localStorage.setItem('fashionai_theme', theme);
  const icon = document.querySelector('.theme-icon');
  if (icon) icon.textContent = theme === 'dark' ? '◑' : '◐';
}

function initThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.addEventListener('click', () => {
      applyTheme(state.theme === 'dark' ? 'light' : 'dark');
    });
  }
}

// ─── API Status ───────────────────────────────────────────
async function checkApiStatus() {
  const badge = document.getElementById('api-status-badge');
  if (!badge) return;
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    const dot = badge.querySelector('.status-dot');
    const text = badge.querySelector('.status-text');
    if (data.api_configured) {
      dot.className = 'status-dot online';
      text.textContent = 'AI Active';
    } else {
      dot.className = 'status-dot demo';
      text.textContent = 'Demo Mode';
    }
  } catch {
    const text = badge.querySelector('.status-text');
    if (text) text.textContent = 'Offline';
  }
}

// ─── Palette ──────────────────────────────────────────────
let palettesData = {};

async function loadPalettes() {
  if (Object.keys(palettesData).length > 0) return;
  try {
    const res = await fetch('/api/palettes');
    palettesData = await res.json();
  } catch {
    palettesData = {
      'Monochrome': ['#000000', '#333333', '#666666', '#999999', '#FFFFFF'],
    };
  }
}

function initPalettePreview() {
  const select = document.getElementById('palette-select');
  if (select) {
    loadPalettes().then(() => renderPalettePreview(select.value));
  }
}

function initPaletteChange() {
  const select = document.getElementById('palette-select');
  if (select) {
    select.addEventListener('change', () => renderPalettePreview(select.value));
  }
}

async function renderPalettePreview(paletteName) {
  await loadPalettes();
  const preview = document.getElementById('palette-preview');
  if (!preview) return;
  const colors = palettesData[paletteName] || [];
  preview.innerHTML = colors.map(c =>
    `<div class="palette-swatch" style="background:${c}" title="${c}"></div>`
  ).join('');
}

// ─── Budget Toggle ────────────────────────────────────────
function initBudgetToggle() {
  document.querySelectorAll('.budget-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.budget-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.budget = btn.dataset.budget;
    });
  });
}

// ─── Prompt Suggestions ───────────────────────────────────
function setPrompt(text) {
  const input = document.getElementById('design-prompt');
  if (input) {
    input.value = text;
    input.focus();
    input.dispatchEvent(new Event('input'));
  }
}

// ─── Loading Steps Animation ──────────────────────────────
let loadingInterval = null;

function startLoadingAnimation() {
  const steps = ['ls1', 'ls2', 'ls3', 'ls4'];
  let current = 0;
  // Reset
  steps.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.className = 'load-step'; }
  });
  const el0 = document.getElementById(steps[0]);
  if (el0) el0.classList.add('active');

  loadingInterval = setInterval(() => {
    if (current > 0) {
      const prev = document.getElementById(steps[current - 1]);
      if (prev) prev.className = 'load-step done';
    }
    if (current < steps.length) {
      const cur = document.getElementById(steps[current]);
      if (cur) cur.classList.add('active');
      current++;
    } else {
      clearInterval(loadingInterval);
    }
  }, 900);
}

function stopLoadingAnimation() {
  if (loadingInterval) clearInterval(loadingInterval);
}

// ─── Main Generate ────────────────────────────────────────
async function generateDesign() {
  const prompt = document.getElementById('design-prompt').value.trim();
  if (!prompt) {
    showNotification('Please describe your design first!', 'error');
    document.getElementById('design-prompt').focus();
    return;
  }

  const style = document.getElementById('style-select').value;
  const gender = document.getElementById('gender-select').value;
  const palette = document.getElementById('palette-select').value;
  const occasion = document.getElementById('occasion-select').value;

  // UI: show loading
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('loading-state').style.display = 'flex';
  document.getElementById('design-result').style.display = 'none';
  document.getElementById('generate-btn').disabled = true;
  startLoadingAnimation();

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, style, color_palette: palette, occasion, gender }),
    });
    const data = await res.json();
    stopLoadingAnimation();

    if (data.success) {
      state.currentDesign = data;
      state.productsLoaded = false;
      state.adviceLoaded = false;
      renderDesignCard(data);
      showNotification('Design created! ✦', 'success');
    } else {
      showNotification(data.error || 'Design generation failed', 'error');
      document.getElementById('loading-state').style.display = 'none';
      document.getElementById('empty-state').style.display = 'flex';
    }
  } catch (err) {
    stopLoadingAnimation();
    showNotification('Network error. Is the server running?', 'error');
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('empty-state').style.display = 'flex';
  } finally {
    document.getElementById('generate-btn').disabled = false;
  }
}

// ─── Render Design Card ───────────────────────────────────
function renderDesignCard(data) {
  const design = data.design;
  const resultEl = document.getElementById('design-result');
  const template = document.getElementById('design-card-template');
  const clone = template.content.cloneNode(true);
  const card = clone.querySelector('.design-card');

  // Name & badges
  card.querySelector('.design-name').textContent = design.design_name || 'Untitled Design';
  const badgesEl = card.querySelector('.design-badges');
  const badgeSources = [
    design.season,
    ...(design.tags || []).slice(0, 3)
  ].filter(Boolean);
  badgesEl.innerHTML = badgeSources.map(b =>
    `<span class="design-badge">${escHtml(b)}</span>`
  ).join('');

  // Description & color story
  card.querySelector('.design-description').textContent = design.description || '';
  card.querySelector('.cs-text').textContent = design.color_story || '';

  // Info pills
  card.querySelector('.season-val').textContent = design.season || '—';
  card.querySelector('.price-val').textContent = design.price_range || '—';

  // Garments tab
  const garmentsList = card.querySelector('.garments-list');
  garmentsList.innerHTML = (design.garments || []).map(g => `
    <div class="garment-item">
      <div class="garment-header">
        <span class="garment-type-badge">${escHtml(g.type || '')}</span>
        <span class="garment-name">${escHtml(g.name || '')}</span>
      </div>
      <p class="garment-desc">${escHtml(g.description || '')}</p>
      <div class="garment-meta">
        ${g.fabric ? `<span class="garment-meta-item">🧵 ${escHtml(g.fabric)}</span>` : ''}
        ${g.color ? `<span class="garment-meta-item">🎨 ${escHtml(g.color)}</span>` : ''}
      </div>
      <div class="garment-details">
        ${(g.details || []).map(d => `<span class="detail-tag">${escHtml(d)}</span>`).join('')}
      </div>
    </div>
  `).join('');

  // Accessories tab
  const accessoriesGrid = card.querySelector('.accessories-grid');
  const accessories = design.accessories || [];
  const accessoryIcons = ['💍', '👜', '👟', '🧣', '🕶️', '🎩'];
  accessoriesGrid.innerHTML = accessories.map((acc, i) => `
    <div class="accessory-item">
      <span class="accessory-icon">${accessoryIcons[i % accessoryIcons.length]}</span>
      ${escHtml(acc)}
    </div>
  `).join('');

  // Styling tips tab
  const tipsList = card.querySelector('.tips-list');
  tipsList.innerHTML = (design.styling_tips || []).map((tip, i) => `
    <div class="tip-item">
      <span class="tip-num">${i + 1}</span>
      <p class="tip-text">${escHtml(tip)}</p>
    </div>
  `).join('');

  // Tags
  const tagsEl = card.querySelector('.design-tags');
  tagsEl.innerHTML = (design.tags || []).map(t =>
    `<span class="design-tag">${escHtml(t)}</span>`
  ).join('');

  // Tab switching
  card.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      card.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      card.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const tabEl = card.querySelector(`#tab-${tabName}`);
      if (tabEl) tabEl.classList.add('active');

      // Lazy load products
      if (tabName === 'products' && !state.productsLoaded) {
        loadProducts(card);
      }
      // Lazy load advice
      if (tabName === 'advice' && !state.adviceLoaded) {
        loadAdvice(card);
      }
    });
  });

  // Show card
  resultEl.innerHTML = '';
  resultEl.appendChild(clone);
  document.getElementById('loading-state').style.display = 'none';
  resultEl.style.display = 'block';

  // Smooth scroll to result
  setTimeout(() => resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

// ─── Load Products (lazy) ─────────────────────────────────
async function loadProducts(card) {
  if (!state.currentDesign) return;
  const grid = card.querySelector('.products-grid');
  const loading = card.querySelector('.products-loading');
  loading.style.display = 'block';
  grid.innerHTML = '';

  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ design_data: state.currentDesign, budget: state.budget }),
    });
    const data = await res.json();
    loading.style.display = 'none';

    if (data.success && data.products) {
      state.productsLoaded = true;
      grid.innerHTML = data.products.map((p, i) => `
        <div class="product-card" style="animation-delay:${i * 0.08}s">
          <div class="product-brand">${escHtml(p.brand || '')}</div>
          <div class="product-name">${escHtml(p.name || '')}</div>
          <div class="product-type">${escHtml(p.type || '')}</div>
          <p class="product-desc">${escHtml(p.description || '')}</p>
          ${p.color ? `<p class="product-type">🎨 ${escHtml(p.color)}</p>` : ''}
          <div class="product-footer">
            <span class="product-price">${escHtml(p.price || '')}</span>
            <div class="product-shops">
              ${(p.where_to_buy || []).slice(0, 2).map(s =>
                `<span class="shop-chip">${escHtml(s)}</span>`
              ).join('')}
            </div>
          </div>
          <button class="product-search-btn" onclick="searchProduct('${escAttr(p.search_query || p.name)}')">
            🔍 Search Online
          </button>
        </div>
      `).join('');
    } else {
      grid.innerHTML = '<p style="color:var(--text-muted);padding:1rem">Could not load product suggestions.</p>';
    }
  } catch {
    loading.style.display = 'none';
    grid.innerHTML = '<p style="color:var(--rose);padding:1rem">Error loading products. Check your connection.</p>';
  }
}

// ─── Load Advice (lazy) ───────────────────────────────────
async function loadAdvice(card) {
  if (!state.currentDesign) return;
  const content = card.querySelector('.advice-content');
  const loading = card.querySelector('.advice-loading');
  loading.style.display = 'block';
  content.innerHTML = '';

  try {
    const res = await fetch('/api/advice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ design_data: state.currentDesign }),
    });
    const data = await res.json();
    loading.style.display = 'none';

    if (data.success && data.advice) {
      state.adviceLoaded = true;
      const a = data.advice;

      let html = '';

      if (a.body_type_tips?.length) {
        html += adviceSection('👤 Body Type Tips', a.body_type_tips);
      }
      if (a.how_to_wear?.length) {
        html += adviceSection('✨ How to Wear It', a.how_to_wear);
      }
      if (a.occasions?.length) {
        html += adviceSection('📍 Perfect Occasions', a.occasions);
      }
      if (a.what_to_avoid?.length) {
        html += adviceSection('⚠️ What to Avoid', a.what_to_avoid);
      }
      if (a.seasonal_variations) {
        html += `
          <div class="advice-section">
            <div class="advice-title">🌿 Seasonal Variations</div>
            <div class="seasonal-grid">
              <div class="seasonal-item">
                <div class="seasonal-label">☀️ Summer</div>
                <div class="seasonal-text">${escHtml(a.seasonal_variations.summer || '')}</div>
              </div>
              <div class="seasonal-item">
                <div class="seasonal-label">❄️ Winter</div>
                <div class="seasonal-text">${escHtml(a.seasonal_variations.winter || '')}</div>
              </div>
            </div>
          </div>`;
      }
      if (a.confidence_boost) {
        html += `<div class="confidence-boost">"${escHtml(a.confidence_boost)}"</div>`;
      }

      content.innerHTML = html || '<p style="color:var(--text-muted);padding:1rem">No advice generated.</p>';
    } else {
      content.innerHTML = '<p style="color:var(--text-muted);padding:1rem">Could not load advice.</p>';
    }
  } catch {
    loading.style.display = 'none';
    content.innerHTML = '<p style="color:var(--rose);padding:1rem">Error loading advice.</p>';
  }
}

function adviceSection(title, items) {
  return `
    <div class="advice-section">
      <div class="advice-title">${title}</div>
      <div class="advice-list">
        ${items.map(item => `<div class="advice-list-item">${escHtml(item)}</div>`).join('')}
      </div>
    </div>`;
}

// ─── Save to Gallery ──────────────────────────────────────
function saveToGallery() {
  if (!state.currentDesign) return;
  const design = state.currentDesign.design;
  const entry = {
    id: Date.now(),
    name: design.design_name,
    description: design.description,
    tags: design.tags || [],
    season: design.season,
    price_range: design.price_range,
    timestamp: new Date().toLocaleDateString(),
    data: state.currentDesign,
  };
  state.gallery.unshift(entry);
  if (state.gallery.length > 20) state.gallery.pop(); // Keep max 20
  localStorage.setItem('fashionai_gallery', JSON.stringify(state.gallery));
  renderGallery();
  showNotification('Saved to Gallery! 🔖', 'success');
}

function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;

  if (state.gallery.length === 0) {
    grid.innerHTML = `
      <div class="gallery-empty glass-card">
        <span class="gallery-empty-icon">🖼️</span>
        <p>No saved designs yet. Generate your first design above!</p>
      </div>`;
    return;
  }

  grid.innerHTML = state.gallery.map((entry, i) => `
    <div class="gallery-item glass-card" onclick="loadFromGallery(${i})" style="animation-delay:${i * 0.06}s">
      <div class="gallery-item-name">${escHtml(entry.name || 'Untitled')}</div>
      <p class="gallery-item-desc">${escHtml(entry.description || '')}</p>
      <div class="gallery-item-meta">
        ${(entry.tags || []).slice(0, 3).map(t =>
          `<span class="gallery-tag">${escHtml(t)}</span>`
        ).join('')}
        ${entry.price_range ? `<span class="gallery-tag">${escHtml(entry.price_range)}</span>` : ''}
      </div>
    </div>
  `).join('');
}

function loadFromGallery(index) {
  const entry = state.gallery[index];
  if (!entry) return;
  state.currentDesign = entry.data;
  state.productsLoaded = false;
  state.adviceLoaded = false;
  renderDesignCard(entry.data);
  document.getElementById('generator').scrollIntoView({ behavior: 'smooth' });
  showNotification('Design loaded! ✦', 'success');
}

// ─── Share ─────────────────────────────────────────────────
function shareDesign() {
  if (!state.currentDesign) return;
  const design = state.currentDesign.design;
  const text = `✦ ${design.design_name}\n\n${design.description}\n\nSeason: ${design.season} | Budget: ${design.price_range}\n\nGenerated with FashionAI`;
  navigator.clipboard.writeText(text)
    .then(() => showNotification('Copied to clipboard! 📋', 'success'))
    .catch(() => showNotification('Copy failed', 'error'));
}

// ─── Search Product ───────────────────────────────────────
function searchProduct(query) {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query + ' buy online')}`;
  window.open(searchUrl, '_blank');
}

// ─── Particles ────────────────────────────────────────────
function initParticles() {
  const container = document.getElementById('particles-bg');
  if (!container) return;
  const count = 40;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    const size = Math.random() * 3 + 1;
    const x = Math.random() * 100;
    const delay = Math.random() * 8;
    const duration = 8 + Math.random() * 12;
    const opacity = Math.random() * 0.4 + 0.1;
    p.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      left: ${x}%;
      bottom: -10px;
      background: rgba(167,139,250,${opacity});
      animation: particle-rise ${duration}s ${delay}s linear infinite;
    `;
    container.appendChild(p);
  }

  // Add keyframes dynamically if not present
  if (!document.getElementById('particle-style')) {
    const style = document.createElement('style');
    style.id = 'particle-style';
    style.textContent = `
      @keyframes particle-rise {
        0% { transform: translateY(0) translateX(0); opacity: 0; }
        10% { opacity: 1; }
        90% { opacity: 1; }
        100% { transform: translateY(-100vh) translateX(${Math.random() > 0.5 ? '' : '-'}${Math.floor(Math.random()*60+20)}px); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
}

// ─── Notifications ────────────────────────────────────────
function showNotification(message, type = 'success') {
  const existing = document.querySelector('.notification');
  if (existing) existing.remove();
  const notif = document.createElement('div');
  notif.className = `notification notif-${type}`;
  notif.textContent = message;
  document.body.appendChild(notif);
  setTimeout(() => {
    notif.style.animation = 'notif-in 0.3s ease reverse';
    setTimeout(() => notif.remove(), 300);
  }, 3000);
}

// ─── Utils ────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escAttr(str) {
  return String(str).replace(/'/g, "\\'");
}

// ─── Active nav link on scroll ────────────────────────────
const sections = ['home', 'generator', 'gallery', 'about'];
const navLinks = document.querySelectorAll('.nav-link');

window.addEventListener('scroll', () => {
  const scrollY = window.scrollY + 100;
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    if (scrollY >= top && scrollY < bottom) {
      navLinks.forEach(l => l.classList.remove('active'));
      const active = document.querySelector(`.nav-link[href="#${id}"]`);
      if (active) active.classList.add('active');
    }
  });
}, { passive: true });

// ─── Enter key on textarea ────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey) {
    generateDesign();
  }
});
