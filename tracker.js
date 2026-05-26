const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn'); 
const stopBtn = document.getElementById('stopBtn');
const statusDisplay = document.getElementById('status');

let currentPaceString = "00:00";
let watchId = null;
let totalDistance = 0; 
let lastPosition = null;

// NEU: Tracker für die verschiedenen Meilensteine der Boxen (in km)
let nextBoxThresholds = {
    '50m': 0.05,
    '500m': 0.5,
    '5km': 5.0,
    '10km': 10.0,
    '21km': 21.0
};
// NEU: Speicher für die in diesem Lauf gesammelten Boxen
let boxesEarnedThisRun = { '50m': 0, '500m': 0, '5km': 0, '10km': 0, '21km': 0 }; 

let map = null;
let userMarker = null;

let startTime = null;
let timerInterval = null;
let elapsedSeconds = 0;

let wakeLock = null;

let trackingPolyline = null;
let mapLayers = []; 
let routeSegments = []; 
let currentSegment = []; 
let nextSplitDistance = 1.0;
let lastSplitTime = 0;
let splits = [];

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

window.renderStats = function() {
    const settings = Storage.getSettings();
    
    const burnedKcal = Math.round(settings.weight * totalDistance * 1.036);
    const fluidNeed = Math.round(settings.weight * 8 * (elapsedSeconds / 3600));

    const statsData = { 
        'distance': `${totalDistance.toFixed(2)} km`, 
        'time': formatTime(elapsedSeconds), 
        'pace': currentPaceString, 
        'kcal': `${burnedKcal} kcal`, 
        'fluid': `${fluidNeed} ml` 
    };
    
    const statsLabels = { 
        'distance': 'Distanz', 
        'time': 'Zeit', 
        'pace': 'Ø Pace', 
        'kcal': 'Kalorien', 
        'fluid': 'Wasserbedarf' 
    };

    document.getElementById('stat1-label').textContent = statsLabels[settings.stat1];
    document.getElementById('stat1-value').textContent = statsData[settings.stat1];
    
    document.getElementById('stat2-label').textContent = statsLabels[settings.stat2];
    document.getElementById('stat2-value').textContent = statsData[settings.stat2];
    
    document.getElementById('stat3-label').textContent = statsLabels[settings.stat3];
    document.getElementById('stat3-value').textContent = statsData[settings.stat3];
};

function updateTimer() {
    if (isPaused) {
        const currentPauseSecs = Math.floor((Date.now() - pauseStartTime) / 1000);
        statusDisplay.textContent = `Pausiert (${formatTime(currentPauseSecs)})`;
        return; 
    }

    elapsedSeconds = Math.floor((Date.now() - startTime - totalPauseMs) / 1000);

    if (elapsedSeconds > 0 && totalDistance > 0) {
        const totalMinutes = elapsedSeconds / 60;
        const paceDecimal = totalMinutes / totalDistance;
        const paceMins = Math.floor(paceDecimal);
        const paceSecs = Math.floor((paceDecimal - paceMins) * 60).toString().padStart(2, '0');
        
        if (paceMins < 100) {
            currentPaceString = `${paceMins}:${paceSecs}`;
        } else {
            currentPaceString = "--:--";
        }
    } else {
        currentPaceString = "00:00";
    }

    window.renderStats(); 
}

