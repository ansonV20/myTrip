export const getBrowserLocation = (): Promise<{ lat: number; lng: number }> => {
	return new Promise((resolve, reject) => {
		if (!navigator.geolocation) {
			reject(new Error('Geolocation is not supported by this browser'));
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				resolve({
					lat: pos.coords.latitude,
					lng: pos.coords.longitude,
				});
			},
			(err) => {
				reject(err);
			},
			{
				enableHighAccuracy: true,
				timeout: 10000,
				maximumAge: 60000,
			}
		);
	});
};

const parseLatLng = (value: { lat: number; lng: number } | string): { lat: number; lng: number } | null => {
	if (typeof value === 'string') {
		const [latStr, lngStr] = value.split(',');
		const lat = Number(latStr);
		const lng = Number(lngStr);
		if (Number.isFinite(lat) && Number.isFinite(lng)) {
			return { lat, lng };
		}
		return null;
	}
	if (Number.isFinite(value.lat) && Number.isFinite(value.lng)) {
		return value;
	}
	return null;
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const getStraightLineDistanceMeters = (origin: { lat: number; lng: number }, destination: { lat: number; lng: number }) => {
	const earthRadiusMeters = 6371000;
	const deltaLat = toRadians(destination.lat - origin.lat);
	const deltaLng = toRadians(destination.lng - origin.lng);
	const lat1 = toRadians(origin.lat);
	const lat2 = toRadians(destination.lat);
	const a =
		Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
		Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
	return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Calculate distance from coordinates already parsed from Google Maps JSON.
export const getDistanceFromGoogle = (
	origin: { lat: number; lng: number } | string,
	destinationAddress: string
): Promise<number | null> => {
	return new Promise((resolve) => {
		const originPoint = parseLatLng(origin);
		const destinationPoint = parseLatLng(destinationAddress);
		if (!originPoint || !destinationPoint) {
			console.error('Unable to parse coordinates for distance calculation', { origin, destinationAddress });
			resolve(null);
			return;
		}
		resolve(getStraightLineDistanceMeters(originPoint, destinationPoint));
	});
};
