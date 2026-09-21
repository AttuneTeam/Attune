-- Organisations are the hard boundary for a person's separate work contexts.
-- The selected organisation is supplied in the x-organization-id request header;
-- membership is checked here, rather than trusting the browser's selection.

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organization_memberships (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_read_organizations" ON organizations FOR SELECT
  USING (EXISTS (SELECT 1 FROM organization_memberships om WHERE om.organization_id = id AND om.user_id = auth.uid()));
CREATE POLICY "members_can_read_memberships" ON organization_memberships FOR SELECT USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION current_organization_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT om.organization_id
  FROM organization_memberships om
  WHERE om.user_id = auth.uid()
    AND om.organization_id = COALESCE(
      NULLIF(current_setting('request.headers', true), '')::jsonb ->> 'x-organization-id',
      (SELECT om2.organization_id::text FROM organization_memberships om2 WHERE om2.user_id = auth.uid() ORDER BY om2.created_at LIMIT 1)
    )::uuid
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION create_organization(organization_name text)
RETURNS organizations LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE created organizations;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  INSERT INTO organizations(name) VALUES (trim(organization_name)) RETURNING * INTO created;
  INSERT INTO organization_memberships(organization_id, user_id, role) VALUES (created.id, auth.uid(), 'owner');
  RETURN created;
END;
$$;

-- Keep the original profile trigger's behaviour, but ensure accounts created
-- after this migration are immediately able to use an isolated workspace too.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE organization_id uuid;
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), 'manager')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organizations (name)
  VALUES (COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)) || '''s organisation')
  RETURNING id INTO organization_id;
  INSERT INTO public.organization_memberships (organization_id, user_id, role)
  VALUES (organization_id, NEW.id, 'owner');
  RETURN NEW;
END;
$$;

-- Preserve all existing work as a separate initial organisation for each owner.
INSERT INTO organizations (id, name, created_at)
SELECT gen_random_uuid(), COALESCE(NULLIF(trim(p.full_name), ''), 'Personal') || '''s organisation ' || left(p.id::text, 8), now()
FROM profiles p;

