import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { safeGetUser } from "@/lib/safeAuth";

interface StudentProgress {
  student_id: string;
  student_name: string;
  student_email: string;
  assignments: {
    assignment_id: string;
    assignment_title: string;
    max_grade: number;
    due_date: string;
    submitted: boolean;
    grade: number | null;
  }[];
  averageGrade: number | null;
  submissionRate: number;
}

interface Course {
  id: string;
  title: string;
}

const StudentProgressPage = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [studentsProgress, setStudentsProgress] = useState<StudentProgress[]>([]);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (courseId) {
      fetchProgressData();
    }
  }, [courseId]);

  const fetchProgressData = async () => {
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

      // Fetch enrolled students
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from("enrollments")
        .select("student_id")
        .eq("course_id", courseId)
        .eq("status", "active");

      if (enrollmentsError) throw enrollmentsError;

      const studentIds = enrollments?.map(e => e.student_id) || [];

      if (studentIds.length === 0) {
        setStudentsProgress([]);
        setLoading(false);
        return;
      }

      // Fetch student profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", studentIds);

      const profilesMap = (profiles || []).reduce((acc, p) => {
        acc[p.id] = { full_name: p.full_name, email: p.email };
        return acc;
      }, {} as Record<string, { full_name: string; email: string }>);

      // Fetch all assignments for this course
      const { data: assignments } = await supabase
        .from("assignments")
        .select("id, title, max_grade, due_date")
        .eq("course_id", courseId)
        .order("due_date", { ascending: true });

      // Fetch all submissions for these assignments
      const assignmentIds = assignments?.map(a => a.id) || [];
      let submissionsMap: Record<string, Record<string, { grade: number | null }>> = {};

      if (assignmentIds.length > 0) {
        const { data: submissions } = await supabase
          .from("submissions")
          .select("student_id, assignment_id, grade")
          .in("assignment_id", assignmentIds)
          .in("student_id", studentIds);

        // Map: student_id -> assignment_id -> submission data
        (submissions || []).forEach(sub => {
          if (!submissionsMap[sub.student_id]) {
            submissionsMap[sub.student_id] = {};
          }
          submissionsMap[sub.student_id][sub.assignment_id] = { grade: sub.grade };
        });
      }

      // Build progress data for each student
      const progressData: StudentProgress[] = studentIds.map(studentId => {
        const studentAssignments = (assignments || []).map(a => {
          const submission = submissionsMap[studentId]?.[a.id];
          return {
            assignment_id: a.id,
            assignment_title: a.title,
            max_grade: a.max_grade,
            due_date: a.due_date,
            submitted: !!submission,
            grade: submission?.grade ?? null,
          };
        });

        const submittedCount = studentAssignments.filter(a => a.submitted).length;
        const gradedAssignments = studentAssignments.filter(a => a.grade !== null);
        
        let averageGrade: number | null = null;
        if (gradedAssignments.length > 0) {
          const totalPercentage = gradedAssignments.reduce((sum, a) => {
            return sum + (a.grade! / a.max_grade) * 100;
          }, 0);
          averageGrade = Math.round(totalPercentage / gradedAssignments.length);
        }

        return {
          student_id: studentId,
          student_name: profilesMap[studentId]?.full_name || "Unknown Student",
          student_email: profilesMap[studentId]?.email || "",
          assignments: studentAssignments,
          averageGrade,
          submissionRate: assignments?.length 
            ? Math.round((submittedCount / assignments.length) * 100) 
            : 0,
        };
      });

      setStudentsProgress(progressData.sort((a, b) => 
        a.student_name.localeCompare(b.student_name)
      ));
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

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Student Progress</h1>
          {course && (
            <p className="text-muted-foreground mt-1">{course.title}</p>
          )}
        </div>
        <Button onClick={() => navigate("/dashboard")} variant="outline">
          Back to Dashboard
        </Button>
      </div>

      {studentsProgress.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No students enrolled in this course yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {studentsProgress.map((student) => (
            <Card key={student.student_id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{student.student_name}</CardTitle>
                    <CardDescription>{student.student_email}</CardDescription>
                  </div>
                  <div className="text-right">
                    {student.averageGrade !== null ? (
                      <Badge 
                        className={
                          student.averageGrade >= 70 
                            ? "bg-green-600" 
                            : student.averageGrade >= 50 
                            ? "bg-yellow-600" 
                            : "bg-red-600"
                        }
                      >
                        Avg: {student.averageGrade}%
                      </Badge>
                    ) : (
                      <Badge variant="secondary">No Grades</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Submission Rate</span>
                    <span>{student.submissionRate}%</span>
                  </div>
                  <Progress value={student.submissionRate} className="h-2" />
                </div>

                {student.assignments.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Assignment</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Grade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {student.assignments.map((assignment) => (
                        <TableRow key={assignment.assignment_id}>
                          <TableCell className="font-medium">
                            {assignment.assignment_title}
                          </TableCell>
                          <TableCell>
                            {new Date(assignment.due_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {assignment.submitted ? (
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                Submitted
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-red-600 border-red-600">
                                Missing
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {assignment.grade !== null ? (
                              <span className="font-medium">
                                {assignment.grade}/{assignment.max_grade}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentProgressPage;