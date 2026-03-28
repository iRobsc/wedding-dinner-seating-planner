/**
 * Render engine — creates and updates DOM elements for tables, seats, and placed guests.
 * In edit mode, shows per-side +/- buttons and table dimension controls.
 */
import { CONFIG } from './config.js';
import { getState, moveTable, removeTable, changeSideSeats, resizeTable, updateTableBounds } from './state.js';
import { screenToWorld, getTransform, isSpaceHeld } from './canvas.js';

let world = null;
let editMode = false;

// Active element tracking
let tableElements = new Map();
let seatElements = new Map();
let canvasGuestElements = new Map();
let editOverlays = new Map(); // tableId → overlay DOM element

// Drag callbacks
let onGuestDragStart = null;

export function initRender(callbacks) {
  world = document.getElementById('canvas-world');
  onGuestDragStart = callbacks.onGuestDragStart;
}

export function setEditMode(enabled) {
  editMode = enabled;
  tableElements.forEach((el) => {
    el.classList.toggle('edit-mode', enabled);
  });
  // Toggle edit overlays
  editOverlays.forEach((overlay) => {
    overlay.style.display = enabled ? 'block' : 'none';
  });
  if (!enabled) {
    // Remove all overlays when leaving edit mode
    editOverlays.forEach(o => o.remove());
    editOverlays.clear();
  } else {
    // Create overlays for existing tables
    const state = getState();
    state.tables.forEach(t => createEditOverlay(t));
  }
}

/** Full re-render of the canvas world */
export function renderAll() {
  const state = getState();
  renderTables(state.tables);
  renderSeats(state.seats, state.guests);
  renderCanvasGuests(state.guests);
}

function renderTables(tables) {
  const existingIds = new Set(tables.map(t => t.id));

  tableElements.forEach((el, id) => {
    if (!existingIds.has(id)) {
      el.remove();
      tableElements.delete(id);
    }
  });
  // Clean up orphaned overlays
  editOverlays.forEach((el, id) => {
    if (!existingIds.has(id)) {
      el.remove();
      editOverlays.delete(id);
    }
  });

  tables.forEach(table => {
    let el = tableElements.get(table.id);
    if (!el) {
      el = createTableElement(table);
      world.appendChild(el);
      tableElements.set(table.id, el);
    }
    el.style.left = `${table.x}px`;
    el.style.top = `${table.y}px`;
    el.style.width = `${table.width || CONFIG.TABLE_WIDTH}px`;
    el.style.height = `${table.height || CONFIG.TABLE_HEIGHT}px`;
    el.classList.toggle('edit-mode', editMode);

    const label = el.querySelector('.table-label');
    if (label) label.textContent = table.label;

    // Update or create edit overlay
    if (editMode) {
      updateEditOverlay(table);
    }
  });
}

function createTableElement(table) {
  const el = document.createElement('div');
  el.className = 'table-element';
  el.dataset.tableId = table.id;

  const label = document.createElement('span');
  label.className = 'table-label';
  label.textContent = table.label;
  el.appendChild(label);

  // Delete button
  const delBtn = document.createElement('button');
  delBtn.className = 'table-delete-btn';
  delBtn.innerHTML = '×';
  delBtn.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    removeTable(table.id);
    renderAll();
    updateStats();
  });
  el.appendChild(delBtn);

  // Draggable in edit mode
  el.addEventListener('mousedown', (e) => {
    if (!editMode || e.button !== 0) return;
    // Don't drag if clicking an edit control or delete button
    if (e.target.closest('.edit-overlay') || e.target.closest('.table-delete-btn')) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const { zoom } = getTransform();
    let dragDx = 0, dragDy = 0;

    function onMove(ev) {
      dragDx = (ev.clientX - startX) / zoom;
      dragDy = (ev.clientY - startY) / zoom;
      el.style.left = `${table.x + dragDx}px`;
      el.style.top = `${table.y + dragDy}px`;
      // Move associated seats and overlay visually
      const state = getState();
      state.seats.filter(s => s.tableId === table.id).forEach(s => {
        const seatEl = seatElements.get(s.id);
        if (seatEl) {
          seatEl.style.left = `${s.x + dragDx}px`;
          seatEl.style.top = `${s.y + dragDy}px`;
        }
      });
      const overlay = editOverlays.get(table.id);
      if (overlay) {
        overlay.style.left = `${table.x + dragDx - 20}px`;
        overlay.style.top = `${table.y + dragDy - 50}px`;
      }
    }

    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (Math.abs(dragDx) > 1 || Math.abs(dragDy) > 1) {
        moveTable(table.id, dragDx, dragDy);
        renderAll();
      }
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });

  // Resize handles
  const corners = ['top-left', 'bottom-left', 'bottom-right'];
  corners.forEach(corner => {
    const handle = document.createElement('div');
    handle.className = `resize-handle ${corner}`;
    
    handle.addEventListener('mousedown', (e) => {
      if (!editMode || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation(); // prevent table drag
      
      const startX = e.clientX;
      const startY = e.clientY;
      const initialW = table.width || CONFIG.TABLE_WIDTH;
      const initialH = table.height || CONFIG.TABLE_HEIGHT;
      const initialX = table.x;
      const initialY = table.y;
      const { zoom } = getTransform();

      function onResizeMove(ev) {
        const dx = (ev.clientX - startX) / zoom;
        const dy = (ev.clientY - startY) / zoom;
        
        let newW = initialW;
        let newH = initialH;
        let newX = initialX;
        let newY = initialY;

        // Calculate new dims and pos based on which corner is dragged
        if (corner.includes('right')) newW = Math.max(60, initialW + dx);
        if (corner.includes('bottom')) newH = Math.max(60, initialH + dy);
        
        if (corner.includes('left')) {
          const maxDx = initialW - 60; // can't shrink below 60px
          const effectiveDx = Math.min(dx, maxDx);
          newW = initialW - effectiveDx;
          newX = initialX + effectiveDx;
        }
        
        if (corner.includes('top')) {
          const maxDy = initialH - 60;
          const effectiveDy = Math.min(dy, maxDy);
          newH = initialH - effectiveDy;
          newY = initialY + effectiveDy;
        }

        updateTableBounds(table.id, newX, newY, newW, newH);
        renderAll();
      }

      function onResizeUp() {
        window.removeEventListener('mousemove', onResizeMove);
        window.removeEventListener('mouseup', onResizeUp);
        updateStats(); // seats may have regened
      }

      window.addEventListener('mousemove', onResizeMove);
      window.addEventListener('mouseup', onResizeUp);
    });

    el.appendChild(handle);
  });

  return el;
}

