import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTimeline, type TimelineItem } from './db';
import { ShowBox } from './components/showBox';
import { DirectionsMap } from './components/DirectionsMap';
import { EditPlanDialog } from './components/EditPlanDialog';
import { AddPlanDialog } from './components/AddPlanDialog';
import { FaDatabase, FaCheck } from 'react-icons/fa';
import { MdEdit } from "react-icons/md";
import './App.css';

function App() {
  const navigate = useNavigate();
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editingItem, setEditingItem] = useState<TimelineItem | null>(null);
  const [selectedDay, setSelectedDay] = useState<'all' | string>('all');
  const [addingDay, setAddingDay] = useState<string | null>(null);

  useEffect(() => {
    const fetchTimeline = async () => {
      const data = await getTimeline();
      setTimeline(data);
    };

    fetchTimeline();
  }, []);

  const refreshTimeline = async () => {
    const data = await getTimeline();
    setTimeline(data);
  };

  // Generate unique list of days present in the timeline (YYYY-MM-DD, local time)
  const dayKey = (iso: string) => {
    const d = new Date(iso);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const days = useMemo(() => {
    const keys = Array.from(new Set(timeline.map((t) => dayKey(t.time))));
    keys.sort();
    return keys;
  }, [timeline]);

  // Grouped view replaces direct visible list

  const dayGroups = useMemo(() => {
    const daysToShow = selectedDay === 'all' ? days : [selectedDay];
    // Helper: for an item in the global timeline, if it's a "Walk around" plan,
    // use the previous plan's location as its effective location.
    const getAdjustedItem = (it: TimelineItem): TimelineItem => {
      if (it.type !== 'plan') return it;
      const isWalkAround = (it.place?.name || '').trim().toLowerCase() === 'walk around';
      if (!isWalkAround) return it;
      // Find previous plan in the global timeline (sorted already)
      const idx = timeline.indexOf(it);
      if (idx <= 0) return it;
      for (let j = idx - 1; j >= 0; j--) {
        const prev = timeline[j];
        if (prev.type === 'plan' && prev.place?.loc) {
          return {
            ...(it as any),
            place: { ...(it.place || {}), loc: prev.place.loc },
          } as TimelineItem;
        }
      }
      return it;
    };

    return daysToShow.map((d) => {
      const itemsForDay = timeline.filter((t) => dayKey(t.time) === d);
      const adjustedItems = itemsForDay.map(getAdjustedItem);
      return {
        day: d,
        items: adjustedItems,
      };
    });
  }, [timeline, days, selectedDay]);

  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-row items-center justify-between mb-4">
        <h1 className="text-[50px] font-black">Osaka Trip</h1>
        <div className="flex flex-col items-center justify-start gap-2">
          <button
            className={`rounded-full bg-gray-500 text-white text-xs p-1.5`}
            onClick={() => setEditMode((v) => !v)}
          >
            {editMode ? <FaCheck /> : <MdEdit />}
          </button>
          <button
            className={`rounded-full bg-gray-500 text-white text-xs p-1.5`}
            onClick={() => navigate('/database')}
          >
            <FaDatabase />
          </button>
        </div>
      </div>
      {/* Day selector */}
      <div className="mb-8 flex flex-wrap gap-2">
        {days.map((d) => {
          const [, month, day] = d.split('-');
          const display = `${day}/${month}`;
          return (
        <button
          key={d}
          className={`px-5 py-2 rounded-3xl shadow-sm`}
          style={{
            boxShadow: selectedDay === d ? "inset 3px 3px 6px #A3A3A3FF, inset -3px -3px 6px #F0F0F0FF" : undefined
          }}
          onClick={() => setSelectedDay(d)}
        >
          {display}
        </button>
          );
        })}
        <button
          className="px-5 py-2 rounded-3xl shadow-sm"
          style={{
            boxShadow: selectedDay === 'all' ? "inset 3px 3px 6px #A3A3A3FF, inset -3px -3px 6px #F0F0F0FF" : undefined
          }}
          onClick={() => setSelectedDay('all')}
        >
          All
        </button>
      </div>

      <div className="timeline gap-10 flex flex-col">
        {dayGroups.map((group) => {
          const items = group.items;
          return (
            <div key={group.day} className="flex flex-col gap-6 ">
              {/* Optional day header when viewing all */}
              {selectedDay === 'all' && (
                <div className='flex flex-row w-full items-center gap-4'>
                  <h2 className="text-xl font-bold text-gray-700">
                    {(() => {
                      const [, m, d] = group.day.split('-');
                      return `${d}/${m}`;
                    })()}
                  </h2>
                  <hr className='text-gray-700 border-dashed w-full' />
                </div>
              )}

              {items.map((item, index) => (
                <div key={`${group.day}-${index}`} className="timeline-item">
                  <div className="timeline-content">
                    <ShowBox
                      item={item}
                      showEdit={editMode}
                      onEdit={(itm) => setEditingItem(itm)}
                    />
                    {item.type === 'plan' &&
                      index < items.length - 1 &&
                      items[index + 1].type === 'plan' &&
                      (items[index + 1] as any).place.name.toLowerCase() !== 'walk around' &&
                      item.place.loc &&
                      (items[index + 1] as any).place.loc && (
                        <div className="mt-6">
                          <DirectionsMap
                            origin={item.place.loc}
                            destination={(items[index + 1] as any).place.loc}
                          />
                        </div>
                      )}
                  </div>
                </div>
              ))}

              {/* Add button below this day's schedule when in edit mode */}
              {editMode && (
                <div className="flex justify-center">
                  <button
                    className="px-4 py-2 rounded-full border border-dashed border-gray-400 text-gray-700 hover:bg-gray-100"
                    onClick={() => setAddingDay(group.day)}
                  >
                    + Add schedule
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <EditPlanDialog
        isOpen={!!editingItem}
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSaved={refreshTimeline}
      />

      <AddPlanDialog
        open={addingDay != null}
        defaultDay={addingDay ?? undefined}
        onClose={() => setAddingDay(null)}
        onSaved={refreshTimeline}
      />
    </div>
  );
}

export default App;
