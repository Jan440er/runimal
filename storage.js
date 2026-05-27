// storage.js
const Storage = {
    RARITIES: [
        { name: 'Gewöhnlich', animals: ['🐰', '🐿️', '🐭', '🦔', '🐦'], color: '#9e9e9e' },
        { name: 'Ungewöhnlich', animals: ['🐸', '🐢', '🦆', '🦉', '🦇'], color: '#4caf50' },
        { name: 'Selten', animals: ['🦊', '🐗', '🦌', '🐺', '🐍'], color: '#2196f3' },
        { name: 'Episch', animals: ['🦅', '🐻', '🦍', '🐊', '🐅'], color: '#9c27b0' },
        { name: 'Legendär', animals: ['🦄', '🐉', '🦖', '🦣', '🦁'], color: '#ff9800' }
    ],

    BOX_TYPES: [
        { id: '50m', name: 'Standard (50m)', icon: '📦', chances: [95, 5, 0, 0, 0] },
        { id: '500m', name: 'Bronze (500m)', icon: '🥉', chances: [85, 12, 3, 0, 0] },
        { id: '5km', name: 'Silber (5km)', icon: '🥈', chances: [70, 20, 8, 2, 0] },
        { id: '10km', name: 'Gold (10km)', icon: '🥇', chances: [60, 25, 11, 3, 1] },
        { id: '21km', name: 'Diamant (21km)', icon: '💎', chances: [50, 30, 15, 4, 1] }
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

    // NEU: Player XP System
    getPlayerStats: () => {
        const data = localStorage.getItem('runSafariPlayer');
        return data ? JSON.parse(data) : { xp: 0, level: 1 };
    },

    // NEU: Erfahrungspunkte hinzufügen und Level Ups berechnen
    addPlayerXP: (amount) => {
        const stats = Storage.getPlayerStats();
        stats.xp += amount;
        
        // Spieler levelt auf, wenn XP das Cap erreichen (Level * 100)
        while (stats.xp >= stats.level * 100) {
            stats.xp -= stats.level * 100;
            stats.level++;
        }
        localStorage.setItem('runSafariPlayer', JSON.stringify(stats));
    },

    // NEU: Tiere sind jetzt Objekte { id, level, cards }
    getAnimals: () => {
        const data = localStorage.getItem('runSafariAnimals');
        let animals = data ? JSON.parse(data) : [];
        
        // NEU: Migration für existierende Spieler (alte String-Einträge zu Objekten konvertieren)
        if (animals.length > 0 && typeof animals[0] === 'string') {
            const migrated = {};
            animals.forEach(a => {
                if(!migrated[a]) migrated[a] = { id: a, level: 1, cards: 0 };
                else migrated[a].cards++;
            });
            animals = Object.values(migrated);
            localStorage.setItem('runSafariAnimals', JSON.stringify(animals));
        }
        return animals;
    },

    // NEU: Tier speichern oder Karte hinzufügen
    saveAnimal: (animalEmoji) => {
        const animals = Storage.getAnimals();
        const existing = animals.find(a => a.id === animalEmoji);
        
        if (existing) {
            existing.cards++; // Tier bereits vorhanden -> Karte hinzufügen
        } else {
            animals.push({ id: animalEmoji, level: 1, cards: 0 }); // Neues Tier
        }
        
        localStorage.setItem('runSafariAnimals', JSON.stringify(animals));
    },

    // NEU: Wie viele Karten braucht das Tier fürs nächste Level? (Lvl 1 -> 1, Lvl 2 -> 2 etc.)
    getCardsRequired: (level) => {
        return level; 
    },

    // NEU: Führt das Level Up für ein Tier aus
    levelUpAnimal: (animalEmoji) => {
        const animals = Storage.getAnimals();
        const animal = animals.find(a => a.id === animalEmoji);
        if (animal) {
            const req = Storage.getCardsRequired(animal.level);
            if (animal.cards >= req) {
                animal.cards -= req;
                animal.level++;
                
                // Spieler bekommt XP für das Leveln (10 XP mal das neue Tier-Level)
                Storage.addPlayerXP(animal.level * 10); 
                
                localStorage.setItem('runSafariAnimals', JSON.stringify(animals));
                return true;
            }
        }
        return false;
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

    saveBoxes: (runId, earnedBoxesMap) => {
        const boxes = Storage.getBoxes();
        for (const [boxId, count] of Object.entries(earnedBoxesMap)) {
            for(let i=0; i<count; i++) {
                boxes.push({ type: boxId, runId: runId, uid: Date.now() + Math.random() }); 
            }
        }
        localStorage.setItem('runSafariBoxes', JSON.stringify(boxes));
    },

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