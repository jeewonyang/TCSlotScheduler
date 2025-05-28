import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

const supabase = createClient('https://YOUR_SUPABASE_URL', 'YOUR_SUPABASE_ANON_KEY');

export default function SlotScheduler() {
  const [events, setEvents] = useState([]);
  const [name, setName] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [location, setLocation] = useState('LL');

  const locationColors = {
    LL: 'blue',
    LR: 'green',
    RL: 'orange',
    RR: 'purple'
  };

  const fetchEvents = async () => {
    const { data } = await supabase.from('slots').select();
    const formatted = data.map(slot => ({
      id: slot.id,
      title: slot.name + ' (' + slot.location + ')',
      start: slot.start,
      end: slot.end,
      backgroundColor: locationColors[slot.location] || 'gray',
      borderColor: locationColors[slot.location] || 'gray',
      extendedProps: {
        name: slot.name,
        location: slot.location
      }
    }));
    setEvents(formatted);
  };

  useEffect(() => {
    fetchEvents();

    const slotSubscription = supabase
      .channel('public:slots')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'slots' }, () => {
        fetchEvents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(slotSubscription);
    };
  }, []);

  const handleSelect = (info) => {
    if (!name) {
      alert("Please enter your name before booking a slot.");
      return;
    }
    setSelectedTime({ start: info.startStr, end: info.endStr });
  };

  const handleBook = async () => {
    if (!selectedTime || !name) return;

    const newStart = new Date(selectedTime.start);
    const newEnd = new Date(selectedTime.end);

    const overlap = events.some(event => {
      const existingStart = new Date(event.start);
      const existingEnd = new Date(event.end);
      return newStart < existingEnd && newEnd > existingStart;
    });

    if (overlap) {
      alert("This time slot is already booked. Please choose another time.");
      return;
    }

    const { error } = await supabase.from('slots').insert({
      name,
      location,
      start: selectedTime.start,
      end: selectedTime.end
    });

    if (!error) {
      await fetchEvents();
      setSelectedTime(null);
    }
  };

  const handleEventClick = (info) => {
    setSelectedEvent(info.event);
  };

  const handleCancel = async () => {
    if (!selectedEvent || selectedEvent.extendedProps.name !== name) {
      alert("You can only cancel bookings made under your name.");
      return;
    }

    const { error } = await supabase.from('slots').delete().eq('id', selectedEvent.id);

    if (!error) {
      setSelectedEvent(null);
      await fetchEvents();
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-6xl mx-auto bg-white p-6 rounded-xl shadow-md grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-3">
          <h1 className="text-3xl font-bold text-center text-blue-700 mb-4">TC Hood Scheduler</h1>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
            <input
              type="text"
              className="w-full md:w-1/3 p-2 border rounded"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full md:w-1/4 p-2 border rounded"
            >
              <option value="LL">LL</option>
              <option value="LR">LR</option>
              <option value="RL">RL</option>
              <option value="RR">RR</option>
            </select>
            {selectedTime && (
              <button
                onClick={handleBook}
                className="bg-green-500 hover:bg-green-600 text-white font-medium px-4 py-2 rounded"
              >
                Book
              </button>
            )}
          </div>
          <FullCalendar
            plugins={[timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            selectable={true}
            events={events}
            select={handleSelect}
            eventClick={handleEventClick}
            allDaySlot={false}
            slotDuration="00:30:00"
            slotMinTime="06:00:00"
            height="auto"
            eventContent={renderEventContent}
          />
        </div>
        <div className="bg-gray-50 p-4 rounded-lg shadow-inner">
          <h2 className="text-xl font-semibold mb-2">Booking Details</h2>
          {selectedEvent ? (
            <div className="space-y-2">
              <p><strong>Name:</strong> {selectedEvent.extendedProps.name}</p>
              <p><strong>Location:</strong> {selectedEvent.extendedProps.location}</p>
              <p><strong>Start:</strong> {new Date(selectedEvent.start).toLocaleString()}</p>
              <p><strong>End:</strong> {new Date(selectedEvent.end).toLocaleString()}</p>
              {selectedEvent.extendedProps.name === name && (
                <button
                  onClick={handleCancel}
                  className="mt-2 bg-red-500 hover:bg-red-600 text-white font-medium px-3 py-1 rounded"
                >
                  Cancel Booking
                </button>
              )}
            </div>
          ) : (
            <p className="text-gray-500">Click on a booking to see details.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function renderEventContent(eventInfo) {
  return (
    <div title={`Booked by ${eventInfo.event.extendedProps.name} (${eventInfo.event.extendedProps.location})`}>
      {eventInfo.event.title}
    </div>
  );
}