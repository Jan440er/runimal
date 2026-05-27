const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');

navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        views.forEach(view => view.classList.remove('active'));
        
        const targetId = item.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');
        
        if (targetId !== 'view-runs') {
            document.querySelectorAll('.run-item-clickable').forEach(runItem => {
                runItem.classList.remove('expanded');
            });
        }

        if(targetId === 'view-track' && typeof map !== 'undefined' && map !== null) {
            setTimeout(() => { map.invalidateSize(); }, 100);
        }
    });
});

const collectionList = document.getElementById('collectionList');
const animalCountDisplay = document.getElementById('animalCount');
const runsList = document.getElementById('runsList');

const inventoryList = document.getElementById('inventoryList');
const boxResult = document.getElementById('boxResult');
const toggleInfoBtn = document.getElementById('toggleInfoBtn');
const infoCard = document.getElementById('infoCard');
const probTableContainer = document.getElementById('probTableContainer');

const weightInput = document.getElementById('setting-weight');
const heightInput = document.getElementById('setting-height');
const stat1Select = document.getElementById('setting-stat1');
const stat2Select = document.getElementById('setting-stat2');
const stat3Select = document.getElementById('setting-stat3');

function loadAndApplySettings() {
    const s = Storage.getSettings();
    weightInput.value = s.weight;
    heightInput.value = s.height;
    stat1Select.value = s.stat1;
    stat2Select.value = s.stat2;
    stat3Select.value = s.stat3;
    
    if(typeof window.renderStats === 'function') window.renderStats();
}

function handleSettingsChange() {
    const newSettings = {
        weight: parseFloat(weightInput.value) || 75,
        height: parseFloat(heightInput.value) || 175,
        stat1: stat1Select.value,
        stat2: stat2Select.value,
        stat3: stat3Select.value
    };
    Storage.saveSettings(newSettings);
    if(typeof window.renderStats === 'function') window.renderStats();
}

[weightInput, heightInput, stat1Select, stat2Select, stat3Select].forEach(el => {
    el.addEventListener('change', handleSettingsChange);
    el.addEventListener('input', handleSettingsChange);
});

