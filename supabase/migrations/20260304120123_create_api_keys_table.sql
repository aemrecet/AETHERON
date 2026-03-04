/*
  # Create API Keys Table

  1. New Tables
    - `api_keys`
      - `id` (uuid, primary key) - Unique identifier
      - `service_name` (text, unique, not null) - Name of the API service (e.g., 'COINGECKO', 'FINNHUB')
      - `api_key` (text, not null) - The API key value
      - `description` (text) - Human-readable description of the service
      - `is_active` (boolean, default true) - Whether this key is currently active
      - `created_at` (timestamptz) - When the key was added
      - `updated_at` (timestamptz) - When the key was last modified

  2. Security
    - Enable RLS on `api_keys` table
    - Add policy for service_role access only (server-side only)
    - No public/anon access to protect sensitive keys

  3. Notes
    - API keys are only accessible from the server (service_role)
    - The service_name column is unique to prevent duplicates
    - is_active flag allows disabling keys without deleting them
*/

CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text UNIQUE NOT NULL,
  api_key text NOT NULL DEFAULT '',
  description text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage api_keys"
  ON api_keys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
