export function ChessKnight({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M7 21h10" />
      <path d="M8 21v-2a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M9 17V9.5a.5.5 0 0 1 .5-.5h0a5.5 5.5 0 0 0 5.5-5.5V3" />
      <path d="M9 9l-3-1.5" />
      <path d="M15 3c0 1-1 2-2.5 2S10 4 10 3" />
      <circle cx="11.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}
