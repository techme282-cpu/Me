import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