/** Create or update the edit overlay for a table (seat +/- buttons, dimension controls) */
function createEditOverlay(table) {
  if (editOverlays.has(table.id)) return;

  const overlay = document.createElement('div');
  overlay.className = 'edit-overlay';
  overlay.dataset.tableId = table.id;
  world.appendChild(overlay);
  editOverlays.set(table.id, overlay);
  updateEditOverlay(table);
}

function updateEditOverlay(table) {
  let overlay = editOverlays.get(table.id);
  if (!overlay) {
    createEditOverlay(table);
    overlay = editOverlays.get(table.id);
    if (!overlay) return;
  }

  const w = table.width || CONFIG.TABLE_WIDTH;
  const h = table.height || CONFIG.TABLE_HEIGHT;
  const sides = table.sideSeats || { top: 2, bottom: 2, left: 3, right: 3 };

  // Position the overlay to encompass the table + seat area
  overlay.style.left = `${table.x - 30}px`;
  overlay.style.top = `${table.y - 58}px`;
  overlay.style.width = `${w + 60}px`;
  overlay.style.height = `${h + 116}px`;
  overlay.style.display = editMode ? 'block' : 'none';

  overlay.innerHTML = `
    <div class="edit-side-ctrl top-ctrl" style="left:${(w + 60) / 2}px; top: 4px;">
      <button class="edit-btn minus" data-side="top" data-table="${table.id}" data-delta="-1">−</button>
      <span class="edit-count">${sides.top}</span>
      <button class="edit-btn plus" data-side="top" data-table="${table.id}" data-delta="1">+</button>
    </div>
    <div class="edit-side-ctrl bottom-ctrl" style="left:${(w + 60) / 2}px; bottom: 4px;">
      <button class="edit-btn minus" data-side="bottom" data-table="${table.id}" data-delta="-1">−</button>
      <span class="edit-count">${sides.bottom}</span>
      <button class="edit-btn plus" data-side="bottom" data-table="${table.id}" data-delta="1">+</button>
    </div>
    <div class="edit-side-ctrl left-ctrl" style="left: -2px; top: ${(h + 116) / 2}px;">
      <button class="edit-btn minus" data-side="left" data-table="${table.id}" data-delta="-1">−</button>
      <span class="edit-count">${sides.left}</span>
      <button class="edit-btn plus" data-side="left" data-table="${table.id}" data-delta="1">+</button>
    </div>
    <div class="edit-side-ctrl right-ctrl" style="right: -2px; top: ${(h + 116) / 2}px;">
      <button class="edit-btn minus" data-side="right" data-table="${table.id}" data-delta="-1">−</button>
      <span class="edit-count">${sides.right}</span>
      <button class="edit-btn plus" data-side="right" data-table="${table.id}" data-delta="1">+</button>
    </div>
    <div class="edit-dimensions" style="left:${(w + 60) / 2}px; top: ${(h + 116) / 2 + 24}px;">
      <label>W</label>
      <input type="number" class="dim-input dim-w" value="${w}" min="60" step="10" data-table="${table.id}" />
      <label>H</label>
      <input type="number" class="dim-input dim-h" value="${h}" min="60" step="10" data-table="${table.id}" />
    </div>
  `;

  // Attach events
  overlay.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const side = btn.dataset.side;
      const delta = parseInt(btn.dataset.delta);
      const tid = btn.dataset.table;
      changeSideSeats(tid, side, delta);
      renderAll();
      updateStats();
    });
  });

  overlay.querySelectorAll('.dim-input').forEach(input => {
    input.addEventListener('change', (e) => {
      e.stopPropagation();
      const tid = input.dataset.table;
      const tbl = getState().tables.find(t => t.id === tid);
      if (!tbl) return;
      const newW = input.classList.contains('dim-w') ? parseInt(input.value) : tbl.width;
      const newH = input.classList.contains('dim-h') ? parseInt(input.value) : tbl.height;
      resizeTable(tid, newW, newH);
      renderAll();
      updateStats();
    });
    // Prevent drag start on input
    input.addEventListener('mousedown', (e) => e.stopPropagation());
  });
}

