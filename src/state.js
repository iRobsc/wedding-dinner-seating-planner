/**
 * State management with localStorage persistence.
 * Single source of truth for all app data.
 *
 * Each table now has per-side seat counts: { top, bottom, left, right }
 */
import { CONFIG } from './config.js';
import defaultStateData from './defaultState.json';

let state = null;
let saveTimeout = null;

/** Generate a short unique ID */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Generate seats around a table based on per-side counts.
 * table.sideSeats = { top: N, bottom: N, left: N, right: N }
 */
function generateSeats(table) {
  const seats = [];
  const w = table.width || CONFIG.TABLE_WIDTH;
  const h = table.height || CONFIG.TABLE_HEIGHT;
  const sw = CONFIG.SEAT_WIDTH;
  const sh = CONFIG.SEAT_HEIGHT;
  const gap = CONFIG.SEAT_GAP;

  const sides = table.sideSeats || { top: 2, bottom: 2, left: 3, right: 3 };

  // Top seats — centered horizontally
  for (let i = 0; i < sides.top; i++) {
    const totalWidth = sides.top * sw + (sides.top - 1) * 4;
    const startX = table.x + (w - totalWidth) / 2;
    seats.push({
      id: uid(), tableId: table.id, side: 'top', index: i,
      x: startX + i * (sw + 4),
      y: table.y - sh - gap,
      guestId: null,
    });
  }

  // Bottom seats — centered horizontally
  for (let i = 0; i < sides.bottom; i++) {
    const totalWidth = sides.bottom * sw + (sides.bottom - 1) * 4;
    const startX = table.x + (w - totalWidth) / 2;
    seats.push({
      id: uid(), tableId: table.id, side: 'bottom', index: i,
      x: startX + i * (sw + 4),
      y: table.y + h + gap,
      guestId: null,
    });
  }

  // Left seats — evenly distributed vertically
  for (let i = 0; i < sides.left; i++) {
    const spacing = h / (sides.left + 1);
    seats.push({
      id: uid(), tableId: table.id, side: 'left', index: i,
      x: table.x - sw - gap,
      y: table.y + spacing * (i + 1) - sh / 2,
      guestId: null,
    });
  }

  // Right seats — evenly distributed vertically
  for (let i = 0; i < sides.right; i++) {
    const spacing = h / (sides.right + 1);
    seats.push({
      id: uid(), tableId: table.id, side: 'right', index: i,
      x: table.x + w + gap,
      y: table.y + spacing * (i + 1) - sh / 2,
      guestId: null,
    });
  }

  return seats;
}

/** Migrate old tables that don't have sideSeats to the new format */
function migrateTable(table) {
  if (!table.sideSeats) {
    const count = table.seatCount || CONFIG.DEFAULT_SEATS_PER_TABLE;
    if (count <= 4) {
      table.sideSeats = { top: Math.ceil(count / 2), bottom: count - Math.ceil(count / 2), left: 0, right: 0 };
    } else {
      const topCount = 2;
      const bottomCount = 2;
      const remaining = count - topCount - bottomCount;
      table.sideSeats = { top: topCount, bottom: bottomCount, left: Math.floor(remaining / 2), right: remaining - Math.floor(remaining / 2) };
    }
  }
  return table;
}

/** Create the default initial state */
function createDefaultState() {
  return JSON.parse(JSON.stringify(defaultStateData));
}

/** Load state from localStorage or use defaults */
export function loadState() {
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
    if (raw) {
      state = JSON.parse(raw);
      if (!state.canvas) state.canvas = { panX: 0, panY: 0, zoom: 0.85 };
      if (!state.guests) state.guests = [];
      if (!state.tables) state.tables = [];
      if (!state.seats) state.seats = [];
      if (!state.nextTableNumber) state.nextTableNumber = state.tables.length + 1;
      if (!state.theme) state.theme = 'dark';
      // Migrate old tables
      state.tables.forEach(t => migrateTable(t));
      return state;
    }
  } catch (e) {
    console.warn('Failed to load state from localStorage:', e);
  }
  state = createDefaultState();
  saveState();
  return state;
}

/** Get current state */
export function getState() {
  if (!state) return loadState();
  return state;
}

/** Save state to localStorage (debounced) */
export function saveState() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save state:', e);
    }
  }, CONFIG.SAVE_DEBOUNCE);
}

/** Force immediate save */
export function saveStateNow() {
  if (saveTimeout) clearTimeout(saveTimeout);
  try {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save state:', e);
  }
}

/** Clear all state and reset to defaults */
export function resetState() {
  state = createDefaultState();
  saveStateNow();
  return state;
}

// ---- Guest operations ----

export function addGuest(name) {
  const guest = { id: uid(), name: name.trim(), seatId: null, x: null, y: null };
  state.guests.push(guest);
  saveState();
  return guest;
}

export function removeGuest(guestId) {
  const seat = state.seats.find(s => s.guestId === guestId);
  if (seat) seat.guestId = null;
  state.guests = state.guests.filter(g => g.id !== guestId);
  saveState();
}

export function seatGuest(guestId, seatId) {
  const guest = state.guests.find(g => g.id === guestId);
  if (!guest) return;
  if (guest.seatId) {
    const prevSeat = state.seats.find(s => s.id === guest.seatId);
    if (prevSeat) prevSeat.guestId = null;
  }
  guest.x = null;
  guest.y = null;
  const seat = state.seats.find(s => s.id === seatId);
  if (seat) {
    if (seat.guestId) {
      const displaced = state.guests.find(g => g.id === seat.guestId);
      if (displaced) { displaced.seatId = null; displaced.x = null; displaced.y = null; }
    }
    seat.guestId = guestId;
    guest.seatId = seatId;
  }
  saveState();
}

