CREATE TABLE settings
(
    id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    key        text UNIQUE NOT NULL,
    value      jsonb       NOT NULL,
    updated_at timestamptz      DEFAULT now()
);

-- Insert default currency (USD)
INSERT INTO settings (key, value)
VALUES ('default_currency', '{
  "code": "USD",
  "symbol": "$"
}');

-- Function to get default currency
CREATE
OR REPLACE FUNCTION get_default_currency()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
SELECT value
FROM settings
WHERE key = 'default_currency';
$$;

-- Function to set default currency (admin only)
CREATE
OR REPLACE FUNCTION set_default_currency(
  currency_code text,
  currency_symbol text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF
NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Only admins can set default currency';
END IF;

INSERT INTO settings (key, value)
VALUES ('default_currency',
        jsonb_build_object('code', currency_code, 'symbol', currency_symbol)) ON CONFLICT (key) DO
UPDATE
    SET value = EXCLUDED.value,
    updated_at = now();
END;
$$;