INSERT INTO organization_memberships (organization_id, user_id)
SELECT o.id, p.id FROM profiles p
JOIN organizations o ON o.name = COALESCE(NULLIF(trim(p.full_name), ''), 'Personal') || '''s organisation ' || left(p.id::text, 8);

-- A few legacy rows can have no manager and no owner-bearing parent (for
-- example an empty team created before manager ownership was enforced). They
-- were unreachable under the old RLS policy too. Keep them intact but place
-- them in an organisation with no members, rather than guessing an owner or
-- allowing one malformed row to prevent the whole migration.
INSERT INTO organizations (id, name)
VALUES ('00000000-0000-0000-0000-000000000046', 'Unassigned legacy records');

-- Every work table gets an organisation key. The default means existing client
-- inserts remain safe while the request policy rejects a missing/foreign context.
DO $$
DECLARE
  tbl text;
  policy_name text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'teams','team_members','interactions','action_items','embeddings','team_values',
    'team_member_integrations','goal_templates','member_goals',
    'roles','role_areas','team_coverage_snapshots','org_context','chat_conversations',
    'chat_messages','knowledge_documents','knowledge_chunks','agenda_items','personal_items',
    'strategic_initiatives','team_pulse_snapshots','manager_profile_snapshots','daily_briefings',
    'workshop_sessions','github_activity_snapshots','user_oauth_tokens','member_personas','member_persona_versions',
    'interaction_initiative_signals','map_domains'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN organization_id uuid REFERENCES organizations(id)', tbl);
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'manager_id') THEN
      EXECUTE format('UPDATE %I SET organization_id = (SELECT organization_id FROM organization_memberships WHERE user_id = %I.manager_id ORDER BY created_at LIMIT 1)', tbl, tbl);
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'user_id') THEN
      EXECUTE format('UPDATE %I SET organization_id = (SELECT organization_id FROM organization_memberships WHERE user_id = %I.user_id ORDER BY created_at LIMIT 1)', tbl, tbl);
    END IF;
    -- Tables without an owner inherit their organisation from their direct parent.
    IF tbl = 'teams' THEN EXECUTE '
      UPDATE teams t SET organization_id = COALESCE(
        (SELECT om.organization_id FROM team_members tm JOIN organization_memberships om ON om.user_id = tm.manager_id WHERE tm.team_id = t.id ORDER BY om.created_at LIMIT 1),
        (SELECT parent.organization_id FROM teams parent WHERE parent.id = t.parent_id)
      ) WHERE t.organization_id IS NULL'; END IF;
    IF tbl = 'action_items' THEN EXECUTE 'UPDATE action_items a SET organization_id = i.organization_id FROM interactions i WHERE a.organization_id IS NULL AND a.interaction_id = i.id'; END IF;
    IF tbl = 'embeddings' THEN EXECUTE 'UPDATE embeddings e SET organization_id = i.organization_id FROM interactions i WHERE e.organization_id IS NULL AND e.interaction_id = i.id'; END IF;
    IF tbl = 'role_areas' THEN EXECUTE 'UPDATE role_areas a SET organization_id = r.organization_id FROM roles r WHERE a.organization_id IS NULL AND a.role_id = r.id'; END IF;
    IF tbl = 'chat_messages' THEN EXECUTE 'UPDATE chat_messages m SET organization_id = c.organization_id FROM chat_conversations c WHERE m.organization_id IS NULL AND m.conversation_id = c.id'; END IF;
    IF tbl = 'agenda_items' THEN EXECUTE 'UPDATE agenda_items a SET organization_id = i.organization_id FROM interactions i WHERE a.organization_id IS NULL AND a.interaction_id = i.id'; END IF;
    IF tbl = 'knowledge_chunks' THEN EXECUTE 'UPDATE knowledge_chunks c SET organization_id = d.organization_id FROM knowledge_documents d WHERE c.organization_id IS NULL AND c.document_id = d.id'; END IF;
    EXECUTE format('UPDATE %I SET organization_id = ''00000000-0000-0000-0000-000000000046'' WHERE organization_id IS NULL', tbl);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN organization_id SET DEFAULT current_organization_id()', tbl);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN organization_id SET NOT NULL', tbl);
    EXECUTE format('CREATE INDEX %I ON %I (organization_id)', tbl || '_organization_id_idx', tbl);
    -- Policies combine with OR by default. Remove the legacy user-scoped
    -- policies, otherwise a request could still see all of its own workspaces.
    FOR policy_name IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl LOOP
      EXECUTE format('DROP POLICY %I ON %I', policy_name, tbl);
    END LOOP;
    EXECUTE format('CREATE POLICY organization_isolation ON %I FOR ALL USING (organization_id = current_organization_id()) WITH CHECK (organization_id = current_organization_id())', tbl);
  END LOOP;
END $$;

-- Org-specific records can recur in another organisation.
ALTER TABLE org_context DROP CONSTRAINT IF EXISTS org_context_manager_id_key;
ALTER TABLE org_context ADD CONSTRAINT org_context_organization_id_key UNIQUE (organization_id);
ALTER TABLE daily_briefings DROP CONSTRAINT IF EXISTS daily_briefings_user_id_date_key;
ALTER TABLE daily_briefings ADD CONSTRAINT daily_briefings_organization_date_key UNIQUE (organization_id, date);
ALTER TABLE user_oauth_tokens DROP CONSTRAINT IF EXISTS user_oauth_tokens_user_id_provider_key;
ALTER TABLE user_oauth_tokens ADD CONSTRAINT user_oauth_tokens_organization_provider_key UNIQUE (organization_id, provider);

-- Search RPCs must honour the selected context as well as their legacy owner check.
CREATE OR REPLACE FUNCTION match_documents(query_embedding vector(1536), match_threshold float DEFAULT 0.7, match_count int DEFAULT 10)
RETURNS TABLE (id uuid, interaction_id uuid, content text, similarity float, participant_name text, scheduled_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT e.id, e.interaction_id, e.content, 1 - (e.content_vector <=> query_embedding), tm.name, i.scheduled_at
  FROM embeddings e JOIN interactions i ON i.id = e.interaction_id JOIN team_members tm ON tm.id = i.participant_id
  WHERE e.organization_id = current_organization_id() AND 1 - (e.content_vector <=> query_embedding) > match_threshold
  ORDER BY e.content_vector <=> query_embedding LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION match_knowledge(query_embedding vector(1536), match_threshold float DEFAULT 0.65, match_count int DEFAULT 5)
RETURNS TABLE (chunk_id uuid, document_id uuid, title text, content text, source text, similarity float)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT kc.id, kc.document_id, kd.title, kc.content, kd.source, 1 - (kc.content_vector <=> query_embedding)
  FROM knowledge_chunks kc JOIN knowledge_documents kd ON kd.id = kc.document_id
  WHERE kc.organization_id = current_organization_id() AND 1 - (kc.content_vector <=> query_embedding) > match_threshold
  ORDER BY kc.content_vector <=> query_embedding LIMIT match_count;
$$;
