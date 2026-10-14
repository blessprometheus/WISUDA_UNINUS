import { archive69Links } from "@/content/site";

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffcc29"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

const rowClass =
  "flex min-h-16 items-center justify-between gap-4 border-b border-forest-line py-3 text-xl font-bold text-white no-underline";

export function ArchiveList() {
  return (
    <ul className="flex flex-col border-t border-forest-line">
      {archive69Links.map((link) => (
        <li key={link.label}>
          {link.href ? (
            <a
              href={link.href}
              rel="noopener noreferrer"
              className={`${rowClass} hover:text-gold-soft`}
            >
              <span className="flex flex-col">
                <span>{link.label}</span>
                <span className="text-sm font-normal text-mist">{link.description}</span>
              </span>
              <ArrowIcon />
            </a>
          ) : (
            <div className={`${rowClass} text-mist`}>
              <span className="flex flex-col">
                <span>{link.label}</span>
                <span className="text-sm font-normal text-mist-dim">
                  {link.description} Tautan akan segera tersedia.
                </span>
              </span>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
