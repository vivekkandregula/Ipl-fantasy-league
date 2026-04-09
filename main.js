const matchesBody = document.getElementById('matches-body');
const acronymInput = document.getElementById('acronym-input');
const saveTeamsBtn = document.getElementById('save-teams-btn');
const breakdownList = document.getElementById('breakdown-list');
const breakdownPlayerName = document.getElementById('breakdown-player-name');

const addPlayerBtn = document.getElementById('add-player-btn');
const newPlayerNameInput = document.getElementById('new-player-name');
const playerSelect = document.getElementById('player-select');
const leaderboardList = document.getElementById('leaderboard-list');
const currentPlayerNameSpan = document.getElementById('current-player-name');
const rankingContainer = document.getElementById('ranking-container');

// Array where index matches the rank (0 = 1st, 1 = 2nd...)
const pointsMapping = [8, 7, 6, 5, 4, 3, 2, 1, -2, -4];

let currentMatches = []; 
let defaultTeams = []; 
let players = []; // Array of { id, name, rankings: [], score: 0 }
let selectedPlayerId = null;

const acronymMap = {
    'CSK': 'Chennai Super Kings',
    'DC': 'Delhi Capitals',
    'GT': 'Gujarat Titans',
    'KKR': 'Kolkata Knight Riders',
    'LSG': 'Lucknow Super Giants',
    'MI': 'Mumbai Indians',
    'PBKS': 'Punjab Kings',
    'RR': 'Rajasthan Royals',
    'RCB': 'Royal Challengers Bengaluru',
    'SRH': 'Sunrisers Hyderabad'
};

function getAcronym(fullName) {
    return Object.keys(acronymMap).find(key => acronymMap[key] === fullName);
}

async function fetchInitialData(isManualSync = false) {
    try {
        const btn = document.getElementById('sync-results-btn');
        if(isManualSync && btn) {
            btn.innerHTML = 'Syncing Data...';
            btn.style.opacity = '0.7';
        }
        
        const [teamsRes, matchesRes] = await Promise.all([
            fetch('/api/teams'),
            fetch('/api/matches')
        ]);
        
        const teamsResult = await teamsRes.json();
        const matchesResult = await matchesRes.json();
        
        defaultTeams = teamsResult.teams || [];
        currentMatches = matchesResult.matches || [];
        
        loadPlayers();

        // Update Last Synced stamp
        const now = new Date();
        const syncLabel = document.getElementById('last-synced-time');
        if(syncLabel) syncLabel.textContent = `Last Synced: ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}`;

        if(isManualSync && btn) {
            btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 0.4rem; margin-top: -2px;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.92-10.26l3.08-3.08"/></svg> Sync Latest Results';
            btn.style.opacity = '1';
        }
    } catch (error) {
        console.error("Error fetching live data", error);
        alert('Failed to fetch the latest match data from the backend.');
        if(isManualSync) {
            const btn = document.getElementById('sync-results-btn');
            if(btn) {
                btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 0.4rem; margin-top: -2px;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.92-10.26l3.08-3.08"/></svg> Sync Latest Results';
                btn.style.opacity = '1';
            }
        }
    }
}

// Match Table rendering component removed as layout was changed

async function loadPlayers() {
    try {
        const res = await fetch('/api/players');
        const data = await res.json();
        
        if (data.players && Array.isArray(data.players)) {
            players = data.players;
        }
        
        // Ensure default rankings integrity
        players.forEach(p => {
            let list = [...(p.rankings || [])];
            const missing = defaultTeams.filter(t => !list.includes(t));
            list = [...list.filter(t => defaultTeams.includes(t)), ...missing];
            p.rankings = list;
        });

        updatePlayerSelectors();
        calculateAllScores();
        renderLeaderboard();
        
        if(players.length > 0) {
            if(!selectedPlayerId || !players.find(p => p.id === selectedPlayerId)){
                selectPlayer(players[0].id);
            } else {
                selectPlayer(selectedPlayerId);
            }
        } else {
            selectedPlayerId = null;
            if(currentPlayerNameSpan) currentPlayerNameSpan.textContent = '';
            if(document.getElementById('acronym-input')) document.getElementById('acronym-input').value = '';
        }
        
        renderBreakdown(); // Show global breakdown immediately
        renderAllSquads(); // Show squads dashboard
    } catch (err) {
        console.error("Failed to load players from backend:", err);
    }
}

