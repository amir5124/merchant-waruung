// app.config.js
const MAPS_KEY = 'AIzaSyCQOfitYRU7iAHMRaj0dwcrI8-UQIiFPWI';

module.exports = ({ config }) => ({
    ...config,
    ios: {
        ...config.ios,
        config: {
            googleMapsApiKey: MAPS_KEY,
        },
    },
    android: {
        ...config.android,
        googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
        config: {
            googleMaps: {
                apiKey: MAPS_KEY,
            },
        },
    },
});