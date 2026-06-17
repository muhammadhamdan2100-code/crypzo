
-- Alerts core
CREATE TYPE public.alert_type AS ENUM (
  'price_above','price_below','pct_change','volume_spike','volatility',
  'market_crash','market_pump','news_keyword','watchlist_change'
);

CREATE TYPE public.alert_severity AS ENUM ('info','success','warning','critical');

CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type public.alert_type NOT NULL,
  coin_id text,
  symbol text,
  name text,
  image text,
  condition jsonb NOT NULL DEFAULT '{}'::jsonb,
  channels text[] NOT NULL DEFAULT ARRAY['in_app']::text[],
  is_active boolean NOT NULL DEFAULT true,
  cooldown_minutes integer NOT NULL DEFAULT 60,
  last_triggered_at timestamptz,
  trigger_count integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX alerts_user_active_idx ON public.alerts(user_id, is_active);
CREATE INDEX alerts_active_type_idx ON public.alerts(is_active, type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own alerts" ON public.alerts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER alerts_updated BEFORE UPDATE ON public.alerts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  alert_id uuid REFERENCES public.alerts(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL,
  severity public.alert_severity NOT NULL DEFAULT 'info',
  coin_id text,
  symbol text,
  image text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notif_user_created_idx ON public.notifications(user_id, created_at DESC);
CREATE INDEX notif_user_unread_idx ON public.notifications(user_id) WHERE read_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own notifications" ON public.notifications
  FOR DELETE USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Channel settings (one row per user)
CREATE TABLE public.alert_channel_settings (
  user_id uuid PRIMARY KEY,
  in_app_enabled boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT false,
  email_enabled boolean NOT NULL DEFAULT false,
  email_address text,
  telegram_enabled boolean NOT NULL DEFAULT false,
  telegram_chat_id text,
  quiet_hours_start smallint,
  quiet_hours_end smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_channel_settings TO authenticated;
GRANT ALL ON public.alert_channel_settings TO service_role;
ALTER TABLE public.alert_channel_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own channel settings" ON public.alert_channel_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER channel_settings_updated BEFORE UPDATE ON public.alert_channel_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Push subscriptions (Web Push)
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_sub_user_idx ON public.push_subscriptions(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own push subs" ON public.push_subscriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
