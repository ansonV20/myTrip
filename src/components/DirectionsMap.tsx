import { useJsApiLoader } from '@react-google-maps/api';
import { memo } from 'react';

// import { FaWalking, FaBus } from 'react-icons/fa';
// import { FaStreetView } from 'react-icons/fa6';

// const containerStyle = {
//   width: '100%',
//   height: '300px',
// };

// interface DirectionsMapProps {
//   origin: string;
//   destination: string;
// }

interface placeData {
  origin: string[];
  destination: string[];
}

function DirectionsMapComponent({ origin, destination }: placeData) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY!,
  });

  // const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  // // Use string literals to avoid referencing global `google` before script loads
  // const [travelMode, setTravelMode] = useState<'WALKING' | 'TRANSIT'>('WALKING');
  // const [routeIndex, setRouteIndex] = useState(0);
  // const [map, setMap] = useState<google.maps.Map | null>(null);
  // const [errorText, setErrorText] = useState<string | null>(null);
  // const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');

  // Reset directions when inputs change to avoid stale routes
  // and to ensure we only request once per change.
  // This also stops the DirectionsService after the first successful response,
  // preventing the blinking caused by repeated fetches.
  // useEffect(() => {
  //   setDirectionsResponse(null);
  //   setErrorText(null);
  //   setRouteIndex(0);
  // }, [origin, destination]);

  // Helpers: allow "lat,lng" or "place_id:..." or free text
  // const toOriginDestination = (val: string): google.maps.DirectionsRequest['origin'] => {
  //   const trimmed = (val || '').trim();
  //   // lat,lng pattern
  //   const m = trimmed.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  //   if (m) {
  //     const lat = parseFloat(m[1]);
  //     const lng = parseFloat(m[2]);
  //     if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
  //       return { lat, lng };
  //     }
  //   }
  //   // place_id:XYZ
  //   const placeIdMatch = trimmed.match(/^place_id:\s*(.+)$/i);
  //   if (placeIdMatch) {
  //     return { placeId: placeIdMatch[1] } as google.maps.Place;
  //   }
  //   // fallback to address string
  //   return trimmed;
  // };

  // const directionsCallback = (
  //   response: google.maps.DirectionsResult | null,
  //   status: google.maps.DirectionsStatus
  // ) => {
  //   if (response !== null) {
  //     if (status === 'OK') {
  //       setDirectionsResponse(response);
  //       setErrorText(null);
  //       setRouteIndex(0);
  //       try {
  //         const r = response.routes?.[0];
  //         if (r?.bounds && map) {
  //           map.fitBounds(r.bounds);
  //         }
  //       } catch (e) {
  //         // ignore fitBounds errors
  //       }
  //     } else {
  //       console.error('Directions request failed due to ' + status);
  //       setDirectionsResponse(null); // Clear previous directions on error
  //       setErrorText(status);
  //     }
  //   }
  // };

  // const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=${travelMode.toLowerCase()}`;
  const googleTransitUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin[0])}&destination=${encodeURIComponent(destination[0])}&travelmode=transit`;

  return (
    isLoaded ? (
      // <div
      //   className="plan-details p-5 rounded-3xl shadow-sm gap-4 flex flex-col"
      //   style={{
      //     boxShadow: "inset 3px 3px 6px #A3A3A3FF, inset -3px -3px 6px #F0F0F0FF"
      //   }}>
      //   <div className="relative">
      //     <div
      //       className="absolute top-0 left-0 z-10 flex gap-3 w-full h-auto rounded-t-xl p-3"
      //       style={{
      //         background: "linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%)"
      //       }}
      //       >
      //       <button
      //         onClick={() => setMapType('roadmap')}
      //         className={`px-3 py-1 rounded-md text-md text-black`}
      //         style={{
      //         background: `${mapType === 'roadmap' ? 'linear-gradient(145deg, #e6e6e6, #ffffff)' : 'linear-gradient(145deg, #ffffff, #e6e6e6)'}`,
      //         boxShadow: `${mapType === 'roadmap' ? 'inset 2px 2px 5px #9C9C9CFF, inset -1px -1px 5px #ffffff' : '2px 2px 4px #8A8A8A5B'}`,
      //         }}
      //       >
      //         Map
      //       </button>
      //       <button
      //         onClick={() => setMapType('satellite')}
      //         className={`px-3 py-1 rounded-md text-md text-black`}
      //         style={{
      //         background: `${mapType === 'satellite' ? 'linear-gradient(145deg, #e6e6e6, #ffffff)' : 'linear-gradient(145deg, #ffffff, #e6e6e6)'}`,
      //         boxShadow: `${mapType === 'satellite'
      //           ? 'inset 2px 2px 5px #9C9C9CFF, inset -1px -1px 5px #ffffff, 2px 2px 4px #bdbdbd55'
      //           : '2px 2px 4px #8A8A8A5B'}`,
      //         }}
      //       >
      //         Satellite
      //       </button>

      //     </div>
      //     <div className="absolute top-3 right-3 z-10">
      //       <button
      //         onClick={() => {
      //           if (!map) return;
      //           const sv = map.getStreetView();
      //           if (!sv) return;
      //           if (sv.getVisible()) {
      //             sv.setVisible(false);
      //           } else {
      //             sv.setPosition(map.getCenter()!);
      //             sv.setPov({ heading: 0, pitch: 0 });
      //             sv.setVisible(true);
      //           }
      //         }}
      //         className="w-8 h-8 bg-white/90 rounded-md shadow flex items-center justify-center hover:bg-white"
      //         title="Street View"
      //       >
      //         <FaStreetView className="text-gray-700" />
      //       </button>
      //     </div>
      //     <GoogleMap
      //       mapContainerStyle={containerStyle}
      //       mapContainerClassName="rounded-xl rounded-bl-none overflow-hidden"
      //       zoom={15}
      //       onLoad={(m) => setMap(m)}
      //       center={{ lat: 0, lng: 0 }}
      //       options={{
      //         mapTypeControl: false,
      //         mapTypeId: mapType as any,
      //         zoomControl: false,
      //         streetViewControl: false,
      //         fullscreenControl: false,
      //       }}
      //     >
      //     {origin && destination && travelMode === 'WALKING' && directionsResponse === null && (
      //       <DirectionsService
      //         key={`${travelMode}-${origin}-${destination}`}
      //         options={{
      //           destination: toOriginDestination(destination),
      //           origin: toOriginDestination(origin),
      //           travelMode: google.maps.TravelMode.WALKING,
      //         }}
      //         callback={directionsCallback}
      //       />
      //     )}
      //     {directionsResponse && (
      //       <DirectionsRenderer
      //         options={{
      //           directions: directionsResponse,
      //           routeIndex,
      //         }}
      //       />
      //     )}
      //     </GoogleMap>
      //     <div className="mt-2 h-auto w-full flex flex-row items-start justify-between">
      //       <div className="flex h-full justify-start items-start flex-wrap gap-2">
      //         <button onClick={() => setTravelMode('WALKING')} className={`px-4 py-2 rounded-bl-xl flex items-center gap-2 text-sm ${travelMode === 'WALKING' ? 'bg-gray-500 text-white' : 'bg-gray-200'}`}>
      //           <FaWalking /> Walking
      //         </button>
      //         <a href={googleTransitUrl} target="_blank" rel="noopener noreferrer" className={`px-4 py-2 rounded-br-xl flex items-center gap-2 text-sm ${travelMode === 'TRANSIT' ? 'bg-gray-500 text-white' : 'bg-gray-200'}`}>
      //           <FaBus /> Transit
      //         </a>
      //       </div>
      //       {directionsResponse && travelMode !== 'TRANSIT' && (() => {
      //         const leg = directionsResponse.routes?.[0]?.legs?.[0];
      //         if (!leg) return null;
      //         return (
      //           <div className="flex flex-col justify-end items-end gap-1 text-sm text-gray-700 ml-auto">
                  
      //           </div>
      //         );
      //       })()}
      //     </div>
      //   </div>

      //   {errorText && (
      //     <div className="mt-2 text-sm text-orange-700">
      //       No route found ({errorText}). Try adjusting origin/destination or open in Google Maps.
      //     </div>
      //   )}
      // </div>
      <div className='w-full flex flex-col items-center justify-center gap-4'>
        <hr className="w-px h-[5px] inline-block border-l-1"></hr>
        <a href={googleTransitUrl} target="_blank" rel="noopener noreferrer">
          <button className="px-5 py-2 rounded-3xl shadow-sm hover:shadow-[inset_3px_3px_6px_#A3A3A3FF,inset_-3px_-3px_6px_#F0F0F0FF] active:shadow-[inset_3px_3px_6px_#A3A3A3FF,inset_-3px_-3px_6px_#F0F0F0FF]">Google Map | {origin[1]} to {destination[1]}</button>
        </a>
        <hr className="w-px h-[5px] inline-block border-l-1"></hr>
        {/* <p>{origin[1]} to {destination[1]}</p> */}
      </div>
    ) : <></>
  );
}

export const DirectionsMap = memo(DirectionsMapComponent);
