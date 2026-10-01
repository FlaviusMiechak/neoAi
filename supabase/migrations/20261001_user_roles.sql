ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';

UPDATE public.users
SET role = 'user'
WHERE role IS NULL;

ALTER TABLE public.users
  ALTER COLUMN role SET DEFAULT 'user',
  ALTER COLUMN role SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_role_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS users_role_idx ON public.users (role);