function renderSeats(seats, guests) {
  const existingIds = new Set(seats.map(s => s.id));

  seatElements.forEach((el, id) => {
    if (!existingIds.has(id)) {
      el.remove();
      seatElements.delete(id);
    }
  });

  seats.forEach(seat => {
    let el = seatElements.get(seat.id);
    if (!el) {
      el = createSeatElement(seat);
      world.appendChild(el);
      seatElements.set(seat.id, el);
    }

    el.style.left = `${seat.x}px`;
    el.style.top = `${seat.y}px`;

    const isOccupied = !!seat.guestId;
    el.classList.toggle('occupied', isOccupied);

    const nameEl = el.querySelector('.seat-name');
    if (isOccupied) {
      const guest = guests.find(g => g.id === seat.guestId);
      nameEl.textContent = guest ? guest.name : '';
      el.dataset.guestId = seat.guestId; // store for drag
      el.style.cursor = 'grab';
    } else {
      nameEl.textContent = '';
      delete el.dataset.guestId;
      el.style.cursor = 'default';
    }
  });
}

function createSeatElement(seat) {
  const el = document.createElement('div');
  el.className = 'seat-placeholder';
  el.dataset.seatId = seat.id;

  const name = document.createElement('span');
  name.className = 'seat-name';
  el.appendChild(name);

  // Allow dragging seated guests
  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || isSpaceHeld() || !el.dataset.guestId) return;
    e.preventDefault();
    e.stopPropagation();
    if (onGuestDragStart) onGuestDragStart(el.dataset.guestId, e.clientX, e.clientY, 'seat');
  });

  return el;
}

function renderCanvasGuests(guests) {
  const freeGuests = guests.filter(g => g.x !== null && g.y !== null && !g.seatId);
  const freeGuestIds = new Set(freeGuests.map(g => g.id));

  canvasGuestElements.forEach((el, id) => {
    if (!freeGuestIds.has(id)) {
      el.remove();
      canvasGuestElements.delete(id);
    }
  });

  freeGuests.forEach(guest => {
    let el = canvasGuestElements.get(guest.id);
    if (!el) {
      el = createCanvasGuestElement(guest);
      world.appendChild(el);
      canvasGuestElements.set(guest.id, el);
    }
    el.style.left = `${guest.x}px`;
    el.style.top = `${guest.y}px`;
    el.textContent = guest.name;
  });
}

function createCanvasGuestElement(guest) {
  const el = document.createElement('div');
  el.className = 'guest-on-canvas';
  el.dataset.guestId = guest.id;
  el.textContent = guest.name;

  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || isSpaceHeld()) return;
    e.preventDefault();
    e.stopPropagation();
    if (onGuestDragStart) onGuestDragStart(guest.id, e.clientX, e.clientY, 'canvas');
  });

  return el;
}

/** Highlight a seat as snap target */
export function highlightSeat(seatId) {
  seatElements.forEach((el, id) => {
    el.classList.toggle('snap-target', id === seatId);
  });
}

/** Clear all seat highlights */
export function clearSeatHighlights() {
  seatElements.forEach((el) => {
    el.classList.remove('snap-target');
  });
}

/** Find nearest empty seat to world position within snap radius */
export function findNearestSeat(worldX, worldY, draggingGuestId = null) {
  const state = getState();
  let bestDist = CONFIG.SNAP_RADIUS;
  let bestSeat = null;

  state.seats.forEach(seat => {
    if (seat.guestId && seat.guestId !== draggingGuestId) return;
    const cx = seat.x + CONFIG.SEAT_WIDTH / 2;
    const cy = seat.y + CONFIG.SEAT_HEIGHT / 2;
    const dist = Math.hypot(worldX - cx, worldY - cy);
    if (dist < bestDist) {
      bestDist = dist;
      bestSeat = seat;
    }
  });

  return bestSeat;
}

/** Update the stats display */
export function updateStats() {
  const state = getState();
  const seated = state.guests.filter(g => g.seatId).length;
  const total = state.guests.length;
  document.getElementById('stat-seated').textContent = seated;
  document.getElementById('stat-unseated').textContent = total - seated;
  document.getElementById('guest-count').textContent = total;
}
