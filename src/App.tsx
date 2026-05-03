import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTimeline, getPlaces, getLocationFromGoogleMapsJson, type TimelineItem, type Plan, type Place } from './db';
import { weatherData, type WeatherData } from './weather';
import { ShowBox } from './components/showBox';
import { DirectionsMap } from './components/DirectionsMap';
import { EditPlanDialog } from './components/EditPlanDialog';
import { AddPlanDialog } from './components/AddPlanDialog';
import { ShowWeather } from './components/showWeather';
import { ShowExchange } from './components/showExchange';
import { getHkdToJpyRate, formatNumber } from './exchangeRates';
import { MultiDestinationMapLink } from './components/MultiDestinationMapLink';
import { getBrowserLocation, getDistanceFromGoogle } from './components/showPlaceLocation';
import { FaDatabase, FaCheck } from 'react-icons/fa';
import { MdEdit, MdOutlineRefresh } from "react-icons/md";
import { IoMdRainy } from "react-icons/io";
import { FaSnowflake } from "react-icons/fa";
import './App.css';

type WeatherState = WeatherData | null;

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
  const [weather, setWeather] = useState<WeatherState>(null);
  const [detailWeather, setDetailWeather] = useState<boolean>(false);
  const [exchangeOpen, setExchangeOpen] = useState<boolean>(false);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [currentDisplayTemp, setCurrentDisplayTemp] = useState<number | null>(null);

  useEffect(() => {
    // // Avoid double-run in React 18 StrictMode (dev)
    // let ran = (window as any).__WEATHER_FETCH_RAN__;
    // if (ran) return;
    // (window as any).__WEATHER_FETCH_RAN__ = true;

    const fetchWeather = async () => {
      try {
        const data = await weatherData();
        setWeather(data);
        // just before the JSX return, derive a helper:
        if (
          data != null &&
          data.current?.time != null &&
          data.hourly?.temperature != null &&
          Array.isArray(data.hourly.temperature)
        ) {
          const base = data.current.time;        // time of first hourly entry
          const now = new Date();
          const diffMs = now.getTime() - base.getTime();
          const hoursFromBase = Math.floor(diffMs / (60 * 60 * 1000));
          if (hoursFromBase < 0) {
            setCurrentDisplayTemp(
              data.current.temperature != null ? data.current.temperature : null
            );
            return;
          } else {
            const temps = data.hourly.temperature;
            const idx = Math.min(hoursFromBase, temps.length - 1);
            const temp = temps[idx];
            setCurrentDisplayTemp(Number.isFinite(temp) ? temp : null);
            return;
          }
        } else {
          setCurrentDisplayTemp(null);
          return;
        }
      } catch (error) {
        console.error('Failed to fetch weather data', error);
      }
    };

    fetchWeather();
  }, []);

  useEffect(() => {
    const fetchRate = async () => {
      try {
        const r = await getHkdToJpyRate();
        setExchangeRate(r);
      } catch (e) {
        console.error('Failed to fetch exchange rate', e);
      }
    };

    fetchRate();
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
          // Try loc first, then extract from google_maps_json, then fall back to name
          const address = place.loc || getLocationFromGoogleMapsJson(place.google_maps_json) || place.name;
          if (!address) {
	            // console.log('[near] skip  no address for place', place.name);
	            return { place, distanceMeters: Number.POSITIVE_INFINITY };
          }
          const originParam = originPlace
            ? (originPlace.loc || getLocationFromGoogleMapsJson(originPlace.google_maps_json) || originPlace.name || '')
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
        time: '' as any,
        stay: undefined,
        tid: 'near',
        pid: `near-${place.id}-${idx}`,
        info: undefined,
        utc: 0,
        type: 'plan',
        typeName: nearDistances[place.id] != null ? `${(nearDistances[place.id] / 1000).toFixed(2)} km away` : 'near',
        place,
      } as Plan));
      return [{ day: 'near', items: fakeItems }];
    }

    const daysToShow = selectedDay === 'all' ? days : [selectedDay];
    // Helper: check if a type is a non-location type (uses previous plan's location)
    const isNonLocationType = (typeName?: string) => {
      return typeName === 'Walk around' || typeName === 'Find eat';
    };
    // Helper: for an item in the global timeline, if it's a non-location type plan,
    // use the previous plan's location as its effective location.
    const getAdjustedItem = (it: TimelineItem): TimelineItem => {
      if (it.type !== 'plan') return it;
      const isNonLoc = isNonLocationType((it as any).typeName);
      if (!isNonLoc) return it;
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
      <div className="flex flex-row items-start mb-4">
        <h1 className="text-[50px] font-black">Trip</h1>
        <div className="flex flex-col items-center justify-between ml-auto gap-2">
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
      <div className='flex flex-row gap-4 mb-6'>
        <button onClick={() => setDetailWeather((v) => !v)} 
        className="w-full h-20 rounded-3xl shadow-sm flex flex-row items-center justify-center gap-3"
        style={{
          boxShadow: "inset 3px 3px 6px #A3A3A3FF, inset -3px -3px 6px #F0F0F0FF"
        }}>
          {/* Temperature (current if available, otherwise first hourly) */}
          <div className=' text-left'>
          <p
          className={`font-bold text-xl ${
            weather?.current?.temperature != null && weather.current.temperature <= 0
            ? 'text-orange-700'
            : weather?.current?.temperature != null && weather.current.temperature < 10
            ? 'text-blue-800'
            : weather?.current?.temperature != null && weather.current.temperature < 15
            ? 'text-blue-500'
            : ''
          }`}
          >
          {currentDisplayTemp != null
          ? `${currentDisplayTemp.toFixed(1)}°C`
          : '---'}
          </p>
          <p className='text-xs font-normal'>
            {weather?.current?.tempRange != null && Array.isArray(weather.current.tempRange) && weather.current.tempRange.length === 2
              ? `${weather.current.tempRange[0].toFixed(1)}°C - ${weather.current.tempRange[1].toFixed(1)}°C`
              : ''}
          </p>
          </div>

          {/* Icons based on precipitation type and existing rain/snow values */}
          <div className="flex flex-row items-center text-xl gap-1">
            {weather?.current?.precipitationType != null && (() => {
              const t = Math.round(weather.current!.precipitationType);
              if (t === 1) return <IoMdRainy />;
              if (t === 2) return <FaSnowflake />;
              if (t === 3) return <IoMdRainy />; // freezing rain -> rain icon
              if (t === 4) return <FaSnowflake />; // sleet -> snow icon
              return null;
            })()}
            {/* fallback to original icons if type not available */}
            {weather?.current?.precipitationType == null && (
              <>
              {weather?.current?.rain != null && weather.current.rain >= 1 && <IoMdRainy />}
              {weather?.current?.snowfall != null && weather.current.snowfall > 0 && <FaSnowflake />}
              </>
            )}
          </div>
        </button>
        <button 
          className="w-full h-20 rounded-3xl shadow-sm flex flex-col items-center justify-center"
          style={{
            boxShadow: "inset 3px 3px 6px #A3A3A3FF, inset -3px -3px 6px #F0F0F0FF"
          }}
          onClick={() => setExchangeOpen(true)}
        >
          <p className="text-xs text-gray-600">HKD ⇄ JPY</p>
          <p className="font-bold text-xl text-gray-800 mt-1">
            {exchangeRate != null
              ? `${formatNumber(1 / exchangeRate, 4)}`
              : 'Loading...'}
          </p>
        </button>
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
                console.log('Rendering item', item),
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
                      !['Walk around', 'Find eat'].includes((items[index + 1] as any).typeName) &&
                      item.place.loc &&
                      (items[index + 1] as any).place.loc && (
                        <div className="mt-6">
                          <DirectionsMap
                            origin={[item.place.loc!, item.place.name!]}
                            destination={[ (items[index + 1] as any).place.loc!, (items[index + 1] as any).place.name ]}
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

      <ShowExchange
        open={exchangeOpen}
        onClose={() => setExchangeOpen(false)}
      />
    </div>
  );
}

export default App;
