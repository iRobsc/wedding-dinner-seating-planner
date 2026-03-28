/**
 * Wedding Seating Planner — Main entry point
 */
import './style.css';
import { loadState, resetState, addTable, getState, setEditMode as stateSetEditMode, setTheme, getTheme } from './state.js';
import { initCanvas } from './canvas.js';
import { initRender, renderAll, setEditMode, updateStats } from './render.js';
import { initDrag, startDrag } from './drag.js';
import { initGuests, renderSidebar } from './guests.js';

function init() {
  // Load persisted state (or defaults)
  loadState();

  // Apply saved theme
  applyTheme(getTheme());

  // Initialize rendering
  initRender({
    onGuestDragStart: startDrag,
  });

  // Initialize canvas (pan/zoom)
  initCanvas(() => {});

  // Initialize drag-and-drop
  initDrag();

  // Initialize guest sidebar
  initGuests();

  // Initial render
  renderAll();
  updateStats();

  // Setup toolbar buttons
  setupToolbar();

  // Edit mode badge
  const badge = document.createElement('div');
  badge.className = 'edit-mode-badge';
  badge.id = 'edit-mode-badge';
  badge.textContent = '✏️ Layout Edit Mode — Drag tables, adjust seats per side, resize tables';
  document.body.appendChild(badge);
}

function setupToolbar() {
  const editBtn = document.getElementById('btn-edit-mode');
  const addTableBtn = document.getElementById('btn-add-table');
  const clearBtn = document.getElementById('btn-clear-all');
  const themeBtn = document.getElementById('btn-theme-toggle');

  let isEditMode = false;

  editBtn.addEventListener('click', () => {
    isEditMode = !isEditMode;
    editBtn.classList.toggle('active', isEditMode);
    addTableBtn.style.display = isEditMode ? 'inline-flex' : 'none';
    setEditMode(isEditMode);
    stateSetEditMode(isEditMode);

    const badgeEl = document.getElementById('edit-mode-badge');
    badgeEl.classList.toggle('visible', isEditMode);
  });

  addTableBtn.addEventListener('click', () => {
    addTable();
    renderAll();
    updateStats();
  });

  clearBtn.addEventListener('click', () => {
    if (confirm('Reset all data? This will remove all guests, tables, and return to the default layout.')) {
      resetState();
      renderAll();
      renderSidebar();
      updateStats();
      isEditMode = false;
      editBtn.classList.remove('active');
      addTableBtn.style.display = 'none';
      setEditMode(false);
      stateSetEditMode(false);
      const badgeEl = document.getElementById('edit-mode-badge');
      badgeEl.classList.remove('visible');
    }
  });

  // Theme toggle
  themeBtn.addEventListener('click', () => {
    const current = getTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  });
}

function applyTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  document.getElementById('theme-icon-moon').style.display = theme === 'dark' ? 'block' : 'none';
  document.getElementById('theme-icon-sun').style.display = theme === 'light' ? 'block' : 'none';
}

// Boot
document.addEventListener('DOMContentLoaded', init);
