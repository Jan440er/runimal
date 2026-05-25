const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const distanceDisplay = document.getElementById('distance');
const statusDisplay = document.getElementById('status');
const collectionList = document.getElementById('collectionList');
const animalCountDisplay = document.getElementById('animalCount');

let watchId = null;
let totalDistance = 0; 
let lastPosition = null;
let animalsCollected = 0;
let nextRewardDistance = 0.1; 

let map = null;
let userMarker = null;

const animals = ['🦊', '🦉', '🐗', '🦌', '🦅', '🐻', '🐰', '🦔', '🐿️', '🐸'];

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function collectAnimal() {
    const randomAnimal = animals[Math.floor(Math.random() * animals.length)];
    
    const li = document.createElement('li');
    li.className = 'animal-item';
    li.textContent = randomAnimal;
    collectionList.prepend(li); 

    animalsCollected++;
    animalCountDisplay.textContent = animalsCollected;

    if (map && lastPosition) {
        const animalIcon = L.divIcon({
            html: `<div>${randomAnimal}</div>`,
            className: 'animal-map-marker',
            iconSize: [34, 34],
            iconAnchor: [17, 17]
        });
        L.marker([lastPosition.latitude, lastPosition.longitude], {icon: animalIcon}).addTo(map);
    }
}

// NEU: Funktion, die die Karte sofort beim Start lädt
function initDefaultMap() {
    if (!map) {
        // Startposition: grob über Deutschland, Zoom-Level 6
        map = L.map('map', { zoomControl: false }).setView([51.1657, 10.4515], 6);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(map);
    }
}

// NEU: Angepasste Funktion, die den Marker setzt und heranzoomt
function updateMapLocation(lat, lng) {
    if (!userMarker) {
        userMarker = L.circleMarker([lat, lng], {
            radius: 8,
            fillColor: "#007AFF",
            color: "#ffffff",
            weight: 3,
            opacity: 1,
            fillOpacity: 1
        }).addTo(map);
    } else {
        userMarker.setLatLng([lat, lng]);
    }
    // NEU: SetView nutzt jetzt Zoomlevel 16, sobald GPS da ist
    map.setView([lat, lng], 16); 
}

function startTracking() {
    if (!navigator.geolocation) {
        statusDisplay.textContent = "GPS nicht unterstützt!";
        return;
    }

    startBtn.disabled = true;
    stopBtn.disabled = false;
    statusDisplay.textContent = "Sucht GPS...";
    statusDisplay.style.color = "orange";

    watchId = navigator.geolocation.watchPosition(
        (position) => {
            statusDisplay.textContent = "Tracking aktiv";
            statusDisplay.style.color = "green";

            const { latitude, longitude } = position.coords;
            
            // NEU: Aktualisiert die Karte mit der exakten Position
            updateMapLocation(latitude, longitude);

            if (lastPosition) {
                const dist = calculateDistance(
                    lastPosition.latitude, lastPosition.longitude,
                    latitude, longitude
                );
                
                if (dist > 0.002) {
                    totalDistance += dist;
                    distanceDisplay.textContent = totalDistance.toFixed(2);

                    if (totalDistance >= nextRewardDistance) {
                        collectAnimal();
                        nextRewardDistance += 0.1; 
                    }
                }
            }
            lastPosition = { latitude, longitude };
        },
        (error) => {
            // NEU: Detailliertere Fehlermeldungen für leichteres Debugging
            let errorMsg = "GPS Fehler!";
            if (error.code === 1) errorMsg = "GPS abgelehnt!"; // Rechte verweigert oder kein HTTPS
            if (error.code === 2) errorMsg = "Kein Signal!";   // Position nicht verfügbar
            if (error.code === 3) errorMsg = "Timeout!";       // Zu lange gedauert
            
            statusDisplay.textContent = errorMsg;
            statusDisplay.style.color = "red";
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 } // NEU: Timeout leicht erhöht
    );
}

function stopTracking() {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    startBtn.disabled = false;
    stopBtn.disabled = true;
    statusDisplay.textContent = "Pausiert";
    statusDisplay.style.color = "black";
}

startBtn.addEventListener('click', startTracking);
stopBtn.addEventListener('click', stopTracking);

// NEU: Karte direkt beim Laden der Seite initialisieren
initDefaultMap();