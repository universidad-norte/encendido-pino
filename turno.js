const firebaseConfig = {
    apiKey: "AIzaSyBgmjx_hm3s712V1aTkS46DKepSvQakeF0",
    authDomain: "encendido-pino.firebaseapp.com",
    databaseURL: "https://encendido-pino-default-rtdb.firebaseio.com",
    projectId: "encendido-pino",
    storageBucket: "encendido-pino.firebasestorage.app",
    messagingSenderId: "694845523416",
    appId: "1:694845523416:web:7a69c674bb89309b619ead"
};

let dbRef = null;
let appState = { tickets: {}, currentTurnId: null, sequenceNumber: 1 };
let contingencyTurn = parseInt(localStorage.getItem('PINO_CONTINGENCY_TURN') || '1', 10);

function initFirebase() {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    dbRef = firebase.database().ref('evento_pino');

    firebase.database().ref('.info/connected').on('value', (snap) => {
        const statusEl = document.getElementById('turnoConnStatus');
        if (snap.val() === true) {
            statusEl.className = 'inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-400';
            statusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400"></span> Nube Activa';
        } else {
            statusEl.className = 'inline-flex items-center gap-1.5 text-[11px] font-bold text-red-400';
            statusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-400 animate-ping"></span> Sin Conexión';
        }
    });

    dbRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            appState.tickets = data.tickets || {};
            appState.currentTurnId = data.currentTurnId || null;
            appState.sequenceNumber = data.sequenceNumber || 1;
        }
        localStorage.setItem('PINO_SANTA_APP_BACKUP', JSON.stringify(appState));
        if (document.getElementById('screenModeSelect').value !== 'contingency') {
            renderTurnScreen();
        }
    });
}

function syncTurnUpdates(updates) {
    if (dbRef) dbRef.update(updates);
    localStorage.setItem('PINO_SANTA_APP_BACKUP', JSON.stringify(appState));
}

function getTicketsArray() { return Object.values(appState.tickets || {}); }

const PRIORITY_ORDER = { discapacidad: 0, ninos: 1, adulto_mayor: 2, normal: 3, undefined: 3 };

function getFolioNum(folio) {
    return parseInt(String(folio || '0').replace(/\D/g, ''), 10) || 0;
}

