import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
// VeilleHistory déplacé vers un onglet séparé
import {
  Bell,
  LogOut,
  Target,
  Users,
  TrendingUp,
  Clock,
  Mail,
  Linkedin,
  Rss,
  Calendar,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  FileText,
  Settings,
  History,
  Bot
} from 'lucide-react';

interface ClientConfig {
  id: string;
  user_id: string;
  email: string | null;
  prenom: string | null;
  secteur: string | null;
  mots_cles: string[];
  concurrents: string[];
  profiles_linkedin: string[];
  sources_veille: string[];
  frequence: string | null;
  heure_envoi: string | null;
  canaux_diffusion: string[];
  status_onboarding: string;
  created_at: string;
  updated_at: string;
}

interface Rapport {
  id: string;
  titre: string;
  type: string;
  statut: string;
  created_at: string;
  sent_at: string | null;
}

interface VeilleDashboardProps {
  onNavigateToChat: () => void;
  onNavigateToChatWithReset: () => void;
  onNavigateToSettings: () => void;
  onNavigateToHistorique: () => void;
  onNavigateToRAGAssistant?: () => void;
}

export default function VeilleDashboard({ onNavigateToChat, onNavigateToChatWithReset, onNavigateToSettings, onNavigateToHistorique, onNavigateToRAGAssistant }: VeilleDashboardProps) {
  const { user, signOut } = useAuth();
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ rapports_generes: 0, rapports_envoyes: 0 });
  const [rapports, setRapports] = useState<Rapport[]>([]);

  // Fonction pour formatter les noms de canaux pour l'affichage
  const formatCanalName = (canal: string): string => {
    // Gestion des valeurs en minuscules (nouvelles valeurs)
    if (canal === 'email') return 'Email';
    if (canal === 'whatsapp_pdf') return 'WhatsApp PDF';
    if (canal === 'whatsapp_podcast') return 'WhatsApp Podcast';

    // Gestion des anciennes valeurs avec majuscules (rétrocompatibilité)
    if (canal === 'Email') return 'Email';
    if (canal === 'Whatsapp') return 'WhatsApp';

    // Fallback: remplacer les underscores par des espaces et capitaliser
    return canal
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  useEffect(() => {
    loadConfig();
    loadStats();
    loadRapports();
  }, []);

  // Recharger les données quand le composant devient visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadConfig();
        loadStats();
        loadRapports();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading config:', error);
        return;
      }

      setConfig(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (!clientData) return;

      const { count: totalCount } = await supabase
        .from('rapports')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', clientData.id);

      const { count: sentCount } = await supabase
        .from('rapports')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', clientData.id)
        .eq('statut', 'envoye');

      setStats({
        rapports_generes: totalCount || 0,
        rapports_envoyes: sentCount || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadRapports = async () => {
    try {
      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (!clientData) return;

      const { data, error } = await supabase
        .from('rapports')
        .select('*')
        .eq('client_id', clientData.id)
        .order('created_at', { ascending: false })
        .limit(7);

      if (error) {
        console.error('Error loading rapports:', error);
        return;
      }

      setRapports(data || []);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Extraire le nom d'une source à partir de l'URL
  const getSourceName = (url: string): string => {
    try {
      const urlObj = new URL(url);
      // Extraire le domaine sans www et sans extension
      let domain = urlObj.hostname.replace('www.', '');
      // Prendre la première partie du domaine
      const parts = domain.split('.');
      if (parts.length > 0) {
        domain = parts[0];
      }
      // Capitaliser la première lettre
      return domain.charAt(0).toUpperCase() + domain.slice(1);
    } catch {
      // Si ce n'est pas une URL, retourner les 30 premiers caractères
      return url.length > 30 ? url.substring(0, 30) + '...' : url;
    }
  };

  // Extraire le nom d'une entreprise depuis l'URL LinkedIn
  const getLinkedInName = (url: string): string => {
    try {
      // Format: https://www.linkedin.com/company/nom-entreprise ou /in/prenom-nom
      const companyMatch = url.match(/\/company\/([^\/\?]+)/);
      const personMatch = url.match(/\/in\/([^\/\?]+)/);

      if (companyMatch && companyMatch[1]) {
        // Remplacer les tirets par des espaces et capitaliser chaque mot
        return companyMatch[1]
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }

      if (personMatch && personMatch[1]) {
        // Pour les profils personnels
        return personMatch[1]
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }

      return url;
    } catch {
      return url;
    }
  };

  const getStatusBadge = () => {
    if (!config) return null;

    if (config.status_onboarding === 'done' || config.status_onboarding === 'completed') {
      return (
        <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-full">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-sm font-medium">Configuration complète ✓</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 bg-orange-50 text-orange-700 px-4 py-2 rounded-full">
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm font-medium">Configuration en cours</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-orange-50/30 via-peach-50 to-orange-100/40">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-orange-50/30 via-peach-50 to-orange-100/40">
        <div className="text-center max-w-md">
          <div className="bg-gradient-to-br from-orange-500 to-coral-500 p-4 rounded-2xl mb-4 inline-block">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Commencez votre configuration</h3>
          <p className="text-gray-600 mb-6">Discutez avec notre assistant IA pour configurer votre veille concurrentielle.</p>
          <button
            onClick={onNavigateToChat}
            className="bg-gradient-to-r from-orange-500 to-coral-500 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all flex items-center gap-2 mx-auto"
          >
            <MessageSquare className="w-5 h-5" />
            Démarrer la configuration
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Status Banner */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Tableau de bord de veille
            </h1>
            <p className="text-gray-600">
              Secteur : <span className="font-semibold">{config.secteur || 'Non défini'}</span>
            </p>
          </div>
          {getStatusBadge()}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-100">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-orange-100 p-3 rounded-xl">
                <FileText className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stats.rapports_generes}</div>
            <div className="text-sm text-gray-600">Rapports générés</div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-100">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-green-100 p-3 rounded-xl">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stats.rapports_envoyes}</div>
            <div className="text-sm text-gray-600">Rapports envoyés</div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-100">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-orange-100 p-3 rounded-xl">
                <Users className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{config.concurrents.length}</div>
            <div className="text-sm text-gray-600">Concurrents suivis</div>
          </div>
        </div>

        {/* Configuration Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Secteur et Mots-clés */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-100 p-2 rounded-lg">
                <Target className="w-5 h-5 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Ciblage</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 mb-2 block">Mots-clés surveillés</label>
                <div className="flex flex-wrap gap-2">
                  {config.mots_cles.length > 0 ? (
                    config.mots_cles.map((mot, idx) => (
                      <span
                        key={idx}
                        className="bg-orange-50 text-orange-700 px-3 py-1 rounded-lg text-sm font-medium"
                      >
                        {mot}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-400 text-sm">Aucun mot-clé défini</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Concurrents */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-100 p-2 rounded-lg">
                <Users className="w-5 h-5 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Concurrents</h3>
            </div>
            <div className="space-y-2">
              {config.concurrents.length > 0 ? (
                config.concurrents.map((concurrent, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 text-gray-700 bg-gray-50 px-3 py-2 rounded-lg"
                  >
                    <TrendingUp className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium">{concurrent}</span>
                  </div>
                ))
              ) : (
                <span className="text-gray-400 text-sm">Aucun concurrent défini</span>
              )}
            </div>
          </div>

          {/* Sources LinkedIn */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Linkedin className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Profils LinkedIn</h3>
            </div>
            <div className="space-y-2">
              {config.profiles_linkedin.length > 0 ? (
                config.profiles_linkedin.map((profile, idx) => (
                  <a
                    key={idx}
                    href={profile}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-gray-700 hover:text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg transition-colors"
                  >
                    <Linkedin className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <span className="text-sm font-medium">{getLinkedInName(profile)}</span>
                  </a>
                ))
              ) : (
                <span className="text-gray-400 text-sm">Aucun profil défini</span>
              )}
            </div>
          </div>

          {/* Sources RSS */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-100 p-2 rounded-lg">
                <Rss className="w-5 h-5 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Sources de veille</h3>
            </div>
            <div className="text-sm text-gray-600">
              {config.sources_veille.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {config.sources_veille.map((source, idx) => (
                    <span
                      key={idx}
                      className="bg-peach-50 text-orange-700 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                      title={source}
                    >
                      <Rss className="w-4 h-4" />
                      {getSourceName(source)}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-gray-400">Aucune source définie</span>
              )}
            </div>
          </div>

          {/* Paramètres de diffusion */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-100 lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-green-100 p-2 rounded-lg">
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Paramètres de diffusion</h3>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <label className="text-sm text-gray-600 mb-2 block">Fréquence</label>
                <div className="flex items-center gap-2 bg-gray-50 px-4 py-3 rounded-lg">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900">
                    {config.frequence || 'Non défini'}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-2 block">Heure d'envoi</label>
                <div className="flex items-center gap-2 bg-gray-50 px-4 py-3 rounded-lg">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-900">
                    {config.heure_envoi || 'Non défini'}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-2 block">Canaux</label>
                <div className="flex flex-wrap gap-2">
                  {config.canaux_diffusion.length > 0 ? (
                    config.canaux_diffusion.map((canal, idx) => (
                      <div
                        key={idx}
                        className="bg-green-100 text-green-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 border border-green-200"
                      >
                        <Mail className="w-4 h-4" />
                        {formatCanalName(canal)}
                      </div>
                    ))
                  ) : (
                    <span className="text-gray-400 text-sm">Non défini</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dernières veilles */}
        {rapports.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">7 dernières veilles</h2>
            <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
              <div className="divide-y divide-gray-100">
                {rapports.slice(0, 7).map((rapport) => (
                  <div key={rapport.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {rapport.titre}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                          <span>
                            {new Date(rapport.date_generation).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                          </span>
                          <span className="text-gray-300">•</span>
                          <span>{rapport.nb_sources} sources</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          rapport.type_rapport === 'quotidien' ? 'bg-orange-100 text-orange-700' :
                          rapport.type_rapport === 'hebdomadaire' ? 'bg-coral-100 text-coral-700' :
                          rapport.type_rapport === 'mensuel' ? 'bg-peach-100 text-orange-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {rapport.type_rapport}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 7 derniers rapports (DEPRECATED - remplacé par VeilleHistory) */}
        {false && rapports.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Derniers rapports de veille</h2>
            <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
              <div className="divide-y divide-gray-100">
                {rapports.map((rapport) => (
                  <div key={rapport.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <FileText className="w-5 h-5 text-orange-500" />
                          <h3 className="font-semibold text-gray-900">{rapport.titre}</h3>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600 ml-8">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(rapport.created_at).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </span>
                          <span className="capitalize px-2 py-1 bg-orange-50 text-orange-700 rounded text-xs font-medium">
                            {rapport.type}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {rapport.statut === 'envoye' ? (
                          <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                            <CheckCircle2 className="w-4 h-4" />
                            Envoyé
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-gray-500 text-sm font-medium">
                            <Clock className="w-4 h-4" />
                            Généré
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CTA to complete configuration or Welcome message */}
        {config.status_onboarding !== 'done' && config.status_onboarding !== 'completed' ? (
          <div className="mt-8 bg-gradient-to-r from-orange-500 to-coral-500 rounded-2xl p-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold mb-2">Terminez votre configuration</h3>
                <p className="text-white/90">
                  Discutez avec notre assistant pour finaliser les paramètres de votre veille.
                </p>
              </div>
              <button
                onClick={onNavigateToChat}
                className="bg-white text-orange-600 px-6 py-3 rounded-xl hover:shadow-lg transition-all flex items-center gap-2 font-semibold"
              >
                <MessageSquare className="w-5 h-5" />
                Continuer la configuration
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-8 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-4">
                <div className="bg-white/20 p-3 rounded-xl">
                  <CheckCircle2 className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">🎉 Félicitations {config.prenom} !</h3>
                  <p className="text-white/90 mb-3">
                    Votre veille concurrentielle est configurée et prête à fonctionner.
                  </p>
                  <p className="text-white/80 text-sm">
                    Vous recevrez vos premiers rapports selon la fréquence que vous avez choisie : <strong>{config.frequence}</strong> à <strong>{config.heure_envoi}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={onNavigateToSettings}
                className="bg-white text-green-600 px-6 py-3 rounded-xl hover:shadow-lg transition-all flex items-center gap-2 font-semibold whitespace-nowrap"
              >
                <Settings className="w-5 h-5" />
                Modifier mes paramètres
              </button>
            </div>
          </div>
        )}
    </div>
  );
}
