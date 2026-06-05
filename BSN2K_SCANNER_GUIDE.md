# Guía Maestra de Inicio y Resumen: BSN 2K Stats Scanner

Esta guía ha sido creada para sincronizar y recordar todos los detalles, configuraciones, credenciales y flujos de trabajo de la conversación en tus diferentes computadoras Mac.

Como este archivo está guardado en la raíz de tu proyecto web, al subir los cambios a **GitHub** desde tu Mac de trabajo, **podrás descargarlo y leerlo al instante en tu otra Mac** simplemente clonando o descargando el repositorio `2kscanner`.

---

## 🔐 Claves y Credenciales del Sistema

*   **Código de Autorización del Panel de Administración (Bypass)**: `adminbsn2k` (insensible a mayúsculas/minúsculas).
*   **Clave para el Envío Oficial de Estadísticas (Google Sheets)**: `bsn2k` (insensible a mayúsculas/minúsculas).
*   **Dominio Oficial del Scanner**: `https://2kbsnscanner.netlify.app`

---

## 📁 Estructura del Proyecto Autónomo
El proyecto ha sido refactored como una aplicación de Next.js completamente independiente de la web principal `2kbsn.com`:
*   **Scanner en la Raíz (`/`)**: Al abrir la web, carga directamente el escáner.
*   **Email y Contraseña**: Se removió el inicio de sesión con Google. Ahora utiliza inicio de sesión directo con correo y clave a través de Firebase Auth.
*   **PWA Instalable**: La app es instalable directamente desde el navegador de tu móvil pulsando en "Añadir a pantalla de inicio".

---

## 🔥 Configuración y Reglas de Firebase Firestore
La cola de aprobación en tiempo real almacena los juegos en la colección temporal `pending_games` en Firestore.

### Reglas de Seguridad Oficiales Aplicadas:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Función para verificar si el usuario es administrador
    function isAdmin() {
      return request.auth != null && (
        request.auth.token.email == '100wrestlingpodcast@gmail.com' || 
        request.auth.token.email == 'admin@bsn2k26.com'
      );
    }

    // --- COLECCIÓN: USUARIOS ---
    match /users/{userId} {
      allow read: if true; 
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update: if request.auth != null && request.auth.uid == userId;
      allow write: if isAdmin();
    }

    // --- COLECCIÓN: TICKETS (PICKS) ---
    match /tickets/{ticketId} {
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow read, write: if isAdmin();
    }

    // --- COLECCIÓN: PROPS (LÍNEAS DE JUEGO) ---
    match /props/{propId} {
      allow read: if true; 
      allow write: if isAdmin();
    }

    // --- COLECCIÓN: PENDING_GAMES (ESCÁNER COLA DE APROBACIÓN) ---
    match /pending_games/{gameId} {
      allow create: if request.auth != null;
      allow read, write: if isAdmin();
    }

    // Denegar acceso a cualquier otra cosa por defecto
    match /{path=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 📲 Guía para Instalar como App Móvil (PWA)
1. Abre **Safari** en tu iPhone o **Chrome** en tu Android e ingresa a [**2kbsnscanner.netlify.app**](https://2kbsnscanner.netlify.app).
2. **En iPhone**: Presiona el botón **Compartir** (cuadrado con flecha arriba) y selecciona **"Añadir a pantalla de inicio"**.
3. **En Android**: Pulsa los tres puntos de arriba a la derecha y selecciona **"Instalar aplicación"**.
4. ¡Listo! Se creará el icono BSN2K en tu pantalla de inicio y se abrirá en pantalla completa nativa.

---

## 🛠️ Desarrollo de la App Nativa (iOS & Android)
Hemos configurado **Capacitor** para empaquetar el scanner como una App móvil nativa real para iOS y Android.

### Comandos de Terminal Esenciales (En tu otra Mac):
1. **Sincronizar cambios de la web**:
   ```bash
   npx cap sync
   ```
2. **Abrir el proyecto en Xcode (para iPhone)**:
   ```bash
   npx cap open ios
   ```
3. **Abrir el proyecto en Android Studio**:
   ```bash
   npx cap open android
   ```

---

## 🖥️ Cómo Sincronizar tu otra Mac Usando GitHub Desktop

Para clonar este proyecto y leer esta guía en tu otra computadora Mac de forma 100% visual:

1. **Instala GitHub Desktop** en tu otra Mac desde: [desktop.github.com](https://desktop.github.com/).
2. Inicia sesión con tu cuenta de GitHub.
3. Haz clic en **"Clone a repository from the Internet..."** (o presiona `Cmd + Shift + O`).
4. Selecciona tu repositorio **`2kscanner`** en la lista y elige la carpeta de tu computadora donde deseas guardarlo.
5. Haz clic en **Clone**.
6. ¡Listo! Tendrás todas las carpetas, el código, el proyecto nativo y esta guía mágica cargada de inmediato en tu otra Mac.
