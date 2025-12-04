import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Smile, BookOpen, BookHeart, MessageCircle, LogOut } from 'lucide-react';
import MoodTrack from './MoodTrack';
import StudyMode from './StudyMode';
import Diary from './Diary';
import Chatbot from './Chatbot';

type Tab = 'mood' | 'study' | 'diary' | 'chat';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('mood');
  const { logout } = useAuth();
  const { classes } = useTheme();

  const tabs = [
    { id: 'mood' as Tab, label: 'Mood', icon: Smile, color: 'from-pink-400 to-purple-400' },
    { id: 'study' as Tab, label: 'Study', icon: BookOpen, color: 'from-blue-400 to-teal-400' },
    { id: 'diary' as Tab, label: 'Diary', icon: BookHeart, color: 'from-purple-400 to-pink-400' },
    { id: 'chat' as Tab, label: 'Chat', icon: MessageCircle, color: 'from-green-400 to-teal-400' },
  ];

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className={`min-h-screen ${classes.background}`}>
      <header className="bg-white/80 backdrop-blur-sm shadow-lg sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500">
            Wellness Buddy
          </h1>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-400 to-pink-400 text-white rounded-full hover:shadow-lg transform hover:scale-105 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden md:inline">Logout</span>
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {activeTab === 'mood' && <MoodTrack />}
        {activeTab === 'study' && <StudyMode />}
        {activeTab === 'diary' && <Diary />}
        {activeTab === 'chat' && <Chatbot />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm shadow-2xl border-t-2 border-purple-200 z-20">
        <div className="container mx-auto px-2 py-3">
          <div className="flex justify-around items-center">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all transform ${
                    isActive
                      ? `bg-gradient-to-br ${tab.color} text-white scale-110 shadow-lg`
                      : 'text-purple-400 hover:text-purple-600 hover:scale-105'
                  }`}
                >
                  <Icon className={`w-6 h-6 ${isActive ? 'animate-bounce' : ''}`} />
                  <span className="text-xs font-bold">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
