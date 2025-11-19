import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import '../styles/phone-input-custom.css';
import {
  Bell,
  LogOut,
  Target,
  Users,
  Clock,
  Linkedin,
  Rss,
  Calendar,
  Save,
  ArrowLeft,
  CheckCircle2,
  X,
  Plus,
  Mail,
  MessageCircle
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
  email_destinataires: string[];
  email_cc: string[];
  whatsapp: string | null;
}

interface SettingsPageProps {
  onNavigateToDashboard: () => void;
}

export default function SettingsPage({ onNavigateToDashboard }: SettingsPageProps) {
  const { user, signOut } = useAuth();
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // États pour les inputs
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [secteur, setSecteur] = useState('');
  const [motsCles, setMotsCles] = useState<string[]>([]);
  const [concurrents, setConcurrents] = useState<string[]>([]);
  const [profilesLinkedin, setProfilesLinkedin] = useState<string[]>([]);
  const [sourcesVeille, setSourcesVeille] = useState<string[]>([]);
  const [frequence, setFrequence] = useState('');
  const [heureEnvoi, setHeureEnvoi] = useState('');
  const [canauxDiffusion, setCanauxDiffusion] = useState<string[]>([]);
  const [emailDestinataires, setEmailDestinataires] = useState<string[]>([]);
  const [emailCc, setEmailCc] = useState<string[]>([]);

  // État WhatsApp (numéro complet avec indicatif)
  const [whatsappPhone, setWhatsappPhone] = useState('+33');

  // États temporaires pour l'ajout d'items
  const [newMotCle, setNewMotCle] = useState('');
  const [newConcurrent, setNewConcurrent] = useState('');
  const [newProfileLinkedin, setNewProfileLinkedin] = useState('');
  const [newSourceVeille, setNewSourceVeille] = useState('');
  const [newEmailDestinataire, setNewEmailDestinataire] = useState('');
  const [newEmailCc, setNewEmailCc] = useState('');

  useEffect(() => {
    loadConfig();
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

      if (data) {
        console.log('=== CHARGEMENT CONFIG ===');
        console.log('Données complètes:', data);
        console.log('Email destinataires chargés:', data.email_destinataires);
        console.log('Email CC chargés:', data.email_cc);

        setConfig(data);
        setPrenom(data.prenom || '');
        setEmail(data.email || '');
        setSecteur(data.secteur || '');
        setMotsCles(data.mots_cles || []);
        setConcurrents(data.concurrents || []);
        setProfilesLinkedin(data.profiles_linkedin || []);
        setSourcesVeille(data.sources_veille || []);
        setFrequence(data.frequence || '');
        setHeureEnvoi(data.heure_envoi || '');

        // Charger et normaliser les canaux depuis la BDD
        // Convertir les anciennes valeurs (Email, Whatsapp) vers les nouvelles (email, whatsapp_pdf, whatsapp_podcast)
        const rawCanaux = data.canaux_diffusion || [];
        const normalizedCanaux = rawCanaux.map((canal: string) => {
          // Convertir "Email" -> "email"
          if (canal.toLowerCase() === 'email') return 'email';
          // Convertir "Whatsapp" -> "whatsapp_pdf" (par défaut)
          if (canal.toLowerCase() === 'whatsapp') return 'whatsapp_pdf';
          // Garder les autres valeurs telles quelles (whatsapp_pdf, whatsapp_podcast)
          return canal;
        });
        setCanauxDiffusion([...new Set(normalizedCanaux)]);

        // Ajouter automatiquement l'email personnel dans les destinataires
        const destinataires = data.email_destinataires || [];
        const emailPersonnel = data.email; // Email des informations personnelles
        if (emailPersonnel && !destinataires.includes(emailPersonnel)) {
          destinataires.unshift(emailPersonnel); // Ajouter en premier
          console.log('✅ Email personnel ajouté automatiquement aux destinataires:', emailPersonnel);
        }
        setEmailDestinataires(destinataires);
        setEmailCc(data.email_cc || []);

        // Charger le numéro WhatsApp
        if (data.whatsapp) {
          setWhatsappPhone(data.whatsapp);
        }

        console.log('États React mis à jour');
        console.log('emailDestinataires state:', destinataires);
        console.log('emailCc state:', data.email_cc || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);

    // S'assurer que l'email personnel est toujours dans les destinataires
    const finalDestinataires = [...emailDestinataires];
    if (email && !finalDestinataires.includes(email)) {
      finalDestinataires.unshift(email);
      console.log('✅ Email personnel ajouté avant sauvegarde:', email);
    }

    // Debug: Afficher les données avant sauvegarde
    console.log('=== DONNÉES À SAUVEGARDER ===');
    console.log('User ID:', user?.id);
    console.log('Email destinataires:', finalDestinataires);
    console.log('Email CC:', emailCc);

    try {
      const updateData = {
        prenom,
        email,
        secteur,
        mots_cles: motsCles,
        concurrents,
        profiles_linkedin: profilesLinkedin,
        sources_veille: sourcesVeille,
        frequence,
        heure_envoi: heureEnvoi,
        canaux_diffusion: canauxDiffusion,
        email_destinataires: finalDestinataires,
        email_cc: emailCc,
        whatsapp: whatsappPhone && whatsappPhone.length > 3 ? whatsappPhone : null,
        updated_at: new Date().toISOString(),
      };

      console.log('Objet complet à envoyer:', updateData);

      const { data, error, count } = await supabase
        .from('clients')
        .update(updateData)
        .eq('user_id', user?.id)
        .select();

      console.log('Nombre de lignes affectées:', count);
      console.log('Data retournée:', data);

      if (error) {
        console.error('❌ ERREUR Supabase:', error);
        console.error('Message:', error.message);
        console.error('Details:', error.details);
        console.error('Hint:', error.hint);
        alert('Erreur lors de la sauvegarde: ' + error.message);
        return;
      }

      console.log('✅ DONNÉES SAUVEGARDÉES:', data);

      // Vérifier que les emails ont bien été sauvegardés
      if (data && data.length > 0) {
        console.log('✅ Données trouvées dans le retour !');
        console.log('Email destinataires dans DB:', data[0].email_destinataires);
        console.log('Email CC dans DB:', data[0].email_cc);
      } else {
        console.warn('⚠️ Aucune donnée retournée par .select() - On vérifie manuellement...');

        // Vérification manuelle
        const { data: verifyData, error: verifyError } = await supabase
          .from('clients')
          .select('email_destinataires, email_cc, updated_at')
          .eq('user_id', user?.id)
          .single();

        if (verifyError) {
          console.error('❌ Erreur lors de la vérification:', verifyError);
        } else {
          console.log('✅ VÉRIFICATION MANUELLE - Données dans DB:', verifyData);
          console.log('Email destinataires (vérif):', verifyData.email_destinataires);
          console.log('Email CC (vérif):', verifyData.email_cc);
        }
      }

      // Mettre à jour l'état local avec les destinataires finaux
      setEmailDestinataires(finalDestinataires);

      // Afficher le modal de succès (l'utilisateur devra cliquer sur OK pour fermer)
      setSaveSuccess(true);
    } catch (error) {
      console.error('❌ EXCEPTION:', error);
      alert('Erreur lors de la sauvegarde: ' + error);
    } finally {
      setSaving(false);
    }
  };

  const addMotCle = () => {
    if (newMotCle.trim() && motsCles.length < 5) {
      setMotsCles([...motsCles, newMotCle.trim()]);
      setNewMotCle('');
    }
  };

  const removeMotCle = (index: number) => {
    setMotsCles(motsCles.filter((_, i) => i !== index));
  };

  const addConcurrent = () => {
    if (newConcurrent.trim() && concurrents.length < 10) {
      setConcurrents([...concurrents, newConcurrent.trim()]);
      setNewConcurrent('');
    }
  };

  const removeConcurrent = (index: number) => {
    setConcurrents(concurrents.filter((_, i) => i !== index));
  };

  const addProfileLinkedin = () => {
    if (newProfileLinkedin.trim()) {
      setProfilesLinkedin([...profilesLinkedin, newProfileLinkedin.trim()]);
      setNewProfileLinkedin('');
    }
  };

  const removeProfileLinkedin = (index: number) => {
    setProfilesLinkedin(profilesLinkedin.filter((_, i) => i !== index));
  };

  const addSourceVeille = () => {
    if (newSourceVeille.trim() && sourcesVeille.length < 4) {
      setSourcesVeille([...sourcesVeille, newSourceVeille.trim()]);
      setNewSourceVeille('');
    }
  };

  const removeSourceVeille = (index: number) => {
    setSourcesVeille(sourcesVeille.filter((_, i) => i !== index));
  };

  const toggleCanal = (canal: string) => {
    if (canauxDiffusion.includes(canal)) {
      setCanauxDiffusion(canauxDiffusion.filter(c => c !== canal));
    } else {
      setCanauxDiffusion([...canauxDiffusion, canal]);
    }
  };

  const addEmailDestinataire = () => {
    const trimmedEmail = newEmailDestinataire.trim();

    if (!trimmedEmail) return;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      alert('Veuillez entrer une adresse email valide');
      return;
    }

    // Vérifier si l'email existe déjà
    if (emailDestinataires.includes(trimmedEmail)) {
      alert('Cet email est déjà dans la liste des destinataires');
      return;
    }

    // Informer si c'est l'email personnel (déjà ajouté automatiquement)
    if (trimmedEmail === email) {
      alert('Votre adresse email personnelle est déjà ajoutée automatiquement aux destinataires');
      setNewEmailDestinataire('');
      return;
    }

    setEmailDestinataires([...emailDestinataires, trimmedEmail]);
    setNewEmailDestinataire('');
  };

  const removeEmailDestinataire = (index: number) => {
    const emailToRemove = emailDestinataires[index];

    // Empêcher la suppression de l'email personnel
    if (emailToRemove === email) {
      alert('Vous ne pouvez pas supprimer votre adresse email personnelle des destinataires.');
      return;
    }

    setEmailDestinataires(emailDestinataires.filter((_, i) => i !== index));
  };

  const addEmailCc = () => {
    if (newEmailCc.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmailCc)) {
      setEmailCc([...emailCc, newEmailCc.trim()]);
      setNewEmailCc('');
    } else {
      alert('Veuillez entrer une adresse email valide');
    }
  };

  const removeEmailCc = (index: number) => {
    setEmailCc(emailCc.filter((_, i) => i !== index));
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
        <div className="text-center">
          <p className="text-gray-600 mb-4">Aucune configuration trouvée</p>
          <button
            onClick={onNavigateToDashboard}
            className="bg-gradient-to-r from-orange-500 to-coral-500 text-white px-6 py-3 rounded-xl hover:shadow-lg transition-all"
          >
            Retour au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Paramètres de veille</h1>
          <p className="text-gray-600">Modifiez votre configuration à tout moment</p>
        </div>

        {/* Modal de succès */}
        {saveSuccess && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md mx-4 animate-slideInUp">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    Enregistré avec succès !
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Votre configuration a été mise à jour avec succès.
                  </p>
                  <button
                    onClick={() => setSaveSuccess(false)}
                    className="w-full px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-500 to-green-600 hover:shadow-lg rounded-lg transition-all"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Informations personnelles */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations personnelles</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Prénom</label>
                <input
                  type="text"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Votre prénom"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="votre@email.com"
                />
              </div>
            </div>
          </div>

          {/* Destinataires Email */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-green-100 p-2 rounded-lg">
                <Mail className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Destinataires des rapports</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Destinataires principaux <span className="text-gray-500">({emailDestinataires.length})</span>
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="email"
                    value={newEmailDestinataire}
                    onChange={(e) => setNewEmailDestinataire(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addEmailDestinataire()}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="email@example.com"
                  />
                  <button
                    onClick={addEmailDestinataire}
                    disabled={!newEmailDestinataire.trim()}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Plus size={16} />
                    Ajouter
                  </button>
                </div>
                <div className="space-y-2">
                  {emailDestinataires.map((emailDest, idx) => {
                    const isPersonalEmail = emailDest === email;
                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between px-4 py-2 rounded-lg ${
                          isPersonalEmail
                            ? 'bg-gradient-to-r from-orange-50 to-orange-100 border-2 border-orange-300'
                            : 'bg-green-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Mail className={`w-4 h-4 ${isPersonalEmail ? 'text-orange-600' : 'text-green-600'}`} />
                          <span className="text-sm font-medium text-gray-700">{emailDest}</span>
                          {isPersonalEmail && (
                            <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full font-semibold">
                              Vous
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => removeEmailDestinataire(idx)}
                          className={`transition-colors ${
                            isPersonalEmail
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'text-gray-400 hover:text-red-600'
                          }`}
                          disabled={isPersonalEmail}
                          title={isPersonalEmail ? 'Vous ne pouvez pas supprimer votre email personnel' : 'Supprimer'}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    );
                  })}
                  {emailDestinataires.length === 0 && (
                    <div className="text-sm text-gray-400 text-center py-2">
                      Aucun destinataire principal ajouté
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  En copie (CC) <span className="text-gray-500">({emailCc.length})</span>
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="email"
                    value={newEmailCc}
                    onChange={(e) => setNewEmailCc(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addEmailCc()}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="email@example.com"
                  />
                  <button
                    onClick={addEmailCc}
                    disabled={!newEmailCc.trim()}
                    className="px-4 py-2 bg-gradient-to-r from-orange-500 to-coral-500 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Plus size={16} />
                    Ajouter
                  </button>
                </div>
                <div className="space-y-2">
                  {emailCc.map((cc, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-orange-50 px-4 py-2 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-orange-600" />
                        <span className="text-sm font-medium text-gray-700">{cc}</span>
                      </div>
                      <button
                        onClick={() => removeEmailCc(idx)}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  {emailCc.length === 0 && (
                    <div className="text-sm text-gray-400 text-center py-2">
                      Aucune personne en copie ajoutée
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Numéro WhatsApp */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-green-100 p-2 rounded-lg">
                <MessageCircle className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Numéro WhatsApp</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Configurez votre numéro WhatsApp pour recevoir les rapports directement sur votre téléphone.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Numéro de téléphone</label>
              <PhoneInput
                defaultCountry="fr"
                value={whatsappPhone}
                onChange={(phone) => setWhatsappPhone(phone)}
                placeholder="Entrez votre numéro"
                inputStyle={{
                  width: '100%',
                  height: '42px',
                  fontSize: '14px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                }}
                countrySelectorStyleProps={{
                  buttonStyle: {
                    height: '42px',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                  }
                }}
              />
            </div>
            {whatsappPhone && whatsappPhone.length > 3 && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-green-600" />
                <p className="text-sm text-green-800">
                  <strong>Numéro configuré:</strong> {whatsappPhone}
                </p>
              </div>
            )}
          </div>

          {/* Secteur */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-100 p-2 rounded-lg">
                <Target className="w-5 h-5 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Secteur d'activité</h3>
            </div>
            <input
              type="text"
              value={secteur}
              onChange={(e) => setSecteur(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Ex: E-commerce, Tech, Finance..."
            />
          </div>

          {/* Mots-clés */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Mots-clés surveillés <span className="text-sm text-gray-500">({motsCles.length}/5)</span>
            </h3>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newMotCle}
                onChange={(e) => setNewMotCle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addMotCle()}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Ajouter un mot-clé"
                disabled={motsCles.length >= 5}
              />
              <button
                onClick={addMotCle}
                disabled={motsCles.length >= 5 || !newMotCle.trim()}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Plus size={16} />
                Ajouter
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {motsCles.map((mot, idx) => (
                <span
                  key={idx}
                  className="bg-orange-50 text-orange-700 px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                >
                  {mot}
                  <button onClick={() => removeMotCle(idx)} className="hover:text-orange-900">
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Concurrents */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-100 p-2 rounded-lg">
                <Users className="w-5 h-5 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Concurrents <span className="text-sm text-gray-500">({concurrents.length}/10)</span>
              </h3>
            </div>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newConcurrent}
                onChange={(e) => setNewConcurrent(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addConcurrent()}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Ajouter un concurrent"
                disabled={concurrents.length >= 10}
              />
              <button
                onClick={addConcurrent}
                disabled={concurrents.length >= 10 || !newConcurrent.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Plus size={16} />
                Ajouter
              </button>
            </div>
            <div className="space-y-2">
              {concurrents.map((concurrent, idx) => (
                <div key={idx} className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">{concurrent}</span>
                  <button
                    onClick={() => removeConcurrent(idx)}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Profils LinkedIn */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Linkedin className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Profils LinkedIn</h3>
            </div>
            <div className="flex gap-2 mb-3">
              <input
                type="url"
                value={newProfileLinkedin}
                onChange={(e) => setNewProfileLinkedin(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addProfileLinkedin()}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="https://linkedin.com/in/..."
              />
              <button
                onClick={addProfileLinkedin}
                disabled={!newProfileLinkedin.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Plus size={16} />
                Ajouter
              </button>
            </div>
            <div className="space-y-2">
              {profilesLinkedin.map((profile, idx) => (
                <div key={idx} className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg">
                  <a
                    href={profile}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline truncate flex-1"
                  >
                    {profile}
                  </a>
                  <button
                    onClick={() => removeProfileLinkedin(idx)}
                    className="text-gray-400 hover:text-red-600 transition-colors ml-2"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Sources de veille */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-purple-100 p-2 rounded-lg">
                <Rss className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Sources de veille <span className="text-sm text-gray-500">({sourcesVeille.length}/4)</span>
              </h3>
            </div>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newSourceVeille}
                onChange={(e) => setNewSourceVeille(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSourceVeille()}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="URL RSS ou nom de la source"
                disabled={sourcesVeille.length >= 4}
              />
              <button
                onClick={addSourceVeille}
                disabled={sourcesVeille.length >= 4 || !newSourceVeille.trim()}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Plus size={16} />
                Ajouter
              </button>
            </div>
            <div className="space-y-2">
              {sourcesVeille.map((source, idx) => (
                <div key={idx} className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg">
                  <span className="text-sm text-gray-700 truncate flex-1">{source}</span>
                  <button
                    onClick={() => removeSourceVeille(idx)}
                    className="text-gray-400 hover:text-red-600 transition-colors ml-2"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Paramètres de diffusion */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-green-100 p-2 rounded-lg">
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Paramètres de diffusion</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fréquence</label>
                <select
                  value={frequence}
                  onChange={(e) => setFrequence(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="">Sélectionner...</option>
                  <option value="quotidienne">Quotidienne</option>
                  <option value="hebdomadaire">Hebdomadaire</option>
                  <option value="mensuelle">Mensuelle</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Heure d'envoi</label>
                <select
                  value={heureEnvoi}
                  onChange={(e) => setHeureEnvoi(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="">Sélectionner...</option>
                  <option value="06:00">06:00</option>
                  <option value="07:00">07:00</option>
                  <option value="08:00">08:00</option>
                  <option value="09:00">09:00</option>
                  <option value="10:00">10:00</option>
                  <option value="11:00">11:00</option>
                  <option value="12:00">12:00</option>
                  <option value="13:00">13:00</option>
                  <option value="14:00">14:00</option>
                  <option value="15:00">15:00</option>
                  <option value="16:00">16:00</option>
                  <option value="17:00">17:00</option>
                  <option value="18:00">18:00</option>
                  <option value="19:00">19:00</option>
                  <option value="20:00">20:00</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">Canaux de diffusion</label>
              <div className="flex flex-wrap gap-3">
                {[
                  { value: 'email', label: 'Email', icon: 'mail' },
                  { value: 'whatsapp_pdf', label: 'WhatsApp PDF', icon: 'whatsapp' },
                  { value: 'whatsapp_podcast', label: 'WhatsApp Podcast', icon: 'whatsapp' }
                ].map((canal) => (
                  <button
                    key={canal.value}
                    onClick={() => toggleCanal(canal.value)}
                    className={`px-5 py-3 rounded-lg font-medium transition-all flex items-center gap-2 border-2 ${
                      canauxDiffusion.includes(canal.value)
                        ? 'bg-green-500 text-white border-green-600 shadow-md'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-green-400 hover:bg-green-50'
                    }`}
                  >
                    {canal.icon === 'mail' ? <Mail size={18} /> : <MessageCircle size={18} />}
                    {canal.label}
                  </button>
                ))}
              </div>
              {(canauxDiffusion.includes('whatsapp_pdf') || canauxDiffusion.includes('whatsapp_podcast')) && (
                <p className="mt-3 text-sm text-blue-600 flex items-start gap-2">
                  <MessageCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>
                    Assurez-vous de configurer votre numéro WhatsApp ci-dessous pour recevoir les rapports sur WhatsApp.
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-4">
            <button
              onClick={onNavigateToDashboard}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all font-medium"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-coral-500 text-white rounded-xl hover:shadow-lg transition-all font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save size={20} />
                  Enregistrer les modifications
                </>
              )}
            </button>
          </div>
        </div>
    </div>
  );
}

