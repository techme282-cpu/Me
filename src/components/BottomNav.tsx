import { Home, Search, PlusSquare, MessageCircle, User, Play } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const navItems = [
  { icon: Home, path: "/", label: "Home" },
  { icon: Search, path: "/explore", label: "Explore" },
  { icon: Play, path: "/loop", label: "Loop" },
  { icon: MessageCircle, path: "/chat", label: "Chat" },
  { icon: User, path: "/profile", label: "Profile" },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-border">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map(({ icon: Icon, path, label }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-0.5 p-2 rounded-xl transition-all duration-200 ${
                active
                  ? "text-primary scale-110"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label={label}
            >
              <Icon size={active ? 26 : 22} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
