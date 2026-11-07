/**
 * Decorative background inspired by Najdi architecture: the stepped
 * triangular crenellations and eight-point stars seen on traditional mud-brick
 * walls. Purely ornamental, hidden from assistive technology.
 */
export function NajdiPattern({ className = '' }: { className?: string }) {
  return (
    <svg className={className} aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="najdi" width="56" height="56" patternUnits="userSpaceOnUse">
          <path
            d="M28 6l5 9 10-2-2 10 9 5-9 5 2 10-10-2-5 9-5-9-10 2 2-10-9-5 9-5-2-10 10 2z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
          <circle cx="28" cy="28" r="2.2" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#najdi)" />
    </svg>
  );
}

/** A row of stepped triangles, used as a section divider. */
export function Crenellation({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 240 12" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path
        d="M0 12 L0 6 L6 6 L6 0 L12 0 L12 6 L18 6 L18 12 Z M24 12 L24 6 L30 6 L30 0 L36 0 L36 6 L42 6 L42 12 Z M48 12 L48 6 L54 6 L54 0 L60 0 L60 6 L66 6 L66 12 Z M72 12 L72 6 L78 6 L78 0 L84 0 L84 6 L90 6 L90 12 Z M96 12 L96 6 L102 6 L102 0 L108 0 L108 6 L114 6 L114 12 Z M120 12 L120 6 L126 6 L126 0 L132 0 L132 6 L138 6 L138 12 Z M144 12 L144 6 L150 6 L150 0 L156 0 L156 6 L162 6 L162 12 Z M168 12 L168 6 L174 6 L174 0 L180 0 L180 6 L186 6 L186 12 Z M192 12 L192 6 L198 6 L198 0 L204 0 L204 6 L210 6 L210 12 Z M216 12 L216 6 L222 6 L222 0 L228 0 L228 6 L234 6 L234 12 Z"
        fill="currentColor"
      />
    </svg>
  );
}
