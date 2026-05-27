// NEU: Komplette Test-Datei zum Simulieren von Läufen
function addTestRun() {
    const distance = 22.00; // 22 km
    const timeStr = "00:10"; // 10 sek
    const paceStr = "00:00"; // Egal
    const routeSegments = []; // Keine echte Route auf der Karte
    const splits = [];
    const totalPauseTimeStr = "00:00";
    const pauses = [];
    
    // Lauf speichern
    const runId = Storage.saveRun(
        distance.toFixed(2),
        timeStr,
        paceStr,
        routeSegments,
        splits,
        totalPauseTimeStr,
        pauses
    );

    // Entsprechende Boxen für 22 km simulieren und vergeben
    const earnedBoxes = { '50m': 1, '500m': 1, '5km': 1, '10km': 1, '21km': 1 };
    Storage.saveBoxes(runId, earnedBoxes);

    alert("Test-Lauf (22 km in 10s) erfolgreich hinzugefügt! Alle zugehörigen Boxen wurden deinem Inventar gutgeschrieben.");
    
    // UI aktualisieren
    if(typeof window.updateHomeUI === 'function') window.updateHomeUI();
    if(typeof window.updateProfileUI === 'function') window.updateProfileUI();
}

// Event-Listener anbinden, sobald das DOM geladen ist
document.addEventListener('DOMContentLoaded', () => {
    const testBtn = document.getElementById('addTestRunBtn');
    if (testBtn) {
        testBtn.addEventListener('click', addTestRun);
    }
});