/**
 * Configurable defaults for the seating planner.
 * Modify these values to change table sizes, seat counts, spacing, etc.
 */
export const CONFIG = {
  // Table dimensions
  TABLE_WIDTH: 160,
  TABLE_HEIGHT: 140,

  // Seat configuration
  SEAT_WIDTH: 72,
  SEAT_HEIGHT: 30,
  SEAT_GAP: 12,              // Gap between seat and table edge
  DEFAULT_SEATS_PER_TABLE: 10,

  // Snap radius — how close a guest must be to snap to a seat
  SNAP_RADIUS: 60,

  // Canvas navigation
  MIN_ZOOM: 0.15,
  MAX_ZOOM: 3,
  ZOOM_SPEED: 0.0015,

  // Default table layout — 10 tables in a 3-4-3 grid
  DEFAULT_TABLES: [
    // Row 1: 3 tables
    { id: 't1',  label: 'Table 1',  x: 200,  y: 100,  width: 160, height: 140, seatCount: 10 },
    { id: 't2',  label: 'Table 2',  x: 600,  y: 100,  width: 160, height: 140, seatCount: 10 },
    { id: 't3',  label: 'Table 3',  x: 1000, y: 100,  width: 160, height: 140, seatCount: 10 },
    // Row 2: 4 tables
    { id: 't4',  label: 'Table 4',  x: 0,    y: 420,  width: 160, height: 140, seatCount: 10 },
    { id: 't5',  label: 'Table 5',  x: 400,  y: 420,  width: 160, height: 140, seatCount: 10 },
    { id: 't6',  label: 'Table 6',  x: 800,  y: 420,  width: 160, height: 140, seatCount: 10 },
    { id: 't7',  label: 'Table 7',  x: 1200, y: 420,  width: 160, height: 140, seatCount: 10 },
    // Row 3: 3 tables
    { id: 't8',  label: 'Table 8',  x: 200,  y: 740,  width: 160, height: 140, seatCount: 10 },
    { id: 't9',  label: 'Table 9',  x: 600,  y: 740,  width: 160, height: 140, seatCount: 10 },
    { id: 't10', label: 'Table 10', x: 1000, y: 740,  width: 160, height: 140, seatCount: 10 },
  ],

  // localStorage key
  STORAGE_KEY: 'wedding-seating-planner',

  // Debounce save interval (ms)
  SAVE_DEBOUNCE: 300,
};
