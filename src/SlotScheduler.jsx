import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

export default function SlotScheduler() {
  const [events, setEvents] = useState([]);
  const [name, setName] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [location, setLocation] = useState('LL');
  const [manualDate, setManualDate] = useState('');
  const [startTime, setStartTime] = useState('06:00');
  const [endTime, setEndTime] = useState('06:30');

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

  const handleManualBook = async () => {
    if (!name || !manualDate || !startTime || !endTime) {
      alert("Please fill in name, date, start and end times.");
      return;
    }

    const start = new Date(`${manualDate}T${startTime}:00`);
    const end = new Date(`${manualDate}T${endTime}:00`);

    const overlap = events.some(event => {
      if (event.extendedProps.location !== location) return false;
      const existingStart = new Date(event.start);
      const existingEnd = new Date(event.end);
      return start < existingEnd && end > existingStart;
    });

    if (overlap) {
      alert("This slot is already booked at this time. Please choose another time or location.");
      return;
    }

    const { error } = await supabase.from('slots').insert({
      name,
      location,
      start,
      end
    });

    if (!error) {
      await fetchEvents();
      setManualDate('');
      setStartTime('06:00');
      setEndTime('06:30');
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4 items-center">
            <input
              type="text"
              className="p-2 border rounded"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              type="date"
              className="p-2 border rounded"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
            />
            <input
              type="time"
              className="p-2 border rounded"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
            <input
              type="time"
              className="p-2 border rounded"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="p-2 border rounded"
            >
              <option value="LL">LL</option>
              <option value="LR">LR</option>
              <option value="RL">RL</option>
              <option value="RR">RR</option>
            </select>
          </div>
          <button
            onClick={handleManualBook}
            className="mb-4 bg-green-500 hover:bg-green-600 text-white font-medium px-4 py-2 rounded"
          >
            Book Slot
          </button>
          <FullCalendar
            plugins={[timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            selectable={true}
            events={events}
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