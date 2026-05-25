// NEU: RARITIES fest in das Storage-Objekt integriert, um Scope-Probleme zu vermeiden
const Storage = {
    RARITIES: [
        { name: 'Gewöhnlich', chance: 50, animals: ['🐰', '🐿️', '🐭', '🦔', '🐦'], color: '#9e9e9e' },
        { name: 'Ungewöhnlich', chance: 30, animals: ['🐸', '🐢', '🦆', '🦉', '🦇'], color: '#4caf50' },
        { name: 'Selten', chance: 15, animals: ['🦊', '🐗', '🦌', '🐺', '🐍'], color: '#2196f3' },
        { name: 'Episch', chance: 4, animals: ['🦅', '🐻', '🦍', '🐊', '🐅'], color: '#9c27b0' },
        { name: 'Legendär', chance: 1, animals: ['🦄', '🐉', '🦖', '🦣', '🦁'], color: '#ff9800' }
    ],

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

    saveRun: (distance, timeStr, speed) => {
        const runs = Storage.getRuns();
        const runId = Date.now();
        const newRun = {
            id: runId,
            date: new Date().toLocaleDateString('de-DE'),
            distance: distance,
            time: timeStr,
            speed: speed,
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

    saveBoxes: (runId, count) => {
        const boxes = Storage.getBoxes();
        for(let i=0; i<count; i++) {
            boxes.push({ runId: runId }); 
        }
        localStorage.setItem('runSafariBoxes', JSON.stringify(boxes));
    },

    consumeBox: () => {
        const boxes = Storage.getBoxes();
        if(boxes.length > 0) {
            const box = boxes.shift(); 
            localStorage.setItem('runSafariBoxes', JSON.stringify(boxes));
            return box.runId;
        }
        return null; 
    }
};