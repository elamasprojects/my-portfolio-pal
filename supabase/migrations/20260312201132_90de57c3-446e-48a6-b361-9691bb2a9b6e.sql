INSERT INTO public.brokers (name, country, category, display_order)
VALUES ('ARQ', 'US', 'digital', 7)
ON CONFLICT DO NOTHING;