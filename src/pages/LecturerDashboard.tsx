import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import CourseDialog from "@/components/CourseDialog";

interface Course {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
}

const LecturerDashboard = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCourses(data || []);
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

  const handleCreateAssignment = (courseId: string) => {
    navigate(`/assignments/create?courseId=${courseId}`);
  };

  const handleViewEnrollments = (courseId: string) => {
    navigate(`/enrollments/${courseId}`);
  };

  const handleViewAssignments = (courseId: string) => {
    navigate(`/lecturer/courses/${courseId}/assignments`);
  };

  const handleViewProgress = (courseId: string) => {
    navigate(`/lecturer/progress/${courseId}`);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Lecturer Dashboard</h1>
        <Button onClick={() => {
          setSelectedCourse(null);
          setDialogOpen(true);
        }}>
          Create New Course
        </Button>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">My Courses</h2>
        {courses.length === 0 ? (
          <p className="text-muted-foreground">You haven't created any courses yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Card key={course.id}>
                <CardHeader>
                  <CardTitle>{course.title}</CardTitle>
                  <CardDescription>
                    {course.description || "No description available"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    onClick={() => handleViewAssignments(course.id)} 
                    className="w-full"
                    variant="default"
                  >
                    View Assignments
                  </Button>
                  <Button 
                    onClick={() => handleViewProgress(course.id)} 
                    className="w-full"
                    variant="secondary"
                  >
                    Student Progress
                  </Button>
                  <Button 
                    onClick={() => handleViewEnrollments(course.id)} 
                    className="w-full"
                    variant="outline"
                  >
                    View Students
                  </Button>
                  <Button 
                    onClick={() => {
                      setSelectedCourse(course);
                      setDialogOpen(true);
                    }} 
                    className="w-full"
                    variant="outline"
                  >
                    Edit Course
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CourseDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelectedCourse(null);
            fetchCourses();
          }
        }}
        course={selectedCourse}
      />
    </div>
  );
};

export default LecturerDashboard;