function sortTicketsByPriorityAndFolio(list) {
    return list.sort((a, b) => {
        const prioDiff = (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
        if (prioDiff !== 0) return prioDiff;
        return getFolioNum(a.folio) - getFolioNum(b.folio);
    });
}

function getWaitingQueue() {
    const waiting = getTicketsArray()
        .filter(t => t.photoStatus === 'WAITING' && t.id !== appState.currentTurnId);
    return sortTicketsByPriorityAndFolio(waiting);
}

function getPendingQueue() {
    return getTicketsArray()
        .filter(t => t.photoStatus === 'PENDING' && t.id !== appState.currentTurnId)
        .sort((a, b) => getFolioNum(a.folio) - getFolioNum(b.folio));
}

function fixQueueToFirst() {
    const allWaiting = sortTicketsByPriorityAndFolio(
        getTicketsArray().filter(t => t.photoStatus === 'WAITING')
    );
    if (allWaiting.length > 0) {
        appState.currentTurnId = allWaiting[0].id;
        syncTurnUpdates({ currentTurnId: allWaiting[0].id });
        renderTurnScreen();
    }
}

function priorityBadge(priority) {
    const map = {
        adulto_mayor: { label: 'Adulto Mayor', cls: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: 'fa-person-cane' },
        ninos:        { label: 'Niños <10',    cls: 'bg-pink-500/20 text-pink-300 border-pink-500/30',  icon: 'fa-child' },
        discapacidad: { label: 'Discapacidad', cls: 'bg-purple-500/20 text-purple-300 border-purple-500/30', icon: 'fa-wheelchair' },
        rescatado:    { label: 'Preferencia (Rezagado)', cls: 'bg-orange-500/20 text-orange-300 border-orange-500/30', icon: 'fa-rotate-left' }
    };
    const p = map[priority];
    if (!p) return '';
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full border ${p.cls}"><i class="fa-solid ${p.icon}"></i> ${p.label}</span>`;
}

function renderTurnScreen() {
    let current = appState.currentTurnId && appState.tickets[appState.currentTurnId]
        ? appState.tickets[appState.currentTurnId] : null;

    if (current) {
        document.getElementById('displayCurrentTurnFolio').innerText = current.folio;
        document.getElementById('displayCurrentTurnName').innerText = current.name;
        document.getElementById('displayCurrentTurnGroup').innerText = `${current.people} integrante(s) en la foto`;
        document.getElementById('displayCurrentTurnPriority').innerHTML = current.wasPending
            ? priorityBadge('rescatado')
            : priorityBadge(current.priority);
    } else {
        document.getElementById('displayCurrentTurnFolio').innerText = "---";
        document.getElementById('displayCurrentTurnName').innerText = "Sin turnos pendientes";
        document.getElementById('displayCurrentTurnGroup').innerText = "Fila despejada";
        document.getElementById('displayCurrentTurnPriority').innerHTML = '';
    }
    renderNextTurnsGrid();
    renderPendingTurnsGrid();
}

function renderNextTurnsGrid() {
    const grid = document.getElementById('displayNextTurnsGrid');
    grid.innerHTML = '';
    const waiting = getWaitingQueue().slice(0, 10);
    for (let i = 0; i < 10; i++) {
        const ticket = waiting[i];
        const card = document.createElement('div');
        if (ticket) {
            card.className = "bg-slate-800/90 border border-slate-700/80 p-4 rounded-2xl text-center shadow flex flex-col justify-between";
            card.innerHTML = `
                <div>
                    <span class="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Lugar #${i + 1}</span>
                    <div class="text-2xl font-extrabold text-gold-400 font-christmas my-1">${ticket.folio}</div>
                    <div class="text-xs font-semibold text-white truncate">${ticket.name}</div>
                    <div class="mt-1">${priorityBadge(ticket.priority)}</div>
                </div>
                <div class="text-[10px] text-emerald-400 font-medium mt-2">${ticket.people} pers.</div>
            `;
        } else {
            card.className = "bg-slate-900/40 border border-slate-800 p-4 rounded-2xl text-center text-slate-600 flex flex-col justify-center items-center min-h-[100px]";
            card.innerHTML = `<span class="text-xs">Libre</span>`;
        }
        grid.appendChild(card);
    }
}

function renderPendingTurnsGrid() {
    const section = document.getElementById('pendingSection');
    const grid = document.getElementById('displayPendingTurnsGrid');
    const badge = document.getElementById('pendingCountBadge');
    const pendingList = getPendingQueue();

    badge.innerText = pendingList.length;

    if (pendingList.length === 0) {
        section.classList.add('hidden');
        grid.innerHTML = '';
        return;
    }

    section.classList.remove('hidden');
    grid.innerHTML = '';
    const isOperator = document.getElementById('screenModeSelect').value === 'operator';

    pendingList.forEach(ticket => {
        const card = document.createElement('div');
        card.className = "bg-orange-950/40 border border-orange-500/40 p-4 rounded-2xl text-center shadow flex flex-col justify-between";
        card.innerHTML = `
            <div>
                <span class="text-[10px] uppercase tracking-widest text-orange-400 font-bold">En Pausa</span>
                <div class="text-2xl font-extrabold text-orange-300 font-christmas my-1">${ticket.folio}</div>
                <div class="text-xs font-semibold text-white truncate">${ticket.name}</div>
                <div class="text-[10px] text-slate-300 mt-1">${ticket.people} pers.</div>
            </div>
            ${isOperator ? `
            <button onclick="rescuePendingTurn('${ticket.id}')" class="operator-only-btn mt-3 w-full py-2 px-2 bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow">
                <i class="fa-solid fa-bolt"></i> Pasar Ahora
            </button>` : ''}
        `;
        grid.appendChild(card);
    });
}

function advanceNextTurn() {
    const updates = {};
    if (appState.currentTurnId && appState.tickets[appState.currentTurnId]) {
        appState.tickets[appState.currentTurnId].photoStatus = 'ATTENDED';
        updates[`tickets/${appState.currentTurnId}/photoStatus`] = 'ATTENDED';
    }
    const next = getWaitingQueue();
    appState.currentTurnId = next.length > 0 ? next[0].id : null;
    updates['currentTurnId'] = appState.currentTurnId;

    syncTurnUpdates(updates);
    renderTurnScreen();
    callCurrentTurn();
}

function moveCurrentToPending() {
    if (!appState.currentTurnId || !appState.tickets[appState.currentTurnId]) return;

    const updates = {};
    appState.tickets[appState.currentTurnId].photoStatus = 'PENDING';
    updates[`tickets/${appState.currentTurnId}/photoStatus`] = 'PENDING';
    
    const next = getWaitingQueue();
    appState.currentTurnId = next.length > 0 ? next[0].id : null;
    updates['currentTurnId'] = appState.currentTurnId;

    syncTurnUpdates(updates);
    renderTurnScreen();
    callCurrentTurn();
}

function rescuePendingTurn(ticketId) {
    const rescuedTicket = appState.tickets[ticketId];
    if (!rescuedTicket) return;

    const updates = {};
    if (appState.currentTurnId && appState.tickets[appState.currentTurnId] && appState.currentTurnId !== ticketId) {
        const displaced = appState.tickets[appState.currentTurnId];
        if (displaced.photoStatus !== 'ATTENDED') {
            displaced.photoStatus = 'WAITING';
            updates[`tickets/${appState.currentTurnId}/photoStatus`] = 'WAITING';
        }
    }

    rescuedTicket.photoStatus = 'WAITING';
    rescuedTicket.wasPending = true;
    appState.currentTurnId = ticketId;

    updates[`tickets/${ticketId}/photoStatus`] = 'WAITING';
    updates[`tickets/${ticketId}/wasPending`] = true;
    updates['currentTurnId'] = ticketId;

    syncTurnUpdates(updates);
    renderTurnScreen();
    callCurrentTurn();
}

function callCurrentTurn() {
    if (!appState.currentTurnId || !appState.tickets[appState.currentTurnId]) return;
    const current = appState.tickets[appState.currentTurnId];
    playTurnSound();
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        setTimeout(() => {
            const speech = new SpeechSynthesisUtterance(`Turno ${current.folio}, ${current.name}, favor de pasar a la foto con Santa.`);
            speech.lang = 'es-MX';
            speech.rate = 0.9;
            window.speechSynthesis.speak(speech);
        }, 700);
    }
}

