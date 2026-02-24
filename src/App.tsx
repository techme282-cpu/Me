import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Explore from "./pages/Explore";
import Create from "./pages/Create";
import Chat from "./pages/Chat";
import ChatRoom from "./pages/ChatRoom";
import Profile from "./pages/Profile";
import UserProfile from "./pages/UserProfile";
import Notifications from "./pages/Notifications";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";
import CreateGroup from "./pages/CreateGroup";
import GroupChat from "./pages/GroupChat";
import GroupSettings from "./pages/GroupSettings";
import JoinGroup from "./pages/JoinGroup";
import Loop from "./pages/Loop";
import PostDetail from "./pages/PostDetail";
import CertificationRequest from "./pages/CertificationRequest";
import Privacy from "./pages/Privacy";
import Admin from "./pages/Admin";

const queryClient = new QueryClient();

// Android hardware back button handler
function BackButtonHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handlePopState = () => {
      // Let the browser handle it naturally via React Router
    };

    // For Capacitor: listen to the hardware back button
    const setupCapacitorBackButton = async () => {
      try {
        // Dynamic import to avoid build errors when not in Capacitor
        const capacitorApp = await import("@capacitor/app" as string);
        const CapApp = capacitorApp.App;
        if (CapApp?.addListener) {
          CapApp.addListener("backButton", ({ canGoBack }: { canGoBack: boolean }) => {
            const mainRoutes = ["/", "/login"];
            if (mainRoutes.includes(location.pathname) && !canGoBack) {
              CapApp.minimizeApp();
            } else {
              navigate(-1);
            }
          });
        }
      } catch {
        // Not running in Capacitor, ignore
      }
    };

    setupCapacitorBackButton();
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [navigate, location.pathname]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <BackButtonHandler />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/create" element={<Create />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/chat/:partnerId" element={<ChatRoom />} />
            <Route path="/group/:groupId" element={<GroupChat />} />
            <Route path="/group/:groupId/settings" element={<GroupSettings />} />
            <Route path="/group/join/:inviteCode" element={<JoinGroup />} />
            <Route path="/post/:postId" element={<PostDetail />} />
            <Route path="/loop" element={<Loop />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/user/:userId" element={<UserProfile />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/create-group" element={<CreateGroup />} />
            <Route path="*" element={<NotFound />} />
            <Route path="/certification" element={<CertificationRequest />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
