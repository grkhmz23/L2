/**
 * Sable theme foundation
 * Deep-black primary, muted gold accent, monospace numerics.
 */

export const theme = {
  colors: {
    bg: '#030303',
    panel: 'rgba(255, 255, 255, 0.03)',
    border: 'rgba(255, 255, 255, 0.08)',
    text: '#f3f4f6',
    muted: '#a1a1aa',
    accent: '#d6be70',
    accent2: '#bf953f',
    danger: '#fb7185',
  },
  fonts: {
    sans: 'var(--font-sans), sans-serif',
    display: 'var(--font-display), serif',
    mono: 'var(--font-mono), monospace',
  },
} as const;