window.updateHomeUI = function() {
    const animals = Storage.getAnimals();
    
    const playerStats = Storage.getPlayerStats();
    document.getElementById('playerLevelDisplay').textContent = playerStats.level;
    const nextLevelXp = playerStats.level * 100;
    document.getElementById('playerXPDisplay').textContent = `${playerStats.xp}/${nextLevelXp}`;
    document.getElementById('playerXPBar').style.width = `${(playerStats.xp / nextLevelXp) * 100}%`;
    
    animalCountDisplay.textContent = animals.length;
    collectionList.innerHTML = '';
    
    const getRarityIndex = (emoji) => {
        return Storage.RARITIES.findIndex(r => r.animals.includes(emoji));
    };

    // NEU: Aktuellen Sortier-Wert aus dem Dropdown auslesen
    const sortSelect = document.getElementById('sortCollectionSelect');
    const sortValue = sortSelect ? sortSelect.value : 'rarity_desc';

    // NEU: Dynamische Sortierungslogik basierend auf der Auswahl
    animals.sort((a, b) => {
        const rA = getRarityIndex(a.id);
        const rB = getRarityIndex(b.id);
        
        if (sortValue === 'rarity_desc') {
            if (rA !== rB) return rB - rA; // Seltenheit absteigend
            if (a.level !== b.level) return b.level - a.level;
            return b.cards - a.cards;
        } 
        else if (sortValue === 'rarity_asc') {
            if (rA !== rB) return rA - rB; // Seltenheit aufsteigend
            if (a.level !== b.level) return a.level - b.level;
            return a.cards - b.cards;
        } 
        else if (sortValue === 'lvl_desc') {
            if (a.level !== b.level) return b.level - a.level; // Level absteigend
            if (rA !== rB) return rB - rA;
            return b.cards - a.cards;
        } 
        else if (sortValue === 'lvl_asc') {
            if (a.level !== b.level) return a.level - b.level; // Level aufsteigend
            if (rA !== rB) return rA - rB;
            return a.cards - b.cards;
        } 
        else if (sortValue === 'near_levelup') {
            // Berechnet das Verhältnis der vorhandenen Karten zu den benötigten Karten
            const reqA = Storage.getCardsRequired(a.level);
            const reqB = Storage.getCardsRequired(b.level);
            const progA = a.cards / reqA;
            const progB = b.cards / reqB;
            
            if (progA !== progB) return progB - progA; // Höchster Fortschritt (Nähe Level-Up) zuerst
            if (rA !== rB) return rB - rA;
            return b.level - a.level;
        }
        return 0;
    });
    
    animals.forEach(animal => {
        let rarityObj = null;
        for (let r of Storage.RARITIES) {
            if (r.animals.includes(animal.id)) {
                rarityObj = r;
                break;
            }
        }

        const li = document.createElement('li');
        li.className = 'animal-item';
        
        const reqCards = Storage.getCardsRequired(animal.level);
        const canLevelUp = animal.cards >= reqCards;
        
        if (rarityObj) {
            li.style.border = `2px solid ${rarityObj.color}`;
        }
        
        li.innerHTML = `
            <div class="animal-level-badge">Lvl ${animal.level}</div>
            <span class="animal-emoji">${animal.id}</span>
            <span class="animal-rarity-label" style="color: ${rarityObj ? rarityObj.color : '#000'}">
                ${rarityObj ? rarityObj.name : 'Unbekannt'}
            </span>
            <div class="animal-cards-info">
                Karten: ${animal.cards} / ${reqCards}
            </div>
            <button class="btn level-up-btn ${canLevelUp ? 'primary' : ''}" ${canLevelUp ? '' : 'disabled'}>
                Level Up
            </button>
        `;
        
        li.querySelector('.level-up-btn').addEventListener('click', () => {
            if (Storage.levelUpAnimal(animal.id)) {
                window.updateHomeUI(); 
            }
        });
        
        collectionList.appendChild(li);
    });

    if (animals.length === 0) {
        collectionList.innerHTML = '<li style="grid-column: 1/-1; text-align: left; background: none; box-shadow: none;">Noch keine Tiere. Öffne Boxen!</li>';
    }

    const runs = Storage.getRuns();
    runsList.innerHTML = '';
    
    runs.forEach(run => {
        const li = document.createElement('li');
        li.className = 'run-item-clickable';
        
        const animalsHtml = run.animals && run.animals.length > 0 
            ? `<div class="run-animals">Gezogen: ${run.animals.join(' ')}</div>` 
            : `<div class="run-animals" style="color:#aaa; font-size: 0.9rem;">Keine Tiere gezogen</div>`;

        let splitsHtml = '<p><strong>⏱️ Kilometer-Splits:</strong></p><ul class="splits-list">';
        if (run.splits && run.splits.length > 0) {
            run.splits.forEach((splitTime, index) => {
                splitsHtml += `<li><span>Kilometer ${index + 1}:</span> <strong>${splitTime} min/km</strong></li>`;
            });
        } else {
            splitsHtml += '<li>Keine Splits aufgezeichnet (Lauf zu kurz).</li>';
        }
        splitsHtml += '</ul>';

        let pausesHtml = '';
        if (run.pauses && run.pauses.length > 0) {
            pausesHtml = `<p style="margin-top: 15px;"><strong>⏸️ Pausen (Gesamt: ${run.totalPauseTime}):</strong></p><ul class="splits-list" style="color: #888;">`;
            run.pauses.forEach((p, idx) => {
                const kmMark = p.km ? `bei km ${p.km}` : 'unbekannter km';
                pausesHtml += `<li><span>Pause ${idx + 1} (${kmMark}):</span> <strong>${p.duration}</strong></li>`;
            });
            pausesHtml += '</ul>';
        }

        li.innerHTML = `
            <div class="run-header">
                <span class="run-date">${run.date}</span>
                <span class="run-stats">${run.distance} km • ${run.time} • ${run.pace} min/km</span>
            </div>
            ${animalsHtml}
            <div class="run-details">
                ${splitsHtml}
                ${pausesHtml}
                <div class="run-map" id="map-${run.id}"></div>
            </div>
        `;
        
        li.addEventListener('click', (e) => {
            if (e.target.closest('.run-map')) return; 

            const isExpanded = li.classList.contains('expanded');
            
            document.querySelectorAll('.run-item-clickable').forEach(item => {
                item.classList.remove('expanded');
            });

            if (!isExpanded) {
                li.classList.add('expanded');
                
                setTimeout(() => {
                    const runMapId = `map-${run.id}`;
                    const mapContainer = document.getElementById(runMapId);
                    
                    if (mapContainer && !mapContainer._leaflet_id) {
                        if ((run.routeSegments && run.routeSegments.length > 0) || (run.route && run.route.length > 0)) {
                            const subMap = L.map(runMapId, { zoomControl: false });
                            
                            const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                                maxZoom: 19
                            });
                            const satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                                maxZoom: 19
                            });
                            const cleanColorLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                                maxZoom: 20
                            });

                            streetLayer.addTo(subMap);
                            
                            L.control.layers({
                                "Straßen": streetLayer,
                                "Satellit": satLayer,
                                "Klar": cleanColorLayer
                            }, null, { position: 'topright' }).addTo(subMap);
                            
                            let allCoords = [];

                            if (run.routeSegments) {
                                run.routeSegments.forEach(segment => {
                                    const color = segment.type === 'pause' ? '#aaaaaa' : '#4CAF50';
                                    const dashArray = segment.type === 'pause' ? '5, 8' : null;
                                    const weight = segment.type === 'pause' ? 3 : 4;
                                    
                                    L.polyline(segment.coords, {color: color, weight: weight, dashArray: dashArray}).addTo(subMap);
                                    allCoords.push(...segment.coords);
                                });
                            } else {
                                L.polyline(run.route, {color: '#4CAF50', weight: 4}).addTo(subMap);
                                allCoords = run.route;
                            }
                            
                            if (allCoords.length > 0) {
                                subMap.fitBounds(L.latLngBounds(allCoords), { padding: [15, 15] });
                                L.circleMarker(allCoords[0], {radius: 5, fillColor: '#4CAF50', color: '#fff', weight: 2, fillOpacity: 1}).addTo(subMap);
                                L.circleMarker(allCoords[allCoords.length - 1], {radius: 5, fillColor: '#f44336', color: '#fff', weight: 2, fillOpacity: 1}).addTo(subMap);
                            }
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
    const allBoxes = Storage.getBoxes();
    inventoryList.innerHTML = '';

    Storage.BOX_TYPES.forEach(boxConfig => {
        const ownedCount = allBoxes.filter(b => b.type === boxConfig.id).length;
        
        const li = document.createElement('li');
        li.className = 'inventory-item';
        li.innerHTML = `
            <div class="inventory-info">
                <span style="font-size: 2rem;">${boxConfig.icon}</span>
                <div>
                    <div style="font-weight: bold;">${boxConfig.name}</div>
                    <div style="font-size: 0.85rem; color: #777;">Besitz: ${ownedCount}</div>
                </div>
            </div>
            <button class="btn primary small open-btn" data-type="${boxConfig.id}" ${ownedCount === 0 ? 'disabled' : ''}>Öffnen</button>
        `;
        inventoryList.appendChild(li);
    });

    document.querySelectorAll('.open-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const typeToOpen = e.target.getAttribute('data-type');
            handleBoxOpen(typeToOpen);
        });
    });
}

