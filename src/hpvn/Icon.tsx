// Line icons in the HPVN Game Zone style (Undercover / 7 Potters / Puzzles use stroke icons, not emoji).
const PATHS = {
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3',
  land: 'M3 21h18M5 21V10l4-3 4 3v11M13 21v-7h6v7M8 14h2M8 17h2',
  scroll: 'M8 4h11v13a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-1h11v1a3 3 0 0 0 3 3M8 4a3 3 0 0 0-3 3v9M11 9h5M11 12h5',
  flame: 'M12 21c-4 0-6-3-6-6 0-4 4-6 4-10 3 2 5 5 5 8 1-1 2-2 2-4 1 2 1 4 1 6 0 3-2 6-6 6Z',
  soundOn: 'M4 9v6h4l5 4V5L8 9H4ZM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12',
  soundOff: 'M4 9v6h4l5 4V5L8 9H4ZM17 9l5 5M22 9l-5 5',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  bolt: 'M13 3 5 14h6l-1 7 8-11h-6l1-7Z',
  exit: 'M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M9 8l-4 4 4 4M5 12h11',
  chevronLeft: 'M15 18l-6-6 6-6',
  chevronRight: 'M9 18l6-6-6-6',
} as const;

export type IconName = keyof typeof PATHS;

export const Icon = ({ name, size = 18 }: { name: IconName; size?: number }) => (
  <svg className="hpvn-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={PATHS[name]} />
  </svg>
);
