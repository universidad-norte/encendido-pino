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
let isConnected = false;
let isProcessing = false;
let html5QrScanner = null;
let cameraActive = false;

let appState = {
    tickets: {},
    preregistros: {},
    currentTurnId: null,
    sequenceNumber: 1
};

let pendingValidationPass = null;
let lastAssignedTicket = null;

function initFirebase() {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    dbRef = firebase.database().ref('evento_pino');

    firebase.database().ref('.info/connected').on('value', (snap) => {
        isConnected = snap.val() === true;
        const badge = document.getElementById('connBadge');
        if (isConnected) {
            badge.className = 'inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
            badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400"></span> En línea';
        } else {
            badge.className = 'inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/30';
            badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-400 animate-ping"></span> Reconectando...';
        }
    });

    dbRef.on('value', (snapshot) => {
        const data = snapshot.val() || {};
        appState.tickets = data.tickets || {};
        appState.preregistros = data.preregistros || {};
        appState.currentTurnId = data.currentTurnId || null;
        appState.sequenceNumber = data.sequenceNumber || 1;
        updateStatsCounter();
    });
}

function updateStatsCounter() {
    const all = Object.values(appState.preregistros || {});
    const activated = all.filter(p => p.checkedIn).length;
    document.getElementById('checkedInCounter').innerText = `${activated} / ${all.length}`;
}

function getHighestFolioNumber(ticketsObj) {
    let maxFolio = 0;
    Object.values(ticketsObj || {}).forEach(t => {
        if (t && t.folio) {
            const num = parseInt(String(t.folio).replace(/\D/g, ''), 10);
            if (!isNaN(num) && num > maxFolio) maxFolio = num;
        }
    });
    return maxFolio;
}

/* --- ESCÁNER DE CÁMARA --- */
async function toggleCameraScanner() {
    const btn = document.getElementById('btnToggleCamera');
    const placeholder = document.getElementById('cameraPlaceholder');

    if (cameraActive && html5QrScanner) {
        await html5QrScanner.stop();
        html5QrScanner.clear();
        cameraActive = false;
        placeholder.classList.remove('hidden');
        btn.innerHTML = '<i class="fa-solid fa-video"></i> Activar Cámara';
        btn.className = 'px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-2';
        return;
    }

    try {
        placeholder.classList.add('hidden');
        html5QrScanner = new Html5Qrcode('qrReader');
        await html5QrScanner.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 220, height: 220 } },
            (decodedText) => {
                playBeep();
                lookupPreregister(decodedText);
            }
        );
        cameraActive = true;
        btn.innerHTML = '<i class="fa-solid fa-video-slash"></i> Apagar Cámara';
        btn.className = 'px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-2';
    } catch (err) {
        placeholder.classList.remove('hidden');
        showFeedback('No se pudo acceder a la cámara. Verifica los permisos o usa la búsqueda manual.', 'error');
    }
}

function handleManualSearch(e) {
    e.preventDefault();
    const val = document.getElementById('manualCodeInput').value.trim();
    if (!val) return;
    lookupPreregister(val);
}

function lookupPreregister(rawQuery) {
    const query = String(rawQuery).trim().toUpperCase();
    const allPre = Object.values(appState.preregistros || {});

    const found = allPre.find(p =>
        String(p.preCode).toUpperCase() === query ||
        String(p.preCode).toUpperCase() === `PRE-${query}` ||
        String(p.contact).toUpperCase() === query
    );

    if (!found) {
        showFeedback(`No existe ningún prerregistro con "${rawQuery}". Verifica el código o envíalo a Puesto 1.`, 'error');
        return;
    }

    if (found.checkedIn) {
        showFeedback(`⚠️ Este pase (${found.preCode}) YA fue activado anteriormente con el turno ${found.assignedFolio || ''}.`, 'warning');
        return;
    }

    hideFeedback();
    openValidationCard(found);
}

function openValidationCard(pass) {
    pendingValidationPass = { ...pass };
    document.getElementById('idleHintCard').classList.add('hidden');
    document.getElementById('assignedTicketCard').classList.add('hidden');
    document.getElementById('validationCard').classList.remove('hidden');

    document.getElementById('valPreCode').innerText = pass.preCode;
    document.getElementById('valName').innerText = pass.name;
    document.getElementById('valMeta').innerText = `${pass.personType} • Contacto: ${pass.contact}`;
    document.getElementById('valPeopleDisplay').innerText = pass.people;

    const prioRadio = document.querySelector(`input[name="valPriority"][value="${pass.priority || 'normal'}"]`);
    if (prioRadio) prioRadio.checked = true;
}

function adjustValidatedPeople(delta) {
    if (!pendingValidationPass) return;
    let val = (parseInt(pendingValidationPass.people, 10) || 1) + delta;
    if (val < 1) val = 1;
    if (val > 15) val = 15;
    pendingValidationPass.people = val;
    document.getElementById('valPeopleDisplay').innerText = val;
}

