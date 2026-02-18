interface CertificationBadgeProps {
  type: string | null | undefined;
  size?: number;
  className?: string;
}

export default function CertificationBadge({ type, size = 16, className = "" }: CertificationBadgeProps) {
  if (!type) return null;

  const config = {
    verified: {
      bg: "from-blue-500 to-blue-600",
      shadow: "shadow-[0_0_8px_rgba(59,130,246,0.5)]",
      label: "Vérifié",
    },
    creator: {
      bg: "from-amber-400 to-orange-500",
      shadow: "shadow-[0_0_8px_rgba(245,158,11,0.5)]",
      label: "Créateur",
    },
    official: {
      bg: "from-emerald-400 via-cyan-400 to-blue-500",
      shadow: "shadow-[0_0_10px_rgba(16,185,129,0.6)]",
      label: "Officiel",
    },
  }[type];

  if (!config) return null;

  return (
    <span
      title={config.label}
      className={`inline-flex items-center justify-center rounded-full bg-gradient-to-br ${config.bg} ${config.shadow} shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        style={{ width: size * 0.65, height: size * 0.65 }}
      >
        <path
          d="M9 12.5L11 14.5L15.5 10"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
