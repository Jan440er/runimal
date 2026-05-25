// UI Elemente
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const distanceDisplay = document.getElementById('distance');
const statusDisplay = document.getElementById('status');
const collectionList = document.getElementById('collectionList');
const animalCountDisplay = document.getElementById('animalCount');

// Status-Variablen
let watchId = null;
let totalDistance = 0; // in Kilometern
let lastPosition = null;
let animalsCollected = 0;
let nextRewardDistance = 0.1; // Belohnung alle 0.1 km (100 Meter)

// Tier-Datenbank (Für den Prototyp nutzen wir Emojis)
const animals = ['🦊', '🦉', '🐗', '🦌', '🦅', '🐻', '🐰', '🦔', '🐿️', '🐸'];

// Haversine-Formel zur Distanzberechnung zwischen zwei GPS-Koordinaten
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Erdradius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Neues Tier zur Sammlung hinzufügen
function collectAnimal() {
    const randomAnimal = animals[Math.floor(Math.random() * animals.length)];
    
    const li = document.createElement('li');
    li.className = 'animal-item';
    li.textContent = randomAnimal;
    collectionList.prepend(li); // Neues Tier oben anfügen

    animalsCollected++;
    animalCountDisplay.textContent = animalsCollected;
}

// GPS Tracker starten
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

            if (lastPosition) {
                const dist = calculateDistance(
                    lastPosition.latitude, lastPosition.longitude,
                    latitude, longitude
                );
                
                // Um kleine GPS-Sprünge zu filtern (weniger als 2 Meter ignorieren)
                if (dist > 0.002) {
                    totalDistance += dist;
                    distanceDisplay.textContent = totalDistance.toFixed(2);

                    // Check ob Meilenstein für neues Tier erreicht wurde
                    if (totalDistance >= nextRewardDistance) {
                        collectAnimal();
                        nextRewardDistance += 0.1; // Nächstes Tier in weiteren 100 Metern
                    }
                }
            }
            lastPosition = { latitude, longitude };
        },
        (error) => {
            statusDisplay.textContent = "GPS Fehler: " + error.message;
            statusDisplay.style.color = "red";
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
}

// GPS Tracker beenden
function stopTracking() {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    startBtn.disabled = false;
    stopBtn.disabled = true;
    statusDisplay.textContent = "Pausiert";
    statusDisplay.style.color = "black";
    lastPosition = null;
}

// Event Listener
startBtn.addEventListener('click', startTracking);
stopBtn.addEventListener('click', stopTracking);