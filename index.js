const firebaseConfig = {
    apiKey: "AIzaSyBgmjx_hm3s712V1aTkS46DKepSvQakeF0",
    authDomain: "encendido-pino.firebaseapp.com",
    databaseURL: "https://encendido-pino-default-rtdb.firebaseio.com",
    projectId: "encendido-pino",
    storageBucket: "encendido-pino.firebasestorage.app",
    messagingSenderId: "694845523416",
    appId: "1:694845523416:web:7a69c674bb89309b619ead"
};

// Cambia esta clave por tu contraseña operativa habitual
const DASHBOARD_PIN = "pino2026";

let dbRef = null;
let snapshotData = {};
let statusChartInstance = null;
let priorityChartInstance = null;

/* --- SEGURIDAD: BLOQUEO Y CONTRASEÑA --- */
function checkAuthState() {
    const isUnlocked = sessionStorage.getItem('PINO_DASH_AUTH') === '1';
    const lockModal = document.getElementById('lockScreenModal');
    const mainContent = document.getElementById('dashboardMainContent');

    if (isUnlocked) {
        lockModal.classList.add('hidden');
        mainContent.classList.remove('hidden');
        document.querySelectorAll('.nav-restricted').forEach(el => el.classList.remove('hidden'));
    } else {
        lockModal.classList.remove('hidden');
        mainContent.classList.add('hidden');
        document.querySelectorAll('.nav-restricted').forEach(el => el.classList.add('hidden'));
    }
}

function unlockDashboard(e) {
    e.preventDefault();
    const input = document.getElementById('dashPasswordInput');
    const err = document.getElementById('lockErrorMsg');

    if (input.value.trim() === DASHBOARD_PIN) {
        sessionStorage.setItem('PINO_DASH_AUTH', '1');
        input.value = '';
        err.classList.add('hidden');
        checkAuthState();
        renderDashboardMetrics(snapshotData);
    } else {
        err.classList.remove('hidden');
        input.select();
    }
}

function lockDashboard() {
    sessionStorage.removeItem('PINO_DASH_AUTH');
    checkAuthState();
}

/* --- CONEXIÓN FIREBASE --- */
function initFirebase() {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    dbRef = firebase.database().ref('evento_pino');

    firebase.database().ref('.info/connected').on('value', (snap) => {
        const badge = document.getElementById('dashConnBadge');
        if (snap.val() === true) {
            badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
            badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400"></span> En línea';
        } else {
            badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/20 text-red-300 border border-red-500/30';
            badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-400 animate-ping"></span> Reconectando';
        }
    });

    dbRef.on('value', (snap) => {
        snapshotData = snap.val() || {};
        renderDashboardMetrics(snapshotData);
    });
}

/* --- MÉTRICAS Y GRÁFICAS --- */
function renderDashboardMetrics(data) {
    const preregList = Object.values(data.preregistros || {});
    const ticketsList = Object.values(data.tickets || {});

    // 1. Prerregistros y Check-in
    const totalPrereg = preregList.length;
    const preregPeople = preregList.reduce((acc, p) => acc + (parseInt(p.people, 10) || 0), 0);
    const checkedInCount = preregList.filter(p => p.checkedIn).length;
    const pendingCheckin = totalPrereg - checkedInCount;
    const rate = totalPrereg > 0 ? Math.round((checkedInCount / totalPrereg) * 100) : 0;

    document.getElementById('statPreregTotal').innerText = totalPrereg;
    document.getElementById('statPreregPeople').innerText = `${preregPeople} personas proyectadas`;
    document.getElementById('statCheckedIn').innerText = checkedInCount;
    document.getElementById('statCheckinRate').innerText = `(${rate}%)`;
    document.getElementById('statPendingCheckin').innerText = `${pendingCheckin} pases aún sin llegar`;

    // 2. Turnos Activos (T-XXX)
    const totalTickets = ticketsList.length;
    const waitingCount = ticketsList.filter(t => t.photoStatus === 'WAITING' || t.photoStatus === 'PENDING').length;
    const attendedCount = ticketsList.filter(t => t.photoStatus === 'ATTENDED').length;

    document.getElementById('statTotalTickets').innerText = totalTickets;
    document.getElementById('statQueueBreakdown').innerText = `${waitingCount} en espera • ${attendedCount} atendidos`;

    // 3. Insumos (Churros & Chocolates)
    const activeFood = ticketsList.reduce((acc, t) => acc + (parseInt(t.churros, 10) || 0), 0);
    const claimedFood = ticketsList
        .filter(t => t.foodClaimed)
        .reduce((acc, t) => acc + (parseInt(t.churros, 10) || 0), 0);

    document.getElementById('statFoodActive').innerText = activeFood;
    document.getElementById('statFoodDetail').innerText = `${claimedFood} entregados • ${preregPeople} estimados prerreg.`;

    // 4. Actualizar Gráficas
    const prioCounts = {
        discapacidad: ticketsList.filter(t => t.priority === 'discapacidad').length,
        ninos: ticketsList.filter(t => t.priority === 'ninos').length,
        adulto_mayor: ticketsList.filter(t => t.priority === 'adulto_mayor').length,
        normal: ticketsList.filter(t => !t.priority || t.priority === 'normal').length
    };

    updateCharts({
        attended: attendedCount,
        waiting: waitingCount,
        pendingPre: pendingCheckin,
        prioCounts
    });
}

function updateCharts({ attended, waiting, pendingPre, prioCounts }) {
    const statusCanvas = document.getElementById('statusChart');
    const prioCanvas = document.getElementById('priorityChart');
    if (!statusCanvas || !prioCanvas) return;

    // Gráfica 1: Dona de Estado Operativo
    if (statusChartInstance) {
        statusChartInstance.data.datasets[0].data = [attended, waiting, pendingPre];
        statusChartInstance.update();
    } else {
        statusChartInstance = new Chart(statusCanvas, {
            type: 'doughnut',
            data: {
                labels: ['Fotos Atendidas', 'En Fila Activa', 'Prerreg. Sin Llegar'],
                datasets: [{
                    data: [attended, waiting, pendingPre],
                    backgroundColor: ['#16a34a', '#facc15', '#6366f1'],
                    borderColor: '#0f172a',
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#cbd5e1', font: { size: 12, weight: 'bold' } }
                    }
                }
            }
        });
    }

    // Gráfica 2: Barras por Prioridad
    const prioData = [
        prioCounts.discapacidad,
        prioCounts.ninos,
        prioCounts.adulto_mayor,
        prioCounts.normal
    ];

    if (priorityChartInstance) {
        priorityChartInstance.data.datasets[0].data = prioData;
        priorityChartInstance.update();
    } else {
        priorityChartInstance = new Chart(prioCanvas, {
            type: 'bar',
            data: {
                labels: ['Discapacidad', 'Niños <10', 'Adulto Mayor', 'General'],
                datasets: [{
                    label: 'Grupos Registrados',
                    data: prioData,
                    backgroundColor: ['#a855f7', '#ec4899', '#3b82f6', '#64748b'],
                    borderRadius: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        ticks: { color: '#cbd5e1', font: { size: 11, weight: 'bold' } },
                        grid: { display: false }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#94a3b8', stepSize: 1 },
                        grid: { color: 'rgba(148, 163, 184, 0.1)' }
                    }
                }
            }
        });
    }
}

function exportBackupJSON() {
    const blob = new Blob([JSON.stringify(snapshotData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    a.href = url;
    a.download = `respaldo_encendido_pino_${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
    checkAuthState();
    createSnow();
    initFirebase();
});