async function savePlayers() {
    try {
        await fetch('/api/players', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ players: players })
        });
    } catch (err) {
        console.error("Failed to save players to backend:", err);
    }
}

async function addPlayer() {
    const name = newPlayerNameInput.value.trim();
    if (!name) return;
    
    const baseRankings = [...defaultTeams].sort((a,b) => a.localeCompare(b));
    
    const newPlayer = {
        id: Date.now().toString(),
        name: name,
        rankings: baseRankings,
        score: 0,
        lastUpdatedAt: new Date().toISOString()
    };
    
    players.push(newPlayer);
    await savePlayers();
    newPlayerNameInput.value = '';
    
    updatePlayerSelectors();
    selectPlayer(newPlayer.id);
    calculateAllScores();
    renderLeaderboard();
    renderBreakdown();
    renderAllSquads();
}

function updatePlayerSelectors() {
    playerSelect.innerHTML = '';
    if (players.length === 0) {
        const opt = document.createElement('option');
        opt.value = "";
        opt.textContent = "No players added...";
        playerSelect.appendChild(opt);
        rankingContainer.style.opacity = '0.5';
        rankingContainer.style.pointerEvents = 'none';
        return;
    }
    
    rankingContainer.style.opacity = '1';
    rankingContainer.style.pointerEvents = 'auto';

    players.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        playerSelect.appendChild(opt);
    });
}

function selectPlayer(id) {
    if (!id) return;
    selectedPlayerId = id;
    playerSelect.value = id;
    
    const player = players.find(p => p.id === id);
    if (player) {
        currentPlayerNameSpan.textContent = player.name;
        renderAcronymInput(player.rankings);
        highlightLeaderboardActive(id);
    }
}

function renderAcronymInput(teamNamesArray) {
    const acronyms = teamNamesArray.map(name => getAcronym(name)).join(', ');
    if (acronymInput) {
        acronymInput.value = acronyms;
    }
}

function calculateAllScores() {
    players.forEach(player => {
        let score = 0;
        currentMatches.forEach(match => {
            if (match.status === 'completed' && match.winner !== 'None') {
                const winnerIndex = player.rankings.indexOf(match.winner);
                if (winnerIndex !== -1) score += pointsMapping[winnerIndex];
            } else if (match.status === 'no_result') {
                const index1 = player.rankings.indexOf(match.team1);
                const index2 = player.rankings.indexOf(match.team2);
                let pts1 = index1 !== -1 ? pointsMapping[index1] : -99;
                let pts2 = index2 !== -1 ? pointsMapping[index2] : -99;
                score += Math.max(pts1, pts2);
            }
        });
        player.score = score;
    });
    players.sort((a,b) => b.score - a.score);
}

function renderLeaderboard() {
    leaderboardList.innerHTML = '';
    if (players.length === 0) {
        leaderboardList.innerHTML = '<div class="empty-state">Add players to see scores.</div>';
        return;
    }
    
    players.forEach((p, index) => {
        const div = document.createElement('div');
        div.className = `leaderboard-item ${p.id === selectedPlayerId ? 'active' : ''}`;
        div.onclick = () => selectPlayer(p.id);
        
        let medal = '';
        if(index === 0) medal = '🥇 ';
        if(index === 1) medal = '🥈 ';
        if(index === 2) medal = '🥉 ';
        
        div.innerHTML = `
            <div class="leaderboard-name">${medal}${p.name}</div>
            <div class="leaderboard-score">${p.score}</div>
        `;
        leaderboardList.appendChild(div);
    });
}

