import { useState } from 'react';
import ChatInterface from './ChatInterface';
import VeilleDashboard from './VeilleDashboard';
import SettingsPage from './SettingsPage';
import VeilleHistoryPage from './VeilleHistoryPage';
import RAGChatPage from './RAGChatPage';
import AutoIndexer from './AutoIndexer';
// import { IndexationStatus } from './IndexationStatus'; // Désactivé car l'indexation est automatique
import { useAuth } from '../contexts/AuthContext';
import { Bell, LogOut, Settings, MessageSquare, LayoutDashboard, Bot, Edit, History, Sparkles } from 'lucide-react';

type View = 'chat' | 'dashboard' | 'settings' | 'historique' | 'rag-assistant';

export default function MainApp() {
  const { user, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  // Key pour forcer le rechargement du Dashboard
  const [dashboardKey, setDashboardKey] = useState(0);
  // State pour afficher le modal de réinitialisation dans le chat
  const [showResetModalOnChat, setShowResetModalOnChat] = useState(false);

  const navigateToDashboard = () => {
    setDashboardKey(prev => prev + 1); // Force le rechargement
    setCurrentView('dashboard');
    setShowResetModalOnChat(false); // Réinitialiser
  };

  const navigateToChatWithResetModal = () => {
    setShowResetModalOnChat(true);
    setCurrentView('chat');
  };

  // Composant invisible qui vérifie et indexe automatiquement les rapports non indexés
  // Se lance une seule fois au démarrage de l'application
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/30 via-peach-50 to-orange-100/40">
      <AutoIndexer />
      {/* <IndexationStatus /> Notification désactivée - l'indexation est automatique */}

      {/* Barre de navigation fixe et unifiée */}
      <div className="bg-white/95 backdrop-blur-sm border-b border-orange-100 px-6 py-3 flex items-center justify-between shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <img
            src="/logohallia.png"
            alt="HALL Veille"
            className="h-10 w-auto object-contain"
          />
          <span className="text-gray-900 font-bold text-xl">HALL Veille</span>
        </div>

        {/* Navigation principale */}
        <div className="flex items-center gap-2">
          <button
            onClick={navigateToDashboard}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-xl transition-all font-medium ${
              currentView === 'dashboard'
                ? 'bg-orange-500 text-white shadow-md'
                : 'text-gray-700 hover:bg-orange-50'
            }`}
          >
            <LayoutDashboard size={16} />
            Tableau de bord
          </button>

          <button
            onClick={navigateToChatWithResetModal}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-xl transition-all font-medium ${
              currentView === 'chat'
                ? 'bg-orange-500 text-white shadow-md'
                : 'text-gray-700 hover:bg-orange-50'
            }`}
          >
            <Edit size={16} />
            Modifier ma configuration
          </button>

          <button
            onClick={() => setCurrentView('rag-assistant')}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-xl transition-all font-medium ${
              currentView === 'rag-assistant'
                ? 'bg-orange-500 text-white shadow-md'
                : 'text-gray-700 hover:bg-orange-50'
            }`}
          >
            <Sparkles size={16} />
            Assistant IA
          </button>

          <button
            onClick={() => setCurrentView('historique')}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-xl transition-all font-medium ${
              currentView === 'historique'
                ? 'bg-orange-500 text-white shadow-md'
                : 'text-gray-700 hover:bg-orange-50'
            }`}
          >
            <History size={16} />
            Historique
          </button>

          <button
            onClick={() => setCurrentView('settings')}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-xl transition-all font-medium ${
              currentView === 'settings'
                ? 'bg-orange-500 text-white shadow-md'
                : 'text-gray-700 hover:bg-orange-50'
            }`}
          >
            <Settings size={16} />
            Paramètres
          </button>
        </div>

        {/* Section utilisateur */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-coral-500 rounded-full flex items-center justify-center text-white font-bold">
            {user?.email?.[0].toUpperCase()}
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 rounded-xl transition-all font-medium"
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </div>
      </div>

      {/* Contenu de la page */}
      {renderView()}
    </div>
  );

  function renderView() {
    if (currentView === 'dashboard') {
      return (
        <VeilleDashboard
          key={dashboardKey}
          onNavigateToChat={() => setCurrentView('chat')}
          onNavigateToChatWithReset={navigateToChatWithResetModal}
          onNavigateToSettings={() => setCurrentView('settings')}
          onNavigateToHistorique={() => setCurrentView('historique')}
          onNavigateToRAGAssistant={() => setCurrentView('rag-assistant')}
        />
      );
    }

    if (currentView === 'settings') {
      return <SettingsPage onNavigateToDashboard={navigateToDashboard} />;
    }

    if (currentView === 'historique') {
      return (
        <div className="max-w-7xl mx-auto px-6 py-8">
          <VeilleHistoryPage />
        </div>
      );
    }

    if (currentView === 'rag-assistant') {
      return <RAGChatPage onBack={navigateToDashboard} />;
    }

    return (
      <ChatInterface
        onNavigateToDashboard={navigateToDashboard}
        autoShowResetModal={showResetModalOnChat}
        onResetModalShown={() => setShowResetModalOnChat(false)}
      />
    );
  }
}
