/* ==========================================================================
   Inventory — prototype de design
   Partie 1 : données d'exemple, persistance, utilitaires, auth, toasts, surcouches
   Partie 2 : routeur et vues (plus bas dans ce fichier)
   ========================================================================== */
(function () {
  'use strict';

  /* ---------------------------------------------------------------------
     Utilitaires
     --------------------------------------------------------------------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const icon = (name, extra) => `<svg class="od-icon${extra ? ' ' + extra : ''}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;

  const fmtMoney = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n);
  const fmtInt = (n) => new Intl.NumberFormat('fr-FR').format(n);
  const fmtCompactMoney = (n) => {
    if (Math.abs(n) >= 1e6) return (n / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' M€';
    if (Math.abs(n) >= 1e4) return (n / 1e3).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' k€';
    return fmtMoney(n);
  };
  const pad = (n) => String(n).padStart(2, '0');
  const fmtDate = (d) => { d = new Date(d); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
  const fmtDateTime = (d) => { d = new Date(d); return `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const isoDay = (d) => { d = new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const sameDay = (a, b) => isoDay(a) === isoDay(b);
  const startOfDay = (d) => { d = new Date(d); d.setHours(0, 0, 0, 0); return d; };
  const daysAgo = (n, h, m) => { const d = startOfDay(new Date()); d.setDate(d.getDate() - n); d.setHours(h == null ? 9 : h, m == null ? 0 : m, 0, 0); return d.toISOString(); };
  const relTime = (d) => {
    const diff = Date.now() - new Date(d).getTime();
    const min = Math.round(diff / 60000);
    if (min < 1) return 'à l’instant';
    if (min < 60) return `il y a ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `il y a ${h} h`;
    const days = Math.round(h / 24);
    if (days === 1) return 'hier';
    if (days < 7) return `il y a ${days} jours`;
    return fmtDate(d);
  };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const initials = (email) => email.split('@')[0].split(/[._-]/).map(s => s[0] || '').join('').slice(0, 2).toUpperCase();
  const plural = (n, s, p) => n > 1 ? (p || s + 's') : s;

  // Générateur pseudo-aléatoire déterministe : même jeu de données à chaque chargement
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ---------------------------------------------------------------------
     Données d'exemple (fournitures d'atelier) — cohérentes entre elles
     --------------------------------------------------------------------- */
  const DATA_VERSION = 3;
  const STORAGE_KEY = 'inventory-proto-data';
  const SESSION_KEY = 'inventory-proto-session';

  // Stockage tolérant : dans un aperçu sandboxé (iframe sans allow-same-origin),
  // localStorage et sessionStorage lèvent une SecurityError. On bascule alors en mémoire.
  function makeStore(kind) {
    let native = null;
    try { native = window[kind]; native.setItem('__inv_probe', '1'); native.removeItem('__inv_probe'); } catch (e) { native = null; }
    const mem = {};
    return {
      native: !!native,
      get(k) { if (native) { try { return native.getItem(k); } catch (e) { /* repli mémoire */ } } return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      set(k, v) { if (native) { try { native.setItem(k, v); return; } catch (e) { /* repli mémoire */ } } mem[k] = String(v); },
      remove(k) { if (native) { try { native.removeItem(k); } catch (e) { /* repli mémoire */ } } delete mem[k]; },
    };
  }
  const store = { local: makeStore('localStorage'), sess: makeStore('sessionStorage') };

  function buildSeed() {
    const rnd = mulberry32(20261016);
    const categories = [
      { id: 1, name: 'Visserie' },
      { id: 2, name: 'Outillage' },
      { id: 3, name: 'Équipements de protection' },
      { id: 4, name: 'Consommables' },
      { id: 5, name: 'Électricité' },
    ];
    const warehouses = [
      { id: 1, name: 'Entrepôt Nord', address: '12 rue des Docks, 59000 Lille' },
      { id: 2, name: 'Entrepôt Sud', address: '48 avenue Berthelot, 69007 Lyon' },
    ];
    const users = [
      { id: 1, email: 'admin@inventory.fr', username: 'mlefevre', role: 'Admin', isActive: true, createdAt: daysAgo(400) },
      { id: 2, email: 'claire.martin@inventory.fr', username: 'cmartin', role: 'User', isActive: true, createdAt: daysAgo(210) },
      { id: 3, email: 'thomas.bernard@inventory.fr', username: 'tbernard', role: 'User', isActive: true, createdAt: daysAgo(120) },
      { id: 4, email: 'julie.petit@inventory.fr', username: 'jpetit', role: 'Admin', isActive: false, createdAt: daysAgo(320) },
    ];
    const P = [
      // nom, catégorie, prix, stock, seuil
      ['Vis inox A2 M6 × 40 (boîte de 100)', 1, 12.9, 48, 20],
      ['Vis à bois 4 × 50 (boîte de 200)', 1, 9.4, 6, 15],
      ['Boulon hexagonal M10 × 60 (sachet de 25)', 1, 7.85, 0, 10],
      ['Écrou frein M8 (boîte de 100)', 1, 6.2, 83, 20],
      ['Rondelle plate M6 (boîte de 500)', 1, 4.95, 140, 30],
      ['Cheville nylon 8 mm (boîte de 100)', 1, 5.6, 22, 25],
      ['Perceuse-visseuse 18 V + 2 batteries', 2, 189, 7, 3],
      ['Meuleuse d’angle 125 mm', 2, 94.5, 4, 2],
      ['Jeu de clés mixtes 8-22 mm', 2, 42, 11, 4],
      ['Niveau à bulle 60 cm', 2, 18.9, 3, 4],
      ['Mètre ruban 5 m', 2, 8.5, 26, 10],
      ['Scie sauteuse 650 W', 2, 76, 2, 2],
      ['Tournevis isolé 1000 V (jeu de 6)', 2, 34.9, 9, 5],
      ['Gants nitrile taille L (boîte de 100)', 3, 11.5, 14, 30],
      ['Lunettes de protection incolores', 3, 4.3, 62, 20],
      ['Casque de chantier blanc', 3, 9.9, 18, 10],
      ['Chaussures de sécurité S3 pointure 42', 3, 54, 5, 6],
      ['Masque FFP2 (boîte de 20)', 3, 13.8, 31, 15],
      ['Bouchons d’oreilles (boîte de 200)', 3, 16.4, 8, 10],
      ['Ruban adhésif toilé 50 mm', 4, 5.2, 37, 15],
      ['Disque à tronçonner 125 mm (lot de 10)', 4, 12.6, 0, 8],
      ['Lame de cutter 18 mm (étui de 10)', 4, 2.9, 95, 25],
      ['Chiffon microfibre (lot de 10)', 4, 7.1, 19, 10],
      ['Colle PU rapide 310 ml', 4, 8.75, 12, 12],
      ['Sac poubelle 110 L (rouleau de 25)', 4, 6.4, 44, 15],
      ['Câble H07V-U 2,5 mm² bleu (100 m)', 5, 38.5, 9, 5],
      ['Disjoncteur 16 A courbe C', 5, 11.2, 27, 10],
      ['Prise 2P+T encastrée blanche', 5, 3.95, 58, 20],
      ['Interrupteur va-et-vient', 5, 4.4, 1, 10],
      ['Boîte de dérivation étanche 100 × 100', 5, 2.6, 73, 20],
      ['Gaine ICTA 20 mm (couronne de 25 m)', 5, 15.3, 10, 6],
      ['Multimètre numérique', 5, 29.9, 6, 3],
    ];
    const creators = ['admin@inventory.fr', 'julie.petit@inventory.fr'];
    const products = P.map((p, i) => {
      const created = daysAgo(120 + Math.floor(rnd() * 240), 9 + Math.floor(rnd() * 8), Math.floor(rnd() * 60));
      const updated = daysAgo(Math.floor(rnd() * 25), 8 + Math.floor(rnd() * 9), Math.floor(rnd() * 60));
      return {
        id: i + 1, name: p[0], categoryId: p[1], price: p[2], stock: p[3], lowStockThreshold: p[4],
        createdAt: created, createdBy: creators[i % 2], updatedAt: updated, updatedBy: creators[(i + 1) % 2], rowVersion: 1,
      };
    });
    // Mouvements : ~70 sur 30 jours, dont plusieurs aujourd'hui
    const movements = [];
    const types = ['Entree', 'Sortie', 'Sortie', 'Entree', 'Ajustement', 'Sortie'];
    const notes = {
      Entree: ['Réception fournisseur', 'Livraison hebdomadaire', 'Retour chantier', ''],
      Sortie: ['Chantier Lille-Centre', 'Chantier Villeurbanne', 'Équipe maintenance', 'Prêt atelier', ''],
      Ajustement: ['Inventaire tournant', 'Casse constatée', 'Correction de saisie'],
    };
    const movers = ['admin@inventory.fr', 'admin@inventory.fr', 'julie.petit@inventory.fr'];
    let id = 1;
    for (let day = 29; day >= 0; day--) {
      const count = day === 0 ? 4 : (day % 7 === 6 || day % 7 === 5) ? 1 : 2 + Math.floor(rnd() * 2);
      for (let k = 0; k < count; k++) {
        const type = types[Math.floor(rnd() * types.length)];
        const prod = products[Math.floor(rnd() * products.length)];
        let qty = 1 + Math.floor(rnd() * (prod.price > 50 ? 3 : 20));
        if (type === 'Ajustement') qty = (rnd() < 0.5 ? -1 : 1) * (1 + Math.floor(rnd() * 4));
        const hour = 8 + Math.floor(rnd() * 9);
        const minute = Math.floor(rnd() * 60);
        const when = day === 0 ? daysAgo(0, Math.min(hour, Math.max(8, new Date().getHours())), minute) : daysAgo(day, hour, minute);
        movements.push({
          id: id++, productId: prod.id, warehouseId: 1 + Math.floor(rnd() * 2), type,
          quantity: qty, notes: notes[type][Math.floor(rnd() * notes[type].length)],
          createdAt: when, userEmail: movers[Math.floor(rnd() * movers.length)],
        });
      }
    }
    movements.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return { version: DATA_VERSION, categories, warehouses, users, products, movements, nextIds: { product: products.length + 1, movement: id, category: 6, warehouse: 3, user: 5 } };
  }

  let DB = null;
  function loadDB() {
    try {
      const raw = store.local.get(STORAGE_KEY);
      if (raw) { const parsed = JSON.parse(raw); if (parsed && parsed.version === DATA_VERSION) { DB = parsed; return; } }
    } catch (e) { /* données corrompues : on repart du jeu de démonstration */ }
    DB = buildSeed();
    saveDB();
  }
  function saveDB() { store.local.set(STORAGE_KEY, JSON.stringify(DB)); }
  function resetDB() { DB = buildSeed(); saveDB(); }

  // Accès typés
  const catName = (id) => (DB.categories.find(c => c.id === id) || {}).name || '—';
  const whName = (id) => (DB.warehouses.find(w => w.id === id) || {}).name || '—';
  const productById = (id) => DB.products.find(p => p.id === Number(id));
  const stockState = (p) => p.stock === 0 ? 'out' : p.stock <= p.lowStockThreshold ? 'low' : 'ok';
  const stockBadge = (p) => {
    const s = stockState(p);
    if (s === 'out') return `<span class="badge badge-out">${icon('alert-circle')}Rupture</span>`;
    if (s === 'low') return `<span class="badge badge-low">${icon('alert')}Sous seuil</span>`;
    return `<span class="badge badge-ok">${icon('check')}Normal</span>`;
  };
  const typeLabel = { Entree: 'Entrée', Sortie: 'Sortie', Ajustement: 'Ajustement' };
  const typeBadge = (t) => {
    if (t === 'Entree') return `<span class="badge badge-in">${icon('arrow-in')}Entrée</span>`;
    if (t === 'Sortie') return `<span class="badge badge-sortie">${icon('arrow-out')}Sortie</span>`;
    return `<span class="badge badge-adj">${icon('sliders')}Ajustement</span>`;
  };
  const signedQty = (m) => m.type === 'Entree' ? '+' + fmtInt(m.quantity) : m.type === 'Sortie' ? '−' + fmtInt(m.quantity) : (m.quantity >= 0 ? '+' : '−') + fmtInt(Math.abs(m.quantity));
  const qtyClass = (m) => m.type === 'Entree' ? 'in' : m.type === 'Sortie' ? 'out' : 'adj';
  const roleBadge = (u) => u.isActive === false
    ? `<span class="badge badge-inactive">Inactif</span>`
    : u.role === 'Admin' ? `<span class="badge badge-admin">${icon('shield')}Admin</span>` : `<span class="badge badge-user">User</span>`;

  /* ---------------------------------------------------------------------
     Session et rôles
     --------------------------------------------------------------------- */
  const session = {
    get user() { try { return JSON.parse(store.sess.get(SESSION_KEY)); } catch (e) { return null; } },
    set user(u) { if (u) store.sess.set(SESSION_KEY, JSON.stringify(u)); else store.sess.remove(SESSION_KEY); },
    get isAdmin() { const u = this.user; return !!u && u.role === 'Admin'; },
    expired: false,
    failedAttempts: 0,
    lockedUntil: 0,
  };
  const DEMO_PASSWORD = { Admin: 'Admin1234!', User: 'User1234!' };

  /* ---------------------------------------------------------------------
     Toasts
     --------------------------------------------------------------------- */
  function toast(kind, title, msg, action) {
    const root = $('#toasts');
    const el = document.createElement('div');
    el.className = `toast toast-${kind}`;
    el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    const iconName = kind === 'success' ? 'check-circle' : kind === 'error' ? 'alert-circle' : 'info';
    el.innerHTML = `${icon(iconName)}<div class="toast-text"><span class="toast-title">${esc(title)}</span>${msg ? `<span class="toast-msg">${esc(msg)}</span>` : ''}</div>
      ${action ? `<button type="button" class="btn-link toast-action">${esc(action.label)}</button>` : ''}
      <button type="button" class="toast-close" aria-label="Fermer la notification">${icon('x')}</button>`;
    root.appendChild(el);
    let done = false;
    const close = () => { if (done) return; done = true; el.classList.add('is-leaving'); setTimeout(() => el.remove(), 160); };
    const timer = setTimeout(close, action ? 8000 : 4500);
    $('.toast-close', el).addEventListener('click', () => { clearTimeout(timer); close(); });
    if (action) $('.toast-action', el).addEventListener('click', () => { clearTimeout(timer); action.onClick(); close(); });
  }

  /* ---------------------------------------------------------------------
     Surcouches : modale de confirmation et panneau latéral
     --------------------------------------------------------------------- */
  let lastFocus = null;
  function openOverlay(html, opts) {
    opts = opts || {};
    const root = $('#overlay-root');
    lastFocus = document.activeElement;
    root.innerHTML = `<div class="overlay ${opts.drawer ? 'drawer-overlay' : ''}" role="presentation">${html}</div>`;
    const ov = $('.overlay', root);
    requestAnimationFrame(() => requestAnimationFrame(() => ov.classList.add('is-open')));
    document.body.style.overflow = 'hidden';
    const dialog = $('[role="dialog"]', ov);
    const focusable = () => $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', dialog).filter(e => !e.disabled);
    setTimeout(() => { const f = $('[autofocus]', dialog) || focusable()[0]; if (f) f.focus(); }, 60);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeOverlay(); }
      if (e.key === 'Tab') {
        const f = focusable(); if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    ov.addEventListener('keydown', onKey);
    ov.addEventListener('mousedown', (e) => { if (e.target === ov && !opts.persistent) closeOverlay(); });
    $$('[data-close]', ov).forEach(b => b.addEventListener('click', closeOverlay));
    return ov;
  }
  function closeOverlay() {
    const ov = $('#overlay-root .overlay');
    if (!ov) return;
    ov.classList.remove('is-open'); ov.classList.add('is-closing');
    document.body.style.overflow = '';
    setTimeout(() => { ov.remove(); if (lastFocus && lastFocus.focus) lastFocus.focus(); }, 160);
  }
  function confirmDialog({ title, body, confirmLabel, danger, onConfirm }) {
    const ov = openOverlay(`
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
        <div class="modal-head">${danger ? `<span class="modal-icon danger">${icon('alert')}</span>` : ''}<h2 id="dlg-title">${esc(title)}</h2></div>
        <div class="modal-body">${body}</div>
        <div class="modal-foot">
          <button type="button" class="btn btn-secondary" data-close ${danger ? 'autofocus' : ''}>Annuler</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="dlg-confirm" ${danger ? '' : 'autofocus'}>${esc(confirmLabel || 'Confirmer')}</button>
        </div>
      </div>`);
    $('#dlg-confirm', ov).addEventListener('click', () => { closeOverlay(); onConfirm(); });
  }

  /* ---------------------------------------------------------------------
     Validation de formulaire (au blur, erreurs par champ + récapitulatif)
     --------------------------------------------------------------------- */
  function setFieldError(form, name, msg) {
    const field = $(`[data-field="${name}"]`, form); if (!field) return;
    const err = $('.field-error', field);
    const input = $('input, select, textarea', field);
    if (msg) {
      field.classList.add('has-error');
      err.innerHTML = `${icon('alert-circle')}<span>${esc(msg)}</span>`; err.hidden = false;
      if (input) { input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', err.id); }
    } else {
      field.classList.remove('has-error'); err.hidden = true; err.innerHTML = '';
      if (input) input.removeAttribute('aria-invalid');
    }
  }
  function fieldHtml({ name, label, type, value, required, hint, attrs, options, placeholder, cls, affix }) {
    const id = `f-${name}`;
    const errId = `${id}-err`;
    let control;
    if (type === 'select') {
      control = `<select class="select" id="${id}" name="${name}" ${attrs || ''}>${options.map(o => `<option value="${esc(o.value)}" ${String(o.value) === String(value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
    } else if (type === 'textarea') {
      control = `<textarea class="textarea" id="${id}" name="${name}" ${attrs || ''} placeholder="${esc(placeholder || '')}">${esc(value || '')}</textarea>`;
    } else {
      control = `<input class="input" id="${id}" name="${name}" type="${type || 'text'}" value="${esc(value == null ? '' : value)}" ${attrs || ''} placeholder="${esc(placeholder || '')}">`;
      if (affix) control = `<div class="input-affix">${control}<span class="affix">${esc(affix)}</span></div>`;
    }
    return `<div class="field ${cls || ''}" data-field="${name}">
      <label class="field-label" for="${id}">${esc(label)}${required ? '<span class="req" aria-hidden="true">*</span><span class="sr-only"> (obligatoire)</span>' : ''}</label>
      ${control}
      ${hint ? `<span class="field-hint">${esc(hint)}</span>` : ''}
      <span class="field-error" id="${errId}" hidden></span>
    </div>`;
  }

  /* ---------------------------------------------------------------------
     Soumission de formulaire robuste : un iframe sandboxé sans allow-forms
     bloque l'événement submit ; on écoute donc aussi le clic sur le bouton
     d'envoi et la touche Entrée dans les champs.
     --------------------------------------------------------------------- */
  function onSubmit(form, handler) {
    let last = 0;
    const run = (e) => { e.preventDefault(); const now = Date.now(); if (now - last < 50) return; last = now; handler(e); };
    form.addEventListener('submit', run);
    form.addEventListener('click', (e) => { const b = e.target.closest('button[type="submit"]'); if (b && form.contains(b)) run(e); });
    if (form.id) $$(`button[type="submit"][form="${form.id}"]`).forEach(b => b.addEventListener('click', run));
    form.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('input:not([type="checkbox"]):not([type="radio"])')) run(e); });
  }

  /* ---------------------------------------------------------------------
     Mutations métier
     --------------------------------------------------------------------- */
  function recordMovement({ productId, warehouseId, type, quantity, notes }) {
    const p = productById(productId);
    const delta = type === 'Entree' ? quantity : type === 'Sortie' ? -quantity : quantity;
    if (p.stock + delta < 0) return { error: 'Le stock résultant serait négatif.' };
    p.stock += delta; p.updatedAt = new Date().toISOString(); p.updatedBy = session.user.email; p.rowVersion += 1;
    const m = { id: DB.nextIds.movement++, productId: p.id, warehouseId, type, quantity, notes: notes || '', createdAt: new Date().toISOString(), userEmail: session.user.email };
    DB.movements.unshift(m); saveDB();
    return { movement: m, product: p };
  }
  function deleteProduct(id) {
    const idx = DB.products.findIndex(p => p.id === id); if (idx < 0) return null;
    const [p] = DB.products.splice(idx, 1);
    const moves = DB.movements.filter(m => m.productId === id);
    DB.movements = DB.movements.filter(m => m.productId !== id);
    saveDB();
    return { product: p, moves, index: idx };
  }
  function restoreProduct(snap) {
    DB.products.splice(Math.min(snap.index, DB.products.length), 0, snap.product);
    DB.movements = DB.movements.concat(snap.moves).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    saveDB();
  }

  // Exporte vers la partie 2
  window.__INV = { $, $$, esc, icon, fmtMoney, fmtInt, fmtCompactMoney, fmtDate, fmtDateTime, isoDay, sameDay, startOfDay, relTime, debounce, initials, plural,
    loadDB, saveDB, resetDB, get DB() { return DB; }, catName, whName, productById, stockState, stockBadge, typeLabel, typeBadge, signedQty, qtyClass, roleBadge,
    session, DEMO_PASSWORD, toast, openOverlay, closeOverlay, confirmDialog, setFieldError, fieldHtml, onSubmit, store, recordMovement, deleteProduct, restoreProduct };
})();

/* ==========================================================================
   Partie 2 : routeur, shell applicatif et vues
   ========================================================================== */
(function () {
  'use strict';
  const I = window.__INV;
  const { $, $$, esc, icon, fmtMoney, fmtInt, fmtCompactMoney, fmtDate, fmtDateTime, isoDay, sameDay, startOfDay, relTime, debounce, initials, plural,
    catName, whName, productById, stockState, stockBadge, typeLabel, typeBadge, signedQty, qtyClass, roleBadge,
    session, DEMO_PASSWORD, toast, openOverlay, closeOverlay, confirmDialog, setFieldError, fieldHtml, onSubmit, store, recordMovement, deleteProduct, restoreProduct } = I;
  const DB = () => I.DB;

  /* ---------------------------------------------------------------------
     Routeur par hash
     --------------------------------------------------------------------- */
  function parseHash() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [path, qs] = raw.split('?');
    const params = {};
    if (qs) new URLSearchParams(qs).forEach((v, k) => { params[k] = v; });
    return { path: path.replace(/\/+$/, '') || '/', params };
  }
  function buildHash(path, params) {
    const q = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => { if (v !== '' && v != null && v !== false) q.set(k, v); });
    const s = q.toString();
    return `#${path}${s ? '?' + s : ''}`;
  }
  function go(path, params) { location.hash = buildHash(path, params); }
  function rememberFocus() {
    const a = document.activeElement;
    pendingFocus = a && a.name && a.form ? { name: a.name, pos: typeof a.selectionStart === 'number' ? a.selectionStart : null } : null;
  }
  function restoreFocus(form) {
    if (!pendingFocus || !form || !form[pendingFocus.name]) return;
    const el = form[pendingFocus.name]; el.focus();
    if (pendingFocus.pos != null && el.setSelectionRange) { try { el.setSelectionRange(pendingFocus.pos, pendingFocus.pos); } catch (e) { /* type non textuel */ } }
    pendingFocus = null;
  }
  function setParams(params, replace) {
    const { path } = parseHash();
    const h = buildHash(path, params);
    if (!replace) { location.hash = h; return; }
    try { history.replaceState(null, '', h); } catch (e) { location.hash = h; return; }
    route();
  }

  const ROUTES = [
    { re: /^\/login$/, view: 'login', public: true },
    { re: /^\/inscription$/, view: 'register', public: true },
    { re: /^\/$/, view: 'dashboard', title: 'Tableau de bord' },
    { re: /^\/produits$/, view: 'products', title: 'Produits' },
    { re: /^\/produits\/nouveau$/, view: 'productForm', title: 'Nouveau produit', admin: true },
    { re: /^\/produits\/(\d+)$/, view: 'productDetail', title: 'Détail du produit' },
    { re: /^\/produits\/(\d+)\/modifier$/, view: 'productForm', title: 'Modifier le produit', admin: true },
    { re: /^\/mouvements$/, view: 'movements', title: 'Mouvements de stock' },
    { re: /^\/categories$/, view: 'categories', title: 'Catégories' },
    { re: /^\/entrepots$/, view: 'warehouses', title: 'Entrepôts' },
    { re: /^\/utilisateurs$/, view: 'users', title: 'Utilisateurs', admin: true },
    { re: /^\/403$/, view: 'forbidden', title: 'Accès refusé' },
  ];

  let currentView = null;
  let pendingFocus = null; // champ de filtre à re-focaliser après un re-rendu
  let shellRendered = false;
  let sidebarOpen = false;
  const scrollMemory = {};

  function route() {
    const { path, params } = parseHash();
    const user = session.user;
    let match = null, m = null;
    for (const r of ROUTES) { m = path.match(r.re); if (m) { match = r; break; } }
    if (!match) match = { view: 'notFound', title: 'Page introuvable' };

    if (match.public) {
      if (user) { go('/'); return; }
      shellRendered = false;
      renderAuthPage(match.view);
      currentView = match.view;
      return;
    }
    if (!user) { store.sess.set('inventory-proto-redirect', location.hash); location.hash = '#/login'; return; }
    if (match.admin && !session.isAdmin) { renderShell(); renderPage('forbidden', {}, [], 'Accès refusé'); return; }

    renderShell();
    renderPage(match.view, params, m ? m.slice(1) : [], match.title);
  }

  /* ---------------------------------------------------------------------
     Shell applicatif : barre latérale, en-tête, bandeau de session
     --------------------------------------------------------------------- */
  function renderShell() {
    if (shellRendered) { updateNav(); return; }
    const u = session.user;
    const app = $('#app');
    app.innerHTML = `
      <div class="app">
        <aside class="sidebar" id="sidebar" aria-label="Navigation principale">
          <div class="brand"><span class="brand-mark">${icon('package')}</span><span class="brand-name">Inventory</span></div>
          <nav class="nav" id="nav"></nav>
          <div class="sidebar-foot">Prototype · v0.1</div>
        </aside>
        <div class="scrim" id="scrim" hidden></div>
        <div class="main">
          <header class="topbar">
            <button type="button" class="btn btn-ghost btn-icon menu-btn" id="menu-btn" aria-label="Ouvrir la navigation" aria-controls="sidebar" aria-expanded="false">${icon('menu')}</button>
            <span class="topbar-title" id="topbar-title"></span>
            <div class="user-menu-wrap">
              <button type="button" class="user-btn" id="user-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="user-menu">
                <span class="user-chip"><span class="avatar" aria-hidden="true">${esc(initials(u.email))}</span>
                  <span class="user-meta"><span class="user-email od-truncate">${esc(u.email)}</span><span class="user-role">${u.role === 'Admin' ? 'Administrateur' : 'Utilisateur'}</span></span>
                </span>${icon('chevron-down')}
              </button>
              <div class="menu" id="user-menu" role="menu" hidden>
                <div class="menu-head">Connecté en tant que<br><strong>${esc(u.email)}</strong> · ${roleBadge(u)}</div>
                <div class="menu-sep"></div>
                <button type="button" class="menu-item" role="menuitem" id="menu-expire">${icon('history')}Simuler une session expirée</button>
                <button type="button" class="menu-item danger" role="menuitem" id="menu-logout">${icon('logout')}Déconnexion</button>
              </div>
            </div>
          </header>
          <div id="session-banner"></div>
          <main id="page-root" class="page" tabindex="-1"></main>
        </div>
      </div>`;
    shellRendered = true;
    updateNav();

    // Menu utilisateur
    const btn = $('#user-btn'), menu = $('#user-menu');
    const closeMenu = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', () => { const open = menu.hidden; menu.hidden = !open; btn.setAttribute('aria-expanded', String(open)); if (open) $('.menu-item', menu).focus(); });
    document.addEventListener('click', (e) => { if (!e.target.closest('.user-menu-wrap')) closeMenu(); });
    menu.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeMenu(); btn.focus(); } });
    $('#menu-logout').addEventListener('click', logout);
    $('#menu-expire').addEventListener('click', () => { closeMenu(); session.expired = true; renderSessionBanner(); toast('error', 'Session expirée', 'Le renouvellement du jeton a échoué.'); });

    // Navigation mobile
    const sidebar = $('#sidebar'), scrim = $('#scrim'), menuBtn = $('#menu-btn');
    const setSidebar = (open) => { sidebarOpen = open; sidebar.classList.toggle('is-open', open); scrim.hidden = !open; requestAnimationFrame(() => scrim.classList.toggle('is-open', open)); menuBtn.setAttribute('aria-expanded', String(open)); menuBtn.setAttribute('aria-label', open ? 'Fermer la navigation' : 'Ouvrir la navigation'); };
    menuBtn.addEventListener('click', () => setSidebar(!sidebarOpen));
    scrim.addEventListener('click', () => setSidebar(false));
    sidebar.addEventListener('click', (e) => { if (e.target.closest('.nav-link')) setSidebar(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sidebarOpen) setSidebar(false); });
    renderSessionBanner();
  }

  function updateNav() {
    const { path } = parseHash();
    const low = DB().products.filter(p => stockState(p) !== 'ok').length;
    const items = [
      { href: '#/', label: 'Tableau de bord', icon: 'dashboard', active: path === '/' },
      { href: '#/produits', label: 'Produits', icon: 'package', active: path.startsWith('/produits'), count: low },
      { href: '#/mouvements', label: 'Mouvements', icon: 'moves', active: path.startsWith('/mouvements') },
      { href: '#/categories', label: 'Catégories', icon: 'tag', active: path.startsWith('/categories') },
      { href: '#/entrepots', label: 'Entrepôts', icon: 'warehouse', active: path.startsWith('/entrepots') },
    ];
    const admin = session.isAdmin ? [{ href: '#/utilisateurs', label: 'Utilisateurs', icon: 'users', active: path.startsWith('/utilisateurs') }] : [];
    const link = (it) => `<a class="nav-link" href="${it.href}" ${it.active ? 'aria-current="page"' : ''} title="${esc(it.label)}">${icon(it.icon)}<span class="nav-label">${esc(it.label)}</span>${it.count ? `<span class="nav-count" aria-label="${it.count} produits à surveiller">${it.count}</span>` : ''}</a>`;
    $('#nav').innerHTML = `<span class="nav-section">Gestion</span>${items.map(link).join('')}${admin.length ? `<span class="nav-section">Administration</span>${admin.map(link).join('')}` : ''}`;
  }

  function renderSessionBanner() {
    const root = $('#session-banner'); if (!root) return;
    root.innerHTML = session.expired ? `<div class="banner banner-warning session-banner" role="alert">${icon('alert')}<span class="banner-text"><strong>Session expirée.</strong> Reconnectez-vous pour continuer : les actions d’écriture sont suspendues.</span><button type="button" class="btn btn-sm btn-secondary" id="banner-login">Se reconnecter</button></div>` : '';
    const b = $('#banner-login'); if (b) b.addEventListener('click', logout);
  }

  function logout() { session.user = null; session.expired = false; shellRendered = false; closeOverlay(); location.hash = '#/login'; }

  /* ---------------------------------------------------------------------
     Rendu d'une page avec skeleton au changement de vue
     --------------------------------------------------------------------- */
  const VIEWS = {};
  function renderPage(view, params, args, title) {
    const root = $('#page-root');
    $('#topbar-title').textContent = title || '';
    document.title = `${title ? title + ' — ' : ''}Inventory`;
    const key = view + (args[0] || '');
    const changed = currentView !== key;
    currentView = key;
    const paint = () => {
      root.innerHTML = VIEWS[view].render(params, args);
      if (VIEWS[view].mount) VIEWS[view].mount(root, params, args);
      const remembered = scrollMemory[location.hash];
      window.scrollTo(0, changed ? (remembered || 0) : window.scrollY);
    };
    if (changed) { root.innerHTML = VIEWS[view].skeleton ? VIEWS[view].skeleton() : skeletonGeneric(); setTimeout(paint, 320); }
    else paint();
  }
  window.addEventListener('scroll', debounce(() => { scrollMemory[location.hash] = window.scrollY; }, 100));
  const skeletonGeneric = () => `<div class="od-stack" style="--od-gap:24px" aria-busy="true" aria-label="Chargement">
      <div class="od-stack" style="--od-gap:8px"><span class="skeleton sk-line w-30" style="height:24px"></span><span class="skeleton sk-line w-50"></span></div>
      <div class="card"><div class="sk-row"><span class="skeleton sk-line w-30"></span><span class="skeleton sk-line w-50"></span></div>${'<div class="sk-row"><span class="skeleton sk-line w-50"></span><span class="skeleton sk-line w-30"></span><span class="skeleton sk-line w-30"></span></div>'.repeat(8)}</div></div>`;
  const skeletonTable = (rows) => `<div class="card" aria-busy="true"><div class="sk-row" style="padding:16px 20px"><span class="skeleton sk-line w-30" style="height:36px"></span><span class="skeleton sk-line w-30" style="height:36px"></span></div>${'<div class="sk-row"><span class="skeleton sk-line w-50"></span><span class="skeleton sk-line w-30"></span><span class="skeleton sk-line w-30"></span><span class="skeleton sk-line w-30"></span></div>'.repeat(rows || 10)}</div>`;

  /* ---------------------------------------------------------------------
     Composants partagés : en-tête de page, pagination, état vide
     --------------------------------------------------------------------- */
  const pageHead = (title, lede, actions, crumbs) => `<div class="page-head">
      <div class="od-stack">${crumbs ? `<nav class="breadcrumb" aria-label="Fil d’Ariane">${crumbs}</nav>` : ''}<h1>${esc(title)}</h1>${lede ? `<p class="lede">${lede}</p>` : ''}</div>
      ${actions ? `<div class="page-actions">${actions}</div>` : ''}</div>`;
  const crumb = (href, label) => `<a href="${href}">${esc(label)}</a>${icon('chevron-right')}`;

  function paginate(items, page, size) {
    const total = items.length, pages = Math.max(1, Math.ceil(total / size));
    page = Math.min(Math.max(1, page), pages);
    return { items: items.slice((page - 1) * size, page * size), page, pages, total, size, from: total ? (page - 1) * size + 1 : 0, to: Math.min(page * size, total) };
  }
  function paginationHtml(pg, { sizes, noun } = {}) {
    const btn = (p, label, cur, dis) => `<button type="button" class="pg-btn" data-page="${p}" ${cur ? 'aria-current="page"' : ''} ${dis ? 'disabled' : ''} ${typeof label === 'string' && label.length > 2 ? '' : `aria-label="Page ${p}"`}>${label}</button>`;
    const seq = []; const { page, pages } = pg;
    const push = (p) => { if (!seq.includes(p) && p >= 1 && p <= pages) seq.push(p); };
    push(1); push(2); push(page - 1); push(page); push(page + 1); push(pages - 1); push(pages);
    seq.sort((a, b) => a - b);
    let out = '';
    seq.forEach((p, i) => { if (i && p - seq[i - 1] > 1) out += `<span class="pg-ellipsis" aria-hidden="true">…</span>`; out += btn(p, String(p), p === page); });
    return `<nav class="pagination" aria-label="Pagination">
      <span class="pg-total">${pg.total ? `${pg.from}–${pg.to} sur ${fmtInt(pg.total)} ${esc(plural(pg.total, noun || 'élément'))}` : 'Aucun résultat'}</span>
      ${sizes ? `<label class="pg-size"><span class="small muted">Par page</span><select class="select" data-size aria-label="Éléments par page">${sizes.map(s => `<option value="${s}" ${s === pg.size ? 'selected' : ''}>${s}</option>`).join('')}</select></label>` : ''}
      <div class="pg-pages">
        <button type="button" class="pg-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="Page précédente">${icon('chevron-left')}</button>
        ${out}
        <button type="button" class="pg-btn" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''} aria-label="Page suivante">${icon('chevron-right')}</button>
      </div></nav>`;
  }
  const emptyState = (iconName, title, text, actions) => `<div class="empty"><span class="empty-icon">${icon(iconName)}</span><h3>${esc(title)}</h3><p>${text}</p>${actions ? `<div class="empty-actions">${actions}</div>` : ''}</div>`;
  const sortBtn = (key, label, sort, dir, cls) => `<th class="${cls || ''}" scope="col"><button type="button" class="th-sort" data-sort="${key}" aria-sort="${sort === key ? (dir === 'desc' ? 'descending' : 'ascending') : 'none'}">${esc(label)}${icon('arrow-up')}</button></th>`;

  /* ---------------------------------------------------------------------
     Pages d'authentification
     --------------------------------------------------------------------- */
  function renderAuthPage(view) {
    const app = $('#app');
    const side = `<aside class="auth-side">
        <div class="brand"><span class="brand-mark">${icon('package')}</span><span class="brand-name">Inventory</span></div>
        <div><h1>Le stock de l’atelier, à jour et sous contrôle.</h1>
          <p>Produits, seuils d’alerte, entrées et sorties par entrepôt : une seule application pour toute l’équipe.</p>
          <ul><li>${icon('check-circle')}Tableau de bord des stocks sous seuil</li><li>${icon('check-circle')}Journal des mouvements horodaté</li><li>${icon('check-circle')}Rôles User et Admin</li></ul></div>
        <span class="side-foot">Application interne · API ASP.NET Core</span></aside>`;
    if (view === 'login') {
      app.innerHTML = `<div class="auth">${side}<div class="auth-main"><div class="auth-card">
        <div><h2>Connexion</h2><p class="lede">Accédez à votre espace de gestion d’inventaire.</p></div>
        <div id="login-error" hidden></div>
        <form id="login-form" novalidate>
          ${fieldHtml({ name: 'email', label: 'Adresse e-mail', type: 'email', required: true, attrs: 'autocomplete="username" autofocus', placeholder: 'prenom.nom@inventory.fr' })}
          <div class="field" data-field="password"><label class="field-label" for="f-password">Mot de passe<span class="req" aria-hidden="true">*</span></label>
            <div class="input-affix"><input class="input" id="f-password" name="password" type="password" autocomplete="current-password"><button type="button" class="affix-btn" id="pw-toggle" aria-label="Afficher le mot de passe" aria-pressed="false">${icon('eye')}</button></div>
            <span class="field-error" id="f-password-err" hidden></span></div>
          <button type="submit" class="btn btn-primary btn-lg btn-block" id="login-btn">Se connecter</button>
        </form>
        <p class="auth-foot">Pas encore de compte ? <a href="#/inscription">Créer un compte</a></p>
        <div class="demo-accounts"><span class="demo-title">Comptes de démonstration</span>
          <span class="demo-row"><span class="badge badge-admin">Admin</span><code>admin@inventory.fr</code><code>${DEMO_PASSWORD.Admin}</code><button type="button" class="btn btn-secondary btn-sm" data-fill="admin@inventory.fr">Remplir</button></span>
          <span class="demo-row"><span class="badge badge-user">User</span><code>claire.martin@inventory.fr</code><code>${DEMO_PASSWORD.User}</code><button type="button" class="btn btn-secondary btn-sm" data-fill="claire.martin@inventory.fr">Remplir</button></span>
          <span><button type="button" class="btn-link" id="reset-data">Réinitialiser les données de démonstration</button></span></div>
      </div></div></div>`;
      mountLogin();
    } else {
      app.innerHTML = `<div class="auth">${side}<div class="auth-main"><div class="auth-card">
        <div><h2>Créer un compte</h2><p class="lede">Un nouveau compte reçoit le rôle User. Un administrateur pourra l’élever ensuite.</p></div>
        <div id="reg-summary" hidden></div>
        <form id="reg-form" novalidate>
          ${fieldHtml({ name: 'username', label: 'Nom d’utilisateur', required: true, attrs: 'autocomplete="username" autofocus maxlength="50"' })}
          ${fieldHtml({ name: 'email', label: 'Adresse e-mail', type: 'email', required: true, attrs: 'autocomplete="email"' })}
          <div class="field" data-field="password"><label class="field-label" for="f-password">Mot de passe<span class="req" aria-hidden="true">*</span></label>
            <div class="input-affix"><input class="input" id="f-password" name="password" type="password" autocomplete="new-password" aria-describedby="pw-hint"><button type="button" class="affix-btn" id="pw-toggle" aria-label="Afficher le mot de passe" aria-pressed="false">${icon('eye')}</button></div>
            <span class="pw-strength" id="pw-strength" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
            <span class="field-hint" id="pw-hint">8 caractères minimum.</span><span class="field-error" id="f-password-err" hidden></span></div>
          ${fieldHtml({ name: 'confirm', label: 'Confirmation du mot de passe', type: 'password', required: true, attrs: 'autocomplete="new-password"' })}
          <button type="submit" class="btn btn-primary btn-lg btn-block" id="reg-btn">Créer le compte</button>
        </form>
        <p class="auth-foot">Déjà un compte ? <a href="#/login">Se connecter</a></p>
      </div></div></div>`;
      mountRegister();
    }
  }
  function mountPwToggle(form) {
    const t = $('#pw-toggle', form.parentElement || document), inp = $('#f-password');
    t.addEventListener('click', () => { const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; t.setAttribute('aria-pressed', String(show)); t.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'); t.innerHTML = icon(show ? 'eye-off' : 'eye'); });
  }
  function mountLogin() {
    const form = $('#login-form'), errBox = $('#login-error'), btn = $('#login-btn');
    mountPwToggle(form);
    $$('[data-fill]').forEach(b => b.addEventListener('click', () => { const u = DB().users.find(x => x.email === b.dataset.fill); form.email.value = u.email; form.password.value = DEMO_PASSWORD[u.role]; form.password.focus(); }));
    $('#reset-data').addEventListener('click', () => { I.resetDB(); toast('success', 'Données réinitialisées', 'Le jeu de démonstration a été restauré.'); });
    const showErr = (html) => { errBox.innerHTML = `<div class="form-error" role="alert">${icon('alert-circle')}<span>${html}</span></div>`; errBox.hidden = false; };
    form.email.addEventListener('blur', () => validateEmail(form));
    onSubmit(form, (e) => {
      e.preventDefault(); errBox.hidden = true;
      const okEmail = validateEmail(form);
      const pw = form.password.value;
      setFieldError(form, 'password', pw ? '' : 'Saisissez votre mot de passe.');
      if (!okEmail || !pw) return;
      const lockMsg = () => `<strong>Trop de tentatives (429).</strong> Réessayez dans ${Math.max(1, Math.ceil((session.lockedUntil - Date.now()) / 1000))} s.`;
      if (session.lockedUntil && Date.now() < session.lockedUntil) { showErr(lockMsg()); return; }
      btn.classList.add('is-loading'); btn.setAttribute('aria-busy', 'true');
      setTimeout(() => {
        btn.classList.remove('is-loading'); btn.removeAttribute('aria-busy');
        const u = DB().users.find(x => x.email.toLowerCase() === form.email.value.trim().toLowerCase());
        if (!u || pw !== DEMO_PASSWORD[u.role]) {
          session.failedAttempts += 1;
          if (session.failedAttempts >= 5) { session.failedAttempts = 0; session.lockedUntil = Date.now() + 60000; showErr(lockMsg()); return; }
          const left = 5 - session.failedAttempts;
          showErr(`Email ou mot de passe incorrect.${left <= 2 ? ` Il vous reste ${left} ${plural(left, 'tentative')}.` : ''} Pour tester, utilisez un compte de démonstration ci-dessous.`);
          return;
        }
        if (!u.isActive) { showErr('Ce compte est désactivé. Contactez un administrateur.'); return; }
        session.failedAttempts = 0;
        session.user = { id: u.id, email: u.email, role: u.role };
        const redirect = store.sess.get('inventory-proto-redirect'); store.sess.remove('inventory-proto-redirect');
        location.hash = redirect && redirect !== '#/login' ? redirect : '#/';
        setTimeout(() => toast('success', 'Bienvenue', `Connecté en tant que ${u.email}.`), 400);
      }, 700);
    });
  }
  function validateEmail(form) {
    const v = form.email.value.trim();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    setFieldError(form, 'email', !v ? 'Saisissez votre adresse e-mail.' : !ok ? 'Le format de l’adresse n’est pas valide (ex. prenom.nom@inventory.fr).' : '');
    return ok;
  }
  function mountRegister() {
    const form = $('#reg-form'), summary = $('#reg-summary');
    mountPwToggle(form);
    const strength = $('#pw-strength');
    form.password.addEventListener('input', () => { const v = form.password.value; const s = (v.length >= 8) + /[A-Z]/.test(v) + /\d/.test(v) + /[^\w]/.test(v); $$('i', strength).forEach((b, i) => b.classList.toggle('on', i < s)); });
    const rules = {
      username: () => form.username.value.trim().length < 3 ? 'Le nom d’utilisateur doit contenir au moins 3 caractères.' : '',
      email: () => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.value.trim()) ? 'Le format de l’adresse n’est pas valide.' : DB().users.some(u => u.email === form.email.value.trim().toLowerCase()) ? 'Cette adresse est déjà utilisée. Connectez-vous ou utilisez une autre adresse.' : '',
      password: () => form.password.value.length < 8 ? 'Le mot de passe doit contenir au moins 8 caractères.' : '',
      confirm: () => form.confirm.value !== form.password.value ? 'Les deux mots de passe ne correspondent pas.' : '',
    };
    Object.keys(rules).forEach(k => form[k].addEventListener('blur', () => setFieldError(form, k, rules[k]())));
    onSubmit(form, (e) => {
      e.preventDefault();
      const errors = Object.keys(rules).map(k => [k, rules[k]()]).filter(x => x[1]);
      Object.keys(rules).forEach(k => setFieldError(form, k, (errors.find(x => x[0] === k) || [])[1] || ''));
      if (errors.length) { summary.innerHTML = `<div class="form-summary" role="alert"><strong>${errors.length} ${plural(errors.length, 'champ')} à corriger :</strong><ul>${errors.map(x => `<li><a href="#f-${x[0]}">${esc(x[1])}</a></li>`).join('')}</ul></div>`; summary.hidden = false; $$('a', summary).forEach(a => a.addEventListener('click', (ev) => { ev.preventDefault(); $(a.getAttribute('href')).focus(); })); return; }
      summary.hidden = true;
      const btn = $('#reg-btn'); btn.classList.add('is-loading');
      setTimeout(() => {
        const u = { id: DB().nextIds.user++, email: form.email.value.trim().toLowerCase(), username: form.username.value.trim(), role: 'User', isActive: true, createdAt: new Date().toISOString() };
        DB().users.push(u); I.saveDB();
        // Les comptes créés utilisent le mot de passe de démonstration User pour rester connectables
        session.user = { id: u.id, email: u.email, role: 'User' };
        location.hash = '#/';
        setTimeout(() => toast('success', 'Compte créé', `Bienvenue ${u.username}. Vous avez le rôle User.`), 400);
      }, 700);
    });
  }

  /* ---------------------------------------------------------------------
     Tableau de bord (page centrale)
     --------------------------------------------------------------------- */
  VIEWS.dashboard = {
    skeleton: () => `<div class="od-stack" style="--od-gap:24px" aria-busy="true" aria-label="Chargement du tableau de bord"><div class="od-stack" style="--od-gap:8px"><span class="skeleton sk-line w-30" style="height:28px"></span><span class="skeleton sk-line w-50"></span></div><div class="tiles">${'<span class="skeleton sk-tile"></span>'.repeat(4)}</div><div class="dash-grid"><span class="skeleton sk-block" style="height:320px;border-radius:8px"></span><span class="skeleton sk-block" style="height:320px;border-radius:8px"></span></div></div>`,
    render() {
      const db = DB(); const now = new Date();
      const productCount = db.products.length;
      const totalValue = db.products.reduce((s, p) => s + p.price * p.stock, 0);
      const lowList = db.products.filter(p => stockState(p) !== 'ok').sort((a, b) => (a.stock / Math.max(1, a.lowStockThreshold)) - (b.stock / Math.max(1, b.lowStockThreshold)));
      const outCount = db.products.filter(p => p.stock === 0).length;
      const today = db.movements.filter(m => sameDay(m.createdAt, now));
      const yesterday = db.movements.filter(m => sameDay(m.createdAt, new Date(now.getTime() - 864e5)));
      const todayIn = today.filter(m => m.type === 'Entree').length, todayOut = today.filter(m => m.type === 'Sortie').length;
      const recent = db.movements.slice(0, 8);
      const u = session.user;
      const hour = now.getHours();
      const greet = hour < 18 ? 'Bonjour' : 'Bonsoir';
      const dayLabel = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

      return `${pageHead('Tableau de bord', `${greet} ${esc(u.email.split('@')[0].split('.')[0].replace(/^\w/, c => c.toUpperCase()))}, voici l’état du stock ce ${esc(dayLabel)}.`,
          session.isAdmin ? `<button type="button" class="btn btn-secondary" id="dash-new-product">${icon('plus')}Produit</button><button type="button" class="btn btn-primary" id="dash-new-move">${icon('moves')}Nouveau mouvement</button>` : `<a class="btn btn-secondary" href="#/mouvements">${icon('history')}Journal des mouvements</a>`)}
        <section class="tiles" aria-label="Indicateurs clés">
          <a class="card tile" href="#/produits"><span class="tile-label">${icon('package')}Produits référencés</span><span class="tile-value">${fmtInt(productCount)}</span><span class="tile-delta">${db.categories.length} catégories · ${db.warehouses.length} entrepôts</span><span class="tile-cta">${icon('arrow-right')}</span></a>
          <div class="card tile"><span class="tile-label">${icon('euro')}Valeur totale du stock</span><span class="tile-value">${esc(fmtCompactMoney(totalValue))}</span><span class="tile-delta">${esc(fmtMoney(totalValue))} au prix d’achat</span></div>
          <a class="card tile ${lowList.length ? 'is-alert' : ''}" href="#/produits?low=1"><span class="tile-label">${icon('alert')}Produits sous seuil</span><span class="tile-value">${fmtInt(lowList.length)}</span><span class="tile-delta ${outCount ? 'bad' : ''}">${outCount ? `${icon('alert-circle')}dont ${outCount} en rupture` : 'Aucune rupture'}</span><span class="tile-cta">${icon('arrow-right')}</span></a>
          <a class="card tile" href="#/mouvements?du=${isoDay(now)}&au=${isoDay(now)}"><span class="tile-label">${icon('moves')}Mouvements du jour</span><span class="tile-value">${fmtInt(today.length)}</span><span class="tile-delta ${today.length >= yesterday.length ? 'up' : 'down'}">${icon(today.length >= yesterday.length ? 'arrow-up' : 'arrow-up')}${todayIn} ${plural(todayIn, 'entrée')} · ${todayOut} ${plural(todayOut, 'sortie')} · hier : ${yesterday.length}</span><span class="tile-cta">${icon('arrow-right')}</span></a>
        </section>
        <div class="dash-grid">
          <section class="card" aria-labelledby="chart-title">
            <div class="card-head"><div class="od-stack" style="--od-gap:2px"><h2 id="chart-title">Entrées et sorties sur 7 jours</h2><span class="small muted">Nombre de mouvements par jour, tous entrepôts</span></div>
              <div class="chart-legend" aria-label="Légende"><span><i class="k-in"></i>Entrées</span><span><i class="k-out"></i>Sorties</span></div></div>
            <div class="card-body"><div class="chart" id="chart">${renderChart()}</div>
              <details class="chart-details"><summary>${icon('chevron-down')}Voir les valeurs en tableau</summary>${chartTable()}</details></div>
          </section>
          <section class="card" aria-labelledby="low-title">
            <div class="card-head"><h2 id="low-title">Produits sous seuil</h2><a class="btn btn-ghost btn-sm" href="#/produits?low=1">Voir tout${icon('arrow-right')}</a></div>
            ${lowList.length ? `<ul class="mini-list">${lowList.slice(0, 5).map(p => `<li>
                <span class="mv-meta"><a class="mv-title od-truncate" href="#/produits/${p.id}">${esc(p.name)}</a><span class="mv-sub">${esc(catName(p.categoryId))} · seuil ${fmtInt(p.lowStockThreshold)}</span><span class="stock-meter" aria-hidden="true"><i class="${p.stock === 0 ? 'out' : ''}" style="width:${Math.min(100, Math.round(p.stock / Math.max(1, p.lowStockThreshold) * 100))}%"></i></span></span>
                <span class="od-stat" style="text-align:right"><span class="mv-qty ${p.stock === 0 ? 'out' : ''}">${fmtInt(p.stock)}</span><span class="small muted">${p.stock === 0 ? 'rupture' : 'en stock'}</span></span>
              </li>`).join('')}</ul>`
              : emptyState('check-circle', 'Tous les stocks sont au-dessus du seuil', 'Aucun produit ne nécessite de réapprovisionnement.')}
          </section>
        </div>
        <section class="card" aria-labelledby="recent-title">
          <div class="card-head"><h2 id="recent-title">Derniers mouvements</h2><a class="btn btn-ghost btn-sm" href="#/mouvements">Journal complet${icon('arrow-right')}</a></div>
          <div class="table-wrap"><table class="table"><thead><tr><th scope="col">Date</th><th scope="col">Produit</th><th scope="col">Type</th><th scope="col" class="num">Quantité</th><th scope="col">Entrepôt</th><th scope="col">Utilisateur</th></tr></thead>
            <tbody>${recent.map(m => { const p = productById(m.productId); return `<tr><td class="od-nowrap"><span class="cell-stack"><span>${esc(fmtDateTime(m.createdAt))}</span><span class="cell-sub">${esc(relTime(m.createdAt))}</span></span></td><td>${p ? `<a class="cell-primary" href="#/produits/${p.id}">${esc(p.name)}</a>` : '<span class="muted">Produit supprimé</span>'}</td><td>${typeBadge(m.type)}</td><td class="num"><strong class="text-${qtyClass(m) === 'in' ? 'success' : qtyClass(m) === 'out' ? 'warning' : ''}">${signedQty(m)}</strong></td><td>${esc(whName(m.warehouseId))}</td><td class="small">${esc(m.userEmail)}</td></tr>`; }).join('')}</tbody></table></div>
        </section>`;
    },
    mount(root) {
      const np = $('#dash-new-product'); if (np) np.addEventListener('click', () => go('/produits/nouveau'));
      const nm = $('#dash-new-move'); if (nm) nm.addEventListener('click', () => openMovementDrawer());
      mountChart($('#chart', root));
    },
  };

  // Séries du graphique : 7 derniers jours, nombre d'entrées / sorties
  function chartSeries() {
    const days = [];
    for (let i = 6; i >= 0; i--) { const d = startOfDay(new Date()); d.setDate(d.getDate() - i); days.push({ date: d, key: isoDay(d), in: 0, out: 0 }); }
    DB().movements.forEach(m => { const k = isoDay(m.createdAt); const d = days.find(x => x.key === k); if (!d) return; if (m.type === 'Entree') d.in++; else if (m.type === 'Sortie') d.out++; });
    return days;
  }
  function renderChart() {
    const days = chartSeries();
    const W = 640, H = 220, padL = 28, padR = 8, padT = 12, padB = 28;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const max = Math.max(4, ...days.map(d => Math.max(d.in, d.out)));
    const yMax = Math.ceil(max / 2) * 2;
    const slotW = innerW / 7, barW = Math.min(24, (slotW - 16) / 2), gap = 2;
    const y = (v) => padT + innerH - (v / yMax) * innerH;
    const ticks = []; for (let v = 0; v <= yMax; v += yMax / 4) ticks.push(v);
    const dayName = (d) => d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
    const bar = (x, v, cls) => { if (!v) return ''; const h = y(0) - y(v); const r = Math.min(4, h); return `<path class="bar ${cls}" d="M${x} ${y(0)} v${-(h - r)} a${r} ${r} 0 0 1 ${r} ${-r} h${barW - 2 * r} a${r} ${r} 0 0 1 ${r} ${r} v${h - r} z"/>`; };
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="chart-title">
      <g class="grid">${ticks.map(v => `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}"/>`).join('')}</g>
      <g class="axis">${ticks.map(v => `<text x="${padL - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
        ${days.map((d, i) => `<text x="${padL + slotW * i + slotW / 2}" y="${H - 8}" text-anchor="middle">${esc(dayName(d.date))} ${d.date.getDate()}</text>`).join('')}</g>
      ${days.map((d, i) => { const x0 = padL + slotW * i + slotW / 2 - barW - gap / 2; return `<g class="slot" tabindex="0" data-i="${i}" aria-label="${esc(d.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))} : ${d.in} ${plural(d.in, 'entrée')}, ${d.out} ${plural(d.out, 'sortie')}">
          <rect class="hit" x="${padL + slotW * i}" y="${padT}" width="${slotW}" height="${innerH}"/>
          <rect class="focus-ring" x="${padL + slotW * i + 4}" y="${padT}" width="${slotW - 8}" height="${innerH}" rx="4"/>
          ${bar(x0, d.in, 'in')}${bar(x0 + barW + gap, d.out, 'out')}</g>`; }).join('')}
    </svg><div class="chart-tip" id="chart-tip" role="tooltip" aria-hidden="true"></div>`;
  }
  function chartTable() {
    const days = chartSeries();
    return `<div class="table-wrap"><table class="table chart-table"><caption class="sr-only">Entrées et sorties par jour</caption><thead><tr><th scope="col">Jour</th><th scope="col" class="num">Entrées</th><th scope="col" class="num">Sorties</th></tr></thead><tbody>${days.map(d => `<tr><td>${esc(fmtDate(d.date))}</td><td class="num">${d.in}</td><td class="num">${d.out}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function mountChart(chart) {
    if (!chart) return;
    const tip = $('#chart-tip', chart); const days = chartSeries();
    const show = (slot) => {
      const i = Number(slot.dataset.i); const d = days[i];
      tip.innerHTML = `<span class="tip-date">${esc(d.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))}</span><span class="tip-row"><i class="key in"></i>Entrées<b>${d.in}</b></span><span class="tip-row"><i class="key out"></i>Sorties<b>${d.out}</b></span>`;
      const r = slot.getBoundingClientRect(), cr = chart.getBoundingClientRect();
      const right = i < 4;
      tip.style.left = `${right ? r.right - cr.left + 4 : r.left - cr.left - 4}px`; tip.style.top = '4px';
      tip.style.transform = right ? 'none' : 'translateX(-100%)';
      tip.classList.add('is-visible'); tip.setAttribute('aria-hidden', 'false');
    };
    const hide = () => { tip.classList.remove('is-visible'); tip.setAttribute('aria-hidden', 'true'); };
    $$('.slot', chart).forEach(s => { s.addEventListener('pointerenter', () => show(s)); s.addEventListener('pointerleave', hide); s.addEventListener('focus', () => show(s)); s.addEventListener('blur', hide); });
  }

  /* ---------------------------------------------------------------------
     Liste des produits
     --------------------------------------------------------------------- */
  function productQuery(params) {
    const q = { search: params.search || '', cat: params.cat || '', min: params.min || '', max: params.max || '', low: params.low === '1', sort: params.sort || 'name', dir: params.dir || 'asc', page: Number(params.page) || 1, size: [10, 25, 50, 100].includes(Number(params.size)) ? Number(params.size) : 10 };
    let list = DB().products.slice();
    if (q.search) { const s = q.search.toLowerCase(); list = list.filter(p => p.name.toLowerCase().includes(s)); }
    if (q.cat) list = list.filter(p => p.categoryId === Number(q.cat));
    if (q.min !== '') list = list.filter(p => p.price >= Number(q.min));
    if (q.max !== '') list = list.filter(p => p.price <= Number(q.max));
    if (q.low) list = list.filter(p => stockState(p) !== 'ok');
    const dirv = q.dir === 'desc' ? -1 : 1;
    const keyFn = { name: p => p.name.toLowerCase(), category: p => catName(p.categoryId).toLowerCase(), price: p => p.price, stock: p => p.stock, updatedAt: p => p.updatedAt }[q.sort] || (p => p.name.toLowerCase());
    list.sort((a, b) => { const ka = keyFn(a), kb = keyFn(b); return (ka < kb ? -1 : ka > kb ? 1 : 0) * dirv; });
    return { q, list };
  }
  VIEWS.products = {
    skeleton: () => `<div class="od-stack" style="--od-gap:24px"><div class="od-stack" style="--od-gap:8px"><span class="skeleton sk-line w-30" style="height:28px"></span><span class="skeleton sk-line w-50"></span></div>${skeletonTable(10)}</div>`,
    render(params) {
      const { q, list } = productQuery(params);
      const pg = paginate(list, q.page, q.size);
      const admin = session.isAdmin;
      const active = [];
      if (q.search) active.push({ k: 'search', label: `Recherche : « ${q.search} »` });
      if (q.cat) active.push({ k: 'cat', label: `Catégorie : ${catName(Number(q.cat))}` });
      if (q.min !== '' || q.max !== '') active.push({ k: 'price', label: `Prix : ${q.min !== '' ? fmtMoney(q.min) : '0 €'} – ${q.max !== '' ? fmtMoney(q.max) : '∞'}` });
      if (q.low) active.push({ k: 'low', label: 'Stock bas uniquement' });
      const rows = pg.items.map(p => `<tr>
          <td><span class="cell-stack"><a class="cell-primary" href="#/produits/${p.id}">${esc(p.name)}</a><span class="cell-sub">Réf. ${String(p.id).padStart(4, '0')}</span></span></td>
          <td>${esc(catName(p.categoryId))}</td>
          <td class="num">${esc(fmtMoney(p.price))}</td>
          <td class="num"><span class="od-row" style="justify-content:flex-end;--od-gap:8px"><strong>${fmtInt(p.stock)}</strong>${stockState(p) !== 'ok' ? stockBadge(p) : ''}</span></td>
          <td class="od-nowrap"><span class="cell-stack"><span>${esc(fmtDateTime(p.updatedAt))}</span><span class="cell-sub">${esc(p.updatedBy)}</span></span></td>
          <td><div class="row-actions">
            <a class="btn btn-ghost btn-icon btn-sm" href="#/produits/${p.id}" aria-label="Voir ${esc(p.name)}" title="Voir">${icon('eye')}</a>
            ${admin ? `<a class="btn btn-ghost btn-icon btn-sm" href="#/produits/${p.id}/modifier" aria-label="Modifier ${esc(p.name)}" title="Modifier">${icon('pencil')}</a>
            <button type="button" class="btn btn-ghost btn-icon btn-sm danger" data-delete="${p.id}" aria-label="Supprimer ${esc(p.name)}" title="Supprimer">${icon('trash')}</button>` : ''}
          </div></td></tr>`).join('');
      return `${pageHead('Produits', `${fmtInt(DB().products.length)} produits référencés · ${DB().products.filter(p => stockState(p) !== 'ok').length} à surveiller`, admin ? `<a class="btn btn-primary" href="#/produits/nouveau">${icon('plus')}Ajouter un produit</a>` : '')}
        <section class="card">
          <form class="toolbar" id="filters" role="search" aria-label="Filtrer les produits">
            <div class="field f-search"><label class="field-label" for="f-search">Recherche</label><div class="input-search">${icon('search')}<input class="input" id="f-search" name="search" type="search" value="${esc(q.search)}" placeholder="Nom du produit"></div></div>
            <div class="field f-cat"><label class="field-label" for="f-cat">Catégorie</label><select class="select" id="f-cat" name="cat"><option value="">Toutes</option>${DB().categories.map(c => `<option value="${c.id}" ${String(c.id) === q.cat ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
            <div class="field f-price"><label class="field-label" for="f-min">Prix min (€)</label><input class="input" id="f-min" name="min" type="number" min="0" step="0.01" value="${esc(q.min)}" inputmode="decimal"></div>
            <div class="field f-price"><label class="field-label" for="f-max">Prix max (€)</label><input class="input" id="f-max" name="max" type="number" min="0" step="0.01" value="${esc(q.max)}" inputmode="decimal"></div>
            <label class="check f-check"><input type="checkbox" name="low" ${q.low ? 'checked' : ''}>Stock bas uniquement</label>
            <div class="toolbar-end">${active.length ? `<button type="button" class="btn btn-ghost" id="clear-filters">${icon('x')}Effacer les filtres</button>` : ''}</div>
          </form>
          ${active.length ? `<div class="toolbar-summary"><span>${fmtInt(pg.total)} ${plural(pg.total, 'résultat')}</span>${active.map(a => `<span class="filter-chip">${esc(a.label)}<button type="button" data-clear="${a.k}" aria-label="Retirer le filtre ${esc(a.label)}">${icon('x')}</button></span>`).join('')}</div>` : ''}
          <div class="table-wrap" id="table-area">
            ${pg.total ? `<table class="table"><thead><tr>${sortBtn('name', 'Nom', q.sort, q.dir)}${sortBtn('category', 'Catégorie', q.sort, q.dir)}${sortBtn('price', 'Prix', q.sort, q.dir, 'num')}${sortBtn('stock', 'Stock', q.sort, q.dir, 'num')}${sortBtn('updatedAt', 'Dernière modification', q.sort, q.dir)}<th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>${rows}</tbody></table>`
              : emptyState('search', 'Aucun produit ne correspond', active.length ? 'Essayez d’élargir la recherche ou de retirer un filtre.' : 'Le catalogue est vide. Ajoutez un premier produit pour commencer.', active.length ? `<button type="button" class="btn btn-secondary" id="empty-clear">Effacer les filtres</button>` : (admin ? `<a class="btn btn-primary" href="#/produits/nouveau">${icon('plus')}Ajouter un produit</a>` : ''))}
          </div>
          ${pg.total ? paginationHtml(pg, { sizes: [10, 25, 50, 100], noun: 'produit' }) : ''}
        </section>`;
    },
    mount(root, params) {
      const form = $('#filters', root);
      const { q } = productQuery(params);
      const apply = (patch) => { const next = { ...params, ...patch }; if (!('page' in patch)) next.page = ''; rememberFocus(); $('#table-area', root).classList.add('is-refreshing'); setParams(next, true); };
      const readForm = () => ({ search: form.search.value.trim(), cat: form.cat.value, min: form.min.value, max: form.max.value, low: form.low.checked ? '1' : '' });
      form.search.addEventListener('input', debounce(() => apply(readForm()), 300));
      ['cat', 'low'].forEach(n => form[n].addEventListener('change', () => apply(readForm())));
      ['min', 'max'].forEach(n => form[n].addEventListener('change', () => apply(readForm())));
      onSubmit(form, (e) => { e.preventDefault(); apply(readForm()); });
      const clearAll = () => apply({ search: '', cat: '', min: '', max: '', low: '' });
      const cf = $('#clear-filters', root); if (cf) cf.addEventListener('click', clearAll);
      const ec = $('#empty-clear', root); if (ec) ec.addEventListener('click', clearAll);
      $$('[data-clear]', root).forEach(b => b.addEventListener('click', () => { const k = b.dataset.clear; apply(k === 'price' ? { min: '', max: '' } : { [k]: '' }); }));
      $$('[data-sort]', root).forEach(b => b.addEventListener('click', () => { const k = b.dataset.sort; apply({ sort: k, dir: q.sort === k && q.dir === 'asc' ? 'desc' : 'asc' }); }));
      $$('[data-page]', root).forEach(b => b.addEventListener('click', () => apply({ page: b.dataset.page })));
      const sz = $('[data-size]', root); if (sz) sz.addEventListener('change', () => apply({ size: sz.value }));
      $$('[data-delete]', root).forEach(b => b.addEventListener('click', () => askDeleteProduct(Number(b.dataset.delete), () => route())));
      restoreFocus(form);
    },
  };
  function askDeleteProduct(id, after) {
    const p = productById(id); if (!p) return;
    const moves = DB().movements.filter(m => m.productId === id).length;
    confirmDialog({
      title: 'Supprimer ce produit ?', danger: true, confirmLabel: 'Supprimer définitivement',
      body: `<p><strong>${esc(p.name)}</strong> sera retiré du catalogue${moves ? ` ainsi que ses <strong>${moves} ${plural(moves, 'mouvement')}</strong> de stock` : ''}. Cette action est irréversible après la fermeture de la notification.</p>`,
      onConfirm: () => {
        if (session.expired) { toast('error', 'Action refusée', 'Votre session a expiré (401). Reconnectez-vous.'); return; }
        const snap = deleteProduct(id);
        toast('success', 'Produit supprimé', p.name, { label: 'Annuler', onClick: () => { restoreProduct(snap); toast('info', 'Suppression annulée', p.name); route(); updateNav(); } });
        updateNav(); after();
      },
    });
  }

  /* ---------------------------------------------------------------------
     Détail d'un produit
     --------------------------------------------------------------------- */
  VIEWS.productDetail = {
    render(params, args) {
      const p = productById(args[0]);
      if (!p) return VIEWS.notFound.render();
      const admin = session.isAdmin;
      const moves = DB().movements.filter(m => m.productId === p.id);
      const pg = paginate(moves, Number(params.page) || 1, 8);
      const value = p.price * p.stock;
      return `${pageHead(p.name, `${esc(catName(p.categoryId))} · Réf. ${String(p.id).padStart(4, '0')}`,
          admin ? `<button type="button" class="btn btn-primary" id="det-move">${icon('moves')}Nouveau mouvement</button><a class="btn btn-secondary" href="#/produits/${p.id}/modifier">${icon('pencil')}Modifier</a><button type="button" class="btn btn-danger-outline" id="det-delete">${icon('trash')}Supprimer</button>` : '',
          crumb('#/produits', 'Produits') + `<span>${esc(p.name)}</span>`)}
        <div class="detail-grid">
          <section class="card" aria-labelledby="info-title">
            <div class="card-head"><h2 id="info-title">Informations</h2>${stockBadge(p)}</div>
            <div class="card-body">
              <div class="od-grid" style="--od-cols:2;--od-gap:16px;margin-bottom:16px">
                <span class="stock-big"><span class="v ${stockState(p) === 'out' ? 'text-danger' : stockState(p) === 'low' ? 'text-warning' : ''}">${fmtInt(p.stock)}</span><span class="l">Unités en stock</span></span>
                <span class="stock-big"><span class="v">${esc(fmtMoney(value))}</span><span class="l">Valeur du stock</span></span>
              </div>
              <dl class="dl">
                <div class="dl-row"><dt>Prix unitaire</dt><dd>${esc(fmtMoney(p.price))}</dd></div>
                <div class="dl-row"><dt>Seuil de stock bas</dt><dd>${fmtInt(p.lowStockThreshold)} <span class="sub">Alerte dès que le stock est inférieur ou égal</span></dd></div>
                <div class="dl-row"><dt>Catégorie</dt><dd>${esc(catName(p.categoryId))}</dd></div>
                <div class="dl-row"><dt>Créé le</dt><dd>${esc(fmtDateTime(p.createdAt))}<span class="sub">par ${esc(p.createdBy)}</span></dd></div>
                <div class="dl-row"><dt>Modifié le</dt><dd>${esc(fmtDateTime(p.updatedAt))}<span class="sub">par ${esc(p.updatedBy)}</span></dd></div>
              </dl>
            </div>
            ${!admin ? `<div class="card-foot muted">${icon('lock', '')} Lecture seule : le rôle User ne peut pas modifier les produits.</div>` : ''}
          </section>
          <section class="card" aria-labelledby="hist-title">
            <div class="card-head"><h2 id="hist-title">Historique des mouvements</h2><span class="small muted">${fmtInt(moves.length)} ${plural(moves.length, 'mouvement')}</span></div>
            <div class="table-wrap">${moves.length ? `<table class="table"><thead><tr><th scope="col">Date</th><th scope="col">Type</th><th scope="col" class="num">Quantité</th><th scope="col">Entrepôt</th><th scope="col">Utilisateur</th><th scope="col">Notes</th></tr></thead><tbody>
              ${pg.items.map(m => `<tr><td class="od-nowrap">${esc(fmtDateTime(m.createdAt))}</td><td>${typeBadge(m.type)}</td><td class="num"><strong class="text-${qtyClass(m) === 'in' ? 'success' : qtyClass(m) === 'out' ? 'warning' : ''}">${signedQty(m)}</strong></td><td>${esc(whName(m.warehouseId))}</td><td class="small">${esc(m.userEmail)}</td><td class="small muted">${m.notes ? esc(m.notes) : '—'}</td></tr>`).join('')}</tbody></table>`
              : emptyState('history', 'Aucun mouvement enregistré', 'Les entrées, sorties et ajustements de ce produit apparaîtront ici.', admin ? `<button type="button" class="btn btn-secondary" id="hist-move">${icon('plus')}Enregistrer un mouvement</button>` : '')}</div>
            ${moves.length ? paginationHtml(pg, { noun: 'mouvement' }) : ''}
          </section>
        </div>`;
    },
    mount(root, params, args) {
      const p = productById(args[0]); if (!p) return;
      const openMove = () => openMovementDrawer(p.id);
      ['#det-move', '#hist-move'].forEach(s => { const b = $(s, root); if (b) b.addEventListener('click', openMove); });
      const del = $('#det-delete', root); if (del) del.addEventListener('click', () => askDeleteProduct(p.id, () => go('/produits')));
      $$('[data-page]', root).forEach(b => b.addEventListener('click', () => setParams({ ...params, page: b.dataset.page }, true)));
    },
  };

  /* ---------------------------------------------------------------------
     Formulaire produit (création et édition)
     --------------------------------------------------------------------- */
  VIEWS.productForm = {
    render(params, args) {
      const editing = !!args[0];
      const p = editing ? productById(args[0]) : null;
      if (editing && !p) return VIEWS.notFound.render();
      const cats = [{ value: '', label: 'Choisir une catégorie' }].concat(DB().categories.map(c => ({ value: c.id, label: c.name })));
      return `${pageHead(editing ? 'Modifier le produit' : 'Nouveau produit', editing ? esc(p.name) : 'Les champs marqués d’un astérisque sont obligatoires.', '', crumb('#/produits', 'Produits') + (editing ? crumb(`#/produits/${p.id}`, p.name) : '') + `<span>${editing ? 'Modifier' : 'Nouveau'}</span>`)}
        <div id="form-conflict"></div>
        <section class="card" style="max-width:760px">
          <form id="product-form" novalidate data-row-version="${editing ? p.rowVersion : ''}">
            <div class="card-body od-stack" style="--od-gap:20px">
              <div id="form-summary" hidden></div>
              <div class="form-grid">
                ${fieldHtml({ name: 'name', label: 'Nom du produit', required: true, value: p ? p.name : '', attrs: 'maxlength="100" autofocus', hint: '100 caractères maximum.', cls: 'span-2' })}
                ${fieldHtml({ name: 'categoryId', label: 'Catégorie', type: 'select', required: true, value: p ? p.categoryId : '', options: cats })}
                ${fieldHtml({ name: 'price', label: 'Prix unitaire', type: 'number', required: true, value: p ? p.price.toFixed(2) : '', attrs: 'min="0" step="0.01" inputmode="decimal"', affix: '€', hint: 'Deux décimales, supérieur ou égal à 0.' })}
                ${editing
                  ? `<div class="field"><span class="field-label">Stock actuel</span><input class="input" type="text" value="${fmtInt(p.stock)}" disabled aria-describedby="stock-hint"><span class="field-hint" id="stock-hint">Le stock se modifie uniquement par un mouvement de stock.</span></div>`
                  : fieldHtml({ name: 'stock', label: 'Stock initial', type: 'number', required: true, value: '0', attrs: 'min="0" step="1" inputmode="numeric"', hint: 'Quantité disponible à la création.' })}
                ${fieldHtml({ name: 'lowStockThreshold', label: 'Seuil de stock bas', type: 'number', required: true, value: p ? p.lowStockThreshold : '10', attrs: 'min="0" step="1" inputmode="numeric"', hint: 'Le produit passe « sous seuil » quand le stock est inférieur ou égal.' })}
              </div>
            </div>
            <div class="card-foot od-row" style="justify-content:flex-end;--od-gap:8px">
              <a class="btn btn-secondary" href="${editing ? `#/produits/${p.id}` : '#/produits'}">Annuler</a>
              <button type="submit" class="btn btn-primary" id="form-submit">${editing ? 'Enregistrer les modifications' : 'Créer le produit'}</button>
            </div>
          </form>
        </section>`;
    },
    mount(root, params, args) {
      const form = $('#product-form', root); if (!form) return;
      const editing = !!args[0];
      const rules = {
        name: () => { const v = form.name.value.trim(); return !v ? 'Le nom est obligatoire.' : v.length > 100 ? 'Le nom ne doit pas dépasser 100 caractères.' : DB().products.some(p => p.name.toLowerCase() === v.toLowerCase() && String(p.id) !== args[0]) ? 'Un produit porte déjà ce nom. Choisissez un nom distinct.' : ''; },
        categoryId: () => !form.categoryId.value ? 'Choisissez une catégorie.' : '',
        price: () => { const v = form.price.value; return v === '' ? 'Le prix est obligatoire.' : Number(v) < 0 ? 'Le prix doit être supérieur ou égal à 0.' : !/^\d+([.,]\d{1,2})?$/.test(v) ? 'Le prix accepte au plus deux décimales (ex. 12,50).' : ''; },
        stock: () => editing ? '' : (form.stock.value === '' ? 'Le stock initial est obligatoire.' : (Number(form.stock.value) < 0 || !Number.isInteger(Number(form.stock.value))) ? 'Le stock doit être un entier supérieur ou égal à 0.' : ''),
        lowStockThreshold: () => form.lowStockThreshold.value === '' ? 'Le seuil est obligatoire.' : (Number(form.lowStockThreshold.value) < 0 || !Number.isInteger(Number(form.lowStockThreshold.value))) ? 'Le seuil doit être un entier supérieur ou égal à 0.' : '',
      };
      Object.keys(rules).forEach(k => { if (form[k]) form[k].addEventListener('blur', () => setFieldError(form, k, rules[k]())); });
      onSubmit(form, (e) => {
        e.preventDefault();
        const errors = Object.keys(rules).map(k => [k, rules[k]()]).filter(x => x[1]);
        Object.keys(rules).forEach(k => { if (form[k]) setFieldError(form, k, (errors.find(x => x[0] === k) || [])[1] || ''); });
        const summary = $('#form-summary', root);
        if (errors.length) { summary.innerHTML = `<div class="form-summary" role="alert"><strong>${errors.length} ${plural(errors.length, 'champ')} à corriger :</strong><ul>${errors.map(x => `<li><a href="#f-${x[0]}">${esc(x[1])}</a></li>`).join('')}</ul></div>`; summary.hidden = false; $$('a', summary).forEach(a => a.addEventListener('click', (ev) => { ev.preventDefault(); $(a.getAttribute('href')).focus(); })); return; }
        summary.hidden = true;
        if (session.expired) { toast('error', 'Action refusée', 'Votre session a expiré (401). Reconnectez-vous.'); return; }
        const btn = $('#form-submit', root); btn.classList.add('is-loading');
        setTimeout(() => {
          btn.classList.remove('is-loading');
          const now = new Date().toISOString(); const me = session.user.email;
          if (editing) {
            I.loadDB(); // relit l'état partagé (un autre onglet peut avoir modifié le produit)
            const p = productById(args[0]);
            if (!p) { toast('error', 'Produit introuvable', 'Ce produit a été supprimé entre-temps (404).'); go('/produits'); return; }
            if (String(p.rowVersion) !== form.dataset.rowVersion) {
              $('#form-conflict', root).innerHTML = `<div class="banner banner-danger" role="alert">${icon('alert')}<span class="banner-text"><strong>Conflit de modification (409).</strong> Ce produit a été modifié par ${esc(p.updatedBy)} le ${esc(fmtDateTime(p.updatedAt))}. Rechargez pour voir la dernière version avant d’enregistrer.</span><button type="button" class="btn btn-sm btn-secondary" id="conflict-reload">Recharger</button></div>`;
              $('#conflict-reload', root).addEventListener('click', () => { currentView = null; route(); });
              window.scrollTo({ top: 0, behavior: 'smooth' });
              return;
            }
            Object.assign(p, { name: form.name.value.trim(), categoryId: Number(form.categoryId.value), price: Number(form.price.value.replace(',', '.')), lowStockThreshold: Number(form.lowStockThreshold.value), updatedAt: now, updatedBy: me, rowVersion: p.rowVersion + 1 });
            I.saveDB(); updateNav();
            toast('success', 'Produit mis à jour', p.name); go(`/produits/${p.id}`);
          } else {
            const p = { id: DB().nextIds.product++, name: form.name.value.trim(), categoryId: Number(form.categoryId.value), price: Number(form.price.value.replace(',', '.')), stock: Number(form.stock.value), lowStockThreshold: Number(form.lowStockThreshold.value), createdAt: now, createdBy: me, updatedAt: now, updatedBy: me, rowVersion: 1 };
            DB().products.push(p);
            if (p.stock > 0) DB().movements.unshift({ id: DB().nextIds.movement++, productId: p.id, warehouseId: DB().warehouses[0].id, type: 'Entree', quantity: p.stock, notes: 'Stock initial', createdAt: now, userEmail: me });
            I.saveDB(); updateNav();
            toast('success', 'Produit créé', `${p.name} a été ajouté au catalogue.`, { label: 'Voir', onClick: () => go(`/produits/${p.id}`) });
            go('/produits');
          }
        }, 600);
      });
    },
  };

  /* ---------------------------------------------------------------------
     Panneau latéral : nouveau mouvement de stock
     --------------------------------------------------------------------- */
  function openMovementDrawer(presetProductId) {
    if (!session.isAdmin) { toast('error', 'Action interdite', 'Le rôle User ne peut pas enregistrer de mouvement (403).'); return; }
    let selected = presetProductId ? productById(presetProductId) : null;
    const ov = openOverlay(`
      <div class="drawer" role="dialog" aria-modal="true" aria-labelledby="mv-title">
        <div class="drawer-head"><h2 id="mv-title">Nouveau mouvement de stock</h2><button type="button" class="btn btn-ghost btn-icon" data-close aria-label="Fermer le panneau">${icon('x')}</button></div>
        <form class="drawer-body" id="mv-form" novalidate>
          <div class="field" data-field="product"><label class="field-label" for="mv-search">Produit<span class="req" aria-hidden="true">*</span></label>
            <div id="mv-product-slot"></div>
            <span class="field-error" id="mv-product-err" hidden></span></div>
          ${fieldHtml({ name: 'warehouse', label: 'Entrepôt', type: 'select', required: true, value: DB().warehouses[0].id, options: DB().warehouses.map(w => ({ value: w.id, label: w.name })) })}
          <div class="field" data-field="type"><span class="field-label" id="mv-type-label">Type de mouvement<span class="req" aria-hidden="true">*</span></span>
            <div class="seg" role="radiogroup" aria-labelledby="mv-type-label">
              <input type="radio" name="type" id="t-in" value="Entree" checked><label for="t-in">${icon('arrow-in')}Entrée</label>
              <input type="radio" name="type" id="t-out" value="Sortie"><label for="t-out">${icon('arrow-out')}Sortie</label>
              <input type="radio" name="type" id="t-adj" value="Ajustement"><label for="t-adj">${icon('sliders')}Ajustement</label>
            </div><span class="field-hint" id="type-hint">Ajoute des unités au stock (réception, retour).</span><span class="field-error" hidden></span></div>
          ${fieldHtml({ name: 'quantity', label: 'Quantité', type: 'number', required: true, value: '1', attrs: 'min="1" step="1" inputmode="numeric"', hint: 'Entier strictement positif.' })}
          <div class="preview" id="mv-preview" aria-live="polite"></div>
          ${fieldHtml({ name: 'notes', label: 'Notes', type: 'textarea', attrs: 'maxlength="250" rows="2"', placeholder: 'Chantier, fournisseur, motif…', hint: '250 caractères maximum, facultatif.' })}
        </form>
        <div class="drawer-foot"><button type="button" class="btn btn-secondary" data-close>Annuler</button><button type="submit" form="mv-form" class="btn btn-primary" id="mv-submit">Enregistrer le mouvement</button></div>
      </div>`, { drawer: true, persistent: true });
    const form = $('#mv-form', ov), slot = $('#mv-product-slot', ov), preview = $('#mv-preview', ov), hint = $('#type-hint', ov);
    const typeHints = { Entree: 'Ajoute des unités au stock (réception, retour).', Sortie: 'Retire des unités du stock (chantier, consommation).', Ajustement: 'Corrige le stock après inventaire : positif ou négatif.' };

    function renderProductSlot() {
      if (selected) {
        slot.innerHTML = `<div class="combo-selected"><span class="c-name od-truncate">${esc(selected.name)}</span><span class="c-stock">${fmtInt(selected.stock)} en stock</span><button type="button" class="btn btn-ghost btn-icon btn-sm" id="mv-change" aria-label="Changer de produit">${icon('x')}</button></div>`;
        $('#mv-change', slot).addEventListener('click', () => { selected = null; renderProductSlot(); $('#mv-search', slot).focus(); });
      } else {
        slot.innerHTML = `<div class="combo"><div class="input-search">${icon('search')}<input class="input" id="mv-search" type="search" placeholder="Rechercher un produit" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="mv-list" aria-autocomplete="list"></div><ul class="combo-list" id="mv-list" role="listbox" hidden></ul></div>`;
        const inp = $('#mv-search', slot), list = $('#mv-list', slot);
        let items = [], idx = -1;
        const draw = () => {
          const s = inp.value.trim().toLowerCase();
          items = DB().products.filter(p => !s || p.name.toLowerCase().includes(s)).slice(0, 8);
          list.hidden = false; inp.setAttribute('aria-expanded', 'true');
          list.innerHTML = items.length ? items.map((p, i) => `<li role="option" id="mv-opt-${p.id}" data-id="${p.id}" aria-selected="${i === idx}"><span class="c-name od-truncate">${esc(p.name)}</span><span class="c-stock">${fmtInt(p.stock)}</span></li>`).join('') : `<li class="combo-empty">Aucun produit pour « ${esc(inp.value)} »</li>`;
          $$('[data-id]', list).forEach(li => li.addEventListener('mousedown', (e) => { e.preventDefault(); pick(Number(li.dataset.id)); }));
        };
        const pick = (id) => { selected = productById(id); renderProductSlot(); setFieldError(form, 'product', ''); updatePreview(); form.quantity.focus(); };
        inp.addEventListener('focus', draw); inp.addEventListener('input', () => { idx = -1; draw(); });
        inp.addEventListener('blur', () => setTimeout(() => { list.hidden = true; inp.setAttribute('aria-expanded', 'false'); }, 120));
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(items.length - 1, idx + 1); draw(); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, idx - 1); draw(); }
          else if (e.key === 'Enter') { e.preventDefault(); if (items[idx]) pick(items[idx].id); else if (items.length === 1) pick(items[0].id); }
        });
      }
      updatePreview();
    }
    function currentDelta() {
      const type = form.type.value; const q = Number(form.quantity.value) || 0;
      return type === 'Entree' ? q : type === 'Sortie' ? -q : q;
    }
    function updatePreview() {
      if (!selected) { preview.innerHTML = `<span class="muted small" style="grid-column:1/-1;text-align:center">Sélectionnez un produit pour voir l’aperçu du stock.</span>`; preview.classList.remove('is-negative'); return; }
      const after = selected.stock + currentDelta();
      preview.classList.toggle('is-negative', after < 0);
      preview.innerHTML = `<span class="od-stat"><span class="v">${fmtInt(selected.stock)}</span><span class="l">Stock avant</span></span><span class="arrow">${icon('arrow-right')}</span><span class="od-stat"><span class="v after">${fmtInt(after)}</span><span class="l">Stock après</span></span>${after < 0 ? `<span class="small text-danger" style="grid-column:1/-1;display:flex;gap:6px;align-items:center">${icon('alert-circle')}Stock résultant négatif : la sortie sera refusée (409).</span>` : after <= selected.lowStockThreshold ? `<span class="small text-warning" style="grid-column:1/-1;display:flex;gap:6px;align-items:center">${icon('alert')}Le produit sera sous son seuil de ${fmtInt(selected.lowStockThreshold)}.</span>` : ''}`;
    }
    renderProductSlot();
    $$('input[name="type"]', form).forEach(r => r.addEventListener('change', () => {
      hint.textContent = typeHints[form.type.value];
      form.quantity.min = form.type.value === 'Ajustement' ? '' : '1';
      $('[data-field="quantity"] .field-hint', form).textContent = form.type.value === 'Ajustement' ? 'Entier non nul : négatif pour retirer, positif pour ajouter.' : 'Entier strictement positif.';
      updatePreview();
    }));
    form.quantity.addEventListener('input', updatePreview);
    form.quantity.addEventListener('blur', () => setFieldError(form, 'quantity', qtyError()));
    const qtyError = () => { const v = form.quantity.value; const n = Number(v); if (v === '' || !Number.isInteger(n)) return 'Saisissez une quantité entière.'; if (form.type.value === 'Ajustement') return n === 0 ? 'La quantité d’ajustement ne peut pas être nulle.' : ''; return n < 1 ? 'La quantité doit être supérieure à 0.' : ''; };
    onSubmit(form, (e) => {
      e.preventDefault();
      let ok = true;
      if (!selected) { setFieldError(form, 'product', 'Choisissez un produit.'); ok = false; }
      const qe = qtyError(); setFieldError(form, 'quantity', qe); if (qe) ok = false;
      if (!ok) return;
      if (selected.stock + currentDelta() < 0) { setFieldError(form, 'quantity', `Stock insuffisant : ${fmtInt(selected.stock)} ${plural(selected.stock, 'unité')} disponibles.`); return; }
      if (session.expired) { toast('error', 'Action refusée', 'Votre session a expiré (401). Reconnectez-vous.'); return; }
      const btn = $('#mv-submit', ov); btn.classList.add('is-loading');
      setTimeout(() => {
        const res = recordMovement({ productId: selected.id, warehouseId: Number(form.warehouse.value), type: form.type.value, quantity: Number(form.quantity.value), notes: form.notes.value.trim() });
        btn.classList.remove('is-loading');
        if (res.error) { toast('error', 'Mouvement refusé', res.error); return; }
        closeOverlay(); updateNav();
        toast('success', `${typeLabel[res.movement.type]} enregistrée`, `${signedQty(res.movement)} · ${res.product.name} · stock : ${fmtInt(res.product.stock)}`);
        route();
      }, 500);
    });
  }

  /* ---------------------------------------------------------------------
     Journal des mouvements
     --------------------------------------------------------------------- */
  VIEWS.movements = {
    skeleton: () => `<div class="od-stack" style="--od-gap:24px"><div class="od-stack" style="--od-gap:8px"><span class="skeleton sk-line w-30" style="height:28px"></span><span class="skeleton sk-line w-50"></span></div>${skeletonTable(12)}</div>`,
    render(params) {
      const q = { wh: params.entrepot || '', type: params.type || '', from: params.du || '', to: params.au || '', product: params.produit || '', page: Number(params.page) || 1, size: [10, 25, 50, 100].includes(Number(params.size)) ? Number(params.size) : 25 };
      let list = DB().movements.slice();
      if (q.wh) list = list.filter(m => m.warehouseId === Number(q.wh));
      if (q.type) list = list.filter(m => m.type === q.type);
      if (q.from) list = list.filter(m => isoDay(m.createdAt) >= q.from);
      if (q.to) list = list.filter(m => isoDay(m.createdAt) <= q.to);
      if (q.product) { const s = q.product.toLowerCase(); list = list.filter(m => { const p = productById(m.productId); return p && p.name.toLowerCase().includes(s); }); }
      const pg = paginate(list, q.page, q.size);
      const active = [q.wh, q.type, q.from, q.to, q.product].some(Boolean);
      const sumIn = list.filter(m => m.type === 'Entree').reduce((s, m) => s + m.quantity, 0), sumOut = list.filter(m => m.type === 'Sortie').reduce((s, m) => s + m.quantity, 0);
      return `${pageHead('Mouvements de stock', `${fmtInt(DB().movements.length)} mouvements enregistrés · entrées ${fmtInt(sumIn)} · sorties ${fmtInt(sumOut)} sur la sélection`,
          `<span title="Export disponible dans une prochaine version"><button type="button" class="btn btn-secondary" disabled aria-describedby="csv-hint">${icon('download')}Exporter en CSV</button></span><span class="sr-only" id="csv-hint">Export CSV non disponible dans cette version.</span>${session.isAdmin ? `<button type="button" class="btn btn-primary" id="mv-new">${icon('plus')}Nouveau mouvement</button>` : ''}`)}
        <section class="card">
          <form class="toolbar" id="mv-filters" aria-label="Filtrer les mouvements">
            <div class="field f-date"><label class="field-label" for="f-du">Du</label><input class="input" id="f-du" name="du" type="date" value="${esc(q.from)}"></div>
            <div class="field f-date"><label class="field-label" for="f-au">Au</label><input class="input" id="f-au" name="au" type="date" value="${esc(q.to)}"></div>
            <div class="field f-cat"><label class="field-label" for="f-wh">Entrepôt</label><select class="select" id="f-wh" name="entrepot"><option value="">Tous</option>${DB().warehouses.map(w => `<option value="${w.id}" ${String(w.id) === q.wh ? 'selected' : ''}>${esc(w.name)}</option>`).join('')}</select></div>
            <div class="field f-cat"><label class="field-label" for="f-type">Type</label><select class="select" id="f-type" name="type"><option value="">Tous</option>${['Entree', 'Sortie', 'Ajustement'].map(t => `<option value="${t}" ${t === q.type ? 'selected' : ''}>${typeLabel[t]}</option>`).join('')}</select></div>
            <div class="field f-search"><label class="field-label" for="f-prod">Produit</label><div class="input-search">${icon('search')}<input class="input" id="f-prod" name="produit" type="search" value="${esc(q.product)}" placeholder="Nom du produit"></div></div>
            <div class="toolbar-end">${active ? `<button type="button" class="btn btn-ghost" id="mv-clear">${icon('x')}Effacer les filtres</button>` : ''}</div>
          </form>
          <div class="table-wrap" id="mv-table">${pg.total ? `<table class="table"><thead><tr><th scope="col">Date</th><th scope="col">Produit</th><th scope="col">Type</th><th scope="col" class="num">Quantité</th><th scope="col">Entrepôt</th><th scope="col">Utilisateur</th><th scope="col">Notes</th></tr></thead><tbody>
            ${pg.items.map(m => { const p = productById(m.productId); return `<tr><td class="od-nowrap">${esc(fmtDateTime(m.createdAt))}</td><td>${p ? `<a class="cell-primary" href="#/produits/${p.id}">${esc(p.name)}</a>` : '<span class="muted">Produit supprimé</span>'}</td><td>${typeBadge(m.type)}</td><td class="num"><strong class="text-${qtyClass(m) === 'in' ? 'success' : qtyClass(m) === 'out' ? 'warning' : ''}">${signedQty(m)}</strong></td><td>${esc(whName(m.warehouseId))}</td><td class="small">${esc(m.userEmail)}</td><td class="small muted">${m.notes ? esc(m.notes) : '—'}</td></tr>`; }).join('')}</tbody></table>`
            : emptyState('history', 'Aucun mouvement sur cette période', active ? 'Élargissez la période ou retirez un filtre.' : 'Les mouvements de stock apparaîtront ici dès qu’ils seront enregistrés.', active ? `<button type="button" class="btn btn-secondary" id="mv-empty-clear">Effacer les filtres</button>` : '')}</div>
          ${pg.total ? paginationHtml(pg, { sizes: [10, 25, 50, 100], noun: 'mouvement' }) : ''}
        </section>`;
    },
    mount(root, params) {
      const form = $('#mv-filters', root);
      const apply = (patch) => { const next = { ...params, ...patch }; if (!('page' in patch)) next.page = ''; rememberFocus(); $('#mv-table', root).classList.add('is-refreshing'); setParams(next, true); };
      const read = () => ({ du: form.du.value, au: form.au.value, entrepot: form.entrepot.value, type: form.type.value, produit: form.produit.value.trim() });
      ['du', 'au', 'entrepot', 'type'].forEach(n => form[n].addEventListener('change', () => apply(read())));
      form.produit.addEventListener('input', debounce(() => apply(read()), 300));
      onSubmit(form, (e) => { e.preventDefault(); apply(read()); });
      const clear = () => apply({ du: '', au: '', entrepot: '', type: '', produit: '' });
      ['#mv-clear', '#mv-empty-clear'].forEach(s => { const b = $(s, root); if (b) b.addEventListener('click', clear); });
      $$('[data-page]', root).forEach(b => b.addEventListener('click', () => apply({ page: b.dataset.page })));
      const sz = $('[data-size]', root); if (sz) sz.addEventListener('change', () => apply({ size: sz.value }));
      const nb = $('#mv-new', root); if (nb) nb.addEventListener('click', () => openMovementDrawer());
      restoreFocus(form);
    },
  };

  /* ---------------------------------------------------------------------
     Catégories et entrepôts : tableau + formulaire en modale
     --------------------------------------------------------------------- */
  function simpleEntityView(cfg) {
    return {
      render() {
        const admin = session.isAdmin; const rows = cfg.rows();
        return `${pageHead(cfg.title, cfg.lede(rows), admin ? `<button type="button" class="btn btn-primary" id="ent-new">${icon('plus')}${esc(cfg.addLabel)}</button>` : '')}
          <section class="card"><div class="table-wrap">${rows.length ? `<table class="table"><thead><tr>${cfg.columns.map(c => `<th scope="col" class="${c.num ? 'num' : ''}">${esc(c.label)}</th>`).join('')}<th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>
            ${rows.map(r => `<tr>${cfg.columns.map(c => `<td class="${c.num ? 'num' : ''}">${c.cell(r)}</td>`).join('')}<td><div class="row-actions">${admin ? `<button type="button" class="btn btn-ghost btn-icon btn-sm" data-edit="${r.id}" aria-label="Modifier ${esc(r.name)}" title="Modifier">${icon('pencil')}</button><button type="button" class="btn btn-ghost btn-icon btn-sm danger" data-del="${r.id}" aria-label="Supprimer ${esc(r.name)}" title="Supprimer">${icon('trash')}</button>` : ''}</div></td></tr>`).join('')}</tbody></table>`
            : emptyState(cfg.icon, cfg.emptyTitle, cfg.emptyText, admin ? `<button type="button" class="btn btn-primary" id="ent-new-empty">${icon('plus')}${esc(cfg.addLabel)}</button>` : '')}</div>
          ${!admin ? `<div class="card-foot muted">${icon('lock')} Lecture seule : la gestion ${cfg.ofWhat} est réservée aux administrateurs.</div>` : ''}</section>`;
      },
      mount(root) {
        ['#ent-new', '#ent-new-empty'].forEach(s => { const b = $(s, root); if (b) b.addEventListener('click', () => cfg.openForm(null)); });
        $$('[data-edit]', root).forEach(b => b.addEventListener('click', () => cfg.openForm(Number(b.dataset.edit))));
        $$('[data-del]', root).forEach(b => b.addEventListener('click', () => cfg.askDelete(Number(b.dataset.del))));
      },
    };
  }
  function entityFormModal({ title, fields, onSave }) {
    const ov = openOverlay(`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="ent-title">
        <div class="modal-head"><h2 id="ent-title">${esc(title)}</h2><button type="button" class="btn btn-ghost btn-icon" data-close aria-label="Fermer">${icon('x')}</button></div>
        <form id="ent-form" novalidate><div class="modal-body od-stack" style="--od-gap:16px">${fields.map(f => fieldHtml(f)).join('')}</div>
        <div class="modal-foot"><button type="button" class="btn btn-secondary" data-close>Annuler</button><button type="submit" class="btn btn-primary" id="ent-save">Enregistrer</button></div></form></div>`);
    const form = $('#ent-form', ov);
    fields.forEach(f => { if (f.validate) form[f.name].addEventListener('blur', () => setFieldError(form, f.name, f.validate(form[f.name].value.trim()))); });
    onSubmit(form, (e) => {
      e.preventDefault();
      let ok = true;
      fields.forEach(f => { if (f.validate) { const err = f.validate(form[f.name].value.trim()); setFieldError(form, f.name, err); if (err) ok = false; } });
      if (!ok) return;
      if (session.expired) { toast('error', 'Action refusée', 'Votre session a expiré (401). Reconnectez-vous.'); return; }
      const values = {}; fields.forEach(f => { values[f.name] = form[f.name].value.trim(); });
      const btn = $('#ent-save', ov); btn.classList.add('is-loading');
      setTimeout(() => { closeOverlay(); onSave(values); route(); }, 400);
    });
  }
  VIEWS.categories = simpleEntityView({
    title: 'Catégories', icon: 'tag', addLabel: 'Nouvelle catégorie', ofWhat: 'des catégories',
    lede: (rows) => `${rows.length} ${plural(rows.length, 'catégorie')} · chaque produit appartient à une catégorie.`,
    emptyTitle: 'Aucune catégorie', emptyText: 'Créez une première catégorie pour classer vos produits.',
    rows: () => DB().categories.map(c => ({ ...c, count: DB().products.filter(p => p.categoryId === c.id).length, value: DB().products.filter(p => p.categoryId === c.id).reduce((s, p) => s + p.price * p.stock, 0), low: DB().products.filter(p => p.categoryId === c.id && stockState(p) !== 'ok').length })),
    columns: [
      { label: 'Nom', cell: r => `<a class="cell-primary" href="#/produits?cat=${r.id}">${esc(r.name)}</a>` },
      { label: 'Produits', num: true, cell: r => fmtInt(r.count) },
      { label: 'Sous seuil', num: true, cell: r => r.low ? `<span class="badge badge-low">${r.low}</span>` : '<span class="muted">0</span>' },
      { label: 'Valeur du stock', num: true, cell: r => esc(fmtMoney(r.value)) },
    ],
    openForm(id) {
      const c = id ? DB().categories.find(x => x.id === id) : null;
      entityFormModal({ title: c ? 'Modifier la catégorie' : 'Nouvelle catégorie',
        fields: [{ name: 'name', label: 'Nom', required: true, value: c ? c.name : '', attrs: 'maxlength="100" autofocus', hint: '100 caractères maximum.', validate: (v) => !v ? 'Le nom est obligatoire.' : v.length > 100 ? '100 caractères maximum.' : DB().categories.some(x => x.name.toLowerCase() === v.toLowerCase() && x.id !== id) ? 'Cette catégorie existe déjà.' : '' }],
        onSave(v) { if (c) { c.name = v.name; toast('success', 'Catégorie modifiée', v.name); } else { DB().categories.push({ id: DB().nextIds.category++, name: v.name }); toast('success', 'Catégorie créée', v.name); } I.saveDB(); } });
    },
    askDelete(id) {
      const c = DB().categories.find(x => x.id === id); const n = DB().products.filter(p => p.categoryId === id).length;
      if (n) { confirmDialog({ title: 'Suppression impossible', confirmLabel: 'Voir les produits', body: `<p><strong>${esc(c.name)}</strong> est encore rattachée à <strong>${n} ${plural(n, 'produit')}</strong>. Réaffectez ces produits à une autre catégorie avant de la supprimer.</p>`, onConfirm: () => go('/produits', { cat: id }) }); return; }
      confirmDialog({ title: 'Supprimer cette catégorie ?', danger: true, confirmLabel: 'Supprimer', body: `<p><strong>${esc(c.name)}</strong> ne contient aucun produit et sera supprimée.</p>`, onConfirm: () => { DB().categories = DB().categories.filter(x => x.id !== id); I.saveDB(); toast('success', 'Catégorie supprimée', c.name); route(); } });
    },
  });
  VIEWS.warehouses = simpleEntityView({
    title: 'Entrepôts', icon: 'warehouse', addLabel: 'Nouvel entrepôt', ofWhat: 'des entrepôts',
    lede: (rows) => `${rows.length} ${plural(rows.length, 'entrepôt')} · chaque mouvement est rattaché à un entrepôt.`,
    emptyTitle: 'Aucun entrepôt', emptyText: 'Créez un premier entrepôt pour enregistrer des mouvements.',
    rows: () => DB().warehouses.map(w => { const ms = DB().movements.filter(m => m.warehouseId === w.id); return { ...w, count: ms.length, last: ms[0] ? ms[0].createdAt : null }; }),
    columns: [
      { label: 'Nom', cell: r => `<span class="cell-stack"><a class="cell-primary" href="#/mouvements?entrepot=${r.id}">${esc(r.name)}</a>${r.address ? `<span class="cell-sub">${esc(r.address)}</span>` : ''}</span>` },
      { label: 'Mouvements', num: true, cell: r => fmtInt(r.count) },
      { label: 'Dernier mouvement', cell: r => r.last ? esc(fmtDateTime(r.last)) : '<span class="muted">—</span>' },
    ],
    openForm(id) {
      const w = id ? DB().warehouses.find(x => x.id === id) : null;
      entityFormModal({ title: w ? 'Modifier l’entrepôt' : 'Nouvel entrepôt',
        fields: [
          { name: 'name', label: 'Nom', required: true, value: w ? w.name : '', attrs: 'maxlength="100" autofocus', validate: (v) => !v ? 'Le nom est obligatoire.' : v.length > 100 ? '100 caractères maximum.' : DB().warehouses.some(x => x.name.toLowerCase() === v.toLowerCase() && x.id !== id) ? 'Cet entrepôt existe déjà.' : '' },
          { name: 'address', label: 'Adresse', value: w ? w.address : '', attrs: 'maxlength="250"', hint: 'Facultatif, 250 caractères maximum.', validate: (v) => v.length > 250 ? '250 caractères maximum.' : '' },
        ],
        onSave(v) { if (w) { w.name = v.name; w.address = v.address; toast('success', 'Entrepôt modifié', v.name); } else { DB().warehouses.push({ id: DB().nextIds.warehouse++, name: v.name, address: v.address }); toast('success', 'Entrepôt créé', v.name); } I.saveDB(); } });
    },
    askDelete(id) {
      const w = DB().warehouses.find(x => x.id === id); const n = DB().movements.filter(m => m.warehouseId === id).length;
      if (n) { confirmDialog({ title: 'Suppression impossible', confirmLabel: 'Voir les mouvements', body: `<p><strong>${esc(w.name)}</strong> porte <strong>${n} ${plural(n, 'mouvement')}</strong> de stock. L’historique doit rester consultable : un entrepôt avec des mouvements ne peut pas être supprimé.</p>`, onConfirm: () => go('/mouvements', { entrepot: id }) }); return; }
      confirmDialog({ title: 'Supprimer cet entrepôt ?', danger: true, confirmLabel: 'Supprimer', body: `<p><strong>${esc(w.name)}</strong> n’a aucun mouvement et sera supprimé.</p>`, onConfirm: () => { DB().warehouses = DB().warehouses.filter(x => x.id !== id); I.saveDB(); toast('success', 'Entrepôt supprimé', w.name); route(); } });
    },
  });

  /* ---------------------------------------------------------------------
     Utilisateurs (Admin)
     --------------------------------------------------------------------- */
  VIEWS.users = {
    render() {
      const me = session.user; const users = DB().users.slice().sort((a, b) => a.email.localeCompare(b.email));
      return `${pageHead('Utilisateurs', `${users.length} comptes · ${users.filter(u => u.role === 'Admin' && u.isActive).length} administrateurs actifs. Un administrateur ne peut ni se rétrograder ni se désactiver lui-même.`)}
        <section class="card"><div class="table-wrap"><table class="table"><thead><tr><th scope="col">Utilisateur</th><th scope="col">Rôle</th><th scope="col">Statut</th><th scope="col">Créé le</th></tr></thead><tbody>
          ${users.map(u => { const self = u.id === me.id; return `<tr class="${u.isActive ? '' : 'is-dim'}">
            <td><span class="od-row" style="--od-gap:12px"><span class="avatar" style="width:32px;height:32px;border-radius:50%;background:var(--primary-soft);color:var(--primary-soft-text);display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex:none">${esc(initials(u.email))}</span><span class="cell-stack"><span class="cell-primary">${esc(u.email)}${self ? ' <span class="badge">vous</span>' : ''}</span><span class="cell-sub">${esc(u.username)}</span></span></span></td>
            <td><span class="od-row" style="--od-gap:8px"><label class="sr-only" for="role-${u.id}">Rôle de ${esc(u.email)}</label><select class="select inline-select" id="role-${u.id}" data-role="${u.id}" ${self || !u.isActive ? 'disabled' : ''}><option value="User" ${u.role === 'User' ? 'selected' : ''}>User</option><option value="Admin" ${u.role === 'Admin' ? 'selected' : ''}>Admin</option></select>${u.role === 'Admin' ? icon('shield', 'text-success') : ''}</span></td>
            <td><span class="cell-toggle"><button type="button" class="switch" role="switch" aria-checked="${u.isActive}" data-active="${u.id}" aria-label="${u.isActive ? 'Désactiver' : 'Activer'} ${esc(u.email)}" ${self ? 'disabled' : ''}></button><span class="small">${u.isActive ? 'Actif' : 'Inactif'}</span></span></td>
            <td class="od-nowrap small muted">${esc(fmtDate(u.createdAt))}</td></tr>`; }).join('')}</tbody></table></div></section>`;
    },
    mount(root) {
      $$('[data-role]', root).forEach(sel => sel.addEventListener('change', () => {
        const u = DB().users.find(x => x.id === Number(sel.dataset.role)); const newRole = sel.value;
        confirmDialog({ title: newRole === 'Admin' ? 'Promouvoir en administrateur ?' : 'Rétrograder en utilisateur ?', confirmLabel: 'Confirmer',
          body: `<p><strong>${esc(u.email)}</strong> ${newRole === 'Admin' ? 'pourra créer, modifier et supprimer des produits, enregistrer des mouvements et gérer les comptes.' : 'ne pourra plus que consulter les données.'}</p>`,
          onConfirm: () => { if (session.expired) { toast('error', 'Action refusée', 'Session expirée (401).'); route(); return; } u.role = newRole; I.saveDB(); toast('success', 'Rôle mis à jour', `${u.email} est maintenant ${newRole}.`); route(); } });
        sel.value = u.role; // retour à l'état réel tant que la confirmation n'est pas donnée
      }));
      $$('[data-active]', root).forEach(sw => sw.addEventListener('click', () => {
        const u = DB().users.find(x => x.id === Number(sw.dataset.active));
        const deactivating = u.isActive;
        confirmDialog({ title: deactivating ? 'Désactiver ce compte ?' : 'Réactiver ce compte ?', danger: deactivating, confirmLabel: deactivating ? 'Désactiver' : 'Réactiver',
          body: `<p><strong>${esc(u.email)}</strong> ${deactivating ? 'ne pourra plus se connecter. Ses actions passées restent dans l’historique.' : 'pourra de nouveau se connecter avec son rôle actuel.'}</p>`,
          onConfirm: () => { if (session.expired) { toast('error', 'Action refusée', 'Session expirée (401).'); return; } u.isActive = !deactivating; I.saveDB(); toast('success', deactivating ? 'Compte désactivé' : 'Compte réactivé', u.email); route(); } });
      }));
    },
  };

  /* ---------------------------------------------------------------------
     Pages d'erreur
     --------------------------------------------------------------------- */
  VIEWS.forbidden = { render: () => `<div class="error-page"><div class="error-inner"><span class="error-icon">${icon('lock')}</span><span class="code">403</span><h2>Accès refusé</h2><p>Cette page est réservée aux administrateurs. Votre rôle actuel est <strong>${esc(session.user ? session.user.role : '')}</strong>. Demandez à un administrateur de modifier votre rôle si nécessaire.</p><a class="btn btn-primary" href="#/">Retour au tableau de bord</a></div></div>` };
  VIEWS.notFound = { render: () => `<div class="error-page"><div class="error-inner"><span class="code">404</span><h2>Page introuvable</h2><p>L’adresse demandée n’existe pas ou l’élément a été supprimé.</p><div class="od-row" style="--od-gap:8px"><a class="btn btn-primary" href="#/">Tableau de bord</a><a class="btn btn-secondary" href="#/produits">Liste des produits</a></div></div></div>` };

  /* ---------------------------------------------------------------------
     Démarrage
     --------------------------------------------------------------------- */
  window.addEventListener('error', (e) => { try { toast('error', 'Erreur dans le prototype', e.message || 'Erreur inattendue'); } catch (x) { /* zone de toasts absente */ } });
  I.loadDB();
  window.addEventListener('hashchange', route);
  window.addEventListener('storage', (e) => { if (e.key === 'inventory-proto-data') { I.loadDB(); if (shellRendered) { updateNav(); } } });
  route();
})();
