export default function PanelWriting() {
  return (
    <div className="mx-auto max-w-md text-center">
      <div className="mb-6 flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-royal-700/50">
          <svg
            className="h-8 w-8 text-gold-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
        </div>
      </div>

      <h3 className="font-heading text-2xl font-bold text-text-primary">
        Coming Soon
      </h3>
      <p className="mt-3 text-text-muted">
        Thoughts on engineering, distributed systems, and building production
        software will appear here.
      </p>

      <div className="mt-8 rounded-lg border border-royal-700/40 bg-royal-800/20 p-4 text-sm text-text-muted">
        <p>In the meantime, feel free to connect on LinkedIn or GitHub.</p>
      </div>
    </div>
  );
}
