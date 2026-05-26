const Storage = {
    RARITIES: [
        { name: 'Gewöhnlich', animals: ['🐰', '🐿️', '🐭', '🦔', '🐦'], color: '#9e9e9e' },
        { name: 'Ungewöhnlich', animals: ['🐸', '🐢', '🦆', '🦉', '🦇'], color: '#4caf50' },
        { name: 'Selten', animals: ['🦊', '🐗', '🦌', '🐺', '🐍'], color: '#2196f3' },
        { name: 'Episch', animals: ['🦅', '🐻', '🦍', '🐊', '🐅'], color: '#9c27b0' },
        { name: 'Legendär', animals: ['🦄', '🐉', '🦖', '🦣', '🦁'], color: '#ff9800' }
    ],

    // NEU: Konfiguration der verschiedenen Box-Typen und deren Wahrscheinlichkeiten (entspricht Index in RARITIES)
    BOX_TYPES: [
        { id: '50m', name: 'Standard (50m)', icon: '📦', chances: [95, 5, 0, 0, 0] },
        { id: '500m', name: 'Bronze (500m)', icon: '🥉', chances: [85, 12, 3, 0, 0] },
        { id: '5km', name: 'Silber (5km)', icon: '🥈', chances: [70, 20, 8, 2, 0] },
        { id: '10km', name: 'Gold (10km)', icon: '🥇', chances: [60, 25, 11, 3, 1] },
        { id: '21km', name: 'Diamant (21km)', icon: '💎', chances: [50, 30, 15, 4, 1] } // Die "alten" originalen Wahrscheinlichkeiten
    ],

    getSettings: () => {
        const data = localStorage.getItem('runSafariSettings');
        return data ? JSON.parse(data) : {
            weight: 75,
            height: 175,
            stat1: 'distance',
            stat2: 'time',
            stat3: 'pace'
        };
    },

    saveSettings: (settingsObj) => {
        localStorage.setItem('runSafariSettings', JSON.stringify(settingsObj));
    },

    getAnimals: () => {
        const data = localStorage.getItem('runSafariAnimals');
        return data ? JSON.parse(data) : [];
    },

    saveAnimal: (animal) => {
        const animals = Storage.getAnimals();
        animals.unshift(animal); 
        localStorage.setItem('runSafariAnimals', JSON.stringify(animals));
    },

    getRuns: () => {
        const data = localStorage.getItem('runSafariRuns');
        return data ? JSON.parse(data) : [];
    },

    saveRun: (distance, timeStr, paceStr, routeSegments, splits, totalPauseTime, pauses) => {
        const runs = Storage.getRuns();
        const runId = Date.now();
        
        const now = new Date();
        const timeStrExact = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
        const dateStrExact = `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`;
        const exactDateTime = `${timeStrExact} ${dateStrExact}`;

        const newRun = {
            id: runId,
            date: exactDateTime, 
            distance: distance,
            time: timeStr,
            pace: paceStr,   
            routeSegments: routeSegments, 
            splits: splits,
            totalPauseTime: totalPauseTime, 
            pauses: pauses, 
            animals: [] 
        };
        runs.unshift(newRun); 
        if (runs.length > 10) runs.pop(); 
        localStorage.setItem('runSafariRuns', JSON.stringify(runs));
        return runId;
    },

    addAnimalToRun: (runId, animalEmoji) => {
        const runs = Storage.getRuns();
        const runIndex = runs.findIndex(r => r.id === runId);
        if(runIndex !== -1) {
            runs[runIndex].animals.push(animalEmoji);
            localStorage.setItem('runSafariRuns', JSON.stringify(runs));
        }
    },

    getBoxes: () => {
        const data = localStorage.getItem('runSafariBoxes');
        return data ? JSON.parse(data) : [];
    },

    // NEU: Nimmt nun ein Objekt entgegen { '50m': 2, '500m': 1 ... }
    saveBoxes: (runId, earnedBoxesMap) => {
        const boxes = Storage.getBoxes();
        for (const [boxId, count] of Object.entries(earnedBoxesMap)) {
            for(let i=0; i<count; i++) {
                // Jede Box bekommt einen eindeutigen Typ und eine Run-ID
                boxes.push({ type: boxId, runId: runId, uid: Date.now() + Math.random() }); 
            }
        }
        localStorage.setItem('runSafariBoxes', JSON.stringify(boxes));
    },

    // NEU: Konsumiert nun explizit eine Box eines bestimmten Typs
    consumeBox: (boxType) => {
        const boxes = Storage.getBoxes();
        const index = boxes.findIndex(b => b.type === boxType);
        if(index !== -1) {
            const box = boxes.splice(index, 1)[0]; 
            localStorage.setItem('runSafariBoxes', JSON.stringify(boxes));
            return box;
        }
        return null; 
    }
};