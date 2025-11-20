import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import StudentDashboard from "./StudentDashboard";
import LecturerDashboard from "./LecturerDashboard";
import CourseList from "@/components/CourseList";
import CourseDialog from "@/components/CourseDialog";
import type { Session } from "@supabase/supabase-js";

const Dashboard = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);
      if (!currentSession) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkAuth = async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    
    if (!currentSession) {
      navigate("/auth");
      return;
    }

    setSession(currentSession);

    // Check user role with retry logic for newly created users
    let retries = 3;
    let roles = null;
    
    while (retries > 0 && !roles) {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentSession.user.id)
        .limit(1)
        .maybeSingle();
      
      roles = data;
      
      if (!roles && retries > 1) {
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      retries--;
    }

    if (roles) {
      setUserRole(roles.role);
    } else {
      // If still no role after retries, default to student
      setUserRole('student');
      toast({
        title: "Notice",
        description: "Role not found, defaulting to student view",
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged out successfully",
    });
    navigate("/auth");
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // Role-based dashboard rendering
  if (userRole === "student") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold">University Management System</h1>
            <Button onClick={handleLogout} variant="outline">
              Logout
            </Button>
          </div>
        </header>
        <StudentDashboard />
      </div>
    );
  }

  if (userRole === "lecturer") {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-2xl font-bold">University Management System</h1>
            <Button onClick={handleLogout} variant="outline">
              Logout
            </Button>
          </div>
        </header>
        <LecturerDashboard />
      </div>
    );
  }

  // Admin dashboard (default)
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">University Management System</h1>
          <Button onClick={handleLogout} variant="outline">
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold">Admin Dashboard</h2>
          <div className="space-x-2">
            <Button onClick={() => navigate("/create-user")}>
              Create New User
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              Add New Course
            </Button>
          </div>
        </div>

        <CourseList isAdmin={true} />

        <CourseDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      </main>
    </div>
  );
};

export default Dashboard;