/* --- MODO CONTINGENCIA OFFLINE INTEGRADO --- */
function handleModeChange() {
    const mode = document.getElementById('screenModeSelect').value;
    document.getElementById('operatorControlsGroup').classList.toggle('hidden', mode !== 'operator');
    document.getElementById('contingencyControlsGroup').classList.toggle('hidden', mode !== 'contingency');
    document.getElementById('nextTurnsSection').classList.toggle('hidden', mode === 'contingency');

    if (mode === 'contingency') {
        document.getElementById('pendingSection').classList.add('hidden');
        renderContingencyScreen(false);
    } else {
        renderTurnScreen();
    }
}

function renderContingencyScreen(speak = false) {
    const folio = 'T-' + String(contingencyTurn).padStart(3, '0');
    const nextFolio = 'T-' + String(contingencyTurn + 1).padStart(3, '0');
    document.getElementById('displayCurrentTurnFolio').innerText = folio;
    document.getElementById('displayCurrentTurnName').innerText = 'Modo Contingencia Secuencial';
    document.getElementById('displayCurrentTurnGroup').innerText = `Siguiente en prepararse: ${nextFolio}`;
    document.getElementById('displayCurrentTurnPriority').innerHTML = '';
    localStorage.setItem('PINO_CONTINGENCY_TURN', contingencyTurn);
    if (speak) announceContingency();
}

function stepContingency(delta) {
    if (contingencyTurn + delta >= 1) {
        contingencyTurn += delta;
        renderContingencyScreen(delta > 0);
    }
}

function setContingencyManual() {
    const val = parseInt(document.getElementById('manualContingencyInput').value, 10);
    if (!isNaN(val) && val >= 1) {
        contingencyTurn = val;
        document.getElementById('manualContingencyInput').value = '';
        renderContingencyScreen(true);
    }
}

function announceContingency() {
    playTurnSound();
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        setTimeout(() => {
            const speech = new SpeechSynthesisUtterance(`Turno ${contingencyTurn}, favor de pasar a la foto con Santa.`);
            speech.lang = 'es-MX';
            speech.rate = 0.95;
            window.speechSynthesis.speak(speech);
        }, 600);
    }
}

function playTurnSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880, now + 0.15);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 1.2);
    } catch(e){}
}

function createSnow() {
    const container = document.getElementById('snowContainer');
    for (let i = 0; i < 25; i++) {
        const flake = document.createElement('div');
        flake.className = 'snowflake';
        flake.innerHTML = '❄';
        flake.style.left = Math.random() * 100 + 'vw';
        flake.style.animationDuration = (Math.random() * 5 + 5) + 's';
        flake.style.animationDelay = (Math.random() * 5) + 's';
        flake.style.opacity = Math.random();
        flake.style.fontSize = (Math.random() * 10 + 12) + 'px';
        container.appendChild(flake);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('PINO_DASH_AUTH') !== '1') {
        document.querySelectorAll('.nav-restricted').forEach(el => el.classList.add('hidden'));
    }
    createSnow();
    initFirebase();
});
