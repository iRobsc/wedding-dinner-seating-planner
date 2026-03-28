/**
 * Drag-and-drop engine.
 * Handles dragging guests from sidebar → canvas, canvas → canvas,
 * snapping to seats, free placement, and returning to sidebar.
 */
import { getState, seatGuest, unseatGuest, placeGuestFree } from './state.js';
import { screenToWorld, getTransform, isSpaceHeld } from './canvas.js';
import { renderAll, highlightSeat, clearSeatHighlights, findNearestSeat, updateStats } from './render.js';
import { renderSidebar } from './guests.js';
import { CONFIG } from './config.js';

let ghost = null;
let dragGuestId = null;
let dragSource = null; // 'sidebar' | 'canvas'
let isDragging = false;

export function initDrag() {
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', onDragEnd);
}

/** Start dragging a guest */
export function startDrag(guestId, clientX, clientY, source) {
  if (isSpaceHeld()) return;

  dragGuestId = guestId;
  dragSource = source;
  isDragging = true;

  const state = getState();
  const guest = state.guests.find(g => g.id === guestId);
  if (!guest) return;

  // Create ghost element
  ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.textContent = guest.name;
  ghost.style.left = `${clientX}px`;
  ghost.style.top = `${clientY}px`;
  document.body.appendChild(ghost);

  // If dragging from canvas, hide the canvas element
  if (source === 'canvas') {
    const canvasEl = document.querySelector(`.guest-on-canvas[data-guest-id="${guestId}"]`);
    if (canvasEl) canvasEl.style.opacity = '0.2';
  } else if (source === 'seat') {
    // Unseat immediately so the seat appears empty while dragging
    unseatGuest(guestId);
    renderAll();
    renderSidebar();
    updateStats();
  }
}

function onDragMove(e) {
  if (!isDragging || !ghost) return;

  ghost.style.left = `${e.clientX}px`;
  ghost.style.top = `${e.clientY}px`;

  // Check if hovering over canvas (not sidebar)
  const sidebar = document.getElementById('sidebar');
  const sidebarRect = sidebar.getBoundingClientRect();

  if (e.clientX < sidebarRect.left) {
    // Over canvas — find nearest seat
    const worldPos = screenToWorld(e.clientX, e.clientY);
    const nearestSeat = findNearestSeat(worldPos.x, worldPos.y, dragGuestId);
    if (nearestSeat) {
      highlightSeat(nearestSeat.id);
    } else {
      clearSeatHighlights();
    }
  } else {
    clearSeatHighlights();
  }
}

function onDragEnd(e) {
  if (!isDragging) return;
  isDragging = false;

  // Remove ghost
  if (ghost) {
    ghost.remove();
    ghost = null;
  }

  clearSeatHighlights();

  if (!dragGuestId) return;

  const sidebar = document.getElementById('sidebar');
  const sidebarRect = sidebar.getBoundingClientRect();

  if (e.clientX >= sidebarRect.left) {
    // Dropped on sidebar — unseat guest
    unseatGuest(dragGuestId);
  } else {
    // Dropped on canvas — check for seat snap
    const worldPos = screenToWorld(e.clientX, e.clientY);
    const nearestSeat = findNearestSeat(worldPos.x, worldPos.y, dragGuestId);

    if (nearestSeat) {
      seatGuest(dragGuestId, nearestSeat.id);
    } else {
      placeGuestFree(dragGuestId, worldPos.x, worldPos.y);
    }
  }

  dragGuestId = null;
  dragSource = null;

  // Re-render everything
  renderAll();
  renderSidebar();
  updateStats();
}

export function isDragActive() {
  return isDragging;
}
