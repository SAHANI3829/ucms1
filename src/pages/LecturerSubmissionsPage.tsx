import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { safeGetUser } from "@/lib/safeAuth";

interface Submission {
  id: string;
  content: string;
  file_url: string | null;
  submitted_at: string;
  grade: number | null;
  feedback: string | null;
  graded_at: string | null;
  student_id: string;
  student_name?: string;
  student_email?: string;
}

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  max_grade: number;
  course_id: string;
}

const LecturerSubmissionsPage = () => {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [gradingSubmission, setGradingSubmission] = useState<Submission | null>(null);
  const [grade, setGrade] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (assignmentId) {
      fetchAssignmentAndSubmissions();
    }
  }, [assignmentId]);

  const fetchAssignmentAndSubmissions = async () => {
    try {
      const { user, error: userError } = await safeGetUser();
      if (!user || userError) {
        navigate("/auth");
        return;
      }

      // Fetch assignment details
      const { data: assignmentData, error: assignmentError } = await supabase
        .from("assignments")
        .select("*")
        .eq("id", assignmentId)
        .maybeSingle();

      if (assignmentError) throw assignmentError;
      if (!assignmentData) {
        toast({
          title: "Error",
          description: "Assignment not found",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      setAssignment(assignmentData);

      // Fetch submissions for this assignment
      const { data: submissionsData, error: submissionsError } = await supabase
        .from("submissions")
        .select("*")
        .eq("assignment_id", assignmentId)
        .order("submitted_at", { ascending: false });

      if (submissionsError) throw submissionsError;

      // Fetch student profiles for each submission
      const studentIds = submissionsData?.map(s => s.student_id) || [];
      let profilesMap: Record<string, { full_name: string; email: string }> = {};

      if (studentIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", studentIds);

        if (profilesData) {
          profilesMap = profilesData.reduce((acc, profile) => {
            acc[profile.id] = { full_name: profile.full_name, email: profile.email };
            return acc;
          }, {} as Record<string, { full_name: string; email: string }>);
        }
      }

      // Merge student info into submissions
      const enrichedSubmissions = submissionsData?.map(sub => ({
        ...sub,
        student_name: profilesMap[sub.student_id]?.full_name || "Unknown Student",
        student_email: profilesMap[sub.student_id]?.email || "",
      })) || [];

      setSubmissions(enrichedSubmissions);
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

  const openGradingDialog = (submission: Submission) => {
    setGradingSubmission(submission);
    setGrade(submission.grade?.toString() || "");
    setFeedback(submission.feedback || "");
  };

  const handleGrade = async () => {
    if (!gradingSubmission || !assignment) return;

    const gradeNum = parseInt(grade);
    if (isNaN(gradeNum) || gradeNum < 0 || gradeNum > assignment.max_grade) {
      toast({
        title: "Invalid Grade",
        description: `Grade must be between 0 and ${assignment.max_grade}`,
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { user } = await safeGetUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { error } = await supabase
        .from("submissions")
        .update({
          grade: gradeNum,
          feedback: feedback || null,
          graded_by: user.id,
          graded_at: new Date().toISOString(),
        })
        .eq("id", gradingSubmission.id);

      if (error) throw error;

      toast({ title: "Submission graded successfully!" });
      setGradingSubmission(null);
      fetchAssignmentAndSubmissions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const gradedCount = submissions.filter(s => s.grade !== null).length;
  const ungradedCount = submissions.length - gradedCount;

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Submissions</h1>
          {assignment && (
            <p className="text-muted-foreground mt-1">{assignment.title}</p>
          )}
        </div>
        <Button onClick={() => navigate(-1)} variant="outline">
          Back
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Submissions</CardDescription>
            <CardTitle className="text-2xl">{submissions.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Graded</CardDescription>
            <CardTitle className="text-2xl text-green-600">{gradedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-2xl text-orange-600">{ungradedCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Submissions List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">All Submissions</h2>
        {submissions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No submissions yet for this assignment.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {submissions.map((submission) => (
              <Card key={submission.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{submission.student_name}</CardTitle>
                      <CardDescription>{submission.student_email}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {submission.grade !== null ? (
                        <Badge className="bg-green-600">
                          {submission.grade}/{assignment?.max_grade}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-orange-600 border-orange-600">
                          Not Graded
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Submission Content</Label>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap bg-muted p-3 rounded-md">
                      {submission.content}
                    </p>
                  </div>

                  {submission.file_url && (
                    <div>
                      <Label className="text-sm font-medium">Attached File</Label>
                      <a 
                        href={submission.file_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline block mt-1"
                      >
                        View Attachment
                      </a>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Submitted: {new Date(submission.submitted_at).toLocaleString()}</span>
                    {submission.graded_at && (
                      <span>Graded: {new Date(submission.graded_at).toLocaleString()}</span>
                    )}
                  </div>

                  {submission.feedback && (
                    <div>
                      <Label className="text-sm font-medium">Feedback</Label>
                      <p className="text-sm text-muted-foreground mt-1 bg-muted p-3 rounded-md">
                        {submission.feedback}
                      </p>
                    </div>
                  )}

                  <Button onClick={() => openGradingDialog(submission)} className="w-full">
                    {submission.grade !== null ? "Update Grade" : "Grade Submission"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Grading Dialog */}
      <Dialog open={!!gradingSubmission} onOpenChange={(open) => !open && setGradingSubmission(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grade Submission</DialogTitle>
            <DialogDescription>
              {gradingSubmission?.student_name} - Max grade: {assignment?.max_grade}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="grade">Grade</Label>
              <Input
                id="grade"
                type="number"
                min={0}
                max={assignment?.max_grade}
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder={`0 - ${assignment?.max_grade}`}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback">Feedback (optional)</Label>
              <Textarea
                id="feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Provide feedback for the student..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGradingSubmission(null)}>
              Cancel
            </Button>
            <Button onClick={handleGrade} disabled={submitting}>
              {submitting ? "Saving..." : "Save Grade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LecturerSubmissionsPage;