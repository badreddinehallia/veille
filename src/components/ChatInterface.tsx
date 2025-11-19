import { useState, useEffect, useRef, startTransition } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Send, LogOut, Bell, Sparkles, LayoutDashboard, Trash2, X, Edit3, Linkedin, AlertCircle, Plus, Check, Loader2, ExternalLink, Clock } from 'lucide-react';
import Picker from 'react-mobile-picker';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  isTyping?: boolean;
}

interface Suggestion {
  label: string;
  value: string;
  description?: string;
  icon?: string;
  format?: string;
  type?: 'linkedin' | 'time' | 'default';
}

interface ChatInterfaceProps {
  onNavigateToDashboard?: () => void;
  autoShowResetModal?: boolean;
  onResetModalShown?: () => void;
}

export default function ChatInterface({ onNavigateToDashboard, autoShowResetModal, onResetModalShown }: ChatInterfaceProps) {
  const { user, signOut } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [typingMessage, setTypingMessage] = useState<string>('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isLastStep, setIsLastStep] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [showRedirectMessage, setShowRedirectMessage] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(6);
  const [showResetModal, setShowResetModal] = useState(false);
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState(false);

  // États pour la gestion des liens LinkedIn
  const [linkedinInput, setLinkedinInput] = useState('');
  const [validatedLinkedins, setValidatedLinkedins] = useState<string[]>([]);
  const [linkValidationMessage, setLinkValidationMessage] = useState('');

  // États pour le sélecteur d'heure (roulette iOS avec react-mobile-picker)
  const [pickerValue, setPickerValue] = useState({
    hour: '08',
    minute: '00'
  });

  // Afficher automatiquement le modal de réinitialisation si demandé
  useEffect(() => {
    if (autoShowResetModal) {
      console.log('🔔 Affichage automatique du modal de réinitialisation');
      setShowResetModal(true);
      // Notifier le parent que le modal a été affiché
      if (onResetModalShown) {
        onResetModalShown();
      }
    }
  }, [autoShowResetModal, onResetModalShown]);

  // Charger les messages depuis Supabase au démarrage
  useEffect(() => {
    const loadMessages = async () => {
      if (!user?.id) return;

      try {
        console.log('🔄 Chargement des messages d\'onboarding depuis Supabase...');

        const { data, error } = await supabase
          .from('onboarding_conversations')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('❌ Erreur lors du chargement des messages:', error);
          throw error;
        }

        // Vérifier si l'onboarding est complété
        const { data: stateData } = await supabase
          .from('onboarding_state')
          .select('is_completed')
          .eq('user_id', user.id)
          .single();

        console.log('📊 État onboarding:', stateData);

        if (stateData?.is_completed) {
          console.log('✅ Onboarding complété - bouton "Modifier" sera affiché');
          setIsOnboardingCompleted(true);
        } else {
          console.log('⏳ Onboarding non complété - bouton "Modifier" caché');
        }

        if (data && data.length > 0) {
          console.log(`✅ ${data.length} messages chargés depuis Supabase`);
          setMessages(data);
        } else {
          // Aucun message, afficher le message de bienvenue
          console.log('📝 Aucun message trouvé, affichage du message de bienvenue');
          const welcomeMessage: Message = {
            id: 'welcome-' + Date.now(),
            role: 'assistant',
            content: `Salut ! 😊

Je vais t'aider à configurer ta veille concurrentielle.`,
            created_at: new Date().toISOString(),
          };

          // Sauvegarder le message de bienvenue dans Supabase
          const { error: insertError } = await supabase
            .from('onboarding_conversations')
            .insert({
              user_id: user.id,
              role: 'assistant',
              content: welcomeMessage.content,
              created_at: welcomeMessage.created_at,
            });

          if (insertError) {
            console.error('❌ Erreur lors de l\'insertion du message de bienvenue:', insertError);
          }

          setMessages([welcomeMessage]);
        }
      } catch (error) {
        console.error('❌ Erreur lors du chargement des messages:', error);
        // Afficher quand même le message de bienvenue en cas d'erreur
        const welcomeMessage: Message = {
          id: 'welcome-' + Date.now(),
          role: 'assistant',
          content: `Salut ! 😊

Je vais t'aider à configurer ta veille concurrentielle.`,
          created_at: new Date().toISOString(),
        };
        setMessages([welcomeMessage]);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    loadMessages();
  }, [user?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [typingMessage, isTyping]);

  // Scroller quand les suggestions apparaissent pour éviter qu'elles cachent les messages
  useEffect(() => {
    if (suggestions.length > 0) {
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [suggestions]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [inputMessage]);

  // Animation typing effect
  const typeMessage = (text: string, callback?: () => void) => {
    if (!text || text.length === 0) {
      if (callback) callback();
      return () => {};
    }

    setIsTyping(true);
    setTypingMessage(''); // Réinitialiser
    let i = 0;
    const speed = 15; // vitesse de frappe en ms

    // Afficher la première lettre immédiatement
    setTypingMessage(text.charAt(0));
    i = 1;
    scrollToBottom();

    // Si le texte n'a qu'un seul caractère
    if (text.length === 1) {
      setIsTyping(false);
      if (callback) callback();
      return () => {};
    }

    // Continuer avec le reste du texte
    const typing = setInterval(() => {
      if (i < text.length) {
        const nextChar = text.charAt(i);
        setTypingMessage((prev) => prev + nextChar);
        i++;
        // Scroller pendant l'animation pour suivre le texte
        requestAnimationFrame(() => scrollToBottom());
      } else {
        clearInterval(typing);
        setIsTyping(false);
        // Scroll final après l'animation
        setTimeout(() => scrollToBottom(), 50);
        if (callback) callback();
      }
    }, speed);

    // Cleanup function
    return () => clearInterval(typing);
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    // Si c'est une suggestion LinkedIn, l'ajouter à la liste validée au lieu du champ input
    if (suggestion.type === 'linkedin') {
      // Vérifier si le lien n'est pas déjà ajouté
      if (!validatedLinkedins.includes(suggestion.value)) {
        setValidatedLinkedins([...validatedLinkedins, suggestion.value]);
        setLinkValidationMessage('✅ Lien ajouté !');
        setTimeout(() => setLinkValidationMessage(''), 2000);
      } else {
        setLinkValidationMessage('⚠️ Ce lien est déjà ajouté');
        setTimeout(() => setLinkValidationMessage(''), 2000);
      }
      return;
    }

    // Pour les autres suggestions (non-LinkedIn)
    const currentMessage = inputMessage.trim();

    if (currentMessage) {
      // Si il y a déjà du texte, ajouter avec une virgule
      setInputMessage(currentMessage + ', ' + suggestion.value);
    } else {
      // Sinon, juste mettre la suggestion
      setInputMessage(suggestion.value);
    }

    // Optionnel : envoyer automatiquement
    // sendMessage();
  };

  // Fonction pour ouvrir le lien dans un nouvel onglet
  const openLinkedinLink = () => {
    const trimmedUrl = linkedinInput.trim();

    if (!trimmedUrl) {
      setLinkValidationMessage('❌ Veuillez entrer un lien');
      return;
    }

    // Ouvrir dans un nouvel onglet
    window.open(trimmedUrl, '_blank', 'noopener,noreferrer');
    setLinkValidationMessage('✅ Lien ouvert ! Si le profil existe, cliquez sur le bouton + pour l\'ajouter à votre liste.');
  };

  // Fonction pour ajouter un lien LinkedIn sans validation
  const addValidatedLinkedin = () => {
    const trimmedUrl = linkedinInput.trim();

    if (!trimmedUrl) {
      setLinkValidationMessage('❌ Veuillez entrer un lien');
      return;
    }

    // Vérifier si le lien n'est pas déjà ajouté
    if (validatedLinkedins.includes(trimmedUrl)) {
      setLinkValidationMessage('⚠️ Ce lien est déjà ajouté');
      setTimeout(() => setLinkValidationMessage(''), 2000);
      return;
    }

    // Ajouter directement sans validation
    setValidatedLinkedins([...validatedLinkedins, trimmedUrl]);
    setLinkedinInput('');
    setLinkValidationMessage('✅ Lien ajouté !');
    setTimeout(() => setLinkValidationMessage(''), 2000);
  };

  // Fonction pour supprimer un lien LinkedIn validé
  const removeValidatedLinkedin = (url: string) => {
    setValidatedLinkedins(validatedLinkedins.filter(link => link !== url));
  };

  // Fonction pour envoyer les liens LinkedIn validés
  const sendLinkedinLinks = async () => {
    if (validatedLinkedins.length === 0) {
      setLinkValidationMessage('❌ Veuillez ajouter au moins un lien LinkedIn');
      return;
    }

    // Créer le message avec tous les liens séparés par des virgules
    const linkedinsMessage = validatedLinkedins.join(', ');
    setInputMessage(linkedinsMessage);

    // Nettoyer les liens validés
    setValidatedLinkedins([]);
    setLinkValidationMessage('');

    // Envoyer automatiquement le message après un petit délai pour que l'input soit mis à jour
    setTimeout(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        // Simuler un envoi
        sendMessage();
      }
    }, 100);
  };

  // Fonction pour envoyer l'heure sélectionnée
  const sendSelectedTime = () => {
    const formattedTime = `${pickerValue.hour}:${pickerValue.minute}`;
    setInputMessage(formattedTime);

    // Envoyer automatiquement le message
    setTimeout(() => {
      sendMessage();
    }, 100);
  };

  const resetConfiguration = async () => {
    setShowResetModal(false);

    try {
      if (user?.id) {
        console.log('🔄 Réinitialisation de la configuration...');

        // 1. Réinitialiser les champs dans la table clients
        // On garde: email, prenom, email_destinataires, email_cc, created_at
        const { error: updateClientError } = await supabase
          .from('clients')
          .update({
            secteur: null,
            mots_cles: [],
            concurrents: [],
            profiles_linkedin: [],
            sources_veille: [],
            frequence: null,
            heure_envoi: null,
            canaux_diffusion: [],
            status_onboarding: 'next_step',
          })
          .eq('user_id', user.id);

        if (updateClientError) {
          console.error('❌ Erreur lors de la réinitialisation du client:', updateClientError);
        }

        // 2. Supprimer tous les messages d'onboarding
        const { error: deleteMessagesError } = await supabase
          .from('onboarding_conversations')
          .delete()
          .eq('user_id', user.id);

        if (deleteMessagesError) {
          console.error('❌ Erreur lors de la suppression des messages:', deleteMessagesError);
        }

        // 3. Supprimer l'état d'onboarding
        const { error: deleteStateError } = await supabase
          .from('onboarding_state')
          .delete()
          .eq('user_id', user.id);

        if (deleteStateError) {
          console.error('❌ Erreur lors de la suppression de l\'état:', deleteStateError);
        }

        // 4. Supprimer tous les messages N8N pour cet utilisateur
        const { error: deleteN8nMessagesError } = await supabase
          .from('n8n_chat_histories')
          .delete()
          .eq('session_id', user.id);

        if (deleteN8nMessagesError) {
          console.error('❌ Erreur lors de la suppression des messages N8N:', deleteN8nMessagesError);
        } else {
          console.log('✅ Messages N8N supprimés');
        }

        console.log('✅ Configuration réinitialisée avec succès');
      }

      // Récupérer le prénom du client pour personnaliser le message
      let prenom = '';

      if (user?.id) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('prenom')
          .eq('user_id', user.id)
          .single();

        prenom = clientData?.prenom || '';
      }

      // Message de bienvenue personnalisé pour modification
      const welcomeText = prenom
        ? `Salut ${prenom} ! 😊\n\nJe vais t'aider à reconfigurer ta veille concurrentielle.\n\nCommençons par ton secteur d'activité. Dans quel secteur travailles-tu ?`
        : `Salut ! 😊\n\nJe vais t'aider à reconfigurer ta veille concurrentielle.\n\nCommençons par ton secteur d'activité. Dans quel secteur travailles-tu ?`;

      // Créer le message de bienvenue
      const welcomeMessage: Message = {
        id: 'welcome-' + Date.now(),
        role: 'assistant',
        content: welcomeText,
        created_at: new Date().toISOString(),
      };

      // Sauvegarder le message de bienvenue dans Supabase
      if (user?.id) {
        const { error: insertError } = await supabase
          .from('onboarding_conversations')
          .insert({
            user_id: user.id,
            role: 'assistant',
            content: welcomeMessage.content,
            created_at: welcomeMessage.created_at,
          });

        if (insertError) {
          console.error('❌ Erreur lors de l\'insertion du message de bienvenue:', insertError);
        }
      }

      setMessages([welcomeMessage]);
      setSuggestions([]);
      setTypingMessage('');
      setIsTyping(false);
      setIsLastStep(false);
      setShowRedirectMessage(false);
      setRedirectCountdown(6);
      setIsOnboardingCompleted(false);

      console.log('✅ Redémarrage de la configuration terminé avec prenom:', prenom);
    } catch (error) {
      console.error('❌ Erreur lors de la réinitialisation:', error);
      alert('Une erreur est survenue lors de la réinitialisation. Veuillez réessayer.');
    }
  };

  const clearMessages = async () => {
    const confirmClear = window.confirm(
      'Êtes-vous sûr de vouloir recommencer la configuration depuis le début ?'
    );

    if (!confirmClear) return;

    try {
      if (user?.id) {
        console.log('🗑️ Suppression des messages d\'onboarding depuis Supabase...');

        // Supprimer tous les messages d'onboarding de l'utilisateur
        const { error: deleteError } = await supabase
          .from('onboarding_conversations')
          .delete()
          .eq('user_id', user.id);

        if (deleteError) {
          console.error('❌ Erreur lors de la suppression des messages:', deleteError);
          throw deleteError;
        }

        // Supprimer l'état d'onboarding
        const { error: deleteStateError } = await supabase
          .from('onboarding_state')
          .delete()
          .eq('user_id', user.id);

        if (deleteStateError) {
          console.error('❌ Erreur lors de la suppression de l\'état:', deleteStateError);
        }

        console.log('✅ Messages supprimés de Supabase');
      }

      // Afficher le message de bienvenue
      const welcomeMessage: Message = {
        id: 'welcome-' + Date.now(),
        role: 'assistant',
        content: `Salut ! 😊

Je vais t'aider à configurer ta veille concurrentielle.`,
        created_at: new Date().toISOString(),
      };

      // Sauvegarder le message de bienvenue dans Supabase
      if (user?.id) {
        const { error: insertError } = await supabase
          .from('onboarding_conversations')
          .insert({
            user_id: user.id,
            role: 'assistant',
            content: welcomeMessage.content,
            created_at: welcomeMessage.created_at,
          });

        if (insertError) {
          console.error('❌ Erreur lors de l\'insertion du message de bienvenue:', insertError);
        }
      }

      setMessages([welcomeMessage]);
      setSuggestions([]);
      setTypingMessage('');
      setIsTyping(false);
      setIsLastStep(false);
      setShowRedirectMessage(false);
      setRedirectCountdown(6);

      console.log('✅ Configuration redémarrée');
    } catch (error) {
      console.error('❌ Erreur lors du redémarrage de la configuration:', error);
      alert('Une erreur est survenue lors du redémarrage. Veuillez réessayer.');
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);
    setSuggestions([]); // Clear suggestions

    // Nettoyer les liens LinkedIn validés après l'envoi
    setValidatedLinkedins([]);
    setLinkedinInput('');
    setLinkValidationMessage('');

    // 1. Sauvegarder et afficher le message utilisateur
    const tempUserMessage: Message = {
      id: 'user-' + Date.now(),
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    // Sauvegarder le message utilisateur dans Supabase
    if (user?.id) {
      const { error: insertUserError } = await supabase
        .from('onboarding_conversations')
        .insert({
          user_id: user.id,
          role: 'user',
          content: userMessage,
          created_at: tempUserMessage.created_at,
        });

      if (insertUserError) {
        console.error('❌ Erreur lors de l\'insertion du message utilisateur:', insertUserError);
      }
    }

    // Variable pour tracker si c'est la dernière étape (locale pour éviter les problèmes de state)
    let isThisLastStep = false;

    try {
      // Récupérer l'état actuel de l'onboarding depuis Supabase
      let currentState = null;
      if (user?.id) {
        const { data: stateData } = await supabase
          .from('onboarding_state')
          .select('*')
          .eq('user_id', user.id)
          .single();

        currentState = stateData;
      }

      // Vérifier si c'est une modification (prenom et email existent, mais secteur vide)
      let messageToSend = userMessage;
      if (user?.id) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('prenom, email, secteur')
          .eq('user_id', user.id)
          .single();

        const prenom = clientData?.prenom || '';
        const email = clientData?.email || '';
        const secteur = clientData?.secteur;

        // Si prenom et email existent mais pas de secteur, c'est une modification
        // Et qu'il y a seulement 2 messages (bienvenue + user), enrichir le message
        const isModification = prenom && email && !secteur && messages.length === 1;

        if (isModification) {
          messageToSend = `je suis ${prenom} mon email est ${email} et mon secteur est : ${userMessage}`;
          console.log('📧 Message enrichi pour N8N (modification détectée):', messageToSend);
        }
      }

      console.log('🚀 Envoi à n8n:', {
        message: messageToSend,
        user_id: user?.id,
        current_state: currentState,
      });

      const response = await fetch('https://n8n.srv954650.hstgr.cloud/webhook/AgentIA', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageToSend,
          user_id: user?.id,
          current_state: currentState,
        }),
      });

      console.log('📡 Statut de la réponse:', response.status, response.statusText);

      if (!response.ok) {
        // Lire le corps de la réponse même en cas d'erreur
        const errorText = await response.text();
        console.error('❌ Réponse d\'erreur du serveur:', errorText);
        throw new Error(`Erreur ${response.status}: ${errorText || response.statusText}`);
      }

      // Vérifier si la réponse a du contenu avant de parser
      const responseText = await response.text();
      console.log('📄 Réponse brute (texte):', responseText.substring(0, 500));

      if (!responseText || responseText.trim() === '') {
        console.warn('⚠️ Réponse vide de n8n, utilisation du fallback');
        throw new Error('Réponse vide de n8n');
      }

      let data;
      try {
        data = JSON.parse(responseText);
        console.log('🔍 Réponse parsée en JSON:', data);
      } catch (e) {
        // Si ce n'est pas du JSON, c'est peut-être du texte brut
        console.log('📝 Réponse en texte brut (pas JSON)');
        data = { output: responseText };
      }

      // Parser la réponse qui peut contenir du JSON dans un bloc markdown
      let parsedData = data;
      let assistantResponse = '';

      // Extraire le message de différents formats possibles
      assistantResponse = data.message_utilisateur || data.output || data.message || data.reply || '';

      console.log('📝 Assistant response extrait:', assistantResponse);

      // Essayer de parser la réponse si c'est du JSON dans une chaîne
      if (typeof assistantResponse === 'string' && assistantResponse.trim().length > 0) {
        // Cas 1 : JSON entouré de ```json ... ```
        if (assistantResponse.includes('```json')) {
          const jsonMatch = assistantResponse.match(/```json\n?([\s\S]*?)\n?```/);
          if (jsonMatch) {
            try {
              const jsonString = jsonMatch[1].trim();
              console.log('📋 JSON extrait des backticks');
              parsedData = JSON.parse(jsonString);
              assistantResponse = parsedData.message_utilisateur || assistantResponse;
              console.log('✅ Parsing réussi (backticks)');
            } catch (e) {
              console.error('❌ Erreur de parsing JSON (backticks):', e);
            }
          }
        }
        // Cas 2 : JSON direct commençant par {
        else if (assistantResponse.trim().startsWith('{')) {
          try {
            console.log('📋 Tentative de parsing JSON direct');
            parsedData = JSON.parse(assistantResponse);
            assistantResponse = parsedData.message_utilisateur || assistantResponse;
            console.log('✅ Parsing réussi (JSON direct)');
          } catch (e) {
            console.error('❌ Erreur de parsing JSON direct:', e);
            // Pas grave, on garde le texte tel quel
          }
        }
        // Cas 3 : Contient des \n échappés
        else if (assistantResponse.includes('\\n')) {
          try {
            console.log('📋 Détection de \\n échappés, nettoyage...');
            // Remplacer les \n par de vrais retours à la ligne
            const cleaned = assistantResponse.replace(/\\n/g, '\n');
            // Essayer d'extraire le JSON
            const jsonMatch = cleaned.match(/```json\n?([\s\S]*?)\n?```/) || cleaned.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const jsonString = jsonMatch[1] || jsonMatch[0];
              parsedData = JSON.parse(jsonString);
              assistantResponse = parsedData.message_utilisateur || cleaned;
              console.log('✅ Parsing réussi (nettoyé)');
            } else {
              // Pas de JSON, juste du texte avec \n - on le nettoie
              assistantResponse = cleaned;
            }
          } catch (e) {
            console.error('❌ Erreur de parsing JSON (nettoyé):', e);
            // Pas grave, on garde le texte nettoyé
          }
        }
      }

      console.log('💬 Message final:', assistantResponse);
      console.log('📦 Données parsées:', parsedData);

      // Vérification finale : si le message est toujours vide après tout ça
      if (!assistantResponse || assistantResponse.trim() === '') {
        console.error('❌ ERREUR: Le message de l\'assistant est vide après parsing!');
        console.error('📋 responseText:', responseText);
        throw new Error('Message de l\'assistant vide');
      }

      // 2. Démarrer l'animation typing pour la réponse
      setIsLoading(false);

      // Stocker les suggestions pour les afficher après l'animation
      let suggestionsToShow = parsedData.suggestions && Array.isArray(parsedData.suggestions)
        ? parsedData.suggestions.map((sugg: Suggestion) => {
            // Détecter automatiquement le type de suggestion
            let detectedType = sugg.type || 'default';

            if (!sugg.type) {
              if (sugg.value && sugg.value.includes('linkedin.com')) {
                detectedType = 'linkedin';
              } else if (sugg.format === 'time' || sugg.value === 'time_picker') {
                detectedType = 'time';
              }
            }

            return {
              ...sugg,
              type: detectedType
            };
          })
        : [];

      // Si le message parle d'heure et qu'il n'y a pas de suggestion 'time', en ajouter une automatiquement
      const messageContainsTimeQuestion = assistantResponse.toLowerCase().includes('quelle heure') ||
                                          assistantResponse.toLowerCase().includes('heure préfères') ||
                                          assistantResponse.toLowerCase().includes('heure souhaitez') ||
                                          assistantResponse.toLowerCase().includes('08:00') ||
                                          assistantResponse.toLowerCase().includes('format hh:mm');

      if (messageContainsTimeQuestion && !suggestionsToShow.some(s => s.type === 'time')) {
        console.log('🕐 Détection automatique : question sur l\'heure détectée, ajout du sélecteur');
        suggestionsToShow = [{
          label: 'Sélectionner l\'heure',
          value: 'time_picker',
          type: 'time'
        }];
      }

      // Détecter si c'est la dernière étape
      // Vérifier si on est à l'étape 10 ou si le message contient des mots-clés de fin
      const configData = parsedData.config || {};
      const isLastQuestion =
        configData.etape_actuelle === 10 ||
        configData.status === 'done' ||
        configData.route === 'completed' ||
        assistantResponse.toLowerCase().includes('configuration terminée') ||
        assistantResponse.toLowerCase().includes('tout est prêt');

      // Mettre à jour la variable locale ET le state
      isThisLastStep = isLastQuestion;
      if (isLastQuestion) {
        console.log('🎯 Dernière étape détectée !');
        setIsLastStep(true);
      }

      // Vérifier si l'onboarding est terminé AVANT l'animation
      const config = parsedData.config || {};
      const isOnboardingCompleted =
        config.status === 'done' ||
        config.route === 'completed' ||
        // Si le message contient "Configuration terminée" ET "Tout est prêt", c'est terminé
        (assistantResponse.includes('Configuration terminée') && assistantResponse.includes('Tout est prêt'));

      console.log('🔍 Vérification onboarding:', {
        configData,
        status: config.status,
        route: config.route,
        isOnboardingCompleted,
        isLastQuestion,
        messageContientTerminee: assistantResponse.includes('Configuration terminée'),
        messageContientPret: assistantResponse.includes('Tout est prêt')
      });

      typeMessage(assistantResponse, async () => {
        // Utiliser startTransition pour une transition fluide
        const finalMessage: Message = {
          id: 'assistant-' + Date.now(),
          role: 'assistant',
          content: assistantResponse,
          created_at: new Date().toISOString(),
        };

        // Sauvegarder le message de l'assistant dans Supabase
        if (user?.id) {
          const { error: insertAssistantError } = await supabase
            .from('onboarding_conversations')
            .insert({
              user_id: user.id,
              role: 'assistant',
              content: assistantResponse,
              created_at: finalMessage.created_at,
            });

          if (insertAssistantError) {
            console.error('❌ Erreur lors de l\'insertion du message assistant:', insertAssistantError);
          }

          // Sauvegarder/mettre à jour l'état d'onboarding
          if (configData) {
            const isCompleted = configData.status === 'done' || configData.route === 'completed';
            const { error: upsertStateError } = await supabase
              .from('onboarding_state')
              .upsert({
                user_id: user.id,
                config: configData,
                etape_actuelle: configData.etape_actuelle || 1,
                is_completed: isCompleted,
              }, {
                onConflict: 'user_id'
              });

            if (upsertStateError) {
              console.error('❌ Erreur lors de la mise à jour de l\'état:', upsertStateError);
            }

            // Mettre à jour le state local
            if (isCompleted) {
              setIsOnboardingCompleted(true);
            }
          }
        }

        startTransition(() => {
          // Ajouter le message final à l'état
          setMessages((prev) => [...prev, finalMessage]);
          setTypingMessage(''); // Effacer le message typing
        });

        // Afficher les suggestions APRÈS l'animation avec un délai
        setTimeout(() => {
          console.log('🎯 Affichage des suggestions après animation...');
          startTransition(() => {
            if (suggestionsToShow.length > 0) {
              console.log(`✅ ${suggestionsToShow.length} suggestions trouvées!`);
              setSuggestions(suggestionsToShow);
            } else {
              console.log('❌ Aucune suggestion trouvée');
              setSuggestions([]);
            }
          });

          // Si l'onboarding est terminé, afficher simplement le bouton (pas de redirection auto)
          if (isOnboardingCompleted) {
            console.log('🎉 Configuration terminée ! Affichage du bouton vers le tableau de bord.');
            console.log('📝 Message récapitulatif affiché:', assistantResponse.substring(0, 100) + '...');
            setShowRedirectMessage(true); // Afficher le bouton vers le tableau de bord
          }
        }, 200);
      });
    } catch (error) {
      console.error('Error calling n8n webhook:', error);
      setIsLoading(false);

      // Si c'était la dernière étape et qu'il y a une erreur (workflow terminé)
      // On envoie quand même le message de félicitations
      // Vérifier également si le message utilisateur contenait des indices de fin d'onboarding
      const isProbablyLastStep = isThisLastStep ||
                                 isLastStep ||
                                 userMessage.toLowerCase().includes('oui') ||
                                 userMessage.toLowerCase().includes('non') ||
                                 userMessage.match(/^\d{10,15}$/); // Numéro de téléphone

      if (isProbablyLastStep && messages.length > 5) { // Si on a déjà échangé plusieurs messages
        console.log('🎉 Dernière étape détectée (erreur probable de fin de workflow), envoi du message de félicitations...');

        // Récupérer les données du client pour créer un vrai récapitulatif
        let congratsMessage = '🎉 Configuration terminée !\n\nVotre veille concurrentielle est maintenant configurée et prête à démarrer ! 🚀';

        try {
          if (user?.id) {
            const { data: clientData } = await supabase
              .from('clients')
              .select('*')
              .eq('user_id', user.id)
              .single();

            if (clientData) {
              // Créer un message récapitulatif personnalisé
              congratsMessage = `🎉 Configuration terminée !\n\nVoici le récap de ta veille concurrentielle :\n\n`;

              if (clientData.prenom) congratsMessage += `👤 Prénom : ${clientData.prenom}\n`;
              if (clientData.email) congratsMessage += `📧 Email : ${clientData.email}\n`;
              if (clientData.whatsapp) congratsMessage += `📱 WhatsApp : ${clientData.whatsapp}\n`;
              if (clientData.secteur) congratsMessage += `🏢 Secteur : ${clientData.secteur}\n`;

              if (clientData.mots_cles && Array.isArray(clientData.mots_cles) && clientData.mots_cles.length > 0) {
                congratsMessage += `🔍 Mots-clés : ${clientData.mots_cles.join(', ')}\n`;
              }

              if (clientData.concurrents && Array.isArray(clientData.concurrents) && clientData.concurrents.length > 0) {
                congratsMessage += `🎯 Concurrents : ${clientData.concurrents.join(', ')}\n`;
              }

              if (clientData.profiles_linkedin && Array.isArray(clientData.profiles_linkedin)) {
                congratsMessage += `💼 LinkedIn : ${clientData.profiles_linkedin.length} profils\n`;
              }

              if (clientData.sources_veille && Array.isArray(clientData.sources_veille)) {
                congratsMessage += `📰 Sources : ${clientData.sources_veille.length} flux RSS\n`;
              }

              if (clientData.frequence) {
                const freqDisplay = clientData.frequence.charAt(0).toUpperCase() + clientData.frequence.slice(1);
                congratsMessage += `📅 Fréquence : ${freqDisplay}\n`;
              }

              if (clientData.heure_envoi) congratsMessage += `⏰ Heure : ${clientData.heure_envoi}\n`;

              if (clientData.canaux_diffusion && Array.isArray(clientData.canaux_diffusion) && clientData.canaux_diffusion.length > 0) {
                const canauxDisplay = clientData.canaux_diffusion.map((c: string) => {
                  if (c === 'email') return 'Email';
                  if (c === 'whatsapp_pdf') return 'WhatsApp (PDF)';
                  if (c === 'whatsapp_podcast') return 'WhatsApp (Podcast)';
                  return c;
                }).join(', ');
                congratsMessage += `📬 Canaux : ${canauxDisplay}\n`;
              }

              congratsMessage += `\nTout est prêt ! 🚀`;
            }
          }
        } catch (err) {
          console.error('Erreur lors de la récupération des données client:', err);
        }

        console.log('📝 Message de félicitations à afficher:', congratsMessage);

        typeMessage(congratsMessage, async () => {
          const finalMessage: Message = {
            id: 'congrats-' + Date.now(),
            role: 'assistant',
            content: congratsMessage,
            created_at: new Date().toISOString(),
          };

          // Sauvegarder le message de félicitations dans Supabase
          if (user?.id) {
            const { error: insertCongratsError } = await supabase
              .from('onboarding_conversations')
              .insert({
                user_id: user.id,
                role: 'assistant',
                content: congratsMessage,
                created_at: finalMessage.created_at,
              });

            if (insertCongratsError) {
              console.error('❌ Erreur lors de l\'insertion du message de félicitations:', insertCongratsError);
            }

            // Marquer l'onboarding comme terminé
            const { error: updateStateError } = await supabase
              .from('onboarding_state')
              .upsert({
                user_id: user.id,
                config: {},
                etape_actuelle: 10,
                is_completed: true,
              }, {
                onConflict: 'user_id'
              });

            if (updateStateError) {
              console.error('❌ Erreur lors de la mise à jour de l\'état:', updateStateError);
            }

            // Mettre à jour le state local
            setIsOnboardingCompleted(true);
          }

          // Ajouter le message à l'état
          startTransition(() => {
            setMessages((prev) => [...prev, finalMessage]);
            setTypingMessage('');
          });

          // Afficher le bouton vers le tableau de bord (pas de redirection auto)
          setTimeout(() => {
            setShowRedirectMessage(true);
            console.log('🎉 Message de félicitations affiché, bouton vers tableau de bord disponible.');
          }, 200);
        });

        return;
      }

      // Message d'erreur (en local)
      const errorMsg = 'Désolé, une erreur s\'est produite. Veuillez réessayer.';
      const errorMessage: Message = {
        id: 'error-' + Date.now(),
        role: 'assistant',
        content: errorMsg,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  return (
    <>
      {/* Modal de confirmation de réinitialisation - Centré et bloquant */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] animate-fadeIn" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg mx-4 animate-slideInUp" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                Modifier votre configuration ?
              </h3>
              <p className="text-base text-gray-600 mb-8 leading-relaxed">
                Voulez-vous vraiment modifier votre configuration ?
                <br /><br />
                <strong>Sera conservé :</strong> Email, prénom, destinataires d'emails
                <br />
                <strong>Sera réinitialisé :</strong> Secteur, mots-clés, concurrents, sources, etc.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => setShowResetModal(false)}
                  className="px-6 py-3 text-base font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
                >
                  Non, annuler
                </button>
                <button
                  onClick={resetConfiguration}
                  className="px-6 py-3 text-base font-semibold text-white bg-gradient-to-r from-orange-500 to-coral-500 hover:shadow-xl rounded-xl transition-all"
                >
                  Oui, je confirme
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col h-screen">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Bouton Effacer les messages en haut à droite */}
              <div className="flex justify-end mb-4">
                <button
                  onClick={clearMessages}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-all font-medium shadow-sm border border-red-200"
                  title="Effacer tous les messages et recommencer la configuration"
                >
                  <Trash2 size={16} />
                  Effacer les messages
                </button>
              </div>
              {messages.length === 0 && !isTyping && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="bg-gradient-to-br from-orange-500 to-coral-500 p-4 rounded-2xl mb-4">
                    <Sparkles className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Commencez une conversation</h3>
                  <p className="text-gray-600 max-w-md">Posez-moi des questions sur votre veille, les tendances du marché ou vos concurrents.</p>
                </div>
              )}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  } animate-fadeIn`}
                >
                  <div className={`flex gap-3 max-w-[85%] ${
                    message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}>
                    <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                      message.role === 'user'
                        ? 'bg-gradient-to-br from-orange-500 to-coral-500 text-white font-bold text-sm'
                        : 'bg-white border-2 border-orange-200'
                    }`}>
                      {message.role === 'user' ? (
                        user?.email?.[0].toUpperCase()
                      ) : (
                        <Sparkles size={18} className="text-orange-500" />
                      )}
                    </div>
                    <div
                      className={`rounded-2xl px-5 py-3.5 shadow-sm ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-orange-500 to-coral-500 text-white'
                          : 'bg-white text-gray-900 border border-orange-100'
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words leading-relaxed text-[15px]">
                        {message.content}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Message en cours de frappe */}
              {isTyping && (
                <div className="flex justify-start animate-fadeIn">
                  <div className="flex gap-3 max-w-[85%]">
                    <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-white border-2 border-orange-200">
                      <Sparkles size={18} className="text-orange-500" />
                    </div>
                    <div className="bg-white border border-orange-100 rounded-2xl px-5 py-3.5 shadow-sm">
                      <div className="whitespace-pre-wrap break-words leading-relaxed text-[15px]">
                        {typingMessage}
                        <span className="inline-block w-[3px] h-[18px] bg-orange-500 ml-1 animate-pulse"></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Indicateur de chargement */}
              {isLoading && !isTyping && (
                <div className="flex justify-start">
                  <div className="flex gap-3 max-w-[85%]">
                    <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-white border-2 border-orange-200">
                      <Sparkles size={18} className="text-orange-500" />
                    </div>
                    <div className="bg-white border border-orange-100 rounded-2xl px-5 py-3.5 shadow-sm">
                      <div className="flex gap-2">
                        <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bouton vers le tableau de bord */}
              {showRedirectMessage && onNavigateToDashboard && (
                <div className="flex justify-center animate-fadeIn mt-6 mb-6">
                  <button
                    onClick={onNavigateToDashboard}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all font-semibold text-base flex items-center gap-3 active:scale-95"
                  >
                    <LayoutDashboard size={24} />
                    Aller au tableau de bord
                  </button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="bg-white/95 backdrop-blur-sm border-t border-orange-100 p-6 shadow-lg">
              <div className="max-w-4xl mx-auto">
                {/* Suggestions */}
                {suggestions.length > 0 && (
                  <div className="mb-4 animate-fadeIn">
                    <div className="flex items-center gap-2 mb-3">
                      {suggestions.some(s => s.type === 'linkedin') ? (
                        <>
                          <div className="w-5 h-5 bg-[#0077B5] rounded flex items-center justify-center">
                            <Linkedin className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-sm font-semibold text-gray-700">Profils LinkedIn suggérés</span>
                        </>
                      ) : suggestions.some(s => s.type === 'time') ? (
                        <>
                          <Clock className="w-4 h-4 text-orange-500" />
                          <span className="text-sm font-semibold text-gray-700">Sélection de l'heure</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-orange-500" />
                          <span className="text-sm font-semibold text-gray-700">Suggestions pour vous</span>
                        </>
                      )}
                    </div>

                    {/* Tooltip d'aide */}
                    {showTooltip && (() => {
                      const isLinkedInStep = suggestions.some(s => s.type === 'linkedin');
                      return (
                        <div className={`mb-3 rounded-xl p-4 shadow-md animate-slideInRight relative ${
                          isLinkedInStep
                            ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-[#0077B5]'
                            : 'bg-gradient-to-r from-orange-100 to-coral-100 border-2 border-orange-300'
                        }`}>
                          <button
                            onClick={() => setShowTooltip(false)}
                            className={`absolute top-2 right-2 transition-colors ${
                              isLinkedInStep
                                ? 'text-[#0077B5] hover:text-[#005885]'
                                : 'text-orange-600 hover:text-orange-700'
                            }`}
                            title="Fermer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg flex-shrink-0 ${
                              isLinkedInStep ? 'bg-[#0077B5]' : 'bg-orange-500'
                            }`}>
                              {isLinkedInStep ? (
                                <Linkedin className="w-4 h-4 text-white" />
                              ) : (
                                <Edit3 className="w-4 h-4 text-white" />
                              )}
                            </div>
                            <div className="flex-1 pr-6">
                              <h4 className={`text-sm font-bold mb-1 ${
                                isLinkedInStep ? 'text-[#0077B5]' : 'text-orange-900'
                              }`}>
                                💡 Astuce
                              </h4>
                              <p className={`text-xs leading-relaxed ${
                                isLinkedInStep ? 'text-blue-900' : 'text-orange-800'
                              }`}>
                                {isLinkedInStep ? (
                                  <>Vous pouvez <strong>sélectionner les profils LinkedIn suggérés</strong> ou <strong>ajouter vos propres liens</strong> dans le champ ci-dessous. Ces profils seront suivis pour votre veille concurrentielle !</>
                                ) : (
                                  <>Vous pouvez <strong>choisir une suggestion</strong> ou <strong>écrire votre propre réponse</strong> dans le champ ci-dessous. Les suggestions sont là pour vous aider, mais vous êtes libre de personnaliser votre réponse !</>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {suggestions.filter(s => s.type !== 'time').map((suggestion, idx) => {
                        const isLinkedIn = suggestion.type === 'linkedin';
                        return (
                          <div
                            key={idx}
                            className={`group relative px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                              isLinkedIn
                                ? 'bg-gradient-to-br from-[#0077B5] to-[#005885] border-[#0077B5] text-white'
                                : 'bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200/50'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              {isLinkedIn && (
                                <div className="flex-shrink-0 mt-0.5">
                                  <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
                                    <Linkedin size={20} className="text-[#0077B5]" />
                                  </div>
                                </div>
                              )}
                              <div className="flex-1">
                                <div className={`font-semibold mb-0.5 text-[13px] ${
                                  isLinkedIn ? 'text-white' : 'text-orange-900'
                                }`}>
                                  {suggestion.label}
                                </div>
                                {suggestion.description && (
                                  <div className={`text-xs line-clamp-1 ${
                                    isLinkedIn ? 'text-blue-100' : 'text-orange-700/70'
                                  }`}>
                                    {suggestion.description}
                                  </div>
                                )}
                              </div>
                              {isLinkedIn && (
                                <div className="flex-shrink-0 flex gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(suggestion.value, '_blank', 'noopener,noreferrer');
                                    }}
                                    disabled={isLoading || isTyping || showResetModal}
                                    className="w-7 h-7 bg-white rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors disabled:opacity-50"
                                    title="Vérifier le lien"
                                  >
                                    <ExternalLink size={14} className="text-[#0077B5]" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSuggestionClick(suggestion);
                                    }}
                                    disabled={isLoading || isTyping || showResetModal}
                                    className="w-7 h-7 bg-white rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors disabled:opacity-50"
                                    title="Ajouter à la liste"
                                  >
                                    <Plus size={14} className="text-[#0077B5]" />
                                  </button>
                                </div>
                              )}
                              {!isLinkedIn && (
                                <button
                                  onClick={() => handleSuggestionClick(suggestion)}
                                  disabled={isLoading || isTyping || showResetModal}
                                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                                    <Send size={12} className="text-white" />
                                  </div>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Section pour ajouter manuellement des liens LinkedIn */}
                    {suggestions.some(s => s.type === 'linkedin') && (
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Linkedin size={16} className="text-[#0077B5]" />
                          <span className="font-medium">Ou ajoutez vos propres liens LinkedIn</span>
                        </div>

                        {/* Input pour ajouter un lien */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={linkedinInput}
                            onChange={(e) => setLinkedinInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addValidatedLinkedin();
                              }
                            }}
                            placeholder="https://www.linkedin.com/company/..."
                            className="flex-1 px-4 py-2.5 border-2 border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0077B5] focus:border-transparent text-sm"
                            disabled={isLoading}
                          />
                          <button
                            onClick={openLinkedinLink}
                            disabled={!linkedinInput.trim() || isLoading}
                            className="px-4 py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium text-sm border border-gray-300"
                            title="Ouvrir le lien pour vérifier"
                          >
                            <ExternalLink size={16} />
                            Vérifier
                          </button>
                          <button
                            onClick={addValidatedLinkedin}
                            disabled={!linkedinInput.trim() || isLoading}
                            className="px-4 py-2.5 bg-[#0077B5] text-white rounded-lg hover:bg-[#006399] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium text-sm"
                            title="Ajouter le lien à la liste"
                          >
                            <Plus size={18} />
                          </button>
                        </div>

                        {/* Message d'aide / validation */}
                        {linkValidationMessage && (
                          <div className={`text-sm px-3 py-2 rounded-lg flex items-start gap-2 ${
                            linkValidationMessage.includes('✅')
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : linkValidationMessage.includes('⚠️')
                              ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            <span>{linkValidationMessage}</span>
                          </div>
                        )}

                        {/* Liste des liens validés */}
                        {validatedLinkedins.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
                              <Check size={16} className="text-green-600" />
                              Liens validés ({validatedLinkedins.length})
                            </div>
                            <div className="space-y-1.5">
                              {validatedLinkedins.map((link, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2"
                                >
                                  <Linkedin size={14} className="text-[#0077B5] flex-shrink-0" />
                                  <span className="flex-1 text-sm text-gray-700 truncate">{link}</span>
                                  <button
                                    onClick={() => window.open(link, '_blank', 'noopener,noreferrer')}
                                    className="text-gray-500 hover:text-[#0077B5] transition-colors"
                                    title="Ouvrir le lien"
                                  >
                                    <ExternalLink size={14} />
                                  </button>
                                  <button
                                    onClick={() => removeValidatedLinkedin(link)}
                                    className="text-red-500 hover:text-red-700 transition-colors"
                                    title="Supprimer"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                              ))}
                            </div>
                            <button
                              onClick={sendLinkedinLinks}
                              className="w-full px-4 py-2.5 bg-gradient-to-r from-[#0077B5] to-[#005885] text-white rounded-lg hover:shadow-lg transition-all font-medium text-sm flex items-center justify-center gap-2"
                            >
                              <Send size={16} />
                              Envoyer ces {validatedLinkedins.length} liens
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sélecteur d'heure (Roulette iOS professionnelle) */}
                    {suggestions.some(s => s.type === 'time') && (
                      <div className="mt-4">
                        <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 border-2 border-orange-200 rounded-xl p-4 shadow-md">
                          {/* Roulette iOS avec react-mobile-picker */}
                          <div className="mb-3">
                            <Picker
                              value={pickerValue}
                              onChange={setPickerValue}
                              wheelMode="normal"
                              height={216}
                              itemHeight={36}
                            >
                              {/* Colonne des heures */}
                              <Picker.Column name="hour">
                                {Array.from({ length: 24 }, (_, i) => {
                                  const hour = String(i).padStart(2, '0');
                                  return (
                                    <Picker.Item key={hour} value={hour}>
                                      {({ selected }) => (
                                        <div className={`text-center py-2 transition-all ${
                                          selected
                                            ? 'text-orange-600 font-bold text-xl'
                                            : 'text-gray-400 text-base'
                                        }`}>
                                          {hour}
                                        </div>
                                      )}
                                    </Picker.Item>
                                  );
                                })}
                              </Picker.Column>

                              {/* Séparateur */}
                              <Picker.Column name="separator">
                                <Picker.Item value=":">
                                  <div className="text-orange-600 font-bold text-xl px-2">:</div>
                                </Picker.Item>
                              </Picker.Column>

                              {/* Colonne des minutes */}
                              <Picker.Column name="minute">
                                {Array.from({ length: 60 }, (_, i) => {
                                  const minute = String(i).padStart(2, '0');
                                  return (
                                    <Picker.Item key={minute} value={minute}>
                                      {({ selected }) => (
                                        <div className={`text-center py-2 transition-all ${
                                          selected
                                            ? 'text-orange-600 font-bold text-xl'
                                            : 'text-gray-400 text-base'
                                        }`}>
                                          {minute}
                                        </div>
                                      )}
                                    </Picker.Item>
                                  );
                                })}
                              </Picker.Column>
                            </Picker>
                          </div>

                          {/* Heure sélectionnée */}
                          <div className="text-center mb-3">
                            <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-orange-300 shadow-sm">
                              <Clock size={16} className="text-orange-500" />
                              <span className="text-xl font-bold text-orange-900">
                                {pickerValue.hour}:{pickerValue.minute}
                              </span>
                            </div>
                          </div>

                          {/* Bouton de confirmation */}
                          <button
                            onClick={sendSelectedTime}
                            disabled={isLoading || isTyping}
                            className="w-full px-4 py-2.5 bg-gradient-to-r from-orange-500 to-coral-500 text-white rounded-lg hover:shadow-lg transition-all font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Check size={16} />
                            Confirmer cette heure
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Input */}
                <div className="flex gap-3 items-end">
                  <div className="flex-1 relative">
                    <textarea
                      ref={textareaRef}
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !showResetModal) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      placeholder={showResetModal ? "Veuillez d'abord confirmer dans le modal..." : "Posez votre question..."}
                      disabled={isLoading || isTyping || showResetModal}
                      rows={1}
                      className="w-full px-5 py-4 border-2 border-orange-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed transition-all resize-none max-h-[200px] overflow-y-auto"
                      style={{ minHeight: '56px' }}
                    />
                  </div>
                  <button
                    onClick={sendMessage}
                    disabled={!inputMessage.trim() || isLoading || isTyping || showResetModal}
                    className="flex-shrink-0 w-14 h-14 bg-gradient-to-r from-orange-500 to-coral-500 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium active:scale-95"
                  >
                    <Send size={22} />
                  </button>
                </div>
                <div className="mt-2 text-xs text-gray-500 text-center">
                  Appuyez sur Entrée pour envoyer, Maj+Entrée pour nouvelle ligne
                </div>
              </div>
            </div>
        </div>
    </>
  );
}
