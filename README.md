# 🎄 Sistema de Gestión y Conteo Regresivo - Encendido del Pino Navideño 🎅

Un sistema web dinámico, festivo y sincronizado en tiempo real para optimizar la logística, toma de fotografías con Santa Claus y la entrega de insumos (churros y chocolate caliente) durante el evento del **Encendido del Pino Universitario**.

---

## 📸 Características Principales

El proyecto se compone de dos módulos principales desarrollados como **Single Page Applications (SPA)** nativas en HTML5, CSS3 (Tailwind) y JavaScript puro:

### 1. Sistema Multi-Puesto Sincronizado (`index.html`)
Diseñado para operarse desde 3 estaciones de trabajo distintas dentro del campus universitarios, sincronizando datos de forma omnicanal mediante **Firebase Realtime Database**:

* **Puesto 1 (Registro & Tickets):** Captura de estudiantes/responsables, cálculo automático de raciones de churros y chocolate, e impresión/generación de tickets físicos o digitales con **Código QR** y opción para compartir por WhatsApp.
* **Puesto 2 (Turnos & Proyección):** Pantalla para proyector o Smart TV que anuncia el turno fotográfico actual con síntesis de voz (*Text-to-Speech*) y campana festiva, además de un panel de pre-espera para los siguientes 10 turnos.
* **Puesto 3 (Entrega de Alimentos con Validaciones):** Escaneo e ingreso de folios para validar el canje de alimentos. **Incluye candado de seguridad** que impide la entrega si el grupo aún no ha pasado a la foto con Santa.
* **Dashboard Central:** Métrica ejecutiva en tiempo real sobre el porcentaje de asistencia, fotos tomadas e insumos entregados.

### 2. Conteo Regresivo Oficial (`conteo.html`)
Página de espera y proyección previa al encendido:
* Temporizador dinámico en días, horas, minutos y segundos.
* Ajuste de fecha objetivo desde la interfaz.
* Animación de caída de nieve y resplandor festivo.
* **Transición de celebración automática:** Al llegar a cero, se activa una ráfaga de confeti continuo y cambia la vista al mensaje oficial de pino encendido.

---

## 🛠️ Tecnologías Utilizadas

* **Frontend:** HTML5, JavaScript (ES6+), [Tailwind CSS](https://tailwindcss.com/) (vía CDN).
* **Librerías Visuales & Animaciones:** FontAwesome 6, Canvas Confetti, Chart.js, QRCode.js.
* **Sincronización en Nube:** [Firebase Realtime Database](https://firebase.google.com/) (Compat SDK v10.7.1).
* **Motor de Voz:** Web Speech API (Nativa del navegador).

---

## 🚀 Guía de Instalación y Configuración

### Prerrequisitos
No requiere instalación de entornos como Node.js, Python o servidores locales (Apache/Nginx). Únicamente necesitas un navegador web moderno (Google Chrome, Microsoft Edge o Mozilla Firefox) y conexión a Internet.

### Configuración de Firebase (Sincronización Multi-Dispositivo)

1. Ve a la [Consola de Firebase](https://console.firebase.google.com/) e inicia sesión con tu cuenta de Google.
2. Crea un nuevo proyecto llamado `encendido-pino`.
3. Ve a **Bases de datos y almacenamiento > Realtime Database** y haz clic en **Crear base de datos**.
4. Selecciona la regla en **Modo de Prueba** (o cambia en la pestaña *Reglas* a `".read": true, ".write": true`).
5. Copia tu objeto de configuración desde **Configuración del Proyecto ⚙️ > Tus aplicaciones > Web `</>`**.
6. Reemplaza las credenciales en la sección JavaScript del archivo `index.html`:

```javascript
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "tu-proyecto.firebaseapp.com",
    databaseURL: "https://tu-proyecto-default-rtdb.firebaseio.com",
    projectId: "tu-proyecto",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef..."
};
```

---

## 📁 Estructura del Repositorio

```text
├── index.html       # Aplicación principal multi-puesto (Dashboard, Registro, Turnos y Entregas)
├── conteo.html      # Pantalla independiente de conteo regresivo pre-evento
└── README.md        # Documentación del proyecto
```

---

## 💻 Instrucciones de Uso el Día del Evento

1. **Equipo 1 (Acceso/Entrada):** Abre `index.html` y selecciona la pestaña **Puesto 1: Captura**. Registra a cada estudiante para entregar su ticket con QR.
2. **Equipo 2 (Escenario/Santa):** Conecta la laptop a la pantalla gigante/proyector, abre `index.html` en la pestaña **Puesto 2: Turno & Fotos** y selecciona *Modo Operador* o *Modo Proyector*.
3. **Equipo 3 (Módulo de Alimentos):** Abre `index.html` en la pestaña **Puesto 3: Churros/Choco**. Escanea el QR o escribe el folio del ticket (ej. `T-001`) para marcar la entrega.

---

## 📄 Licencia

Este proyecto fue desarrollado para la coordinación de eventos universitarios. Libre para uso, modificación y distribución educativa.