import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTimeline, getPlaces, type TimelineItem, type Plan, type Place } from './db';
import { weatherData } from './weather';
import { ShowBox } from './components/showBox';
import { DirectionsMap } from './components/DirectionsMap';
import { EditPlanDialog } from './components/EditPlanDialog';
import { AddPlanDialog } from './components/AddPlanDialog';
import { ShowWeather } from './components/showWeather';
import { MultiDestinationMapLink } from './components/MultiDestinationMapLink';
import { getBrowserLocation, getDistanceFromGoogle } from './components/showPlaceLocation';
import { FaDatabase, FaCheck } from 'react-icons/fa';
import { MdEdit, MdOutlineRefresh } from "react-icons/md";
import { IoMdRainy } from "react-icons/io";
import { FaSnowflake } from "react-icons/fa";
import './App.css';

interface weatherData {
  current?: {
    time: Date;
    temperature_2m: number;
    rain: number;
    snowfall: number;
    apparent_temperature: number;
  };
  hourly?: {
    temperature_2m: number[];
    rain: number[];
    snowfall: number[];
  };
}

function App() {
  const navigate = useNavigate();
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editingItem, setEditingItem] = useState<TimelineItem | null>(null);
  const [selectedDay, setSelectedDay] = useState<'all' | string>('all');
  const [addingDay, setAddingDay] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [nearMode, setNearMode] = useState(false);
  const [nearDistances, setNearDistances] = useState<Record<string, number>>({});
  const [originPlaceId, setOriginPlaceId] = useState<string | null>(null);
  const [weather, setWeather] = useState<weatherData | null>(null);
  const [detailWeather, setDetailWeather] = useState<boolean>(false);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const data = await weatherData();
        setWeather(data);
      } catch (error) {
        console.error('Failed to fetch weather data', error);
      }
    };

    fetchWeather();
  }, []);

  useEffect(() => {
    const fetchTimeline = async () => {
      const data = await getTimeline();
      setTimeline(data);
      const placeData = await getPlaces();
      setPlaces(placeData);
    };

    fetchTimeline();
  }, []);

  const refreshTimeline = async () => {
    const data = await getTimeline();
    setTimeline(data);
    const placeData = await getPlaces();
    setPlaces(placeData);
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

  const [nearPlaces, setNearPlaces] = useState<Place[] | null>(null);

  useEffect(() => {
    const updateNearPlaces = async () => {
      if (!nearMode || (!userLocation && !originPlaceId)) {
        setNearPlaces(null);
        setNearDistances({});
        return;
      }
      const allPlaces = places;
      const originPlace = originPlaceId ? places.find((p) => p.id === originPlaceId) : null;
      const results = await Promise.all(
        allPlaces.map(async (place) => {
          const address = place.loc || place.name;
          if (!address) {
	            // console.log('[near] skip  no address for place', place.name);
	            return { place, distanceMeters: Number.POSITIVE_INFINITY };
          }
          const originParam = originPlace
            ? (originPlace.loc || originPlace.name || '')
            : userLocation
            ? { lat: userLocation.lat, lng: userLocation.lng }
            : '';
          const meters = await getDistanceFromGoogle(originParam, address);
          if (meters == null) {
	            // console.log('[near] no distance from Google for', place.name, address);
	            return { place, distanceMeters: Number.POSITIVE_INFINITY };
          }
	          // console.log('[near distance]', place.name, `${(meters / 1000).toFixed(2)} km`);
	          return { place, distanceMeters: meters };
        })
      );

      const sorted = results
        .sort((a, b) => a.distanceMeters - b.distanceMeters)
          .map(({ place, distanceMeters }) => ({ place, distanceMeters }));

        const placesOnly = sorted.map((x) => x.place);
        const distanceMap: Record<string, number> = {};
        sorted.forEach(({ place, distanceMeters }) => {
          distanceMap[place.id] = distanceMeters;
        });
        setNearPlaces(placesOnly);
        setNearDistances(distanceMap);
    };

    updateNearPlaces();
  }, [nearMode, userLocation, places]);

  const dayGroups = useMemo(() => {
    if (nearMode && nearPlaces) {
      // Near mode: render a single pseudo-day using nearest places wrapped as fake plans
      const fakeItems: TimelineItem[] = nearPlaces.map((place, idx) => ({
        time: new Date().toISOString(),
        stay: undefined,
        tid: 'near',
        pid: `near-${place.id}-${idx}`,
        info: place.info,
        utc: 0,
        type: 'plan',
        typeName: nearDistances[place.id] != null ? `${(nearDistances[place.id] / 1000).toFixed(2)} km away` : 'near',
        place,
      } as Plan));
      return [{ day: 'near', items: fakeItems }];
    }

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
  }, [timeline, days, selectedDay, nearMode, nearPlaces, nearDistances]);










  return (
    <div className="container mx-auto p-4">
      <div className="flex flex-col items-start mb-4">
        <div className='flex flex-row items-center justify-between gap-4'>
          <h1 className="text-[50px] font-black">Osaka Trip</h1>
          <button onClick={() => setDetailWeather((v) => !v)} className="">
            <p className={weather?.hourly?.temperature_2m?.[0] != null && weather.hourly.temperature_2m[0] <= 0 ? 'text-orange-700' : weather?.hourly?.temperature_2m?.[0] != null && weather.hourly.temperature_2m[0] < 10 ? 'text-blue-800' : weather?.hourly?.temperature_2m?.[0] != null && weather.hourly.temperature_2m[0] < 15 ? 'text-blue-500' : ''}>{weather?.hourly?.temperature_2m?.[0] != null && `${weather.hourly.temperature_2m[0].toFixed(1)}°C`}</p>
            <p>{weather?.hourly?.rain?.[0] != null && weather.hourly.rain[0] >= 1 && <IoMdRainy />}</p>
            <p>{weather?.hourly?.snowfall?.[0] != null && weather.hourly.snowfall[0] > 0 && <FaSnowflake />}</p>
          </button>
        </div>
        <div className="flex flex-row items-center justify-start gap-2">
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
          onClick={() => {
            // Leaving Near mode when a specific day is selected
            setNearMode(false);
            setOriginPlaceId(null);
            setSelectedDay(d);
          }}
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
          onClick={() => {
            // Leaving Near mode when returning to the full timeline
            setNearMode(false);
            setOriginPlaceId(null);
            setSelectedDay('all');
          }}
        >
          All
        </button>
        <button
          className="px-5 py-2 rounded-3xl shadow-sm"
          style={{
            boxShadow: nearMode ? "inset 3px 3px 6px #A3A3A3FF, inset -3px -3px 6px #F0F0F0FF" : undefined
          }}
          onClick={async () => {
            try {
              const loc = await getBrowserLocation();
              setUserLocation(loc);
              setNearMode(true);
              setSelectedDay('near');
            } catch (e) {
              console.error('Failed to get user location for Near mode', e);
              alert('Unable to get your location. Please allow location access in your browser.');
            }
          }}
        >
          Near
        </button>
      </div>
      {/* Origin selector for Near mode */}
      {nearMode && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-600">Origin:</span>
          <button
            className="px-4 py-1 text-sm rounded-3xl border border-gray-300 bg-white"
            onClick={async () => {
              try {
                const loc = await getBrowserLocation();
                setUserLocation(loc);
                setOriginPlaceId(null);
              } catch (e) {
                console.error('Failed to get browser location for origin', e);
                alert('Unable to get your current location.');
              }
            }}
          >
            Use my current location
          </button>
          <select
            className="px-3 py-1 text-sm rounded-3xl border border-gray-300 bg-white"
            value={originPlaceId ?? ''}
            onChange={async (e) => {
              const pid = e.target.value;
              if (!pid) return;
              const place = places.find((p) => p.id === pid);
              if (!place) return;
              try {
                setOriginPlaceId(pid);
              } catch (err) {
                console.error('Failed to set origin to place', err);
              }
            }}
          >
            <option value="">Choose another place as origin</option>
            {places.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            className="px-3 py-1 text-md border-none bg-white transition-transform duration-500"
            style={{
              animation: 'spin 0.6s linear'
            }}
            onClick={() => {
              if (!nearMode) return;
              setNearMode(false);
              setTimeout(() => setNearMode(true), 0);
            }}
          >
            <MdOutlineRefresh />
          </button>
          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      <div className="timeline gap-10 flex flex-col">
        {dayGroups.map((group) => {
          const items = group.items;
          const locationGroups: string[][] = [];
          let currentGroup: string[] = [];

          for (const item of items) {
            if (item.type === 'plan') {
              // Plan type from db.ts has 'tid'
              const plan = item as Plan;
              if (plan.tid === '0005') {
                if (currentGroup.length > 0) {
                  locationGroups.push(currentGroup);
                }
                currentGroup = [];
              } else if (plan.place?.loc) {
                currentGroup.push(plan.place.loc);
              }
            }
          }

          if (currentGroup.length > 0) {
            locationGroups.push(currentGroup);
          }

          return (
            <div key={group.day} className="flex flex-col gap-6 ">
              {/* Optional day header when viewing all; hide header label in Near mode */}
              {!nearMode && selectedDay && (
                <div className='flex flex-col w-full gap-4'>
                  <div className='flex flex-row w-full items-center gap-4'>
                    <h2 className="text-xl font-bold text-gray-700 text-nowrap">
                      {(() => {
                        const [y, m, d] = group.day.split('-');
                        const date = new Date(Number(y), Number(m) - 1, Number(d));
                        const weekday = date.toLocaleDateString(undefined, { weekday: 'short' }); // e.g. "Mon"
                        return `${d}/${m} · ${weekday}`;
                      })()}
                    </h2>
                    <hr className='text-gray-700 border-dashed w-full' />
                  </div>
                  {locationGroups.map((locations, index) => (
                    <div key={index} className="ml-2">
                      <MultiDestinationMapLink locations={locations} />
                    </div>
                  ))}
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

      {detailWeather && weather && (
        <ShowWeather 
        data={weather} 
        onClose={() => setDetailWeather(false)}
        />
      )}
    </div>
  );
}

export default App;
