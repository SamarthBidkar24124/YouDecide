import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Smile, Frown, Meh, Zap, Heart, Cloud, BarChart3 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../lib/api';
import MoodCamera, { MoodEvent } from './MoodCamera';

const moods = [
  { name: 'happy', icon: Smile, color: 'from-yellow-400 to-orange-400', music: 'Upbeat Pop' },
  { name: 'sad', icon: Frown, color: 'from-blue-400 to-blue-600', music: 'Calm Acoustic' },
  { name: 'calm', icon: Cloud, color: 'from-green-400 to-teal-400', music: 'Nature Sounds' },
  { name: 'excited', icon: Zap, color: 'from-pink-400 to-purple-400', music: 'Energetic Dance' },
  { name: 'loved', icon: Heart, color: 'from-red-400 to-pink-400', music: 'Feel Good Vibes' },
  { name: 'neutral', icon: Meh, color: 'from-gray-400 to-gray-500', music: 'Lo-fi Chill' },
];

interface MoodEntry {
  mood: string;
  created_at: string;
}

export default function MoodTrack() {
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [moodData, setMoodData] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [serverMoods, setServerMoods] = useState<MoodEvent[]>([]);
  const [serverLoading, setServerLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { user } = useAuth();

  useEffect(() => {
    loadMoodData();
    if (user) {
      loadServerMoods(user.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadServerMoods = async (userId: string) => {
    setServerLoading(true);
    setServerError(null);
    try {
      const data = await api.get<MoodEvent[]>(`/mood/history?userId=${userId}&days=7`);
      setServerMoods(data);
    } catch (error) {
      console.error('Error loading mood history:', error);
      setServerError('Could not load camera-based mood history yet.');
    } finally {
      setServerLoading(false);
    }
  };

  const getStorageKey = () => {
    if (!user) return null;
    return `moods_${user.id}`;
  };

  const loadMoodData = () => {
    if (!user || typeof window === 'undefined') return;
    const key = getStorageKey();
    if (!key) return;

    const raw = window.localStorage.getItem(key);
    if (!raw) {
      setMoodData([]);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as MoodEntry[];
      setMoodData(parsed);
    } catch {
      setMoodData([]);
    }
  };

  const saveMoodData = (updated: MoodEntry[]) => {
    if (!user || typeof window === 'undefined') return;
    const key = getStorageKey();
    if (!key) return;

    window.localStorage.setItem(key, JSON.stringify(updated));
    setMoodData(updated);
  };

  const handleMoodSelect = (moodName: string) => {
    if (!user) return;

    setSelectedMood(moodName);
    setLoading(true);

    try {
      const newEntry: MoodEntry = {
        mood: moodName,
        created_at: new Date().toISOString(),
      };
      const updated = [newEntry, ...moodData].slice(0, 7);
      saveMoodData(updated);
    } catch (error) {
      console.error('Error saving mood:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMoodCount = (moodName: string) => {
    return moodData.filter((entry) => entry.mood === moodName).length;
  };

  const maxCount = Math.max(...moods.map((m) => getMoodCount(m.name)), 1);

  const serverMoodChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    serverMoods.forEach((event) => {
      const key = event.mood;
      counts[key] = (counts[key] || 0) + 1;
    });

    return Object.entries(counts).map(([mood, count]) => ({
      mood,
      count,
    }));
  }, [serverMoods]);

  const handleNewServerMood = (event: MoodEvent) => {
    setServerMoods((prev) => [event, ...prev]);
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl p-6 md:p-8">
        <h2 className="text-3xl font-bold text-purple-600 mb-2">
          How are you feeling today?
        </h2>
        <p className="text-purple-400 mb-6">Pick your mood!</p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {moods.map((mood) => {
            const Icon = mood.icon;
            const isSelected = selectedMood === mood.name;

            return (
              <button
                key={mood.name}
                onClick={() => handleMoodSelect(mood.name)}
                disabled={loading}
                className={`p-6 rounded-2xl border-3 transition-all transform hover:scale-105 ${
                  isSelected
                    ? `bg-gradient-to-br ${mood.color} text-white border-transparent scale-105`
                    : 'bg-white border-purple-200 text-purple-600 hover:border-purple-400'
                }`}
              >
                <Icon className="w-12 h-12 mx-auto mb-2" />
                <div className="font-bold capitalize">{mood.name}</div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedMood && (
        <div className="bg-gradient-to-br from-pink-100 to-purple-100 rounded-3xl shadow-xl p-6 md:p-8 animate-slide-up">
          <h3 className="text-2xl font-bold text-purple-600 mb-4">
            Music Recommendation
          </h3>
          <div className="bg-white/80 rounded-2xl p-6 flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-pink-400 to-purple-400 rounded-xl flex items-center justify-center">
              <Heart className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="font-bold text-lg text-purple-600">
                {moods.find((m) => m.name === selectedMood)?.music}
              </div>
              <div className="text-purple-400">Perfect for your mood!</div>
            </div>
          </div>
        </div>
      )}

      <MoodCamera onNewMood={handleNewServerMood} />

      <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl p-6 md:p-8">
        <h3 className="text-2xl font-bold text-purple-600 mb-6">
          Your Mood This Week
        </h3>

        <div className="space-y-4">
          {moods.map((mood) => {
            const count = getMoodCount(mood.name);
            const percentage = (count / maxCount) * 100;

            return (
              <div key={mood.name}>
                <div className="flex justify-between mb-2">
                  <span className="font-semibold capitalize text-purple-600">
                    {mood.name}
                  </span>
                  <span className="text-purple-400">{count} times</span>
                </div>
                <div className="h-4 bg-purple-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${mood.color} transition-all duration-1000 ease-out rounded-full`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl p-6 md:p-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold text-purple-600">
            Camera Mood History
          </h3>
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg">
            <BarChart3 className="w-5 h-5" />
          </div>
        </div>

        {serverLoading && (
          <p className="text-purple-400 text-sm">Loading mood history...</p>
        )}

        {serverError && (
          <p className="text-sm text-red-500 mb-2">{serverError}</p>
        )}

        {!serverLoading && serverMoods.length === 0 && !serverError && (
          <p className="text-sm text-purple-400">
            Use the camera above to detect your mood. Your recent moods will appear
            here as a graph.
          </p>
        )}

        {serverMoodChartData.length > 0 && (
          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serverMoodChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mood" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#a855f7" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
