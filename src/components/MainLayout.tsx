import { useLocation } from "react-router-dom";
import Home from "@/pages/Home";
import Explore from "@/pages/Explore";
import Chat from "@/pages/Chat";
import Profile from "@/pages/Profile";
import Loop from "@/pages/Loop";

const TAB_PAGES: Record<string, React.ComponentType> = {
  "/": Home,
  "/explore": Explore,
  "/chat": Chat,
  "/profile": Profile,
  "/loop": Loop,
};

const TAB_PATHS = Object.keys(TAB_PAGES);

export default function MainLayout() {
  const { pathname } = useLocation();

  return (
    <>
      {TAB_PATHS.map((path) => {
        const Page = TAB_PAGES[path];
        const active = pathname === path;
        return (
          <div
            key={path}
            style={{ display: active ? "block" : "none" }}
          >
            <Page />
          </div>
        );
      })}
    </>
  );
}
