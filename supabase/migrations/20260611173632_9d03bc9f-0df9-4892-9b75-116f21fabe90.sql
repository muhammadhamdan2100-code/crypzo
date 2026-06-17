CREATE TYPE public.tx_side AS ENUM ('buy', 'sell');

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coin_id text NOT NULL,
  symbol text NOT NULL,
  name text NOT NULL,
  image text,
  side public.tx_side NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  price numeric NOT NULL CHECK (price >= 0),
  fee numeric NOT NULL DEFAULT 0 CHECK (fee >= 0),
  notes text,
  executed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX transactions_user_executed_idx ON public.transactions (user_id, executed_at DESC);
CREATE INDEX transactions_user_coin_idx ON public.transactions (user_id, coin_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own transactions"
  ON public.transactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
