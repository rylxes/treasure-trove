-- Create item_questions table
CREATE TABLE public.item_questions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- User who asked the question
    question_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.item_questions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.item_questions IS 'Stores questions asked by users about specific items.';

-- Policies for item_questions
CREATE POLICY "Public item questions are viewable by everyone"
  ON public.item_questions FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own questions"
  ON public.item_questions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own questions" -- Or only allow deletion and re-asking
  ON public.item_questions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own questions"
  ON public.item_questions FOR DELETE
  USING (auth.uid() = user_id);


-- Create item_answers table
CREATE TABLE public.item_answers (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id uuid NOT NULL REFERENCES public.item_questions(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- User who answered (seller or other users)
    answer_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.item_answers ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.item_answers IS 'Stores answers to questions asked about items. Answers can be from the seller or other users.';

-- Policies for item_answers
CREATE POLICY "Public item answers are viewable by everyone"
  ON public.item_answers FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert answers" -- Any authenticated user can answer
  ON public.item_answers FOR INSERT
  WITH CHECK (auth.uid() = user_id); -- Check that the user_id field matches the logged-in user

CREATE POLICY "Users can update their own answers"
  ON public.item_answers FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own answers"
  ON public.item_answers FOR DELETE
  USING (auth.uid() = user_id);

-- Optional: Add a column to item_questions to quickly count answers
ALTER TABLE public.item_questions
ADD COLUMN answer_count INT DEFAULT 0;

-- Function to update answer_count on item_questions
CREATE OR REPLACE FUNCTION update_question_answer_count()
RETURNS TRIGGER AS $$
DECLARE
    target_question_id uuid;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        target_question_id := OLD.question_id;
    ELSE
        target_question_id := NEW.question_id;
    END IF;

    UPDATE public.item_questions
    SET answer_count = (
        SELECT COUNT(*)
        FROM public.item_answers
        WHERE question_id = target_question_id
    )
    WHERE id = target_question_id;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for answer_count update
CREATE TRIGGER on_answer_change
  AFTER INSERT OR UPDATE OR DELETE ON public.item_answers
  FOR EACH ROW
  EXECUTE FUNCTION update_question_answer_count();
