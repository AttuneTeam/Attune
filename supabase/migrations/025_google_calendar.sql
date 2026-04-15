-- Google OAuth token storage for the manager's account
CREATE TABLE user_oauth_tokens (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider      text NOT NULL,          -- 'google'
  access_token  text NOT NULL,
  refresh_token text,
  expires_at    timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE user_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_tokens" ON user_oauth_tokens
  FOR ALL USING (user_id = auth.uid());

-- Link an interaction to a Google Calendar event
ALTER TABLE interactions ADD COLUMN google_calendar_event_id text;
