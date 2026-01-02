import { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client.ts";
import { Button } from "../components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card.tsx";
import { useToast } from "../hooks/use-toast.ts";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "../components/ui/input.tsx";
import { Label } from "../components/ui/label.tsx";
import { Textarea } from "../components/ui/textarea.tsx";
import { Badge } from "../components/ui/badge.tsx";

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  max_grade: number;
  courses: {
    title: string;
  };
}

const AssignmentsPage = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [maxGrade, setMaxGrade] = useState(100);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get("courseId");

  useEffect(() => {
    if (courseId) {
      setIsCreating(true);
    } else {
      fetchAssignments();
    }
  }, [courseId]);

  const fetchAssignments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get enrolled courses
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("course_id")
        .eq("student_id", user.id);

      const courseIds = enrollments?.map(e => e.course_id) || [];

      // Get assignments for enrolled courses
      const { data, error } = await supabase
        .from("assignments")
        .select("*, courses(title)")
        .in("course_id", courseIds)
        .order("due_date", { ascending: true });

      if (error) throw error;
      setAssignments(data || []);
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

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("assignments")
        .insert({
          course_id: courseId,
          title,
          description,
          due_date: dueDate,
          max_grade: maxGrade,
          created_by: user.id,
        });

      if (error) throw error;

      toast({ title: "Assignment created successfully!" });
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSubmit = (assignmentId: string) => {
    navigate(`/submissions/${assignmentId}`);
  };

  if (loading && !isCreating) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (isCreating) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Create New Assignment</CardTitle>
            <CardDescription>Add assignment details for your course</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Assignment Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxGrade">Maximum Grade</Label>
                <Input
                  id="maxGrade"
                  type="number"
                  value={maxGrade}
                  onChange={(e) => setMaxGrade(parseInt(e.target.value))}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">Create Assignment</Button>
                <Button type="button" variant="outline" onClick={() => navigate("/dashboard")}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">My Assignments</h1>
        <Button onClick={() => navigate("/dashboard")} variant="outline">
          Back to Dashboard
        </Button>
      </div>

      <div className="space-y-4">
        {assignments.length === 0 ? (
          <p className="text-muted-foreground">No assignments available.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {assignments.map((assignment) => {
              const dueDate = new Date(assignment.due_date);
              const isOverdue = dueDate < new Date();

              return (
                <Card key={assignment.id}>
                  <CardHeader>
                    <CardTitle>{assignment.title}</CardTitle>
                    <CardDescription>
                      {assignment.courses.title}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {assignment.description || "No description provided"}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">
                        Due: {dueDate.toLocaleDateString()}
                      </span>
                      {isOverdue ? (
                        <Badge variant="destructive">Overdue</Badge>
                      ) : (
                        <Badge>Active</Badge>
                      )}
                    </div>
                    <div className="text-sm">
                      Max Grade: {assignment.max_grade}
                    </div>
                    <Button 
                      onClick={() => handleSubmit(assignment.id)} 
                      className="w-full"
                    >
                      Submit Assignment
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

export default AssignmentsPage;
