import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Users, Sparkles } from 'lucide-react';

export default function ProfileSetup({ onComplete }: { onComplete: () => void }) {
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname || !gender) {
      setError('Please fill in all fields!');
      return;
    }

    if (!user || typeof window === 'undefined') {
      setError('You must be logged in to create a profile.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const profile = {
        id: user.id,
        nickname,
        gender,
      };
      window.localStorage.setItem(`profile_${user.id}`, JSON.stringify(profile));
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const backgroundClass =
    gender === 'male'
      ? 'bg-gradient-to-br from-sky-100 via-blue-100 to-indigo-100'
      : gender === 'female'
      ? 'bg-gradient-to-br from-pink-100 via-rose-100 to-fuchsia-100'
      : 'bg-gradient-to-br from-yellow-100 via-pink-100 to-purple-100';

  return (
    <div className={`min-h-screen ${backgroundClass} flex items-center justify-center p-4`}>
      <div className="w-full max-w-2xl">
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-8 md:p-12 transform transition-all">
          <div className="text-center mb-8">
            <div className="inline-block bg-gradient-to-br from-yellow-400 to-pink-400 rounded-full p-6 mb-4 animate-bounce">
              <Sparkles className="w-16 h-16 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-purple-600 mb-2">
              Let's Get to Know You!
            </h1>
            <p className="text-lg text-purple-500">
              Tell us a bit about yourself
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-100 border-2 border-red-300 rounded-2xl text-red-600 text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <label className="block text-xl font-bold text-purple-600 mb-4">
                What should we call you?
              </label>
              <input
                type="text"
                placeholder="Your nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full px-6 py-4 bg-purple-50 border-3 border-purple-200 rounded-2xl text-lg focus:outline-none focus:border-purple-400 transition-all"
              />
            </div>

            <div>
              <label className="block text-xl font-bold text-purple-600 mb-4">
                Choose your avatar
              </label>
              <div className="grid grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => setGender('male')}
                  className={`p-6 rounded-2xl border-3 transition-all transform hover:scale-105 ${
                    gender === 'male'
                      ? 'bg-blue-400 border-blue-600 text-white'
                      : 'bg-blue-100 border-blue-300 text-blue-600'
                  }`}
                >
                  <User className="w-12 h-12 mx-auto mb-2" />
                  <div className="font-bold">Boy</div>
                </button>

                <button
                  type="button"
                  onClick={() => setGender('female')}
                  className={`p-6 rounded-2xl border-3 transition-all transform hover:scale-105 ${
                    gender === 'female'
                      ? 'bg-pink-400 border-pink-600 text-white'
                      : 'bg-pink-100 border-pink-300 text-pink-600'
                  }`}
                >
                  <User className="w-12 h-12 mx-auto mb-2" />
                  <div className="font-bold">Girl</div>
                </button>

                <button
                  type="button"
                  onClick={() => setGender('other')}
                  className={`p-6 rounded-2xl border-3 transition-all transform hover:scale-105 ${
                    gender === 'other'
                      ? 'bg-purple-400 border-purple-600 text-white'
                      : 'bg-purple-100 border-purple-300 text-purple-600'
                  }`}
                >
                  <Users className="w-12 h-12 mx-auto mb-2" />
                  <div className="font-bold">Other</div>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 text-white text-2xl font-bold rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50"
            >
              {loading ? 'Creating Profile...' : "Let's Go!"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
