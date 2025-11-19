-- Vérifier d'abord si la table existe et la supprimer si nécessaire
DROP TABLE IF EXISTS onboarding_conversations CASCADE;

-- Table pour stocker les conversations d'onboarding
CREATE TABLE onboarding_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX idx_onboarding_conversations_user_id ON onboarding_conversations(user_id);
CREATE INDEX idx_onboarding_conversations_created_at ON onboarding_conversations(created_at);

-- Supprimer la table si elle existe
DROP TABLE IF EXISTS onboarding_state CASCADE;

-- Table pour stocker l'état de l'onboarding (config actuelle)
CREATE TABLE onboarding_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  etape_actuelle INTEGER DEFAULT 1,
  is_completed BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour l'état de l'onboarding
CREATE INDEX idx_onboarding_state_user_id ON onboarding_state(user_id);

-- Politique de sécurité (RLS) pour onboarding_conversations
ALTER TABLE onboarding_conversations ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Users can view their own onboarding messages" ON onboarding_conversations;
DROP POLICY IF EXISTS "Users can insert their own onboarding messages" ON onboarding_conversations;
DROP POLICY IF EXISTS "Users can delete their own onboarding messages" ON onboarding_conversations;

-- Politique : Les utilisateurs peuvent voir uniquement leurs propres messages
CREATE POLICY "Users can view their own onboarding messages"
  ON onboarding_conversations
  FOR SELECT
  USING (auth.uid() = user_id);

-- Politique : Les utilisateurs peuvent insérer leurs propres messages
CREATE POLICY "Users can insert their own onboarding messages"
  ON onboarding_conversations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Politique : Les utilisateurs peuvent supprimer leurs propres messages
CREATE POLICY "Users can delete their own onboarding messages"
  ON onboarding_conversations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Politique de sécurité (RLS) pour onboarding_state
ALTER TABLE onboarding_state ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Users can view their own onboarding state" ON onboarding_state;
DROP POLICY IF EXISTS "Users can insert their own onboarding state" ON onboarding_state;
DROP POLICY IF EXISTS "Users can update their own onboarding state" ON onboarding_state;
DROP POLICY IF EXISTS "Users can delete their own onboarding state" ON onboarding_state;

-- Politique : Les utilisateurs peuvent voir uniquement leur propre état
CREATE POLICY "Users can view their own onboarding state"
  ON onboarding_state
  FOR SELECT
  USING (auth.uid() = user_id);

-- Politique : Les utilisateurs peuvent insérer leur propre état
CREATE POLICY "Users can insert their own onboarding state"
  ON onboarding_state
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Politique : Les utilisateurs peuvent mettre à jour leur propre état
CREATE POLICY "Users can update their own onboarding state"
  ON onboarding_state
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Politique : Les utilisateurs peuvent supprimer leur propre état
CREATE POLICY "Users can delete their own onboarding state"
  ON onboarding_state
  FOR DELETE
  USING (auth.uid() = user_id);

-- Supprimer le trigger s'il existe
DROP TRIGGER IF EXISTS update_onboarding_state_updated_at_trigger ON onboarding_state;

-- Fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_onboarding_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at automatiquement
CREATE TRIGGER update_onboarding_state_updated_at_trigger
  BEFORE UPDATE ON onboarding_state
  FOR EACH ROW
  EXECUTE FUNCTION update_onboarding_state_updated_at();
