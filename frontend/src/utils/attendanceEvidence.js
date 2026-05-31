const LOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 12000,
  maximumAge: 0,
};

export const getDeviceTimeEvidence = () => ({
  deviceTime: new Date().toISOString(),
  deviceTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
  deviceUtcOffsetMinutes: new Date().getTimezoneOffset(),
});

export const requestFreshLocation = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
        });
      },
      () => reject(new Error("Location permission is required for attendance.")),
      LOCATION_OPTIONS,
    );
  });

export const toAttendanceEvidence = (location) => ({
  lat: location?.latitude ?? location?.lat ?? null,
  lng: location?.longitude ?? location?.lng ?? null,
  accuracy: location?.accuracy ?? null,
  capturedAt: location?.capturedAt ?? null,
  ...getDeviceTimeEvidence(),
});
