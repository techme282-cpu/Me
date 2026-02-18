import { BadgeCheck, Palette, Shield } from "lucide-react";

interface CertificationBadgeProps {
  type: string | null | undefined;
  size?: number;
  className?: string;
}

export default function CertificationBadge({ type, size = 14, className = "" }: CertificationBadgeProps) {
  if (!type) return null;

  switch (type) {
    case "verified":
      return <span title="Vérifié"><BadgeCheck size={size} className={`text-blue-500 shrink-0 ${className}`} /></span>;
    case "creator":
      return <span title="Créateur"><Palette size={size} className={`text-amber-500 shrink-0 ${className}`} /></span>;
    case "official":
      return <span title="Compte Officiel"><Shield size={size} className={`text-emerald-500 shrink-0 ${className}`} /></span>;
    default:
      return null;
  }
}
