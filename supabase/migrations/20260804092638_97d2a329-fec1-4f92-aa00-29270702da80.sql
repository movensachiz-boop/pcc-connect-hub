CREATE TABLE public.exam_marks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  form text NOT NULL,
  stream text NOT NULL,
  subject_id text NOT NULL,
  subject_name text,
  term text NOT NULL,
  exam_type text NOT NULL,
  mark numeric NOT NULL,
  max_mark numeric NOT NULL DEFAULT 100,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_profile_id, subject_id, term, exam_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_marks TO authenticated;
GRANT ALL ON public.exam_marks TO service_role;

ALTER TABLE public.exam_marks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all exam marks" ON public.exam_marks
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'developer')
);

CREATE POLICY "Students can view their own exam marks" ON public.exam_marks
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = exam_marks.student_profile_id AND p.user_id = auth.uid()));

CREATE POLICY "Staff can insert exam marks" ON public.exam_marks
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer')
);

CREATE POLICY "Staff can update exam marks" ON public.exam_marks
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer')
);

CREATE POLICY "Staff can delete exam marks" ON public.exam_marks
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer')
);

CREATE TRIGGER trg_exam_marks_updated BEFORE UPDATE ON public.exam_marks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_exam_marks_class ON public.exam_marks (form, stream, term, exam_type);