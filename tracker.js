const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn'); // NEU
const stopBtn = document.getElementById('stopBtn');
const distanceDisplay = document.getElementById('distance');
const timeDisplay = document.getElementById('time');
const speedDisplay = document.getElementById('speed');
const statusDisplay = document.getElementById('status');

let watchId = null;
let totalDistance = 0; 
let lastPosition = null;

let nextRewardDistance = 0.05; 
let boxesEarnedThisRun = 0; 

let map = null;
let userMarker = null;

let startTime = null;
let timerInterval = null;
let elapsedSeconds = 0;

let wakeLock = null;

// NEU: Erweiterte Variablen für Segmente und Pausen
let trackingPolyline = null;
let mapLayers = []; // Speichert alle gezeichneten Linien (Aktiv + Pausen)
let routeSegments = []; 
let currentSegment = []; 
let nextSplitDistance = 1.0;
let lastSplitTime = 0;
let splits = [];

// NEU: Pausen-Zustand
let isPaused = false;
let pauseStartTime = null;
let totalPauseMs = 0;
let pauses = [];

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
    if (isPaused) return; // NEU: Timer-UI friert während der Pause ein

    // NEU: Pausenzeit wird von der Gesamtzeit abgezogen
    elapsedSeconds = Math.floor((Date.now() - startTime - totalPauseMs) / 1000);
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
        wakeLock.release().then(() => { wakeLock = null; });
    }
}

// NEU: Extrahiert in eigene Funktion für Start & Weiter
function bindGeolocationWatch() {
    return navigator.geolocation.watchPosition(
        (position) => {
            statusDisplay.textContent = "Tracking aktiv";
            statusDisplay.style.color = "green";

            const { latitude, longitude } = position.coords;
            updateMapLocation(latitude, longitude);

            // NEU: Überprüft, ob dies der erste Punkt nach einer Pause ist
            if (currentSegment.length === 0 && lastPosition) {
                // Zeichne die Luftlinie der Pause
                const pauseStartCoord = [lastPosition.latitude, lastPosition.longitude];
                const pauseEndCoord = [latitude, longitude];
                
                if (pauseStartCoord[0] !== latitude || pauseStartCoord[1] !== longitude) {
                    const pauseSegment = { type: 'pause', coords: [pauseStartCoord, pauseEndCoord] };
                    routeSegments.push(pauseSegment);
                    
                    const pauseLine = L.polyline(pauseSegment.coords, {color: '#aaaaaa', weight: 4, dashArray: '5, 8'}).addTo(map);
                    mapLayers.push(pauseLine);
                }
                
                // Neue Polyline für den aktiven Track starten
                trackingPolyline = L.polyline([], {color: '#4CAF50', weight: 5, opacity: 0.8}).addTo(map);
                mapLayers.push(trackingPolyline);

                // Verhindert Distanzberechnung für den Pausen-Sprung
                lastPosition = { latitude, longitude };
                currentSegment.push([latitude, longitude]);
                trackingPolyline.setLatLngs(currentSegment);
                return; 
            }

            // Normales Hinzufügen der Punkte in das aktive Segment
            currentSegment.push([latitude, longitude]);
            if (!trackingPolyline) {
                trackingPolyline = L.polyline([], {color: '#4CAF50', weight: 5, opacity: 0.8}).addTo(map);
                mapLayers.push(trackingPolyline);
            }
            trackingPolyline.setLatLngs(currentSegment);

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

                    if (totalDistance >= nextSplitDistance) {
                        const splitTimeSeconds = elapsedSeconds - lastSplitTime;
                        splits.push(formatTime(splitTimeSeconds));
                        lastSplitTime = elapsedSeconds;
                        nextSplitDistance += 1.0;
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

function startTracking() {
    if (!navigator.geolocation) {
        statusDisplay.textContent = "GPS nicht unterstützt!";
        return;
    }

    // Zurücksetzen aller Werte
    totalDistance = 0;
    elapsedSeconds = 0;
    nextRewardDistance = 0.05; 
    boxesEarnedThisRun = 0;   
    distanceDisplay.textContent = "0.00";
    timeDisplay.textContent = "00:00";
    speedDisplay.textContent = "00:00";
    
    // NEU: Tracker Variablen & Pausen zurücksetzen
    routeSegments = [];
    currentSegment = [];
    nextSplitDistance = 1.0;
    lastSplitTime = 0;
    splits = [];
    isPaused = false;
    totalPauseMs = 0;
    pauses = [];
    lastPosition = null;
    
    // NEU: Alte Linien von der Karte löschen
    mapLayers.forEach(layer => map.removeLayer(layer));
    mapLayers = [];
    trackingPolyline = null;

    // NEU: UI Buttons umschalten
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'block';
    pauseBtn.textContent = 'Pause';
    stopBtn.disabled = false;

    statusDisplay.textContent = "Sucht GPS...";
    statusDisplay.style.color = "orange";

    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);

    requestWakeLock();
    watchId = bindGeolocationWatch();
}

// NEU: Funktion für das Pausieren und Fortsetzen
function togglePauseTracking() {
    if (!isPaused) {
        // Pausieren
        isPaused = true;
        pauseStartTime = Date.now();
        
        statusDisplay.textContent = "Pausiert";
        statusDisplay.style.color = "orange";
        pauseBtn.textContent = "Weiter";
        
        // GPS Stoppen
        if (watchId) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }
        
        // Aktuelles Segment abspeichern und vorbereiten für neuen Track
        if (currentSegment.length > 0) {
            routeSegments.push({ type: 'active', coords: [...currentSegment] });
            currentSegment = []; // Zurücksetzen für nach der Pause
        }
    } else {
        // Weiterlaufen
        isPaused = false;
        const pauseDurationMs = Date.now() - pauseStartTime;
        totalPauseMs += pauseDurationMs;
        
        pauses.push({
            duration: formatTime(Math.floor(pauseDurationMs / 1000))
        });
        
        statusDisplay.textContent = "Sucht GPS...";
        statusDisplay.style.color = "orange";
        pauseBtn.textContent = "Pause";
        
        // GPS wieder starten
        watchId = bindGeolocationWatch();
    }
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

    // NEU: Falls der Lauf gestoppt wird, während noch ein Segment offen ist
    if (currentSegment.length > 0) {
        routeSegments.push({ type: 'active', coords: [...currentSegment] });
    }

    // NEU: UI zurücksetzen
    startBtn.style.display = 'block';
    pauseBtn.style.display = 'none';
    stopBtn.disabled = true;
    lastPosition = null;

    releaseWakeLock();

    if (totalDistance > 0.01) {
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

        // NEU: Pausen-Informationen an die Storage-Methode übergeben
        const totalPauseTimeStr = formatTime(Math.floor(totalPauseMs / 1000));
        const runId = Storage.saveRun(
            totalDistance.toFixed(2), 
            timeDisplay.textContent, 
            speedDisplay.textContent,
            routeSegments, 
            finalSplits,
            totalPauseTimeStr,
            pauses
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
pauseBtn.addEventListener('click', togglePauseTracking); // NEU
stopBtn.addEventListener('click', stopTracking);

initDefaultMap();