function renderAllSquads() {
    const allSquadsList = document.getElementById('all-squads-list');
    if(!allSquadsList) return;
    
    allSquadsList.innerHTML = '';
    if (players.length === 0) {
        allSquadsList.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;">No players added.</div>';
        return;
    }
    
    players.forEach(p => {
        const div = document.createElement('div');
        div.style.background = 'rgba(255,255,255,0.05)';
        div.style.padding = '1.2rem';
        div.style.borderRadius = '8px';
        div.style.border = '1px solid var(--glass-border)';
        
        const acronyms = p.rankings.map(name => getAcronym(name)).join(', ');
        const updatedStr = p.lastUpdatedAt ? new Date(p.lastUpdatedAt).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : 'Prior to tracking';
        
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom: 0.8rem;">
                <strong style="color:var(--text-main); font-size: 1.1rem; font-weight: 600;">${p.name}</strong>
                <span style="font-weight:800; color:#20c997;">${p.score} pts</span>
            </div>
            <div style="color:var(--text-muted); font-size:0.95rem; font-family:monospace; line-height:1.4; word-spacing: 2px;">
                ${acronyms}
            </div>
            <div style="margin-top: 0.8rem; font-size: 0.75rem; color: #6b6f84; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 0.6rem;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle; margin-right:4px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                Last Squad Update: ${updatedStr}
            </div>
        `;
        allSquadsList.appendChild(div);
    });
}

function highlightLeaderboardActive(id) {
    document.querySelectorAll('.leaderboard-item').forEach(el => el.classList.remove('active'));
    renderLeaderboard();
}

function renderBreakdown() {
    breakdownList.innerHTML = '';
    if (currentMatches.length === 0) {
        breakdownList.innerHTML = '<div class="empty-state">No matches played yet.</div>';
        return;
    }
    if (players.length === 0) {
        breakdownList.innerHTML = '<div class="empty-state">Add players to see breakdown.</div>';
        return;
    }

    let thPlayers = players.map(p => `<th style="min-width: 90px; padding:1rem;">${p.name}</th>`).join('');
    
    // Setup running totals starting from their current total score
    let runningTotals = {};
    players.forEach(p => runningTotals[p.id] = p.score);
    
    let rowsHtml = currentMatches.map(match => {
        let matchLabel = match.team1 + ' vs ' + match.team2;
        let winnerLabel = match.status === 'no_result' ? '<span style="color:#4db8ff">Rain (Max Pts)</span>' : `<span style="color:#20c997">${match.winner}</span>`;
        
        let playerScoresHtml = players.map(player => {
            let pts = 0;
            if (match.status === 'completed' && match.winner !== 'None') {
                const wIdx = player.rankings.indexOf(match.winner);
                if(wIdx !== -1) pts = pointsMapping[wIdx];
            } else if (match.status === 'no_result') {
                const i1 = player.rankings.indexOf(match.team1);
                const i2 = player.rankings.indexOf(match.team2);
                let p1 = i1 !== -1 ? pointsMapping[i1] : -99;
                let p2 = i2 !== -1 ? pointsMapping[i2] : -99;
                pts = Math.max(p1, p2);
            }
            
            let totalAfterMatch = runningTotals[player.id];
            runningTotals[player.id] -= pts; // Subtract for the next (chronologically older) row
            
            const isNeg = pts < 0;
            return `
                <td style="padding:0.6rem;">
                    <div style="font-weight:bold; color:${isNeg ? '#ff6b6b' : '#20c997'}; font-size:1.1rem;">${pts > 0 ? '+' : ''}${pts}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">(Total: ${totalAfterMatch})</div>
                </td>
            `;
        }).join('');

        return `
            <tr>
                <td style="text-align:left; color:#a1a3b5; padding:0.6rem;">${matchLabel}</td>
                <td style="font-weight:600; padding:0.6rem;">${winnerLabel}</td>
                ${playerScoresHtml}
            </tr>
        `;
    }).join('');

    const tableHtml = `
        <table class="breakdown-table" style="width:100%; border-collapse: collapse; text-align:center;">
            <thead>
                <tr style="border-bottom: 2px solid var(--glass-border);">
                    <th style="padding:1rem; text-align:left;">Match Details</th>
                    <th style="padding:1rem;">Winner (Points trigger)</th>
                    ${thPlayers}
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
        </table>
    `;

    breakdownList.innerHTML = tableHtml;
}

// (Drag and drop logic removed)

// Event Listeners
addPlayerBtn.addEventListener('click', addPlayer);
newPlayerNameInput.addEventListener('keypress', (e) => {
    if(e.key === 'Enter') addPlayer();
});

playerSelect.addEventListener('change', (e) => {
    selectPlayer(e.target.value);
});

document.getElementById('rename-player-btn').addEventListener('click', async () => {
    if (!selectedPlayerId) return;
    const player = players.find(p => p.id === selectedPlayerId);
    if(player) {
        const newName = prompt("Enter new name for " + player.name + ":", player.name);
        if(newName && newName.trim() !== "") {
            player.name = newName.trim();
            await savePlayers();
            // Re-render components that show names
            updatePlayerSelectors();
            playerSelect.value = selectedPlayerId;
            currentPlayerNameSpan.textContent = player.name;
            renderLeaderboard();
            renderBreakdown();
            renderAllSquads();
        }
    }
});

document.getElementById('delete-player-btn').addEventListener('click', async () => {
    if (!selectedPlayerId) return;
    const player = players.find(p => p.id === selectedPlayerId);
    if(player) {
        if(confirm(`Are you sure you want to permanently delete ${player.name}?`)) {
            players = players.filter(p => p.id !== selectedPlayerId);
            await savePlayers();
            await loadPlayers(); // Full reload from backend to clear out IDs, update UI completely
        }
    }
});

saveTeamsBtn.addEventListener('click', async () => {
    if (!selectedPlayerId) return;
    const player = players.find(p => p.id === selectedPlayerId);
    if(player) {
        if (!acronymInput) return;
        
        const rawInput = acronymInput.value;
        const parts = rawInput.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
        
        if (parts.length !== 10) {
            alert('Please provide exactly 10 team acronyms separated by commas.');
            return;
        }
        
        const validKeys = Object.keys(acronymMap);
        const mappedTeams = [];
        for (let i = 0; i < parts.length; i++) {
            if (!validKeys.includes(parts[i])) {
                alert(`Invalid acronym found: ${parts[i]}`);
                return;
            }
            if (mappedTeams.includes(acronymMap[parts[i]])) {
                alert(`Duplicate acronym found: ${parts[i]}`);
                return;
            }
            mappedTeams.push(acronymMap[parts[i]]);
        }

        player.rankings = mappedTeams;
        player.lastUpdatedAt = new Date().toISOString();
        await savePlayers();
        calculateAllScores();
        renderLeaderboard();
        renderBreakdown();
        renderAllSquads();
        
        const btnText = saveTeamsBtn.textContent;
        saveTeamsBtn.textContent = 'Saved!';
        saveTeamsBtn.style.background = '#20c997';
        setTimeout(() => {
            saveTeamsBtn.textContent = btnText;
            saveTeamsBtn.style.background = '';
        }, 1500);
    }
});

const syncBtn = document.getElementById('sync-results-btn');
if(syncBtn) {
    syncBtn.addEventListener('click', () => {
        fetchInitialData(true);
    });
}

// 12:30 PM PT Auto Sync logic
function checkAutoSync() {
    const ptDateString = new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles"});
    const ptDate = new Date(ptDateString);
    const hours = ptDate.getHours();
    const minutes = ptDate.getMinutes();
    
    // Check if it is currently 12:30 PM PT (12:30)
    if (hours === 12 && minutes === 30) {
        const todayStr = ptDate.toDateString();
        if (localStorage.getItem('lastAutoSyncDate') !== todayStr) {
            console.log('Initiating 12:30 PM PT Auto Sync...');
            fetchInitialData(true);
            localStorage.setItem('lastAutoSyncDate', todayStr);
        }
    }
}

// Check every 60 seconds
setInterval(checkAutoSync, 60000);

// Init
document.addEventListener('DOMContentLoaded', fetchInitialData);
