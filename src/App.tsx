import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import AssignmentsPage from "./pages/AssignmentsPage";
import SubmissionPage from "./pages/SubmissionPage";
import EnrollmentsPage from "./pages/EnrollmentsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import CreateUserPage from "./pages/CreateUserPage";
import LecturerAssignmentsPage from "./pages/LecturerAssignmentsPage";
import LecturerSubmissionsPage from "./pages/LecturerSubmissionsPage";
import StudentProgressPage from "./pages/StudentProgressPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/assignments" element={<AssignmentsPage />} />
          <Route path="/assignments/create" element={<AssignmentsPage />} />
          <Route
            path="/submissions/:assignmentId"
            element={
              <ErrorBoundary
                title="Submission page failed to load"
                description="We hit an error while opening the submission screen. Try reloading or going back." 
              >
                <SubmissionPage />
              </ErrorBoundary>
            }
          />
          <Route path="/enrollments/:courseId" element={<EnrollmentsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/create-user" element={<CreateUserPage />} />
          {/* Lecturer Routes */}
          <Route path="/lecturer/courses/:courseId/assignments" element={<LecturerAssignmentsPage />} />
          <Route path="/lecturer/submissions/:assignmentId" element={<LecturerSubmissionsPage />} />
          <Route path="/lecturer/progress/:courseId" element={<StudentProgressPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;