export function unseatGuest(guestId) {
  const guest = state.guests.find(g => g.id === guestId);
  if (!guest) return;
  if (guest.seatId) {
    const seat = state.seats.find(s => s.id === guest.seatId);
    if (seat) seat.guestId = null;
    guest.seatId = null;
  }
  guest.x = null;
  guest.y = null;
  saveState();
}

export function placeGuestFree(guestId, x, y) {
  const guest = state.guests.find(g => g.id === guestId);
  if (!guest) return;
  if (guest.seatId) {
    const seat = state.seats.find(s => s.id === guest.seatId);
    if (seat) seat.guestId = null;
    guest.seatId = null;
  }
  guest.x = x;
  guest.y = y;
  saveState();
}

// ---- Table operations ----

export function addTable() {
  const num = state.nextTableNumber++;
  const table = migrateTable({
    id: uid(),
    label: `Table ${num}`,
    x: 400, y: 400,
    width: CONFIG.TABLE_WIDTH,
    height: CONFIG.TABLE_HEIGHT,
    seatCount: CONFIG.DEFAULT_SEATS_PER_TABLE,
  });
  state.tables.push(table);
  const newSeats = generateSeats(table);
  state.seats.push(...newSeats);
  saveState();
  return table;
}

export function removeTable(tableId) {
  state.seats.filter(s => s.tableId === tableId).forEach(s => {
    if (s.guestId) {
      const g = state.guests.find(g2 => g2.id === s.guestId);
      if (g) { g.seatId = null; g.x = null; g.y = null; }
    }
  });
  state.seats = state.seats.filter(s => s.tableId !== tableId);
  state.tables = state.tables.filter(t => t.id !== tableId);
  saveState();
}

export function moveTable(tableId, dx, dy) {
  const table = state.tables.find(t => t.id === tableId);
  if (!table) return;
  table.x += dx;
  table.y += dy;
  state.seats.filter(s => s.tableId === tableId).forEach(s => {
    s.x += dx;
    s.y += dy;
  });
  saveState();
}

/**
 * Change the seat count on a specific side of a table.
 * Preserves guest assignments where possible.
 */
export function changeSideSeats(tableId, side, delta) {
  const table = state.tables.find(t => t.id === tableId);
  if (!table) return;

  const newCount = Math.max(0, (table.sideSeats[side] || 0) + delta);
  table.sideSeats[side] = newCount;

  // Regenerate all seats for this table, preserving guests where possible
  regenerateTableSeats(tableId);
  saveState();
}

/**
 * Resize a table — update width/height, then regenerate seats.
 */
export function resizeTable(tableId, width, height) {
  const table = state.tables.find(t => t.id === tableId);
  if (!table) return;
  table.width = Math.max(60, width);
  table.height = Math.max(60, height);
  regenerateTableSeats(tableId);
  saveState();
}

/**
 * Update table bounds (x, y, width, height) and regenerate seats.
 * Used for interactive corner dragging.
 */
export function updateTableBounds(tableId, x, y, width, height) {
  const table = state.tables.find(t => t.id === tableId);
  if (!table) return;
  table.x = x;
  table.y = y;
  table.width = Math.max(60, width);
  table.height = Math.max(60, height);
  regenerateTableSeats(tableId);
  saveState();
}

/**
 * Regenerate seats for a table. Tries to preserve guest assignments.
 */
function regenerateTableSeats(tableId) {
  const table = state.tables.find(t => t.id === tableId);
  if (!table) return;

  // Collect existing guest assignments
  const oldSeats = state.seats.filter(s => s.tableId === tableId);
  const assignments = {}; // side+index → guestId
  oldSeats.forEach(s => {
    if (s.guestId) {
      assignments[`${s.side}-${s.index}`] = s.guestId;
    }
  });

  // Remove old seats
  state.seats = state.seats.filter(s => s.tableId !== tableId);

  // Generate new seats
  const newSeats = generateSeats(table);

  // Restore guest assignments where possible
  const displacedGuests = [];
  const restoredGuestIds = new Set();

  newSeats.forEach(s => {
    const key = `${s.side}-${s.index}`;
    if (assignments[key]) {
      s.guestId = assignments[key];
      restoredGuestIds.add(assignments[key]);
    }
  });

  // Find guests that lost their seats
  Object.values(assignments).forEach(guestId => {
    if (!restoredGuestIds.has(guestId)) {
      const guest = state.guests.find(g => g.id === guestId);
      if (guest) {
        guest.seatId = null;
        guest.x = null;
        guest.y = null;
      }
    }
  });

  // Update guest seatId references
  newSeats.forEach(s => {
    if (s.guestId) {
      const guest = state.guests.find(g => g.id === s.guestId);
      if (guest) guest.seatId = s.id;
    }
  });

  state.seats.push(...newSeats);
}

// ---- Canvas operations ----

export function setCanvasTransform(panX, panY, zoom) {
  state.canvas.panX = panX;
  state.canvas.panY = panY;
  state.canvas.zoom = zoom;
  saveState();
}

export function setEditMode(enabled) {
  state.editMode = enabled;
}

// ---- Theme ----

export function setTheme(theme) {
  state.theme = theme;
  saveState();
}

export function getTheme() {
  return state ? state.theme : 'dark';
}
