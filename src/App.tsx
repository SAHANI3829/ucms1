import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import AssignmentsPage from "./pages/AssignmentsPage";
import SubmissionPage from "./pages/SubmissionPage";
import EnrollmentsPage from "./pages/EnrollmentsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import CreateUserPage from "./pages/CreateUserPage";
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
          <Route path="/submissions/:assignmentId" element={<SubmissionPage />} />
          <Route path="/enrollments/:courseId" element={<EnrollmentsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/create-user" element={<CreateUserPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
