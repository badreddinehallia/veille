-- Script pour vérifier les tables existantes dans Supabase

-- Vérifier si les tables existent
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('onboarding_conversations', 'onboarding_state', 'conversations')
ORDER BY table_name;

-- Voir la structure de la table onboarding_conversations si elle existe
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'onboarding_conversations'
ORDER BY ordinal_position;

-- Voir la structure de la table onboarding_state si elle existe
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'onboarding_state'
ORDER BY ordinal_position;

-- Voir toutes les contraintes existantes
SELECT
    tc.constraint_name,
    tc.table_name,
    tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('onboarding_conversations', 'onboarding_state')
ORDER BY tc.table_name, tc.constraint_name;

-- Voir toutes les politiques RLS existantes
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('onboarding_conversations', 'onboarding_state')
ORDER BY tablename, policyname;
