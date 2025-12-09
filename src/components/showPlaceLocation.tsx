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

// Call Google Directions API (via JS Maps SDK) to get walking distance in meters
export const getDistanceFromGoogle = (
	origin: { lat: number; lng: number } | string,
	destinationAddress: string
): Promise<number | null> => {
	return new Promise((resolve) => {
		if (typeof google === 'undefined' || !google.maps?.DirectionsService) {
			console.error('Google Maps JS API not loaded for distance calculation');
			resolve(null);
			return;
		}
		const service = new google.maps.DirectionsService();
		service.route(
			{
				origin,
				destination: destinationAddress,
				travelMode: google.maps.TravelMode.WALKING,
			},
			(result, status) => {
				if (status === 'OK' && result?.routes?.[0]?.legs?.[0]?.distance) {
					const meters = result.routes[0].legs[0].distance!.value;
					resolve(meters);
				} else {
					console.error('Directions request failed for', destinationAddress, status);
					resolve(null);
				}
			}
		);
	});
};
