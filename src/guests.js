/**
 * Guest sidebar — add guests, render the guest list, handle sidebar drag starts.
 */
import { getState, addGuest, removeGuest } from './state.js';
import { startDrag } from './drag.js';
import { renderAll, updateStats } from './render.js';
import { isSpaceHeld } from './canvas.js';

let guestListEl = null;
let inputEl = null;

export function initGuests() {
  guestListEl = document.getElementById('guest-list');
  inputEl = document.getElementById('guest-input');
  const addBtn = document.getElementById('btn-add-guest');

  addBtn.addEventListener('click', handleAddGuest);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAddGuest();
  });

  renderSidebar();
  updateStats();
}

function handleAddGuest() {
  const name = inputEl.value.trim();
  if (!name) return;
  addGuest(name);
  inputEl.value = '';
  inputEl.focus();
  renderSidebar();
  renderAll();
  updateStats();
}

/** Render the sidebar guest list */
export function renderSidebar() {
  const state = getState();
  guestListEl.innerHTML = '';

  // Show unassigned guests (no seat and no free position)
  const unassigned = state.guests.filter(g => !g.seatId && g.x === null);
  // Show seated/placed guests with a different style
  const seated = state.guests.filter(g => g.seatId || g.x !== null);

  // Unassigned first
  unassigned.forEach(guest => {
    guestListEl.appendChild(createGuestCard(guest, false));
  });

  // Then seated (greyed out)
  if (seated.length > 0 && unassigned.length > 0) {
    const divider = document.createElement('div');
    divider.style.cssText = 'height:1px;background:rgba(255,255,255,0.06);margin:8px 0;';
    guestListEl.appendChild(divider);
  }

  seated.forEach(guest => {
    guestListEl.appendChild(createGuestCard(guest, true));
  });
}

function createGuestCard(guest, isSeated) {
  const card = document.createElement('div');
  card.className = `guest-card${isSeated ? ' seated' : ''}`;
  card.dataset.guestId = guest.id;

  const dot = document.createElement('span');
  dot.className = 'guest-dot';

  const name = document.createElement('span');
  name.className = 'guest-name';
  name.textContent = guest.name;

  const removeBtn = document.createElement('button');
  removeBtn.className = 'guest-remove';
  removeBtn.innerHTML = '×';
  removeBtn.addEventListener('mousedown', (e) => {
    e.stopPropagation(); // prevent drag from starting
  });
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    removeGuest(guest.id);
    renderSidebar();
    renderAll();
    updateStats();
  });

  card.appendChild(dot);
  card.appendChild(name);
  card.appendChild(removeBtn);

  // Drag start
  card.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || isSpaceHeld()) return;
    e.preventDefault();
    startDrag(guest.id, e.clientX, e.clientY, 'sidebar');
  });

  return card;
}
