const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const distanceDisplay = document.getElementById('distance');
const timeDisplay = document.getElementById('time');
const speedDisplay = document.getElementById('speed');
const statusDisplay = document.getElementById('status');

let watchId = null;
let totalDistance = 0; 
let lastPosition = null;

// Distanz für Boxen auf 0.05 (50 Meter) gesetzt
let nextRewardDistance = 0.05; 
let boxesEarnedThisRun = 0; 

let map = null;
let userMarker = null;

let startTime = null;
let timerInterval = null;
let elapsedSeconds = 0;

let wakeLock = null;

// NEU: Variablen für Routen-Linie und Kilometer-Splits
let trackingPolyline = null;
let routeCoords = [];
let nextSplitDistance = 1.0;
let lastSplitTime = 0;
let splits = [];

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

// NEU: Timer berechnet nun die Läufer-Pace (min/km) statt km/h
function updateTimer() {
    elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    timeDisplay.textContent = formatTime(elapsedSeconds);

    if (elapsedSeconds > 0 && totalDistance > 0) {
        const totalMinutes = elapsedSeconds / 60;
        const paceDecimal = totalMinutes / totalDistance;
        const paceMins = Math.floor(paceDecimal);
        const paceSecs = Math.floor((paceDecimal - paceMins) * 60).toString().padStart(2, '0');
        
        if (paceMins < 100) {
            speedDisplay.textContent = `${paceMins}:${paceSecs}`;
        } else {
            speedDisplay.textContent = "--:--";
        }
    } else {
        speedDisplay.textContent = "00:00";
    }
}

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

async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('Wake Lock aktiv - Display bleibt an');
            
            document.addEventListener('visibilitychange', async () => {
                if (wakeLock !== null && document.visibilityState === 'visible') {
                    wakeLock = await navigator.wakeLock.request('screen');
                }
            });
        }
    } catch (err) {
        console.log(`Wake Lock Fehler: ${err.name}, ${err.message}`);
    }
}

function releaseWakeLock() {
    if (wakeLock !== null) {
        wakeLock.release()
            .then(() => {
                wakeLock = null;
                console.log('Wake Lock freigegeben');
            });
    }
}

function startTracking() {
    if (!navigator.geolocation) {
        statusDisplay.textContent = "GPS nicht unterstützt!";
        return;
    }

    totalDistance = 0;
    elapsedSeconds = 0;
    nextRewardDistance = 0.05; 
    boxesEarnedThisRun = 0;   
    distanceDisplay.textContent = "0.00";
    timeDisplay.textContent = "00:00";
    speedDisplay.textContent = "00:00"; // NEU: Pace Startwert
    
    // NEU: Tracker Variablen zurücksetzen
    routeCoords = [];
    nextSplitDistance = 1.0;
    lastSplitTime = 0;
    splits = [];
    
    if (trackingPolyline) {
        map.removeLayer(trackingPolyline);
    }
    // NEU: Polyline initialisieren, um den Weg auf der Karte zu zeichnen
    trackingPolyline = L.polyline([], {color: '#4CAF50', weight: 5, opacity: 0.8}).addTo(map);

    startBtn.disabled = true;
    stopBtn.disabled = false;
    statusDisplay.textContent = "Sucht GPS...";
    statusDisplay.style.color = "orange";

    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);

    requestWakeLock();

    watchId = navigator.geolocation.watchPosition(
        (position) => {
            statusDisplay.textContent = "Tracking aktiv";
            statusDisplay.style.color = "green";

            const { latitude, longitude } = position.coords;
            updateMapLocation(latitude, longitude);

            // NEU: Aktuelle GPS-Koordinate in Route sichern und Linie live updaten
            routeCoords.push([latitude, longitude]);
            trackingPolyline.setLatLngs(routeCoords);

            if (lastPosition) {
                const dist = calculateDistance(
                    lastPosition.latitude, lastPosition.longitude,
                    latitude, longitude
                );
                
                if (dist > 0.005) {
                    totalDistance += dist;
                    distanceDisplay.textContent = totalDistance.toFixed(2);

                    if (totalDistance >= nextRewardDistance) {
                        boxesEarnedThisRun++;
                        spawnBoxOnMap(latitude, longitude);
                        nextRewardDistance += 0.05; 
                    }

                    // NEU: Wenn ein voller Kilometer erreicht wurde, Split berechnen
                    if (totalDistance >= nextSplitDistance) {
                        const splitTimeSeconds = elapsedSeconds - lastSplitTime;
                        splits.push(formatTime(splitTimeSeconds));
                        lastSplitTime = elapsedSeconds;
                        nextSplitDistance += 1.0;
                    }
                    
                    lastPosition = { latitude, longitude };
                }
            } else {
                lastPosition = { latitude, longitude };
            }
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

    releaseWakeLock();

    if (totalDistance > 0.01) {
        // NEU: Letzten angefangenen Kilometer als Rest-Split berechnen
        let finalSplits = [...splits];
        const coveredInCurrentKm = totalDistance - (nextSplitDistance - 1.0);
        if (coveredInCurrentKm > 0.03) { 
            const splitTimeSeconds = elapsedSeconds - lastSplitTime;
            const paceDecimal = (splitTimeSeconds / 60) / coveredInCurrentKm;
            if (isFinite(paceDecimal) && paceDecimal < 100) {
                const pMins = Math.floor(paceDecimal);
                const pSecs = Math.floor((paceDecimal - pMins) * 60).toString().padStart(2, '0');
                finalSplits.push(`${pMins}:${pSecs} (Rest)`);
            }
        }

        // NEU: Übergabe von Pace, Routen-Koordinaten und Splits an den Storage
        const runId = Storage.saveRun(
            totalDistance.toFixed(2), 
            timeDisplay.textContent, 
            speedDisplay.textContent,
            routeCoords,
            finalSplits
        );
        
        if (boxesEarnedThisRun > 0) {
            Storage.saveBoxes(runId, boxesEarnedThisRun);
        }

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