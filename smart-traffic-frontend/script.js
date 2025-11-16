document.addEventListener('DOMContentLoaded', function() {
    const trafficStatusDiv = document.getElementById('traffic-status');

    // Initialize the Leaflet map
    const map = L.map('mapid').setView([28.7050, 77.1030], 15); // Centered around one of the example traffic lights

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    let trafficLightMarkers = {}; // Store Leaflet markers for traffic lights

    // Function to create a custom icon for traffic lights
    function createTrafficLightIcon(greenTime) {
        let color = 'red'; // Default to red
        if (greenTime > 0) {
            color = 'green'; // If greenTime is positive, assume green
        }
        
        return L.divIcon({
            className: 'custom-traffic-light-icon',
            html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid black;"></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
    }

    // WebSocket connection to FastAPI backend
    const websocket = new WebSocket("ws://127.0.0.1:8000/ws");

    websocket.onopen = function(event) {
        console.log("WebSocket connected!");
        trafficStatusDiv.innerHTML = "Connected to traffic data.";
    };

    websocket.onmessage = function(event) {
        // Assuming the message is JSON data
        const data = JSON.parse(event.data);
        console.log("Received data:", data);

        const laneId = data.lane_id;
        const vehicleCount = data.vehicle_count;
        const greenTime = data.green_time;
        const latitude = data.latitude;
        const longitude = data.longitude;

        if (latitude !== null && longitude !== null) {
            if (trafficLightMarkers[laneId]) {
                // Update existing marker
                trafficLightMarkers[laneId].setIcon(createTrafficLightIcon(greenTime));
                trafficLightMarkers[laneId].setLatLng([latitude, longitude]);
                trafficLightMarkers[laneId].setPopupContent(`<b>Lane ${laneId}</b><br>Vehicles: ${vehicleCount}<br>Green Time: ${greenTime}s`);
            } else {
                // Create new marker
                const marker = L.marker([latitude, longitude], { icon: createTrafficLightIcon(greenTime) }).addTo(map);
                marker.bindPopup(`<b>Lane ${laneId}</b><br>Vehicles: ${vehicleCount}<br>Green Time: ${greenTime}s`);
                trafficLightMarkers[laneId] = marker;
            }
        }

        // Update status div
        trafficStatusDiv.innerHTML = `<h2>Traffic Status for Lane ${laneId}:</h2>
                                      <p>Vehicles Detected: ${vehicleCount}</p>
                                      <p>Green Light Duration: ${greenTime} seconds</p>`;
    };

    websocket.onerror = function(error) {
        console.error("WebSocket Error:", error);
        trafficStatusDiv.innerHTML = '<p style="color: red;">WebSocket Error. Check console for details.</p>';
    };

    websocket.onclose = function(event) {
        console.log("WebSocket closed:", event);
        trafficStatusDiv.innerHTML = '<p style="color: red;">WebSocket Disconnected.</p>';
    };
});