
-- Certification requests table
CREATE TABLE public.certification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  clan text NOT NULL,
  clan_role text NOT NULL,
  reason text NOT NULL,
  cert_type text NOT NULL DEFAULT 'verified',
  status text NOT NULL DEFAULT 'pending',
  rejection_reason text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  analyzed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.certification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own cert requests" ON public.certification_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create cert requests" ON public.certification_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all cert requests" ON public.certification_requests FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update cert requests" ON public.certification_requests FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- Account reviews table
CREATE TABLE public.account_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reason text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own account reviews" ON public.account_reviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create account reviews" ON public.account_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all account reviews" ON public.account_reviews FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update account reviews" ON public.account_reviews FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- Indexes
CREATE INDEX idx_cert_requests_user ON public.certification_requests(user_id);
CREATE INDEX idx_cert_requests_status ON public.certification_requests(status);
CREATE INDEX idx_account_reviews_user ON public.account_reviews(user_id);
CREATE INDEX idx_account_reviews_status ON public.account_reviews(status);