function handleBoxOpen(boxType) {
    const box = Storage.consumeBox(boxType);
    if (!box) return; 

    const boxConfig = Storage.BOX_TYPES.find(b => b.id === boxType);
    
    const rand = Math.random() * 100;
    let currentProbability = 0;
    let drawnAnimal = null;
    let drawnRarity = null;

    for (let i = 0; i < Storage.RARITIES.length; i++) {
        const rarityDef = Storage.RARITIES[i];
        const chanceForThisRarity = boxConfig.chances[i];
        
        currentProbability += chanceForThisRarity;
        
        if (rand <= currentProbability && chanceForThisRarity > 0) {
            drawnAnimal = rarityDef.animals[Math.floor(Math.random() * rarityDef.animals.length)];
            drawnRarity = rarityDef;
            break;
        }
    }

    if (!drawnAnimal) {
        drawnRarity = Storage.RARITIES[0];
        drawnAnimal = drawnRarity.animals[Math.floor(Math.random() * drawnRarity.animals.length)];
    }

    const allKnownAnimals = Storage.getAnimals();
    const isNew = !allKnownAnimals.find(a => a.id === drawnAnimal);

    Storage.saveAnimal(drawnAnimal);
    if(box.runId) {
        Storage.addAnimalToRun(box.runId, drawnAnimal);
    }

    boxResult.innerHTML = `
        <div class="animal-item" style="border: 3px solid ${drawnRarity.color}; display: inline-block; padding: 20px; transform: scale(1.2);">
            <div style="font-size: 3rem;">${drawnAnimal}</div>
            <div style="font-size: 0.9rem; color: ${drawnRarity.color}; margin-top: 5px; font-weight: bold; text-transform: uppercase;">
                ${drawnRarity.name}
            </div>
            <div style="font-size: 0.8rem; font-weight: bold; margin-top: 10px; color: ${isNew ? 'var(--primary)' : '#555'};">
                ${isNew ? '✨ Neues Tier entdeckt!' : '+1 Karte gesammelt!'}
            </div>
            <div style="font-size: 0.7rem; color: #555; margin-top: 5px;">Aus ${boxConfig.name}</div>
        </div>
    `;

    updateProfileUI();
    updateHomeUI();
}

