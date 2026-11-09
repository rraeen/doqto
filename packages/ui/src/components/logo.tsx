/** The Doqto mark and name. `markOnly` drops the word, for places that print a product name next to it. */
export function Logo({ markOnly = false }: { markOnly?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-xl font-bold tracking-tight text-brand-700">
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <rect width="32" height="32" rx="9" fill="currentColor" />
        <path d="M14 9h4v5h5v4h-5v5h-4v-5H9v-4h5z" fill="#fff" />
      </svg>
      {!markOnly && 'Doqto'}
    </span>
  );
}
