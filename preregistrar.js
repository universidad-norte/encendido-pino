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
let currentPass = null;

function initFirebase() {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    dbRef = firebase.database().ref('evento_pino');
}

function adjustPeople(delta) {
    const input = document.getElementById('prePeople');
    let val = parseInt(input.value, 10) + delta;
    if (val < 1) val = 1;
    if (val > 15) val = 15;
    input.value = val;
    document.getElementById('peopleDisplay').innerText = val;
    document.getElementById('foodSummary').innerText = `${val} churro(s) y ${val} chocolate(s)`;
}

async function generateUniquePreCode(length = 5) {
    // Se omiten 0, O, 1, I, L para evitar confusiones al leerlo o dictarlo
    const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

    for (let attempt = 0; attempt < 15; attempt++) {
        let code = '';
        for (let i = 0; i < length; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const candidate = `PRE-${code}`;
        const snap = await dbRef.child('preregistros').child(candidate).once('value');
        if (!snap.exists()) return candidate;
    }

    return `PRE-${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

function priorityText(prio) {
    const labels = {
        normal: 'Acceso General',
        adulto_mayor: 'Prioridad: Adulto Mayor',
        ninos: 'Prioridad: Niños <10',
        discapacidad: 'Prioridad: Discapacidad'
    };
    return labels[prio] || 'Acceso General';
}

async function handlePreregister(e) {
    e.preventDefault();
    const btn = document.getElementById('btnPreregister');
    const name = document.getElementById('preName').value.trim();
    const contact = document.getElementById('preContact').value.trim();
    const personType = document.querySelector('input[name="personType"]:checked')?.value || 'Alumno';
    const priority = document.querySelector('input[name="priority"]:checked')?.value || 'normal';
    const people = parseInt(document.getElementById('prePeople').value, 10);

    if (!name || !contact || people < 1) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando pase...';

    try {
        const preCode = await generateUniquePreCode();
        const passData = {
            preCode,
            name,
            contact,
            personType,
            priority,
            people,
            churros: people,
            chocolates: people,
            checkedIn: false,
            assignedFolio: null,
            createdAt: new Date().toISOString()
        };

        await dbRef.child('preregistros').child(preCode).set(passData);
        localStorage.setItem('PINO_MY_PREREGISTER', JSON.stringify(passData));
        showGeneratedPass(passData);
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
    } catch (err) {
        alert('Hubo un problema de conexión. Verifica tu internet e intenta nuevamente.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-qrcode"></i> Generar Mi Pase QR de Prerregistro';
    }
}

function showGeneratedPass(pass) {
    currentPass = pass;
    document.getElementById('formSection').classList.add('hidden');
    document.getElementById('passResultSection').classList.remove('hidden');

    document.getElementById('passCode').innerText = pass.preCode;
    document.getElementById('passName').innerText = pass.name;
    document.getElementById('passMeta').innerText = `${pass.personType} • ${priorityText(pass.priority)}`;
    document.getElementById('passPeople').innerText = pass.people;
    document.getElementById('passChurros').innerText = pass.churros;
    document.getElementById('passChocolates').innerText = pass.chocolates;

    const qrBox = document.getElementById('passQrContainer');
    qrBox.innerHTML = '';
    new QRCode(qrBox, {
        text: pass.preCode,
        width: 170,
        height: 170,
        colorDark: "#0f172a",
        colorLight: "#ffffff"
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForNewPreregister() {
    document.getElementById('preregisterForm').reset();
    adjustPeople(0);
    document.getElementById('passResultSection').classList.add('hidden');
    document.getElementById('formSection').classList.remove('hidden');
}

async function downloadFullPassImage() {
    const card = document.getElementById('printablePassCard');
    const btn = document.getElementById('btnDownloadPass');
    if (!card || !currentPass) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando imagen...';

    try {
        // Esperar a que las fuentes estén listas para renderizado nítido
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }

        const canvas = await html2canvas(card, {
            scale: 3, // Alta resolución para celular
            backgroundColor: '#020617', // Fondo oscuro elegante detrás de las esquinas redondeadas
            useCORS: true,
            logging: false
        });

        const link = document.createElement('a');
        link.download = `Pase_${currentPass.preCode}_EncendidoPino.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (err) {
        alert('No se pudo generar la imagen automáticamente. Puedes tomar captura de pantalla directamente.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-image"></i> Guardar Pase Completo';
    }
}

function sharePassWhatsApp() {
    if (!currentPass) return;
    const text = `🎄 *Encendido del Pino - Pase de Prerregistro*%0A%0A*Código:* ${currentPass.preCode}%0A*Responsable:* ${currentPass.name}%0A*Personas:* ${currentPass.people} (${currentPass.churros} churros y ${currentPass.chocolates} chocolates)%0A%0APresenta este código en el módulo de *Check-in* al llegar al evento para activar tu turno de foto con Santa.`;
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
}

function toggleLookupModal() {
    document.getElementById('lookupError').classList.add('hidden');
    document.getElementById('lookupModal').classList.toggle('hidden');
}

function searchExistingPass() {
    const query = document.getElementById('lookupInput').value.trim().toLowerCase();
    if (!query || !dbRef) return;

    dbRef.child('preregistros').once('value', (snap) => {
        const all = snap.val() || {};
        const found = Object.values(all).find(p =>
            String(p.preCode).toLowerCase() === query ||
            String(p.contact).toLowerCase() === query
        );

        if (found) {
            toggleLookupModal();
            showGeneratedPass(found);
        } else {
            document.getElementById('lookupError').classList.remove('hidden');
        }
    });
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