// NEU: Unterstützt nun dynamische Icons, je nach Box-Typ
function spawnBoxOnMap(lat, lng, iconEmoji = '📦') {
    if (map) {
        const boxIcon = L.divIcon({
            html: `<div>${iconEmoji}</div>`,
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

function bindGeolocationWatch() {
    return navigator.geolocation.watchPosition(
        (position) => {
            statusDisplay.textContent = "Tracking aktiv";
            statusDisplay.style.color = "green";

            const { latitude, longitude } = position.coords;
            updateMapLocation(latitude, longitude);

            if (currentSegment.length === 0 && lastPosition) {
                const pauseStartCoord = [lastPosition.latitude, lastPosition.longitude];
                const pauseEndCoord = [latitude, longitude];
                
                if (pauseStartCoord[0] !== latitude || pauseStartCoord[1] !== longitude) {
                    const pauseSegment = { type: 'pause', coords: [pauseStartCoord, pauseEndCoord] };
                    routeSegments.push(pauseSegment);
                    
                    const pauseLine = L.polyline(pauseSegment.coords, {color: '#aaaaaa', weight: 4, dashArray: '5, 8'}).addTo(map);
                    mapLayers.push(pauseLine);
                }
                
                trackingPolyline = L.polyline([], {color: '#4CAF50', weight: 5, opacity: 0.8}).addTo(map);
                mapLayers.push(trackingPolyline);

                lastPosition = { latitude, longitude };
                currentSegment.push([latitude, longitude]);
                trackingPolyline.setLatLngs(currentSegment);
                return; 
            }

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
                    
                    // NEU: Wir checken jeden einzelnen Schwellenwert der 5 Box-Typen separat
                    if (totalDistance >= nextBoxThresholds['50m']) { 
                        boxesEarnedThisRun['50m']++; 
                        spawnBoxOnMap(latitude, longitude, '📦'); 
                        nextBoxThresholds['50m'] += 0.05; 
                    }
                    if (totalDistance >= nextBoxThresholds['500m']) { 
                        boxesEarnedThisRun['500m']++; 
                        spawnBoxOnMap(latitude, longitude, '🥉'); 
                        nextBoxThresholds['500m'] += 0.5; 
                    }
                    if (totalDistance >= nextBoxThresholds['5km']) { 
                        boxesEarnedThisRun['5km']++; 
                        spawnBoxOnMap(latitude, longitude, '🥈'); 
                        nextBoxThresholds['5km'] += 5.0; 
                    }
                    if (totalDistance >= nextBoxThresholds['10km']) { 
                        boxesEarnedThisRun['10km']++; 
                        spawnBoxOnMap(latitude, longitude, '🥇'); 
                        nextBoxThresholds['10km'] += 10.0; 
                    }
                    if (totalDistance >= nextBoxThresholds['21km']) { 
                        boxesEarnedThisRun['21km']++; 
                        spawnBoxOnMap(latitude, longitude, '💎'); 
                        nextBoxThresholds['21km'] += 21.0; 
                    }

                    if (totalDistance >= nextSplitDistance) {
                        const splitTimeSeconds = elapsedSeconds - lastSplitTime;
                        splits.push(formatTime(splitTimeSeconds));
                        lastSplitTime = elapsedSeconds;
                        nextSplitDistance += 1.0;
                    }

                    window.renderStats(); 
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

    document.body.classList.add('tracking-active');
    
    setTimeout(() => {
        if (map) map.invalidateSize();
    }, 350);

    totalDistance = 0;
    elapsedSeconds = 0;
    currentPaceString = "00:00"; 
    
    // NEU: Zurücksetzen aller Distanz-Marker und gesammelten Boxen bei Laufstart
    nextBoxThresholds = { '50m': 0.05, '500m': 0.5, '5km': 5.0, '10km': 10.0, '21km': 21.0 };
    boxesEarnedThisRun = { '50m': 0, '500m': 0, '5km': 0, '10km': 0, '21km': 0 };
    
    window.renderStats(); 
    
    routeSegments = [];
    currentSegment = [];
    nextSplitDistance = 1.0;
    lastSplitTime = 0;
    splits = [];
    isPaused = false;
    totalPauseMs = 0;
    pauses = [];
    lastPosition = null;
    
    mapLayers.forEach(layer => map.removeLayer(layer));
    mapLayers = [];
    trackingPolyline = null;

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

function togglePauseTracking() {
    if (!isPaused) {
        isPaused = true;
        pauseStartTime = Date.now();
        
        statusDisplay.textContent = "Pausiert (00:00)";
        statusDisplay.style.color = "orange";
        pauseBtn.textContent = "Weiter";
        
        if (watchId) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }
        
        if (currentSegment.length > 0) {
            routeSegments.push({ type: 'active', coords: [...currentSegment] });
            currentSegment = []; 
        }
    } else {
        isPaused = false;
        const pauseDurationMs = Date.now() - pauseStartTime;
        totalPauseMs += pauseDurationMs;
        
        pauses.push({
            duration: formatTime(Math.floor(pauseDurationMs / 1000)),
            km: totalDistance.toFixed(2) 
        });
        
        statusDisplay.textContent = "Sucht GPS...";
        statusDisplay.style.color = "orange";
        pauseBtn.textContent = "Pause";
        
        watchId = bindGeolocationWatch();
    }
}

function stopTracking() {
    document.body.classList.remove('tracking-active');
    
    setTimeout(() => {
        if (map) map.invalidateSize();
    }, 350);

    if (isPaused) {
        const pauseDurationMs = Date.now() - pauseStartTime;
        totalPauseMs += pauseDurationMs;
        pauses.push({
            duration: formatTime(Math.floor(pauseDurationMs / 1000)),
            km: totalDistance.toFixed(2)
        });
        isPaused = false;
    }

    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    if (currentSegment.length > 0) {
        routeSegments.push({ type: 'active', coords: [...currentSegment] });
    }

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

        const totalPauseTimeStr = formatTime(Math.floor(totalPauseMs / 1000));
        
        const runId = Storage.saveRun(
            totalDistance.toFixed(2), 
            formatTime(elapsedSeconds), 
            currentPaceString,
            routeSegments, 
            finalSplits,
            totalPauseTimeStr,
            pauses
        );
        
        // NEU: Gesamte Box-Ausbeute des Laufes berechnen
        let totalBoxesThisRun = Object.values(boxesEarnedThisRun).reduce((sum, count) => sum + count, 0);
        if (totalBoxesThisRun > 0) {
            Storage.saveBoxes(runId, boxesEarnedThisRun);
        }

        alert(`Lauf beendet! Du hast insgesamt ${totalBoxesThisRun} Box(en) gesammelt!`);
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
pauseBtn.addEventListener('click', togglePauseTracking); 
stopBtn.addEventListener('click', stopTracking);

initDefaultMap();