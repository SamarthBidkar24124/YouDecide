import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Heart } from 'lucide-react';

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        await register(email, password);
      } else {
        await login(email, password);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl flex flex-col md:flex-row items-center gap-8">
        <div className="flex-1 text-center md:text-left animate-float">
          <div className="inline-block bg-white/80 backdrop-blur-sm rounded-full p-8 mb-6 shadow-xl">
            <Heart className="w-24 h-24 text-pink-400" fill="currentColor" />
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-purple-600 mb-4">
            Wellness Buddy
          </h1>
          <p className="text-xl text-purple-500">
            Your happy place to track moods, study & grow!
          </p>
        </div>

        <div className="flex-1 w-full max-w-md">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-8 transform transition-all hover:scale-105">
            <h2 className="text-3xl font-bold text-center text-purple-600 mb-6">
              {isSignUp ? 'Join Us!' : 'Welcome Back!'}
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-100 border-2 border-red-300 rounded-2xl text-red-600 text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  type="email"
                  placeholder="Your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-6 py-4 bg-purple-50 border-3 border-purple-200 rounded-2xl text-lg focus:outline-none focus:border-purple-400 transition-all"
                />
              </div>

              <div>
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-6 py-4 bg-purple-50 border-3 border-purple-200 rounded-2xl text-lg focus:outline-none focus:border-purple-400 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-pink-400 to-purple-400 text-white text-xl font-bold rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50"
              >
                {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Login'}
              </button>
            </form>

            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
              }}
              className="w-full mt-4 text-purple-500 hover:text-purple-700 transition-colors"
            >
              {isSignUp
                ? 'Already have an account? Login'
                : "Don't have an account? Sign Up"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
