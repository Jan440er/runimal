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
    
    runs.forEach(run => {
        const li = document.createElement('li');
        const animalsHtml = run.animals && run.animals.length > 0 
            ? `<div class="run-animals">Gezogen: ${run.animals.join(' ')}</div>` 
            : `<div class="run-animals" style="color:#aaa; font-size: 0.9rem;">Keine Tiere gezogen</div>`;

        li.innerHTML = `
            <div class="run-header">
                <span class="run-date">${run.date}</span>
                <span class="run-stats">${run.distance} km • ${run.time} • ${run.speed} km/h</span>
            </div>
            ${animalsHtml}
        `;
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

    // NEU: Greift nun sicher auf Storage.RARITIES zu
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

// NEU: Toggle-Mechanik repariert (Prüft jetzt children.length statt innerHTML)
toggleInfoBtn.addEventListener('click', () => {
    if (infoCard.style.display === 'none') {
        infoCard.style.display = 'block';
        toggleInfoBtn.textContent = '📊 Wahrscheinlichkeiten ausblenden';
        
        // NEU: Verhindert Fehlschlagen durch Kommentare/Whitespaces
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