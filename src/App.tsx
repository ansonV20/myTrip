import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTimeline, type TimelineItem } from './db';
import { ShowBox } from './components/showBox';
import { DirectionsMap } from './components/DirectionsMap';
import { EditPlanDialog } from './components/EditPlanDialog';
import './App.css';

function App() {
  const navigate = useNavigate();
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editingItem, setEditingItem] = useState<TimelineItem | null>(null);

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

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">My Trip Timeline</h1>
        <div className="flex items-center gap-2">
          <button
            className={`px-3 py-1.5 rounded-md border text-sm ${editMode ? 'border-blue-600 text-white bg-blue-600' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
            onClick={() => setEditMode((v) => !v)}
          >
            {editMode ? 'Done' : 'Edit'}
          </button>
          <button
            className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm"
            onClick={() => navigate('/database')}
          >
            Database
          </button>
        </div>
      </div>
      <div className="timeline gap-6 flex flex-col">
        {timeline.map((item, index) => (
          <div key={index} className="timeline-item">
            <div className="timeline-content">
              <ShowBox
                item={item}
                showEdit={editMode}
                onEdit={(itm) => setEditingItem(itm)}
              />
              {item.type === 'plan' &&
                index < timeline.length - 1 &&
                timeline[index + 1].type === 'plan' &&
                item.place.loc &&
                (timeline[index + 1] as any).place.loc && (
                  <div className="mt-6">
                    <DirectionsMap
                      origin={item.place.loc}
                      destination={(timeline[index + 1] as any).place.loc}
                    />
                  </div>
                )}
            </div>
          </div>
        ))}
      </div>

      <EditPlanDialog
        isOpen={!!editingItem}
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSaved={refreshTimeline}
      />
    </div>
  );
}

export default App;
