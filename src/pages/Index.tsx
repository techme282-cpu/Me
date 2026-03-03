import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";
import MainLayout from "@/components/MainLayout";

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-display font-bold text-gradient">PURGE HUB</h1>
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <MainLayout />;
};

export default Index;
