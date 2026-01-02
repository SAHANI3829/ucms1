import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useParams } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { safeGetUser } from "@/lib/safeAuth";

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  max_grade: number;
}

interface Submission {
  id: string;
  content: string;
  grade: number | null;
  feedback: string | null;
  submitted_at: string;
}

const SubmissionPage = () => {
  const { assignmentId } = useParams();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, [assignmentId]);

  const fetchData = async () => {
    if (!assignmentId) {
      setError("No assignment ID provided");
      setLoading(false);
      return;
    }

    try {
      const { user, error: userError } = await safeGetUser();
      if (userError && (userError as any).code === "refresh_token_not_found") {
        toast({
          title: "Session expired",
          description: "Please log in again.",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to view submissions",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      // Fetch assignment
      const { data: assignmentData, error: assignmentError } = await supabase
        .from("assignments")
        .select("*")
        .eq("id", assignmentId)
        .single();

      if (assignmentError) {
        console.error("Assignment fetch error:", assignmentError);
        setError(`Could not load assignment: ${assignmentError.message}`);
        setLoading(false);
        return;
      }

      if (!assignmentData) {
        setError("Assignment not found");
        setLoading(false);
        return;
      }

      setAssignment(assignmentData);

      // Fetch existing submission
      const { data: submissionData, error: submissionError } = await supabase
        .from("submissions")
        .select("*")
        .eq("assignment_id", assignmentId)
        .eq("student_id", user.id)
        .maybeSingle();

      if (submissionError) {
        console.error("Submission fetch error:", submissionError);
      }

      if (submissionData) {
        setSubmission(submissionData);
        setContent(submissionData.content);
      }
    } catch (err: any) {
      console.error("Unexpected error:", err);
      setError(err.message || "An unexpected error occurred");
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentId) return;

    try {
      const { user, error: userError } = await safeGetUser();
      if (!user || userError) return;

      if (submission) {
        // Update existing submission
        const { error } = await supabase
          .from("submissions")
          .update({ content })
          .eq("id", submission.id);

        if (error) throw error;
        toast({ title: "Submission updated successfully!" });
      } else {
        // Create new submission
        const { error } = await supabase
          .from("submissions")
          .insert({
            assignment_id: assignmentId,
            student_id: user.id,
            content,
          });

        if (error) throw error;
        toast({ title: "Submission created successfully!" });
      }

      navigate("/assignments");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (error || !assignment) {
    return (
      <div className="container mx-auto p-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Unable to load assignment</CardTitle>
            <CardDescription>
              {error || "Assignment not found"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/assignments")} variant="outline">
              Back to Assignments
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if graded AFTER we know assignment exists
  const isGraded = submission !== null && submission.grade !== null;
  const canEdit = !isGraded;

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{assignment.title}</CardTitle>
              <CardDescription>
                Due: {new Date(assignment.due_date).toLocaleDateString()}
              </CardDescription>
            </div>
            {isGraded && submission && (
              <Badge variant="secondary">
                Grade: {submission.grade}/{assignment.max_grade}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">Assignment Description</h3>
            <p className="text-muted-foreground">
              {assignment.description || "No description provided"}
            </p>
          </div>

          {isGraded && submission && submission.feedback && (
            <div>
              <h3 className="font-semibold mb-2">Lecturer Feedback</h3>
              <p className="text-muted-foreground bg-muted p-4 rounded-lg">
                {submission.feedback}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="content">Your Submission</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={10}
                required
                disabled={!canEdit}
                placeholder="Enter your assignment submission here..."
              />
            </div>

            <div className="flex gap-2">
              {canEdit && (
                <Button type="submit" className="flex-1">
                  {submission ? "Update Submission" : "Submit Assignment"}
                </Button>
              )}
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate("/assignments")}
              >
                Back
              </Button>
            </div>
          </form>

          {submission && (
            <div className="text-sm text-muted-foreground">
              Submitted on: {new Date(submission.submitted_at).toLocaleString()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SubmissionPage;