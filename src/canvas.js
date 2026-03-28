/**
 * Infinite canvas with Figma-like pan (Space+drag) and zoom (scroll wheel).
 * Manages coordinate transforms between screen and world space.
 */
import { CONFIG } from './config.js';
import { getState, setCanvasTransform } from './state.js';

let viewport = null;
let world = null;

let panX = 0;
let panY = 0;
let zoom = 1;

let isPanning = false;
let spaceHeld = false;
let panStartX = 0;
let panStartY = 0;
let panStartPanX = 0;
let panStartPanY = 0;

let onTransformChange = null;

/** Initialize the canvas engine */
export function initCanvas(onUpdate) {
  viewport = document.getElementById('canvas-viewport');
  world = document.getElementById('canvas-world');
  onTransformChange = onUpdate;

  // Load saved transform
  const state = getState();
  panX = state.canvas.panX;
  panY = state.canvas.panY;
  zoom = state.canvas.zoom;
  applyTransform();

  // Zoom with mouse wheel
  viewport.addEventListener('wheel', handleWheel, { passive: false });

  // Pan with Space + drag
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  viewport.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);

  // Toolbar buttons
  document.getElementById('btn-zoom-in').addEventListener('click', () => {
    zoomBy(0.15, viewport.clientWidth / 2, viewport.clientHeight / 2);
  });
  document.getElementById('btn-zoom-out').addEventListener('click', () => {
    zoomBy(-0.15, viewport.clientWidth / 2, viewport.clientHeight / 2);
  });
  document.getElementById('btn-zoom-fit').addEventListener('click', zoomToFit);

  updateZoomLabel();
}

/** Convert screen coords to world coords */
export function screenToWorld(screenX, screenY) {
  const rect = viewport.getBoundingClientRect();
  const sx = screenX - rect.left;
  const sy = screenY - rect.top;
  return {
    x: (sx - panX) / zoom,
    y: (sy - panY) / zoom,
  };
}

/** Convert world coords to screen coords */
export function worldToScreen(worldX, worldY) {
  const rect = viewport.getBoundingClientRect();
  return {
    x: worldX * zoom + panX + rect.left,
    y: worldY * zoom + panY + rect.top,
  };
}

/** Get current transform values */
export function getTransform() {
  return { panX, panY, zoom };
}

function applyTransform() {
  world.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  updateZoomLabel();
}

function updateZoomLabel() {
  const label = document.getElementById('zoom-level');
  if (label) label.textContent = `${Math.round(zoom * 100)}%`;
}

function clampZoom(z) {
  return Math.min(CONFIG.MAX_ZOOM, Math.max(CONFIG.MIN_ZOOM, z));
}

function zoomBy(delta, cx, cy) {
  const oldZoom = zoom;
  zoom = clampZoom(zoom + delta);
  // Zoom towards the center point
  panX = cx - (cx - panX) * (zoom / oldZoom);
  panY = cy - (cy - panY) * (zoom / oldZoom);
  applyTransform();
  persistTransform();
  if (onTransformChange) onTransformChange();
}

function handleWheel(e) {
  e.preventDefault();
  const rect = viewport.getBoundingClientRect();
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;
  const delta = -e.deltaY * CONFIG.ZOOM_SPEED * zoom;
  zoomBy(delta, cx, cy);
}

function handleKeyDown(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    return;
  }
  if (e.code === 'Space' && !e.repeat) {
    e.preventDefault();
    spaceHeld = true;
    viewport.classList.add('panning');
  }
}

function handleKeyUp(e) {
  if (e.code === 'Space') {
    spaceHeld = false;
    if (!isPanning) {
      viewport.classList.remove('panning');
    }
  }
}

function handleMouseDown(e) {
  // Middle mouse button always pans
  if (e.button === 1 || (spaceHeld && e.button === 0)) {
    e.preventDefault();
    isPanning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    panStartPanX = panX;
    panStartPanY = panY;
    viewport.classList.add('panning');
  }
}

function handleMouseMove(e) {
  if (!isPanning) return;
  const dx = e.clientX - panStartX;
  const dy = e.clientY - panStartY;
  panX = panStartPanX + dx;
  panY = panStartPanY + dy;
  applyTransform();
}

function handleMouseUp(e) {
  if (isPanning) {
    isPanning = false;
    if (!spaceHeld) {
      viewport.classList.remove('panning');
    }
    persistTransform();
    if (onTransformChange) onTransformChange();
  }
}

function persistTransform() {
  setCanvasTransform(panX, panY, zoom);
}

function zoomToFit() {
  const state = getState();
  if (state.tables.length === 0) return;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  state.tables.forEach(t => {
    minX = Math.min(minX, t.x - 80);
    minY = Math.min(minY, t.y - 60);
    maxX = Math.max(maxX, t.x + (t.width || CONFIG.TABLE_WIDTH) + 80);
    maxY = Math.max(maxY, t.y + (t.height || CONFIG.TABLE_HEIGHT) + 60);
  });

  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;

  zoom = clampZoom(Math.min(vw / contentW, vh / contentH) * 0.85);
  panX = (vw - contentW * zoom) / 2 - minX * zoom;
  panY = (vh - contentH * zoom) / 2 - minY * zoom;

  applyTransform();
  persistTransform();
  if (onTransformChange) onTransformChange();
}

/** Check if space is currently held (for drag disambiguation) */
export function isSpaceHeld() {
  return spaceHeld;
}

/** Check if currently panning */
export function isCurrentlyPanning() {
  return isPanning;
}
