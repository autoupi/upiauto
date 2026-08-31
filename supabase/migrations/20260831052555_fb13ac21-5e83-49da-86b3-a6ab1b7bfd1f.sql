-- ============ FULL DATABASE SCHEMA ============
CREATE TABLE public.merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  api_key_hash text NOT NULL UNIQUE,
  api_key_prefix text NOT NULL,
  webhook_secret text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  owner_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  upi_id text,
  payee_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles_revealed (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key_plain text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.merchant_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  domain text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, domain)
);

CREATE TABLE public.orders (
  order_id text PRIMARY KEY,
  requested_amount numeric(10,2) NOT NULL,
  payable_amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  expiry_at timestamptz NOT NULL,
  paid_at timestamptz,
  payer_email text,
  payer_name text,
  paid_email_id text,
  merchant_id uuid REFERENCES public.merchants(id) ON DELETE SET NULL,
  merchant_order_id text,
  webhook_url text,
  success_url text,
  failure_url text,
  customer_email text,
  webhook_status text NOT NULL DEFAULT 'pending',
  webhook_attempts integer NOT NULL DEFAULT 0,
  next_webhook_at timestamptz,
  last_webhook_at timestamptz,
  failed_at timestamptz,
  upi_pa text,
  upi_pn text
);

CREATE TABLE public.payment_history (
  order_id text PRIMARY KEY,
  requested_amount numeric NOT NULL,
  payable_amount numeric NOT NULL,
  created_at timestamptz NOT NULL,
  paid_at timestamptz NOT NULL,
  payer_email text,
  payer_name text,
  paid_email_id text,
  archived_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.processed_emails (
  message_id text PRIMARY KEY,
  order_id text,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL,
  attempt integer NOT NULL,
  event text NOT NULL,
  url text NOT NULL,
  status_code integer,
  response_body text,
  error text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.email_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_address text NOT NULL,
  app_password text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  last_error text,
  last_checked_at timestamptz,
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ INDEXES ============
CREATE UNIQUE INDEX orders_pending_payable_unique ON public.orders (payable_amount) WHERE status = 'pending';
CREATE INDEX orders_status_idx ON public.orders (status);
CREATE UNIQUE INDEX orders_merchant_unique_order ON public.orders (merchant_id, merchant_order_id) WHERE merchant_id IS NOT NULL AND merchant_order_id IS NOT NULL;
CREATE INDEX orders_webhook_due ON public.orders (next_webhook_at) WHERE webhook_status = 'pending' AND webhook_url IS NOT NULL;
CREATE UNIQUE INDEX orders_paid_email_id_uniq ON public.orders (paid_email_id) WHERE paid_email_id IS NOT NULL;
CREATE INDEX merchant_domains_merchant_id_idx ON public.merchant_domains (merchant_id);

-- ============ GRANTS ============
GRANT SELECT ON public.orders, public.payment_history, public.webhook_deliveries, public.merchants, public.merchant_domains, public.profiles, public.profiles_revealed TO authenticated;
GRANT INSERT, DELETE ON public.merchant_domains TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;
GRANT DELETE ON public.profiles_revealed TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- ============ RLS ============
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles_revealed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users view own revealed key" ON public.profiles_revealed FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own revealed key" ON public.profiles_revealed FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Deny client inserts on profiles_revealed" ON public.profiles_revealed FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny client updates on profiles_revealed" ON public.profiles_revealed FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Users view own merchant" ON public.merchants FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Deny client inserts on merchants" ON public.merchants FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny client updates on merchants" ON public.merchants FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Deny client deletes on merchants" ON public.merchants FOR DELETE TO anon, authenticated USING (false);
CREATE POLICY "Owners can view their merchant domains" ON public.merchant_domains FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_domains.merchant_id AND m.owner_id = auth.uid()));
CREATE POLICY "Owners can insert their merchant domains" ON public.merchant_domains FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_domains.merchant_id AND m.owner_id = auth.uid()));
CREATE POLICY "Owners can delete their merchant domains" ON public.merchant_domains FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_domains.merchant_id AND m.owner_id = auth.uid()));
CREATE POLICY "Owners view their orders" ON public.orders FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = orders.merchant_id AND m.owner_id = auth.uid()));
CREATE POLICY "Owners view their payment_history" ON public.payment_history FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o JOIN public.merchants m ON m.id = o.merchant_id WHERE o.order_id = payment_history.order_id AND m.owner_id = auth.uid()));
CREATE POLICY "Owners view their webhook_deliveries" ON public.webhook_deliveries FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o JOIN public.merchants m ON m.id = o.merchant_id WHERE o.order_id = webhook_deliveries.order_id AND m.owner_id = auth.uid()));
CREATE POLICY "Deny all client access to processed_emails" ON public.processed_emails FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Deny all client access to email_accounts" ON public.email_accounts FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- ============ FUNCTIONS + TRIGGERS ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions'
AS $function$
DECLARE
  v_raw_key TEXT; v_prefix TEXT; v_hash TEXT; v_webhook TEXT;
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name',''), split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;

  v_raw_key := 'lk_live_' || encode(extensions.gen_random_bytes(24),'hex');
  v_prefix  := substr(v_raw_key, 1, 12);
  v_hash    := encode(extensions.digest(v_raw_key,'sha256'),'hex');
  v_webhook := 'whsec_' || encode(extensions.gen_random_bytes(24),'hex');

  INSERT INTO public.merchants (name, api_key_hash, api_key_prefix, webhook_secret, owner_id)
  VALUES (COALESCE(NULLIF(NEW.raw_user_meta_data->>'display_name',''), split_part(NEW.email,'@',1)), v_hash, v_prefix, v_webhook, NEW.id)
  ON CONFLICT (owner_id) DO NOTHING;

  INSERT INTO public.profiles_revealed (user_id, api_key_plain)
  VALUES (NEW.id, v_raw_key) ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.archive_paid_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') AND NEW.paid_at IS NOT NULL THEN
    INSERT INTO public.payment_history
      (order_id, requested_amount, payable_amount, created_at, paid_at, payer_email, payer_name, paid_email_id)
    VALUES
      (NEW.order_id, NEW.requested_amount, NEW.payable_amount, NEW.created_at, NEW.paid_at, NEW.payer_email, NEW.payer_name, NEW.paid_email_id)
    ON CONFLICT (order_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER orders_archive_paid AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.archive_paid_order();

CREATE OR REPLACE FUNCTION public.schedule_order_webhook()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.webhook_url IS NOT NULL
     AND NEW.status IN ('paid','expired','failed')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.webhook_status = 'pending' THEN
    NEW.next_webhook_at := now();
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER trg_schedule_order_webhook BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.schedule_order_webhook();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_email_accounts_updated_at BEFORE UPDATE ON public.email_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ DAILY PURGE AT 12:00 AM IST ============
CREATE OR REPLACE FUNCTION public.purge_daily_data()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.webhook_deliveries;
  DELETE FROM public.payment_history;
  DELETE FROM public.processed_emails;
  DELETE FROM public.orders;
END;
$function$;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
SELECT cron.schedule('purge-daily-data-midnight-ist', '30 18 * * *', $$SELECT public.purge_daily_data();$$);