toggleInfoBtn.addEventListener('click', () => {
    if (infoCard.style.display === 'none') {
        infoCard.style.display = 'block';
        toggleInfoBtn.textContent = '📊 Wahrscheinlichkeiten ausblenden';
        
        if (probTableContainer.innerHTML === '') {
            let tableHtml = '<table class="prob-table"><thead><tr><th>Box</th>';
            Storage.RARITIES.forEach(r => {
                tableHtml += `<th style="color: ${r.color}">${r.name}</th>`;
            });
            tableHtml += '</tr></thead><tbody>';

            Storage.BOX_TYPES.forEach(box => {
                tableHtml += `<tr><td>${box.icon}<br><span style="font-size:0.7rem">${box.name}</span></td>`;
                box.chances.forEach(chance => {
                    tableHtml += `<td>${chance > 0 ? chance + '%' : '-'}</td>`;
                });
                tableHtml += '</tr>';
            });
            tableHtml += '</tbody></table>';
            
            probTableContainer.innerHTML = tableHtml;
        }
    } else {
        infoCard.style.display = 'none';
        toggleInfoBtn.textContent = '📊 Wahrscheinlichkeiten ansehen';
    }
});

// NEU: Event-Listener für das Umschalten des Sortierungs-Dropdowns anbinden
document.addEventListener('DOMContentLoaded', () => {
    const sortSelectEl = document.getElementById('sortCollectionSelect');
    if (sortSelectEl) {
        sortSelectEl.addEventListener('change', () => window.updateHomeUI());
    }
});

loadAndApplySettings();
window.updateHomeUI();
window.updateProfileUI();