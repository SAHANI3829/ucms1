import { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client.ts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { safeGetUser } from "@/lib/safeAuth";

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  max_grade: number;
  course_id: string;
}

interface Course {
  id: string;
  title: string;
}

const LecturerAssignmentsPage = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (courseId) {
      fetchCourseAndAssignments();
    }
  }, [courseId]);

  const fetchCourseAndAssignments = async () => {
    try {
      const { user, error: userError } = await safeGetUser();
      if (!user || userError) {
        navigate("/auth");
        return;
      }

      // Fetch course details
      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("id, title")
        .eq("id", courseId)
        .maybeSingle();

      if (courseError) throw courseError;
      if (!courseData) {
        toast({
          title: "Error",
          description: "Course not found",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      setCourse(courseData);

      // Fetch assignments for this course
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("assignments")
        .select("*")
        .eq("course_id", courseId)
        .order("due_date", { ascending: false });

      if (assignmentsError) throw assignmentsError;
      setAssignments(assignmentsData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewSubmissions = (assignmentId: string) => {
    navigate(`/lecturer/submissions/${assignmentId}`);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Course Assignments</h1>
          {course && (
            <p className="text-muted-foreground mt-1">{course.title}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate(`/assignments/create?courseId=${courseId}`)}>
            Create Assignment
          </Button>
          <Button onClick={() => navigate("/dashboard")} variant="outline">
            Back to Dashboard
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {assignments.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No assignments created yet for this course.</p>
              <Button 
                onClick={() => navigate(`/assignments/create?courseId=${courseId}`)} 
                className="mt-4"
              >
                Create Your First Assignment
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {assignments.map((assignment) => {
              const dueDate = new Date(assignment.due_date);
              const isOverdue = dueDate < new Date();

              return (
                <Card key={assignment.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="truncate">{assignment.title}</span>
                      {isOverdue ? (
                        <Badge variant="secondary">Past Due</Badge>
                      ) : (
                        <Badge>Active</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Due: {dueDate.toLocaleDateString()} at {dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {assignment.description || "No description provided"}
                    </p>
                    <div className="text-sm">
                      <span className="font-medium">Max Grade:</span> {assignment.max_grade}
                    </div>
                    <Button 
                      onClick={() => handleViewSubmissions(assignment.id)} 
                      className="w-full"
                    >
                      View Submissions
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LecturerAssignmentsPage;