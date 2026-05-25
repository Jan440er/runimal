const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');

navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        views.forEach(view => view.classList.remove('active'));
        
        const targetId = item.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');
        
        if(targetId === 'view-track' && typeof map !== 'undefined' && map !== null) {
            setTimeout(() => { map.invalidateSize(); }, 100);
        }
    });
});

const collectionList = document.getElementById('collectionList');
const animalCountDisplay = document.getElementById('animalCount');
const runsList = document.getElementById('runsList');

const boxCountDisplay = document.getElementById('boxCountDisplay');
const openBoxBtn = document.getElementById('openBoxBtn');
const boxResult = document.getElementById('boxResult');
const toggleInfoBtn = document.getElementById('toggleInfoBtn');
const infoCard = document.getElementById('infoCard');
const rarityList = document.getElementById('rarityList');

window.updateHomeUI = function() {
    const animals = Storage.getAnimals();
    animalCountDisplay.textContent = animals.length;
    
    collectionList.innerHTML = '';
    animals.forEach(animal => {
        const li = document.createElement('li');
        li.className = 'animal-item';
        li.textContent = animal;
        collectionList.appendChild(li);
    });

    if (animals.length === 0) {
        collectionList.innerHTML = '<li style="grid-column: 1/-1; text-align: left; background: none; box-shadow: none;">Noch keine Tiere. Öffne Boxen!</li>';
    }

    const runs = Storage.getRuns();
    runsList.innerHTML = '';
    
    // NEU: Rendert Läufe als ausklappbares Accordion inklusive Karte und Splits
    runs.forEach(run => {
        const li = document.createElement('li');
        li.className = 'run-item-clickable';
        
        const animalsHtml = run.animals && run.animals.length > 0 
            ? `<div class="run-animals">Gezogen: ${run.animals.join(' ')}</div>` 
            : `<div class="run-animals" style="color:#aaa; font-size: 0.9rem;">Keine Tiere gezogen</div>`;

        // Splits HTML Struktur aufbauen
        let splitsHtml = '<p><strong>⏱️ Kilometer-Splits:</strong></p><ul class="splits-list">';
        if (run.splits && run.splits.length > 0) {
            run.splits.forEach((splitTime, index) => {
                splitsHtml += `<li><span>Kilometer ${index + 1}:</span> <strong>${splitTime} min/km</strong></li>`;
            });
        } else {
            splitsHtml += '<li>Keine Splits aufgezeichnet (Lauf zu kurz).</li>';
        }
        splitsHtml += '</ul>';

        // Listen-Inhalt zusammensetzen (Pace statt km/h)
        li.innerHTML = `
            <div class="run-header">
                <span class="run-date">${run.date}</span>
                <span class="run-stats">${run.distance} km • ${run.time} • ${run.pace} min/km</span>
            </div>
            ${animalsHtml}
            <div class="run-details">
                ${splitsHtml}
                <div class="run-map" id="map-${run.id}"></div>
            </div>
        `;
        
        // Klick-Logik zum Öffnen/Schließen und Laden der Leaflet Route
        li.addEventListener('click', (e) => {
            if (e.target.closest('.run-map')) return; // Klicks auf Karte ignorieren

            const isExpanded = li.classList.toggle('expanded');
            
            if (isExpanded) {
                setTimeout(() => {
                    const runMapId = `map-${run.id}`;
                    const mapContainer = document.getElementById(runMapId);
                    
                    // Verhindert doppelte Karten-Initialisierung
                    if (mapContainer && !mapContainer._leaflet_id) {
                        if (run.route && run.route.length > 0) {
                            const subMap = L.map(runMapId, { zoomControl: false });
                            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                                maxZoom: 19
                            }).addTo(subMap);
                            
                            // Route einzeichnen
                            const polyline = L.polyline(run.route, {color: '#4CAF50', weight: 4}).addTo(subMap);
                            subMap.fitBounds(polyline.getBounds(), { padding: [15, 15] });
                            
                            // Start- & Zielmarker setzen
                            L.circleMarker(run.route[0], {radius: 5, fillColor: '#4CAF50', color: '#fff', weight: 2, fillOpacity: 1}).addTo(subMap);
                            L.circleMarker(run.route[run.route.length - 1], {radius: 5, fillColor: '#f44336', color: '#fff', weight: 2, fillOpacity: 1}).addTo(subMap);
                        } else {
                            mapContainer.innerHTML = '<p style="padding: 10px; color: #888; font-size: 0.85rem;">Keine Routenpunkte vorhanden.</p>';
                        }
                    }
                }, 50);
            }
        });

        runsList.appendChild(li);
    });

    if (runs.length === 0) {
        runsList.innerHTML = '<li style="color: #777;">Bisher keine Läufe aufgezeichnet.</li>';
    }
}

window.updateProfileUI = function() {
    const boxes = Storage.getBoxes();
    boxCountDisplay.textContent = boxes.length;
    openBoxBtn.disabled = boxes.length === 0;
}

openBoxBtn.addEventListener('click', () => {
    const runId = Storage.consumeBox();
    if (!runId) return; 

    const rand = Math.random() * 100;
    let currentProbability = 0;
    let drawnAnimal = null;
    let drawnRarity = null;

    for (let r of Storage.RARITIES) {
        currentProbability += r.chance;
        if (rand <= currentProbability) {
            drawnAnimal = r.animals[Math.floor(Math.random() * r.animals.length)];
            drawnRarity = r;
            break;
        }
    }

    Storage.saveAnimal(drawnAnimal);
    Storage.addAnimalToRun(runId, drawnAnimal);

    boxResult.innerHTML = `
        <div class="animal-item" style="border: 3px solid ${drawnRarity.color}; display: inline-block; padding: 20px; transform: scale(1.2);">
            ${drawnAnimal}
            <div style="font-size: 0.9rem; color: ${drawnRarity.color}; margin-top: 5px; font-weight: bold;">
                ${drawnRarity.name}
            </div>
        </div>
    `;

    updateProfileUI();
    updateHomeUI();
});

toggleInfoBtn.addEventListener('click', () => {
    if (infoCard.style.display === 'none') {
        infoCard.style.display = 'block';
        toggleInfoBtn.textContent = '📊 Wahrscheinlichkeiten ausblenden';
        
        if (rarityList.children.length === 0) {
            Storage.RARITIES.forEach(r => {
                const li = document.createElement('li');
                li.className = 'rarity-row';
                li.innerHTML = `
                    <span class="rarity-chance" style="color: ${r.color}">${r.name} (${r.chance}%)</span>
                    <span class="rarity-animals">${r.animals.join(' ')}</span>
                `;
                rarityList.appendChild(li);
            });
        }
    } else {
        infoCard.style.display = 'none';
        toggleInfoBtn.textContent = '📊 Wahrscheinlichkeiten ansehen';
    }
});

window.updateHomeUI();
window.updateProfileUI();