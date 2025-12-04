import { useEffect, useMemo, useState } from 'react';
import Calendar from 'react-calendar';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { BookHeart, Save, Plus, Trash2, Star, Clock3 } from 'lucide-react';

type CalendarValue = Date | null;

interface DiaryEntry {
  id: string;
  content: string;
  created_at: string;
  updated_at?: string | null;
}

interface EventItem {
  id: string;
  userId: string;
  title: string;
  start: string;
  end: string;
  type: string;
  notes?: string | null;
}

const formatLocalDay = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Diary() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [selectedDate, setSelectedDate] = useState<CalendarValue>(new Date());
  const [dayEvents, setDayEvents] = useState<EventItem[]>([]);

  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventTime, setNewEventTime] = useState('18:00');
  const [newEventEndTime, setNewEventEndTime] = useState('19:00');
  const [newEventType, setNewEventType] = useState('study');
  const [newEventNotes, setNewEventNotes] = useState('');

  const { user } = useAuth();

  const selectedDayStr = useMemo(
    () => (selectedDate ? formatLocalDay(selectedDate) : ''),
    [selectedDate]
  );

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      try {
        const data = await api.get<DiaryEntry[]>(
          `/diary?userId=${encodeURIComponent(user.id)}`
        );
        setEntries(data);
      } catch (error) {
        console.error('Error loading diary entries:', error);
      }
    };

    void load();
  }, [user]);

  useEffect(() => {
    if (!user || !selectedDate) return;

    const loadEventsForDay = async () => {
      try {
        const day = selectedDate;
        const from = new Date(
          day.getFullYear(),
          day.getMonth(),
          day.getDate(),
          0,
          0,
          0
        );
        const to = new Date(
          day.getFullYear(),
          day.getMonth(),
          day.getDate(),
          23,
          59,
          59
        );

        const events = await api.get<EventItem[]>(
          `/events?userId=${encodeURIComponent(
            user.id
          )}&from=${from.toISOString()}&to=${to.toISOString()}`
        );
        setDayEvents(events);
      } catch (error) {
        console.error('Error loading events:', error);
      }
    };

    void loadEventsForDay();
  }, [user, selectedDate]);

  const entriesByDay = useMemo(() => {
    const map = new Map<string, DiaryEntry[]>();
    entries.forEach((entry) => {
      const day = formatLocalDay(new Date(entry.created_at));
      const list = map.get(day) ?? [];
      list.push(entry);
      map.set(day, list);
    });
    return map;
  }, [entries]);

  const selectedDayEntries = selectedDayStr
    ? entriesByDay.get(selectedDayStr) ?? []
    : [];

  const daysWithEntries = useMemo(
    () => new Set(Array.from(entriesByDay.keys())),
    [entriesByDay]
  );

  const handleSave = async () => {
    if (!currentEntry.trim() || !user) return;

    setLoading(true);

    try {
      if (editingId) {
        const updated = await api.put<DiaryEntry>(
          `/diary/${editingId}?userId=${encodeURIComponent(user.id)}`,
          { content: currentEntry.trim() }
        );
        setEntries((prev) =>
          prev.map((entry) => (entry.id === editingId ? updated : entry))
        );
      } else {
        const created = await api.post<DiaryEntry>('/diary', {
          userId: user.id,
          content: currentEntry.trim(),
        });
        setEntries((prev) => [created, ...prev]);
      }

      setCurrentEntry('');
      setEditingId(null);
    } catch (error) {
      console.error('Error saving entry:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (entry: DiaryEntry) => {
    setCurrentEntry(entry.content);
    setEditingId(entry.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await api.delete<void>(
        `/diary/${id}?userId=${encodeURIComponent(user.id)}`
      );
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  const handleNew = () => {
    setCurrentEntry('');
    setEditingId(null);
  };

  const handleCreateEvent = async () => {
    if (!user || !selectedDate || !newEventTitle.trim()) return;

    const [startHour, startMinute] = newEventTime.split(':').map(Number);
    const [endHour, endMinute] = newEventEndTime.split(':').map(Number);

    const start = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      startHour || 0,
      startMinute || 0,
      0
    );
    const end = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      endHour || 0,
      endMinute || 0,
      0
    );

    try {
      const created = await api.post<EventItem>('/events', {
        userId: user.id,
        title: newEventTitle.trim(),
        start: start.toISOString(),
        end: end.toISOString(),
        type: newEventType,
        notes: newEventNotes.trim() || undefined,
      });
      setDayEvents((prev) => [...prev, created]);
      setNewEventTitle('');
      setNewEventNotes('');
    } catch (error) {
      console.error('Error creating event:', error);
    }
  };

  const handleDeleteEvent = async (event: EventItem) => {
    if (!user) return;
    try {
      await api.delete<void>(
        `/events/${event.id}?userId=${encodeURIComponent(user.id)}`
      );
      setDayEvents((prev) => prev.filter((e) => e.id !== event.id));
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 rounded-3xl shadow-xl p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-4 right-4 animate-float">
          <Star className="w-8 h-8 text-yellow-400 fill-yellow-400" />
        </div>
        <div className="absolute bottom-4 left-4 animate-float-delayed">
          <Star className="w-6 h-6 text-pink-400 fill-pink-400" />
        </div>

        <div className="flex items-center mb-6 justify-between gap-4">
          <div className="flex items-center">
            <BookHeart className="w-10 h-10 text-purple-600 mr-3" />
            <div>
              <h2 className="text-3xl font-bold text-purple-600">My Diary</h2>
              <p className="text-purple-500 text-sm">
                Capture feelings, then plan your day around them.
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-purple-600 bg-white/70 rounded-full px-4 py-2 shadow-sm">
            <Clock3 className="w-4 h-4" />
            <span>{selectedDayStr}</span>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1.1fr),minmax(0,1.2fr)]">
          <div>
            <textarea
              value={currentEntry}
              onChange={(e) => setCurrentEntry(e.target.value)}
              placeholder="Write your thoughts here... ✨"
              className="w-full h-48 p-6 bg-white/80 backdrop-blur-sm border-3 border-purple-200 rounded-2xl text-lg focus:outline-none focus:border-purple-400 transition-all resize-none"
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSave}
                disabled={loading || !currentEntry.trim()}
                className="flex-1 py-4 bg-gradient-to-r from-green-400 to-teal-400 text-white text-lg font-bold rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                {editingId ? 'Update Entry' : 'Save Entry'}
              </button>
              {editingId && (
                <button
                  onClick={handleNew}
                  className="py-4 px-6 bg-gradient-to-r from-orange-400 to-red-400 text-white text-lg font-bold rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  New
                </button>
              )}
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 md:p-5 shadow-md">
            <Calendar
              value={selectedDate}
              onChange={(value) => setSelectedDate(value as CalendarValue)}
              tileClassName={({ date }) => {
                const dayStr = formatLocalDay(date);
                if (daysWithEntries.has(dayStr)) {
                  return 'relative after:content-[""] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-2 after:h-2 after:rounded-full after:bg-purple-400';
                }
                return undefined;
              }}
              className="w-full border-0 bg-transparent [&_.react-calendar__tile--now]:bg-purple-100 [&_.react-calendar__tile--active]:bg-purple-500 [&_.react-calendar__tile--active]:text-white"
            />

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-purple-600">
                  {selectedDayStr}: Plan & events
                </h3>
              </div>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                    placeholder="New event or class"
                    className="flex-1 rounded-xl border border-purple-200 px-3 py-2 text-xs bg-white/80"
                  />
                  <select
                    value={newEventType}
                    onChange={(e) => setNewEventType(e.target.value)}
                    className="rounded-xl border border-purple-200 px-2 py-2 text-xs bg-white/80"
                  >
                    <option value="study">Study</option>
                    <option value="class">Class</option>
                    <option value="personal">Personal</option>
                  </select>
                </div>
                <div className="flex gap-2 items-center text-xs">
                  <input
                    type="time"
                    value={newEventTime}
                    onChange={(e) => setNewEventTime(e.target.value)}
                    className="rounded-xl border border-purple-200 px-2 py-1 bg-white/80 flex-1"
                  />
                  <span className="text-purple-400">to</span>
                  <input
                    type="time"
                    value={newEventEndTime}
                    onChange={(e) => setNewEventEndTime(e.target.value)}
                    className="rounded-xl border border-purple-200 px-2 py-1 bg-white/80 flex-1"
                  />
                </div>
                <textarea
                  value={newEventNotes}
                  onChange={(e) => setNewEventNotes(e.target.value)}
                  placeholder="Optional notes or link"
                  className="w-full rounded-xl border border-purple-200 px-3 py-2 text-xs bg-white/80 resize-none h-16"
                />
                <button
                  onClick={handleCreateEvent}
                  disabled={!newEventTitle.trim() || !user}
                  className="w-full rounded-2xl bg-gradient-to-r from-purple-400 to-blue-400 text-white text-xs font-semibold py-2 shadow-md hover:shadow-lg disabled:opacity-50"
                >
                  Add event
                </button>
              </div>

              <div className="mt-3 max-h-36 overflow-y-auto space-y-2">
                {dayEvents.length === 0 && selectedDayEntries.length === 0 ? (
                  <p className="text-xs text-purple-400">
                    No events or entries for this day yet.
                  </p>
                ) : (
                  <>
                    {dayEvents.map((event) => (
                      <div
                        key={event.id}
                        className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-2 text-xs flex justify-between gap-2"
                      >
                        <div>
                          <div className="font-semibold text-purple-700">
                            {event.title}
                          </div>
                          <div className="text-[11px] text-purple-500">
                            {new Date(event.start).toLocaleTimeString(
                              undefined,
                              { hour: '2-digit', minute: '2-digit' }
                            )}{' '}
                            –{' '}
                            {new Date(event.end).toLocaleTimeString(
                              undefined,
                              { hour: '2-digit', minute: '2-digit' }
                            )}{' '}
                            • {event.type}
                          </div>
                          {event.notes && (
                            <div className="text-[11px] text-purple-400 mt-1">
                              {event.notes}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteEvent(event)}
                          className="text-[11px] text-rose-500 hover:text-rose-600"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                    {selectedDayEntries.length > 0 && (
                      <div className="pt-1 border-t border-purple-100 mt-1">
                        <div className="text-[11px] text-purple-500 mb-1">
                          Diary snippets
                        </div>
                        {selectedDayEntries.map((entry) => (
                          <div
                            key={entry.id}
                            className="text-[11px] text-purple-600 bg-white/70 rounded-lg px-2 py-1 mb-1 line-clamp-2"
                          >
                            {entry.content}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-2xl font-bold text-purple-600">Previous Entries</h3>
        {entries.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 text-center">
            <p className="text-purple-400 text-lg">
              No entries yet. Start writing your first diary entry!
            </p>
          </div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg p-6 transform hover:scale-105 transition-all"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="text-sm text-purple-400">
                  {new Date(entry.created_at).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(entry)}
                    className="px-4 py-2 bg-blue-400 text-white rounded-xl hover:bg-blue-500 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="p-2 bg-red-400 text-white rounded-xl hover:bg-red-500 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <p className="text-purple-700 whitespace-pre-wrap">{entry.content}</p>
            </div>
          ))
        )}
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(5deg); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(-5deg); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float-delayed 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
