
-- Portfolios
CREATE TABLE public.portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#22d3ee',
  is_default boolean NOT NULL DEFAULT false,
  goal_amount numeric,
  goal_target_date date,
  goal_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolios TO authenticated;
GRANT ALL ON public.portfolios TO service_role;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own portfolios" ON public.portfolios FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER portfolios_set_updated_at BEFORE UPDATE ON public.portfolios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX portfolios_user_idx ON public.portfolios(user_id);

-- Add portfolio_id to holdings + transactions
ALTER TABLE public.holdings
  ADD COLUMN portfolio_id uuid REFERENCES public.portfolios(id) ON DELETE SET NULL;
ALTER TABLE public.transactions
  ADD COLUMN portfolio_id uuid REFERENCES public.portfolios(id) ON DELETE SET NULL;
CREATE INDEX holdings_portfolio_idx ON public.holdings(portfolio_id);
CREATE INDEX transactions_portfolio_idx ON public.transactions(portfolio_id);

-- Backfill: create a "Main" portfolio for every existing user that has holdings/transactions, and assign
DO $$
DECLARE u uuid; pid uuid;
BEGIN
  FOR u IN
    SELECT DISTINCT user_id FROM public.holdings
    UNION
    SELECT DISTINCT user_id FROM public.transactions
  LOOP
    INSERT INTO public.portfolios(user_id, name, is_default)
    VALUES (u, 'Main', true)
    RETURNING id INTO pid;
    UPDATE public.holdings SET portfolio_id = pid WHERE user_id = u AND portfolio_id IS NULL;
    UPDATE public.transactions SET portfolio_id = pid WHERE user_id = u AND portfolio_id IS NULL;
  END LOOP;
END $$;

-- Auto-create default portfolio on signup (extend handle_new_user)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  INSERT INTO public.portfolios (user_id, name, is_default) VALUES (NEW.id, 'Main', true);
  RETURN NEW;
END;
$$;
