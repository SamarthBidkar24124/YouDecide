import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User } from 'lucide-react';
import { api } from '../lib/api';

interface Message {
  id: string;
  text: string;
  isBot: boolean;
  timestamp: Date;
}

interface ChatApiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatApiRequest {
  messages: ChatApiMessage[];
}

interface ChatApiResponse {
  reply: string;
}

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hi there! I'm your Wellness Buddy! How are you feeling today?",
      isBot: true,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    setError(null);

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      isBot: false,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const chatMessages: ChatApiMessage[] = [
        // We let the backend add the system prompt; here we just send history.
        ...messages.map((m) => ({
          role: m.isBot ? 'assistant' : 'user',
          content: m.text,
        })),
        { role: 'user', content: userMessage.text },
      ];

      const body: ChatApiRequest = { messages: chatMessages };
      const res = await api.post<ChatApiResponse>('/chat', body);

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: res.reply,
        isBot: true,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      console.error('Error talking to chatbot:', err);
      setError(
        'Oops, I had trouble connecting right now. Please try again in a moment.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="pb-24">
      <div className="bg-gradient-to-br from-green-100 via-teal-100 to-blue-100 rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-teal-400 to-blue-400 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mr-3">
              <Bot className="w-8 h-8 text-teal-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Wellness Buddy</h2>
              <p className="text-teal-100">Always here to chat!</p>
            </div>
          </div>
        </div>

        <div className="bg-white/50 backdrop-blur-sm p-4 h-96 overflow-y-auto">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isBot ? 'justify-start' : 'justify-end'} animate-slide-in`}
              >
                <div
                  className={`flex gap-2 max-w-xs md:max-w-md ${
                    message.isBot ? 'flex-row' : 'flex-row-reverse'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.isBot
                        ? 'bg-gradient-to-br from-teal-400 to-blue-400'
                        : 'bg-gradient-to-br from-pink-400 to-purple-400'
                    }`}
                  >
                    {message.isBot ? (
                      <Bot className="w-5 h-5 text-white" />
                    ) : (
                      <User className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div
                    className={`px-4 py-3 rounded-2xl ${
                      message.isBot
                        ? 'bg-white text-purple-700 rounded-tl-none'
                        : 'bg-gradient-to-br from-pink-400 to-purple-400 text-white rounded-tr-none'
                    } shadow-lg`}
                  >
                    <p className="break-words">{message.text}</p>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start animate-slide-in">
                <div className="flex gap-2 max-w-xs md:max-w-md flex-row">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-teal-400 to-blue-400">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl bg-white text-purple-700 rounded-tl-none shadow-lg">
                    <p className="break-words">Thinking about the best way to help you…</p>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="bg-white p-4 border-t-2 border-teal-200">
          {error && (
            <div className="mb-2 text-sm text-red-600 text-center">{error}</div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1 px-4 py-3 bg-purple-50 border-2 border-purple-200 rounded-2xl focus:outline-none focus:border-purple-400 transition-all"
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isLoading}
              className="p-3 bg-gradient-to-br from-teal-400 to-blue-400 text-white rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-110 transition-all disabled:opacity-50 disabled:hover:scale-100"
            >
              <Send className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
