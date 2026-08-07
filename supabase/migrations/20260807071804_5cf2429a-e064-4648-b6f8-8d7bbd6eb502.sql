CREATE UNIQUE INDEX IF NOT EXISTS payments_unique_reference_idx
ON public.payments (upper(btrim(paynow_reference)))
WHERE paynow_reference IS NOT NULL AND btrim(paynow_reference) <> '' AND status <> 'voided';