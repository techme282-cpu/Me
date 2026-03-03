import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Create from "./pages/Create";
import ChatRoom from "./pages/ChatRoom";
import UserProfile from "./pages/UserProfile";
import Notifications from "./pages/Notifications";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";
import CreateGroup from "./pages/CreateGroup";
import GroupChat from "./pages/GroupChat";
import GroupSettings from "./pages/GroupSettings";
import JoinGroup from "./pages/JoinGroup";
import PostDetail from "./pages/PostDetail";
import CertificationRequest from "./pages/CertificationRequest";
import Privacy from "./pages/Privacy";
import Admin from "./pages/Admin";

const queryClient = new QueryClient();

// Android hardware back button handler
function BackButtonHandler() {

  useEffect(() => {
    let backListener: any = null;

    const setupCapacitorBackButton = async () => {
      try {
        const capacitorApp = await import("@capacitor/app" as string);
        const CapApp = capacitorApp.App;
        if (CapApp?.addListener) {
          backListener = CapApp.addListener("backButton", () => {
            const mainRoutes = ["/", "/login"];
            const isOnMain = mainRoutes.includes(window.location.pathname);
            
            // Only minimize if on a main route AND there's no history to go back to
            if (isOnMain && window.history.length <= 2) {
              CapApp.minimizeApp();
            } else {
              window.history.back();
            }
          });
        }
      } catch {
        // Not running in Capacitor, ignore
      }
    };

    setupCapacitorBackButton();
    return () => {
      backListener?.remove?.();
    };
  }, []);

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
            <Route path="/explore" element={<Index />} />
            <Route path="/chat" element={<Index />} />
            <Route path="/profile" element={<Index />} />
            <Route path="/loop" element={<Index />} />
            <Route path="/create" element={<Create />} />
            <Route path="/chat/:partnerId" element={<ChatRoom />} />
            <Route path="/group/:groupId" element={<GroupChat />} />
            <Route path="/group/:groupId/settings" element={<GroupSettings />} />
            <Route path="/group/join/:inviteCode" element={<JoinGroup />} />
            <Route path="/post/:postId" element={<PostDetail />} />
            <Route path="/user/:userId" element={<UserProfile />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/create-group" element={<CreateGroup />} />
            <Route path="/certification" element={<CertificationRequest />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
