import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api, API_BASE_URL } from '../lib/api';
import {
  Play,
  Pause,
  RotateCcw,
  BookOpen,
  Trophy,
  Droplets,
  Check,
  X,
  ListChecks,
  Flame,
} from 'lucide-react';

const quotes = [
  "You're doing amazing!",
  'Every minute counts!',
  'Stay focused, superstar!',
  'Learning is growing!',
  "You've got this!",
  'Keep up the great work!',
];

const FOCUS_MINUTES = 25;
const BREAK_MINUTES = 5;

type Phase = 'focus' | 'break';

interface StudySummary {
  total_minutes: number;
  total_sessions: number;
  day_minutes: number | null;
  day_sessions: number | null;
}

interface WaterReminder {
  id: string;
  userId: string;
  reminder_time: string;
  status: 'pending' | 'done' | 'skipped';
  day: string;
}

type TaskPriority = 'low' | 'medium' | 'high';
type TaskStatus = 'pending' | 'in_progress' | 'done';

interface StudyTask {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  created_at: string;
  updated_at?: string | null;
}

interface StudyStreak {
  userId: string;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  active_dates: string[];
}

const WHITE_NOISE_URL = `${API_BASE_URL}/study/white-noise`;

const formatLocalDay = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function StudyMode() {
  const { user } = useAuth();

  const [minutes, setMinutes] = useState(FOCUS_MINUTES);
  const [seconds, setSeconds] = useState(0);
  const [phase, setPhase] = useState<Phase>('focus');
  const [isActive, setIsActive] = useState(false);
  const [quote, setQuote] = useState(quotes[0]);

  const [summary, setSummary] = useState<StudySummary | null>(null);
  const [waterReminders, setWaterReminders] = useState<WaterReminder[]>([]);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [taskFilter, setTaskFilter] = useState<TaskStatus | 'all'>('all');
  const [taskPriorityFilter, setTaskPriorityFilter] =
    useState<TaskPriority | 'all'>('all');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] =
    useState<TaskPriority>('medium');

  const [streak, setStreak] = useState<StudyStreak | null>(null);

  const intervalRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [soundOn, setSoundOn] = useState(true);

  const [sessionStart, setSessionStart] = useState<Date | null>(null);

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatLocalDay(today), [today]);

  useEffect(() => {
    if (!user) return;

    const controller = new AbortController();

    const loadAll = async () => {
      try {
        const [summaryData, streakData] = await Promise.all([
          api.get<StudySummary>(
            `/study/sessions/summary?userId=${encodeURIComponent(
              user.id
            )}&day=${todayStr}`
          ),
          api.get<StudyStreak>(
            `/study/streak?userId=${encodeURIComponent(user.id)}`
          ),
        ]);
        setSummary(summaryData);
        setStreak(streakData);
      } catch (error) {
        console.error('Error loading study stats:', error);
      }

      try {
        const water = await api.get<WaterReminder[]>(
          `/study/water?userId=${encodeURIComponent(
            user.id
          )}&day=${todayStr}`
        );
        if (water.length === 0) {
          const created = await api.post<WaterReminder[]>(
            '/study/water/bulk',
            {
              userId: user.id,
              day: todayStr,
              start_hour: 9,
              end_hour: 21,
              interval_minutes: 90,
            }
          );
          setWaterReminders(created);
        } else {
          setWaterReminders(water);
        }
      } catch (error) {
        console.error('Error loading water reminders:', error);
      }

      try {
        const loadedTasks = await api.get<StudyTask[]>(
          `/study/tasks?userId=${encodeURIComponent(user.id)}`
        );
        setTasks(loadedTasks);
      } catch (error) {
        console.error('Error loading tasks:', error);
      }
    };

    void loadAll();

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, todayStr]);

  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio(WHITE_NOISE_URL);
      audio.loop = true;
      audioRef.current = audio;
    }
  }, []);

  useEffect(() => {
    if (!isActive || !soundOn || !audioRef.current) {
      audioRef.current?.pause();
      return;
    }

    void audioRef.current.play().catch((error) => {
      console.error('Audio playback error:', error);
    });
  }, [isActive, soundOn]);

  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
      return;
    }

    intervalRef.current = window.setInterval(() => {
      setSeconds((prevSeconds) => {
        if (prevSeconds === 0) {
          // about to roll minutes
          setMinutes((prevMinutes) => {
            if (prevMinutes === 0) {
              void handleTimerComplete();
              return phase === 'focus' ? BREAK_MINUTES : FOCUS_MINUTES;
            }
            return prevMinutes - 1;
          });
          return 59;
        }
        return prevSeconds - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, phase]);

  const playBellSound = () => {
    const audio = new Audio(
      'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGS76+idTgwOUKXh8bllHAU6kdXu0H4qBSp+zPLaizsKFlm46+mnVBELTKXk8r5jHgcwiM/z1YU6Bxxmu+3qnE0MDU6k4fG5ZRwFOpHV7tB+KgUqfsvy2os7ChZZuOvpp1QRC0yl5PK+Yx4HMIjP89WFOgceZrvt6pxNDA1OpOHxuWUcBTqR1e7QfioFKn7L8tqLOwoWWbjr6adUEQtMpeTyvmMeBzCIz/PVhToHHma77eqcTQwNTqTh8bllHAU6kdXu0H4qBSp+y/Laizsitz'
    );
    void audio.play();
  };

  const showRandomQuote = () => {
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    setQuote(randomQuote);
  };

  const refreshSummaryAndStreak = async () => {
    if (!user) return;
    try {
      const [summaryData, streakData] = await Promise.all([
        api.get<StudySummary>(
          `/study/sessions/summary?userId=${encodeURIComponent(
            user.id
          )}&day=${todayStr}`
        ),
        api.get<StudyStreak>(
          `/study/streak?userId=${encodeURIComponent(user.id)}`
        ),
      ]);
      setSummary(summaryData);
      setStreak(streakData);
    } catch (error) {
      console.error('Error refreshing stats:', error);
    }
  };

  const handleTimerComplete = async () => {
    setIsActive(false);
    playBellSound();
    showRandomQuote();

    if (user && phase === 'focus') {
      const end = new Date();
      const start = sessionStart ?? new Date(end.getTime() - FOCUS_MINUTES * 60 * 1000);
      try {
        await api.post<StudyStreak>('/study/sessions', {
          userId: user.id,
          start_time: start.toISOString(),
          duration_minutes: FOCUS_MINUTES,
          session_date: todayStr,
          phase_type: 'focus',
          completed: true,
        });
        await refreshSummaryAndStreak();
      } catch (error) {
        console.error('Error recording session:', error);
      } finally {
        setSessionStart(null);
      }
    }

    setPhase((prev) => (prev === 'focus' ? 'break' : 'focus'));
    setMinutes((prevPhase) =>
      phase === 'focus' ? BREAK_MINUTES : FOCUS_MINUTES
    );
    setSeconds(0);
  };

  const handlePlayPause = () => {
    if (!user) return;

    if (!isActive && !sessionStart) {
      setSessionStart(new Date());
    }

    setIsActive((prev) => !prev);
  };

  const handleReset = () => {
    setIsActive(false);
    setMinutes(FOCUS_MINUTES);
    setSeconds(0);
    setPhase('focus');
    setSessionStart(null);
  };

  const handleToggleSound = () => {
    setSoundOn((prev) => !prev);
  };

  const handleWaterStatus = async (
    id: string,
    status: WaterReminder['status']
  ) => {
    if (!user) return;
    try {
      const updated = await api.put<WaterReminder>(
        `/study/water/${id}?userId=${encodeURIComponent(user.id)}`,
        { status }
      );
      setWaterReminders((prev) =>
        prev.map((w) => (w.id === id ? updated : w))
      );
    } catch (error) {
      console.error('Error updating water reminder:', error);
    }
  };

  const handleAddTask = async () => {
    if (!user || !newTaskTitle.trim()) return;
    try {
      const created = await api.post<StudyTask>('/study/tasks', {
        userId: user.id,
        title: newTaskTitle.trim(),
        description: newTaskDescription.trim() || undefined,
        priority: newTaskPriority,
        status: 'pending',
      });
      setTasks((prev) => [created, ...prev]);
      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskPriority('medium');
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const handleUpdateTaskStatus = async (
    task: StudyTask,
    status: TaskStatus
  ) => {
    if (!user) return;
    try {
      const updated = await api.put<StudyTask>(
        `/study/tasks/${task.id}?userId=${encodeURIComponent(user.id)}`,
        { status }
      );
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? updated : t))
      );
      if (status === 'done') {
        await refreshSummaryAndStreak();
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDeleteTask = async (task: StudyTask) => {
    if (!user) return;
    try {
      await api.delete<void>(
        `/study/tasks/${task.id}?userId=${encodeURIComponent(user.id)}`
      );
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const filteredTasks = tasks.filter((task) => {
    const statusOk =
      taskFilter === 'all' ? true : task.status === taskFilter;
    const priorityOk =
      taskPriorityFilter === 'all'
        ? true
        : task.priority === taskPriorityFilter;
    return statusOk && priorityOk;
  });

  const totalMinutes = summary?.total_minutes ?? 0;
  const totalSessions = summary?.total_sessions ?? 0;
  const todaySessions = summary?.day_sessions ?? 0;

  const phaseTotalMinutes = phase === 'focus' ? FOCUS_MINUTES : BREAK_MINUTES;
  const totalSecondsPhase = minutes * 60 + seconds;
  const percentage = (totalSecondsPhase / (phaseTotalMinutes * 60)) * 100;
  const circumference = 2 * Math.PI * 120;
  const offset = circumference - (percentage / 100) * circumference;

  const streakDays = streak?.current_streak ?? 0;
  const longestStreak = streak?.longest_streak ?? 0;

  const recentDays = useMemo(() => {
    const days: string[] = [];
    const base = new Date();
    for (let i = 27; i >= 0; i -= 1) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      days.push(formatLocalDay(d));
    }
    return days;
  }, []);

  return (
    <div className="space-y-6 pb-24">
      <div className="bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 rounded-3xl shadow-xl p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <BookOpen className="w-12 h-12 text-purple-600 mr-3" />
            <div>
              <h2 className="text-3xl font-bold text-purple-600">Study Timer</h2>
              <p className="text-purple-500 text-sm">
                {phase === 'focus'
                  ? 'Deep focus mode – you got this!'
                  : 'Gentle break – stretch, breathe, hydrate.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleSound}
              className={`px-3 py-2 rounded-full text-xs font-semibold shadow-md transition-all ${
                soundOn
                  ? 'bg-green-500 text-white'
                  : 'bg-white/70 text-purple-500'
              }`}
            >
              {soundOn ? 'White noise: On' : 'White noise: Off'}
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-[auto,minmax(0,1.2fr)] gap-8 items-center">
          <div className="relative w-64 h-64 mx-auto">
            <svg className="transform -rotate-90 w-64 h-64">
              <circle
                cx="128"
                cy="128"
                r="120"
                stroke="currentColor"
                strokeWidth="12"
                fill="transparent"
                className="text-purple-200"
              />
              <circle
                cx="128"
                cy="128"
                r="120"
                stroke="currentColor"
                strokeWidth="12"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="text-purple-600 transition-all duration-1000"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
              <div className="text-5xl font-bold text-purple-600">
                {String(minutes).padStart(2, '0')}:
                {String(seconds).padStart(2, '0')}
              </div>
              <div className="text-purple-400 mt-2 capitalize">
                {phase === 'focus' ? 'Focus' : 'Break'} Time
              </div>
              <div className="text-xs text-purple-500 mt-1">
                {todaySessions} sessions today
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-center gap-4 mb-4">
              <button
                onClick={handlePlayPause}
                className="p-6 bg-gradient-to-br from-green-400 to-green-500 text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-110 transition-all disabled:opacity-50"
                disabled={!user}
              >
                {isActive ? (
                  <Pause className="w-8 h-8" />
                ) : (
                  <Play className="w-8 h-8" />
                )}
              </button>
              <button
                onClick={handleReset}
                className="p-6 bg-gradient-to-br from-orange-400 to-orange-500 text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-110 transition-all"
              >
                <RotateCcw className="w-8 h-8" />
              </button>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 text-center">
              <p className="text-lg md:text-2xl font-bold text-purple-600 animate-pulse">
                {quote}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl p-6 md:p-8">
          <div className="flex items-center mb-4">
            <Trophy className="w-8 h-8 text-yellow-500 mr-3" />
            <h3 className="text-2xl font-bold text-purple-600">Your Progress</h3>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gradient-to-br from-yellow-100 to-orange-100 rounded-2xl p-6 text-center">
              <div className="text-4xl font-bold text-orange-600">
                {totalMinutes}
              </div>
              <div className="text-orange-500 mt-2">Minutes Studied</div>
            </div>
            <div className="bg-gradient-to-br from-green-100 to-teal-100 rounded-2xl p-6 text-center">
              <div className="text-4xl font-bold text-teal-600">
                {totalSessions}
              </div>
              <div className="text-teal-500 mt-2">Total Sessions</div>
            </div>
          </div>

          <div className="bg-purple-50 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Flame className="w-8 h-8 text-orange-500" />
              <div>
                <div className="text-sm text-purple-500 uppercase tracking-wide">
                  Study streak
                </div>
                <div className="text-lg font-bold text-purple-700">
                  {streakDays} day{streakDays === 1 ? '' : 's'} in a row
                </div>
                <div className="text-xs text-purple-400">
                  Longest: {longestStreak} day
                  {longestStreak === 1 ? '' : 's'}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-purple-500">
                Last 4 weeks
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {recentDays.map((day) => {
                const active = streak?.active_dates?.includes(day);
                return (
                  <div
                    key={day}
                    className={`h-6 w-6 rounded-lg border border-purple-100 flex items-center justify-center text-[10px] ${
                      active
                        ? 'bg-gradient-to-br from-teal-400 to-emerald-500 text-white'
                        : 'bg-white text-purple-300'
                    }`}
                    title={day}
                  >
                    {new Date(day).getDate()}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl p-6 md:p-8">
          <div className="flex items-center mb-4">
            <Droplets className="w-8 h-8 text-sky-500 mr-3" />
            <h3 className="text-2xl font-bold text-purple-600">
              Hydration Timeline
            </h3>
          </div>
          <p className="text-sm text-purple-400 mb-4">
            Tiny sips, big wins. Tap a drop when you&apos;ve had some water.
          </p>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
            {waterReminders.length === 0 ? (
              <div className="text-purple-400 text-sm">
                Loading your water schedule for today...
              </div>
            ) : (
              waterReminders.map((reminder) => {
                const time = new Date(reminder.reminder_time).toLocaleTimeString(
                  undefined,
                  { hour: '2-digit', minute: '2-digit' }
                );
                const isPast =
                  new Date(reminder.reminder_time).getTime() < Date.now();
                const isCurrent =
                  Math.abs(
                    new Date(reminder.reminder_time).getTime() - Date.now()
                  ) < 30 * 60 * 1000;

                let border =
                  'border-sky-200 bg-sky-50 text-sky-600 hover:border-sky-300';
                if (reminder.status === 'done') {
                  border =
                    'border-emerald-400 bg-emerald-50 text-emerald-600 line-through';
                } else if (reminder.status === 'skipped') {
                  border = 'border-rose-300 bg-rose-50 text-rose-500';
                } else if (isCurrent) {
                  border =
                    'border-purple-400 bg-purple-50 text-purple-600 shadow-sm';
                } else if (isPast) {
                  border = 'border-slate-200 bg-slate-50 text-slate-500';
                }

                return (
                  <div
                    key={reminder.id}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition-colors ${border}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center shadow-sm">
                        <Droplets className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold">{time}</div>
                        <div className="text-xs opacity-70 capitalize">
                          {reminder.status}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleWaterStatus(reminder.id, 'done')}
                        className="p-2 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                        aria-label="Mark done"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          handleWaterStatus(reminder.id, 'skipped')
                        }
                        className="p-2 rounded-full bg-rose-400 text-white hover:bg-rose-500 transition-colors"
                        aria-label="Skip"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl p-6 md:p-8 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <ListChecks className="w-8 h-8 text-teal-500" />
            <h3 className="text-2xl font-bold text-purple-600">
              Study To‑Dos
            </h3>
          </div>
          <div className="flex gap-2 text-xs">
            <select
              value={taskFilter}
              onChange={(e) =>
                setTaskFilter(e.target.value as TaskStatus | 'all')
              }
              className="px-3 py-2 rounded-full bg-white/80 border border-purple-100 text-purple-600"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
            </select>
            <select
              value={taskPriorityFilter}
              onChange={(e) =>
                setTaskPriorityFilter(
                  e.target.value as TaskPriority | 'all'
                )
              }
              className="px-3 py-2 rounded-full bg-white/80 border border-purple-100 text-purple-600"
            >
              <option value="all">All priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        <div className="grid md:grid-cols-[minmax(0,1.2fr),minmax(0,1.8fr)] gap-4">
          <div className="bg-purple-50 rounded-2xl p-4 space-y-3">
            <input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="What do you want to focus on?"
              className="w-full rounded-xl border border-purple-200 bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
            <textarea
              value={newTaskDescription}
              onChange={(e) => setNewTaskDescription(e.target.value)}
              placeholder="Optional details, page numbers, links..."
              className="w-full rounded-xl border border-purple-200 bg-white/80 px-3 py-2 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
            <div className="flex items-center justify-between gap-3">
              <select
                value={newTaskPriority}
                onChange={(e) =>
                  setNewTaskPriority(e.target.value as TaskPriority)
                }
                className="flex-1 rounded-full bg-white/80 border border-purple-200 px-3 py-2 text-xs text-purple-600"
              >
                <option value="high">High priority</option>
                <option value="medium">Medium priority</option>
                <option value="low">Low priority</option>
              </select>
              <button
                onClick={handleAddTask}
                disabled={!newTaskTitle.trim() || !user}
                className="px-4 py-2 rounded-2xl bg-gradient-to-r from-teal-400 to-emerald-400 text-white text-sm font-semibold shadow-md hover:shadow-lg disabled:opacity-50"
              >
                Add task
              </button>
            </div>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {filteredTasks.length === 0 ? (
              <div className="text-purple-400 text-sm">
                No tasks yet. Add a focus task to get started!
              </div>
            ) : (
              filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-white/90 border border-purple-100 rounded-2xl px-4 py-3 flex items-start justify-between gap-3 hover:shadow-md transition-all"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-purple-700">
                        {task.title}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide ${
                          task.priority === 'high'
                            ? 'bg-rose-100 text-rose-600'
                            : task.priority === 'medium'
                            ? 'bg-amber-100 text-amber-600'
                            : 'bg-emerald-100 text-emerald-600'
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-xs text-purple-500 whitespace-pre-wrap mb-1">
                        {task.description}
                      </p>
                    )}
                    <div className="text-[10px] text-purple-300">
                      Created{' '}
                      {new Date(task.created_at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <select
                      value={task.status}
                      onChange={(e) =>
                        handleUpdateTaskStatus(
                          task,
                          e.target.value as TaskStatus
                        )
                      }
                      className="text-xs rounded-full bg-white/80 border border-purple-200 px-2 py-1 text-purple-600"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In progress</option>
                      <option value="done">Done</option>
                    </select>
                    <button
                      onClick={() => handleDeleteTask(task)}
                      className="text-[11px] text-rose-500 hover:text-rose-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
