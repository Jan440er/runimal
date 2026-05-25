const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const distanceDisplay = document.getElementById('distance');
const timeDisplay = document.getElementById('time');
const speedDisplay = document.getElementById('speed');
const statusDisplay = document.getElementById('status');

let watchId = null;
let totalDistance = 0; 
let lastPosition = null;

// NEU: Distanz für Boxen auf 0.5 (500 Meter) gesetzt
let nextRewardDistance = 0.5; 
let boxesEarnedThisRun = 0; // Zählt gesammelte Boxen im aktuellen Lauf

let map = null;
let userMarker = null;

let startTime = null;
let timerInterval = null;
let elapsedSeconds = 0;

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

function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function updateTimer() {
    elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    timeDisplay.textContent = formatTime(elapsedSeconds);

    if (elapsedSeconds > 0 && totalDistance > 0) {
        const hours = elapsedSeconds / 3600;
        const speed = totalDistance / hours;
        speedDisplay.textContent = speed.toFixed(1);
    }
}

// NEU: Spawnt jetzt eine Box 📦 auf der Karte, kein Tier mehr
function spawnBoxOnMap(lat, lng) {
    if (map) {
        const boxIcon = L.divIcon({
            html: `<div>📦</div>`,
            className: 'animal-map-marker',
            iconSize: [34, 34],
            iconAnchor: [17, 17]
        });
        L.marker([lat, lng], {icon: boxIcon}).addTo(map);
    }
}

function initDefaultMap() {
    if (!map) {
        map = L.map('map', { zoomControl: false }).setView([51.1657, 10.4515], 6);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(map);
    }
}

function updateMapLocation(lat, lng) {
    if (!userMarker) {
        userMarker = L.circleMarker([lat, lng], {
            radius: 8, fillColor: "#007AFF", color: "#ffffff", weight: 3, opacity: 1, fillOpacity: 1
        }).addTo(map);
    } else {
        userMarker.setLatLng([lat, lng]);
    }
    map.setView([lat, lng], 16); 
}

function startTracking() {
    if (!navigator.geolocation) {
        statusDisplay.textContent = "GPS nicht unterstützt!";
        return;
    }

    totalDistance = 0;
    elapsedSeconds = 0;
    nextRewardDistance = 0.5; // NEU: 500 Meter
    boxesEarnedThisRun = 0;   // NEU: Counter reset
    distanceDisplay.textContent = "0.00";
    timeDisplay.textContent = "00:00";
    speedDisplay.textContent = "0.0";
    
    startBtn.disabled = true;
    stopBtn.disabled = false;
    statusDisplay.textContent = "Sucht GPS...";
    statusDisplay.style.color = "orange";

    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);

    watchId = navigator.geolocation.watchPosition(
        (position) => {
            statusDisplay.textContent = "Tracking aktiv";
            statusDisplay.style.color = "green";

            const { latitude, longitude } = position.coords;
            updateMapLocation(latitude, longitude);

            if (lastPosition) {
                const dist = calculateDistance(
                    lastPosition.latitude, lastPosition.longitude,
                    latitude, longitude
                );
                
                if (dist > 0.002) {
                    totalDistance += dist;
                    distanceDisplay.textContent = totalDistance.toFixed(2);

                    // NEU: Boxen-Meilenstein erreicht
                    if (totalDistance >= nextRewardDistance) {
                        boxesEarnedThisRun++;
                        spawnBoxOnMap(latitude, longitude);
                        nextRewardDistance += 0.5; // Nächste Box in 500 Metern
                    }
                }
            }
            lastPosition = { latitude, longitude };
        },
        (error) => {
            let errorMsg = "GPS Fehler!";
            if (error.code === 1) errorMsg = "GPS abgelehnt!"; 
            if (error.code === 2) errorMsg = "Kein Signal!";   
            if (error.code === 3) errorMsg = "Timeout!";       
            statusDisplay.textContent = errorMsg;
            statusDisplay.style.color = "red";
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
}

function stopTracking() {
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    startBtn.disabled = false;
    stopBtn.disabled = true;
    lastPosition = null;

    if (totalDistance > 0.01) {
        // NEU: Lauf speichern und die ID erhalten
        const runId = Storage.saveRun(
            totalDistance.toFixed(2), 
            timeDisplay.textContent, 
            speedDisplay.textContent
        );
        
        // NEU: Gesammelte Boxen mit dem Lauf verknüpfen
        if (boxesEarnedThisRun > 0) {
            Storage.saveBoxes(runId, boxesEarnedThisRun);
        }

        // NEU: Feedback an den Nutzer
        alert(`Lauf beendet! Du hast ${boxesEarnedThisRun} Box(en) gesammelt! Öffne sie im Inventar.`);
        statusDisplay.textContent = "Gespeichert!";
        statusDisplay.style.color = "var(--primary)";
        
        if(typeof window.updateHomeUI === 'function') window.updateHomeUI();
        if(typeof window.updateProfileUI === 'function') window.updateProfileUI();
    } else {
        statusDisplay.textContent = "Zu kurz zum Speichern.";
        statusDisplay.style.color = "black";
    }
}

startBtn.addEventListener('click', startTracking);
stopBtn.addEventListener('click', stopTracking);

initDefaultMap();