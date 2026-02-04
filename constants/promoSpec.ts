/**
 * Heres Promo Video Spec (15s) — Developer-Generatable Parameters
 * Capsule Open + Execution Burst Version
 * Use for Three.js, Canvas 2D, GLSL, WebGPU, or GSAP timeline.
 */

// ─── 0. Video Metadata ─────────────────────────────────────────────────────
export const PROMO_VIDEO = {
  VIDEO_DURATION: 15.0,
  FPS: 60,
  RESOLUTION_WIDTH: 1920,
  RESOLUTION_HEIGHT: 1080,
  STYLE: 'futuristic minimal Solana motion',
  BACKGROUND: 'near-black',
  PRIMARY_ACCENT: 'cyan/purple glow',
} as const

// ─── 1. Timeline Scene Boundaries (seconds) ────────────────────────────────
export const PROMO_TIMELINE = {
  SCENE1_END: 2.0,
  SCENE2_END: 5.0,
  SCENE3_END: 8.5,
  SCENE4_END: 12.0,
  SCENE5_END: 15.0,
} as const

// ─── Scene 1 — Opening Title (0.0s → 2.0s) ─────────────────────────────────
export const PROMO_SCENE1 = {
  TEXT_TITLE: 'Unleash the Power of Heres',
  TEXT_SUB: 'People disappear. Intent should not.',
  TEXT_FADE_IN: {
    START: 0.0,
    DURATION: 0.6,
    TRANSLATE_Y_FROM: 40,
    TRANSLATE_Y_TO: 0,
    EASING: 'power2.out',
  },
  GRID_ROTATION_SPEED_DEG_PER_SEC: 6,
  GRID_OPACITY: 0.12,
} as const

// ─── Scene 2 — Define Capsule Intent (2.0s → 5.0s) ────────────────────────
export const PROMO_SCENE2 = {
  TEXT_TITLE: 'Lock SOL. Set beneficiaries & inactivity.',
  TEXT_SUB: 'One capsule. Your rules. On Solana.',
  CAPSULE_CLOSED: true,
  CAPSULE_FLOAT: {
    AMPLITUDE_PX: 14,
    LOOP_PERIOD_S: 1.6,
  },
  INTENT_PARTICLES: {
    SPAWN_RATE: 'low',
    DRIFT_SPEED: 'verySlow',
  },
} as const

// ─── Scene 3 — Private Monitoring (5.0s → 8.5s) ───────────────────────────
export const PROMO_SCENE3 = {
  TEXT_TITLE: 'Conditions stay private in PER (TEE)',
  TEXT_SUB: 'No one sees until execution.',
  SCAN_BEAM: {
    OPACITY: 0.6,
    BEAM_WIDTH_PX: 80,
    SWEEP_DURATION_S: 2.0,
    COLOR: 'cyan-white',
  },
  CAPSULE_EDGE_GLOW_INCREASE: 0.25,
} as const

// ─── Scene 4 — Capsule Opens + Execution Burst (8.5s → 12.0s) ─────────────
export const PROMO_SCENE4 = {
  TEXT_TITLE: 'When silence becomes truth…',
  TEXT_SUB: 'Execution is automatic on Solana.',

  // Capsule opening
  OPEN_START: 8.8,
  OPEN_PEAK: 9.3,
  OPEN_END: 10.0,
  CAPSULE_SPLIT_DISTANCE_PX: 200,
  CAPSULE_SPLIT_EASING: 'power2.out',

  // Execution burst light
  BURST_START: 9.15,
  BURST_PEAK: 9.25,
  BURST_FADE: 9.8,
  BURST_LIGHT: {
    SHAPE: 'radialSphere',
    RADIUS_PX: 500,
    BLUR_PX: 20,
    COLOR_GRADIENT: 'cyan → purple → transparent',
  },

  // Execution lines (transaction trigger)
  EXECUTION_LINES_COUNT: 6,
  EXECUTION_LINES_ANGLES_DEG: [0, 60, 120, 180, 240, 300],
  LINE_EXPANSION: {
    START_LENGTH_PX: 0,
    MAX_LENGTH_PX: 800,
    DURATION_S: 0.7,
    EASING: 'power2.out',
  },
  LINE_OPACITY: {
    PEAK: 0.8,
    FADE_OUT_DURATION_S: 1.0,
  },

  // Global screen flash (impact frame)
  FLASH_FRAME_TIME: 9.25,
  FLASH_DURATION_S: 0.15,
  FLASH_OPACITY: 0.8,
  FLASH_COLOR: 'pureWhite',

  // Particle burst (optional)
  PARTICLE_BURST_COUNT: 35,
  BURST_VELOCITY: 'high',
  PARTICLE_LIFETIME_S: 1.2,
  PARTICLE_FADE_OUT: true,
} as const

// ─── Scene 5 — Closing Statement (12.0s → 15.0s) ──────────────────────────
export const PROMO_SCENE5 = {
  TEXT_TITLE: 'Zero trust executor. No keys held by anyone.',
  TEXT_SUB: 'heres.vercel.app',
  CAPSULE_GLOW: 'maximum',
  CAPSULE_HALVES: 're-center OR dissolve',
  GLOBAL_FADE_OUT: {
    START: 14.2,
    DURATION_S: 0.8,
  },
} as const

// ─── 2. Visual Style Controls (Developer Parameters) ────────────────────────
export const PROMO_STYLE = {
  // Rotation / movement
  GRID_ROTATION_SPEED_DEG_PER_SEC: 6,
  CAPSULE_FLOAT_AMPLITUDE_PX: 14,
  TEXT_SLIDE_DISTANCE_PX: 40,
  TRIGGER_FLASH_SCALE: 1.08,

  // Color ratio (cyan / purple)
  ACCENT_RATIO: {
    CYAN_PERCENT: 65,
    PURPLE_PERCENT: 35,
  },
  BACKGROUND_BRIGHTNESS_PERCENT: 8, // 8–12%
  TEXT_COLOR: '#F8FAFF',
  HIGHLIGHT_GLOW_STRENGTH: 0.4, // +40%

  // Particle / beam / grid
  PARTICLE_DENSITY_MAX: 120,
  PARTICLE_DRIFT_SPEED_PX_PER_FRAME: 0.2,
  SCAN_BEAM_OPACITY: 0.6,
  GRID_OPACITY: 0.12,
  TRIGGER_BURST_PARTICLES: 35,
  EXECUTION_LINE_BLUR_PX: 1,

  // Capsule shape
  CAPSULE_WIDTH_PX: 280,
  CAPSULE_HEIGHT_PX: 520,
  CAPSULE_RADIUS_PX: 180,
  SHAPE_VARIANT: 'elongated' as 'elongated' | 'thick' | 'sharp',
} as const

// ─── 4. Output (for export / recording) ─────────────────────────────────────
export const PROMO_OUTPUT = {
  OUTPUT_FILE: 'heres_promo_15s.mp4',
  CODEC: 'H.264',
  FPS: 60,
  USE_CASE: 'Landing hero section / Hackathon demo / Twitter promo',
} as const
