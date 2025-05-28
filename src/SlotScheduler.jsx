import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://YOUR_SUPABASE_URL', 'YOUR_SUPABASE_ANON_KEY');

export default function SlotScheduler() {
  const [slots, setSlots] = useState(null);
  const [name, setName] = useState('');

  useEffect(() => {
    const fetchSlots = async () => {
      const { data } = await supabase.from('slots').select();
      setSlots(data);
    };

    const slotSubscription = supabase
      .channel('public:slots')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'slots' }, () => {
        fetchSlots();
      })
      .subscribe();

    fetchSlots();

    return () => {
      supabase.removeChannel(slotSubscription);
    };
  }, []);

  const bookSlot = async (id) => {
    if (!name) return;
    await supabase.from('slots').update({ name }).eq('id', id);
  };

  const cancelSlot = async (id) => {
    await supabase.from('slots').update({ name: null }).eq('id', id);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white shadow-2xl rounded-2xl p-6 w-full max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold text-center text-blue-700">Machine Slot Scheduler</h1>
        <p className="text-center text-gray-600">Sign up for a slot by entering your name and clicking an available time.</p>

        <input
          type="text"
          className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        {slots === null ? (
          <p className="text-center text-gray-500">Loading slots...</p>
        ) : (
          <ul className="space-y-3">
            {slots.map(slot => (
              <li
                key={slot.id}
                className={`p-5 rounded-xl flex justify-between items-center border shadow-sm ${slot.name ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}
              >
                <div>
                  <p className="text-lg font-semibold">{slot.time}</p>
                  <p className="text-sm text-gray-600">{slot.name ? `Booked by ${slot.name}` : 'Available'}</p>
                </div>
                {!slot.name ? (
                  <button
                    className="bg-green-500 hover:bg-green-600 text-white font-medium px-4 py-2 rounded-xl transition"
                    onClick={() => bookSlot(slot.id)}
                    disabled={!name}
                  >
                    Sign Up
                  </button>
                ) : slot.name === name ? (
                  <button
                    className="bg-red-500 hover:bg-red-600 text-white font-medium px-4 py-2 rounded-xl transition"
                    onClick={() => cancelSlot(slot.id)}
                  >
                    Cancel
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}