function cancelValidation() {
    pendingValidationPass = null;
    document.getElementById('validationCard').classList.add('hidden');
    document.getElementById('idleHintCard').classList.remove('hidden');
}

function confirmCheckinAndAssignTurn() {
    if (!pendingValidationPass || !isConnected || isProcessing || !dbRef) return;

    isProcessing = true;
    const btn = document.getElementById('btnConfirmCheckin');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Asignando Turno...';

    const confirmedPriority = document.querySelector('input[name="valPriority"]:checked')?.value || 'normal';
    const confirmedPeople = parseInt(pendingValidationPass.people, 10) || 1;
    const maxExisting = getHighestFolioNumber(appState.tickets);
    let assignedNumber = null;

    // Transacción atómica en el servidor para asignar el folio real de fila
    dbRef.child('sequenceNumber').transaction((currentSeq) => {
        const safeBase = Math.max(currentSeq || 1, maxExisting + 1);
        assignedNumber = safeBase;
        return safeBase + 1;
    }, (error, committed) => {
        isProcessing = false;
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-check-circle text-xl"></i> Confirmar Check-in y Asignar Turno';

        if (error || !committed || !assignedNumber) {
            showFeedback('Error de red al reservar el turno. Intenta de nuevo.', 'error');
            return;
        }

        const folioStr = 'T-' + String(assignedNumber).padStart(3, '0');
        const ticketId = 'id_' + Date.now() + '_' + assignedNumber;

        const newTicket = {
            id: ticketId,
            folio: folioStr,
            name: pendingValidationPass.name,
            people: confirmedPeople,
            personType: pendingValidationPass.personType || 'Alumno',
            priority: confirmedPriority,
            source: 'PREREGISTER',
            preCode: pendingValidationPass.preCode,
            churros: confirmedPeople,
            chocolates: confirmedPeople,
            photoStatus: 'WAITING',
            foodClaimed: false,
            createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        const updates = {};
        updates[`tickets/${ticketId}`] = newTicket;
        updates[`preregistros/${pendingValidationPass.preCode}/checkedIn`] = true;
        updates[`preregistros/${pendingValidationPass.preCode}/assignedFolio`] = folioStr;
        updates[`preregistros/${pendingValidationPass.preCode}/checkedInAt`] = new Date().toISOString();

        if (!appState.currentTurnId) {
            updates['currentTurnId'] = ticketId;
        }

        dbRef.update(updates).then(() => {
            lastAssignedTicket = newTicket;
            pendingValidationPass = null;
            document.getElementById('manualCodeInput').value = '';
            showAssignedTicket(newTicket);
            confetti({ particleCount: 55, spread: 65, origin: { y: 0.7 } });
        });
    });
}

function showAssignedTicket(ticket) {
    document.getElementById('validationCard').classList.add('hidden');
    document.getElementById('assignedTicketCard').classList.remove('hidden');

    const prioLabels = {
        normal: 'Acceso General',
        adulto_mayor: 'Prioridad: Adulto Mayor',
        ninos: 'Prioridad: Niños <10',
        discapacidad: 'Prioridad: Discapacidad'
    };

    document.getElementById('assignedFolio').innerText = ticket.folio;
    document.getElementById('assignedName').innerText = ticket.name;
    document.getElementById('assignedPriority').innerText = `${ticket.personType} • ${prioLabels[ticket.priority] || 'Acceso General'}`;
    document.getElementById('assignedChurros').innerText = ticket.churros;
    document.getElementById('assignedChocolates').innerText = ticket.chocolates;

    const qrBox = document.getElementById('assignedQr');
    qrBox.innerHTML = '';
    new QRCode(qrBox, {
        text: ticket.folio,
        width: 125,
        height: 125,
        colorDark: '#0f172a',
        colorLight: '#ffffff'
    });
}

function shareAssignedWhatsApp() {
    if (!lastAssignedTicket) return;
    const t = lastAssignedTicket;
    const text = `🎄 *Encendido del Pino - Turno Activado*%0A%0A*Turno en Fila:* ${t.folio}%0A*Responsable:* ${t.name}%0A*Vales:* ${t.churros} churro(s) y ${t.chocolates} chocolate(s)%0A%0AMantente atento a la pantalla de turnos para tu foto con Santa.`;
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
}

function showFeedback(msg, type) {
    const el = document.getElementById('scanFeedback');
    el.classList.remove('hidden');
    if (type === 'error') {
        el.className = 'p-4 rounded-2xl text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/40';
    } else {
        el.className = 'p-4 rounded-2xl text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40';
    }
    el.innerText = msg;
}

function hideFeedback() {
    document.getElementById('scanFeedback').classList.add('hidden');
}

function playBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(1046.5, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
}

function createSnow() {
    const container = document.getElementById('snowContainer');
    for (let i = 0; i < 20; i++) {
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
    createSnow();
    initFirebase();
});