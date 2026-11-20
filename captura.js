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
let isSubmitting = false;
let appState = { tickets: {}, currentTurnId: null, sequenceNumber: 1 };

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

function setConnectionUI(online) {
    isConnected = online;
    const badge = document.getElementById('connectionBadge');
    const btn = document.getElementById('btnSubmitTicket');

    if (online) {
        badge.className = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
        badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400"></span> En línea (Sincronizado)';
        if (!isSubmitting) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Registrar e Imprimir Ticket';
        }
    } else {
        badge.className = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/30';
        badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-400 animate-ping"></span> Reconectando...';
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-wifi"></i> Esperando conexión...';
    }
}

function initFirebase() {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    dbRef = firebase.database().ref('evento_pino');

    // Monitor oficial de conexión de Firebase (detecta bloqueos de pantalla y cortes de red al instante)
    firebase.database().ref('.info/connected').on('value', (snap) => {
        setConnectionUI(snap.val() === true);
    });

    // Escucha en tiempo real de los tickets y el turno activo
    dbRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            appState.tickets = data.tickets || {};
            appState.currentTurnId = data.currentTurnId || null;
            const maxExisting = getHighestFolioNumber(appState.tickets);
            appState.sequenceNumber = Math.max(data.sequenceNumber || 1, maxExisting + 1);
        }
        localStorage.setItem('PINO_SANTA_APP_BACKUP', JSON.stringify(appState));
    });
}

function adjustCount(delta) {
    const input = document.getElementById('inputPeople');
    let val = parseInt(input.value) + delta;
    if (val < 1) val = 1;
    if (val > 20) val = 20;
    input.value = val;
    document.getElementById('peopleDisplay').innerText = val;
    document.getElementById('summaryCount').innerText = val;
    document.getElementById('summaryCountMug').innerText = val;
}

function handleRegister(e) {
    e.preventDefault();
    if (!isConnected || isSubmitting || !dbRef) return;

    const nameInput = document.getElementById('inputName');
    const peopleInput = document.getElementById('inputPeople');
    const personType = document.querySelector('input[name="personType"]:checked')?.value || 'Alumno';
    const priority = document.querySelector('input[name="priority"]:checked')?.value || 'normal';
    const name = nameInput.value.trim();
    const people = parseInt(peopleInput.value);
    if (!name || people < 1) return;

    isSubmitting = true;
    const btn = document.getElementById('btnSubmitTicket');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Reservando Folio...';

    const maxExisting = getHighestFolioNumber(appState.tickets);
    let assignedNumber = null;

    // TRANSACCIÓN ATÓMICA EN EL SERVIDOR: garantiza que sequenceNumber nunca se reinicie ni duplique
    dbRef.child('sequenceNumber').transaction((currentSeq) => {
        const safeBase = Math.max(currentSeq || 1, maxExisting + 1);
        assignedNumber = safeBase;
        return safeBase + 1;
    }, (error, committed) => {
        isSubmitting = false;
        setConnectionUI(isConnected);

        if (error || !committed || !assignedNumber) {
            alert('No se pudo confirmar el folio con el servidor. Verifica tu conexión e intenta de nuevo.');
            return;
        }

        const folioStr = 'T-' + String(assignedNumber).padStart(3, '0');
        const ticketId = 'id_' + Date.now() + '_' + assignedNumber;
        const newTicket = {
            id: ticketId,
            folio: folioStr,
            name,
            people,
            personType,
            priority,
            source: 'ONSITE',
            churros: people,
            chocolates: people,
            photoStatus: 'WAITING',
            foodClaimed: false,
            createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        // Escritura atómica únicamente sobre el nuevo ticket (y currentTurnId si no hay nadie en escenario)
        const updates = {};
        updates[`tickets/${ticketId}`] = newTicket;
        if (!appState.currentTurnId) {
            updates['currentTurnId'] = ticketId;
        }

        dbRef.update(updates).then(() => {
            renderTicketPreview(newTicket);
            confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
            nameInput.value = '';
            peopleInput.value = 1;
            adjustCount(0);
            nameInput.focus();
        });
    });
}

function renderTicketPreview(ticket) {
    document.getElementById('ticketFolio').innerText = ticket.folio;
    document.getElementById('ticketName').innerText = ticket.name;
    document.getElementById('ticketChurros').innerText = ticket.churros;
    document.getElementById('ticketChocolates').innerText = ticket.chocolates;
    const qrContainer = document.getElementById('qrcode');
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, { text: ticket.folio, width: 120, height: 120, colorDark: "#0f172a", colorLight: "#ffffff" });
}

function shareWhatsApp() {
    const folio = document.getElementById('ticketFolio').innerText;
    const name = document.getElementById('ticketName').innerText;
    const text = `🎄 *Universidad - Encendido del Pino*%0A%0A¡Hola ${name}! Tu ticket para la foto con Santa Claus es *${folio}*.%0AMantente atento a la pantalla de turnos.`;
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
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