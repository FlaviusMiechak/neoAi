CREATE TABLE IF NOT EXISTS public.manual_payments (
  id uuid PRIMARY KEY,
  user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency char(3) NOT NULL DEFAULT 'USD',
  payment_reference text NOT NULL,
  proof_url text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'rejected')),
  admin_note text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by varchar REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS manual_payments_status_submitted_idx
  ON public.manual_payments (status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS manual_payments_user_submitted_idx
  ON public.manual_payments (user_id, submitted_at DESC);

ALTER TABLE public.manual_payments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY,
  user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  email_sent_at timestamptz,
  email_error text
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;