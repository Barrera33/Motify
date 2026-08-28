/* =========================================================
   MOTIFY
   Spotify Web Playback Controller
========================================================= */

/* =========================================================
   CONFIGURACIÓN
========================================================= */

const CLIENT_ID = "c855b0a480d74d278a35821ad46ed5c8";
const REDIRECT_URI = "http://127.0.0.1:5500";
const SCOPES = [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-read-playback-state",
    "user-modify-playback-state"
].join(" ");

/* =========================================================
   VARIABLES
========================================================= */

let accessToken = null;
let player = null;
let deviceId = null;
let currentState = null;
let spotifySDKReady = false;
let playerInitializing = false;

/* =========================================================
   ELEMENTOS
========================================================= */

const connectButton = document.getElementById("connectSpotify");
const loginSection = document.getElementById("loginSection");
const playerSection = document.getElementById("playerSection");
const connectionStatus = document.getElementById("connectionStatus");
const deviceIdElement = document.getElementById("deviceId");
const deviceStateElement = document.getElementById("deviceState");
const playerReadyElement = document.getElementById("playerReady");
const transferButton = document.getElementById("transferButton");
const transferMessage = document.getElementById("transferMessage");
const trackName = document.getElementById("trackName");
const artistName = document.getElementById("artistName");
const albumCover = document.getElementById("albumCover");
const playButton = document.getElementById("playButton");
const previousButton = document.getElementById("previousButton");
const nextButton = document.getElementById("nextButton");
const volumeSlider = document.getElementById("volumeSlider");
const volumeValue = document.getElementById("volumeValue");
const systemConsole = document.getElementById("systemConsole");
const clearConsole = document.getElementById("clearConsole");

/* =========================================================
   LOG
========================================================= */

function log(message, type = "") {
    console.log(message);
    const p = document.createElement("p");
    p.textContent = message;
    if (type) {
        p.classList.add(type);
    }
    systemConsole.appendChild(p);
    systemConsole.scrollTop = systemConsole.scrollHeight;
}

/* =========================================================
   PKCE
========================================================= */

function randomString(length = 64) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    let result = "";
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
        result += chars[array[i] % chars.length];
    }
    return result;
}

async function sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest("SHA-256", data);
}

function base64urlencode(arrayBuffer) {
    return btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

/* =========================================================
   LOGIN
========================================================= */

connectButton.addEventListener("click", startSpotifyLogin);

async function startSpotifyLogin() {
    try {
        log("🔐 Preparando conexión con Spotify...");
        const verifier = randomString(64);
        const hashed = await sha256(verifier);
        const challenge = base64urlencode(hashed);

        sessionStorage.setItem("motify_code_verifier", verifier);

        const params = new URLSearchParams({
            response_type: "code",
            client_id: CLIENT_ID,
            scope: SCOPES,
            redirect_uri: REDIRECT_URI,
            code_challenge_method: "S256",
            code_challenge: challenge
        });

        const authURL = "https://accounts.spotify.com/authorize?" + params.toString();
        window.location.href = authURL;
    } catch (error) {
        log("❌ Error iniciando Spotify: " + error.message, "error");
    }
}

/* =========================================================
   CALLBACK SPOTIFY
========================================================= */

async function handleSpotifyCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");

    if (error) {
        log("❌ Spotify rechazó la conexión: " + error, "error");
        return;
    }

    if (!code) return false;

    const verifier = sessionStorage.getItem("motify_code_verifier");
    if (!verifier) {
        log("❌ Falta el code verifier.", "error");
        return false;
    }

    try {
        log("🔄 Obteniendo token...");
        const body = new URLSearchParams({
            client_id: CLIENT_ID,
            grant_type: "authorization_code",
            code: code,
            redirect_uri: REDIRECT_URI,
            code_verifier: verifier
        });

        const response = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: body.toString()
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error_description || "No se pudo obtener el token.");
        }

        accessToken = data.access_token;
        sessionStorage.setItem("motify_access_token", accessToken);
        sessionStorage.setItem("motify_token_expiration", String(Date.now() + (data.expires_in * 1000)));
        sessionStorage.removeItem("motify_code_verifier");

        window.history.replaceState({}, document.title, window.location.pathname);

        log("🟢 Spotify conectado.", "success");
        showPlayer();
        waitForSDK();
        return true;
    } catch (error) {
        log("❌ Error obteniendo token: " + error.message, "error");
        return false;
    }
}

/* =========================================================
   ESPERAR SDK
========================================================= */

function waitForSDK() {
    if (window.Spotify) {
        spotifySDKReady = true;
        initializeSpotifyPlayer();
        return;
    }

    log("⏳ Esperando Spotify Web Playback SDK...");
    setTimeout(waitForSDK, 500);
}

/* =========================================================
   MOSTRAR PLAYER
========================================================= */

function showPlayer() {
    loginSection.classList.add("hidden");
    playerSection.classList.remove("hidden");
    connectionStatus.textContent = "🟡 CONECTANDO...";
    connectionStatus.className = "status connected";
}

/* =========================================================
   CREAR MOTIFY
========================================================= */

function initializeSpotifyPlayer() {
    if (player) {
        log("ℹ️ MOTIFY Player ya existe.");
        return;
    }

    if (playerInitializing) return;

    if (!accessToken) {
        log("❌ No hay token de Spotify.", "error");
        return;
    }

    if (!window.Spotify) {
        log("⏳ Spotify SDK todavía no está disponible.");
        return;
    }

    playerInitializing = true;
    log("🎧 Creando MOTIFY...");

    player = new Spotify.Player({
        name: "MOTIFY",
        getOAuthToken: callback => {
            const token = sessionStorage.getItem("motify_access_token");
            if (token) callback(token);
        },
        volume: 0.5
    });

    /* ============ READY ============ */
    player.addListener("ready", async ({ device_id }) => {
        deviceId = device_id;
        console.log("🔥 MOTIFY READY", deviceId);
        log("🔥 MOTIFY READY " + deviceId, "success");

        deviceIdElement.textContent = deviceId;
        deviceStateElement.textContent = "READY";
        playerReadyElement.textContent = "● READY";
        playerReadyElement.classList.add("ready");

        connectionStatus.textContent = "🟢 MOTIFY CONECTADO";
        connectionStatus.className = "status connected";

        transferButton.disabled = false;
        transferMessage.textContent = "MOTIFY está listo para recibir Spotify.";

        await waitForDeviceInSpotify();
    });

    /* ============ NOT READY ============ */
    player.addListener("not_ready", ({ device_id }) => {
        log("🔴 MOTIFY desconectado: " + device_id, "error");

        if (device_id === deviceId) {
            deviceStateElement.textContent = "OFFLINE";
            playerReadyElement.textContent = "OFFLINE";
            playerReadyElement.classList.remove("ready");
            transferButton.disabled = true;
        }
    });

    /* ============ ESTADO ============ */
    player.addListener("player_state_changed", state => {
        if (!state) return;
        currentState = state;
        const track = state.track_window.current_track;
        if (!track) return;

        trackName.textContent = track.name;
        artistName.textContent = track.artists.map(artist => artist.name).join(", ");

        if (track.album && track.album.images && track.album.images.length) {
            albumCover.innerHTML = `<img src="${track.album.images[0].url}" alt="Album">`;
        }

        playButton.textContent = state.paused ? "▶" : "⏸";
    });

    /* ============ ERRORES ============ */
    player.addListener("initialization_error", ({ message }) => log("❌ Initialization error: " + message, "error"));
    player.addListener("authentication_error", ({ message }) => log("❌ Authentication error: " + message, "error"));
    player.addListener("account_error", ({ message }) => log("❌ Account error: " + message, "error"));
    player.addListener("playback_error", ({ message }) => log("❌ Playback error: " + message, "error"));

    /* ============ CONNECT ============ */
    player.connect().then(success => {
        if (success) {
            log("🟢 Web Playback conectado.", "success");
        } else {
            log("❌ No se pudo conectar MOTIFY.", "error");
        }
    });
}

/* =========================================================
   ESPERAR A QUE SPOTIFY VEA MOTIFY
========================================================= */

async function waitForDeviceInSpotify(attempts = 0) {
    if (!deviceId) return false;

    if (attempts >= 10) {
        log("⚠️ MOTIFY tiene Device ID pero Spotify tardó en mostrarlo.");
        deviceStateElement.textContent = "READY";
        return false;
    }

    try {
        const response = await fetch("https://api.spotify.com/v1/me/player/devices", {
            headers: { Authorization: "Bearer " + accessToken }
        });

        if (response.status === 401) {
            log("❌ Token expirado.", "error");
            return false;
        }

        const data = await response.json();
        console.log("🎧 DISPOSITIVOS:", data.devices);

        const motify = data.devices.find(device => device.id === deviceId || device.name === "MOTIFY");

        if (motify) {
            deviceId = motify.id;
            deviceIdElement.textContent = deviceId;
            deviceStateElement.textContent = "VISIBLE EN SPOTIFY";
            transferButton.disabled = false;
            log("✅ Spotify detectó MOTIFY.", "success");
            log("🆔 Device ID confirmado: " + deviceId, "success");
            transferMessage.textContent = "MOTIFY está listo para transferir.";
            return true;
        }

        log("⏳ Spotify todavía está registrando MOTIFY...");
        setTimeout(() => { waitForDeviceInSpotify(attempts + 1); }, 1500);
    } catch (error) {
        log("⚠️ Error consultando dispositivos: " + error.message, "error");
        return false;
    }
}

/* =========================================================
   TRANSFERIR
========================================================= */

transferButton.addEventListener("click", transferToMotify);

async function transferToMotify() {
    if (!deviceId) {
        log("❌ MOTIFY todavía no tiene Device ID.", "error");
        return;
    }

    if (!accessToken) {
        log("❌ No hay sesión de Spotify.", "error");
        return;
    }

    transferButton.disabled = true;
    transferMessage.textContent = "🚀 Transfiriendo a MOTIFY...";
    log("🚀 TRANSFIRIENDO A MOTIFY", "success");
    log("🆔 Device: " + deviceId);

    try {
        const response = await fetch("https://api.spotify.com/v1/me/player", {
            method: "PUT",
            headers: {
                Authorization: "Bearer " + accessToken,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                device_ids: [deviceId],
                play: true
            })
        });

        if (response.status === 204) {
            log("🎉 ¡MOTIFY ES EL REPRODUCTOR ACTIVO!", "success");
            transferMessage.textContent = "🟢 ¡Reproducción transferida a MOTIFY!";
            deviceStateElement.textContent = "REPRODUCIENDO";
            connectionStatus.textContent = "🟢 MOTIFY REPRODUCIENDO";
        } else {
            const text = await response.text();
            log("❌ Transfer error " + response.status + ": " + text, "error");
            transferMessage.textContent = "❌ No se pudo transferir.";
        }
    } catch (error) {
        log("❌ Error transfiriendo: " + error.message, "error");
        transferMessage.textContent = "❌ Error de conexión.";
    }

    transferButton.disabled = false;
}

/* =========================================================
   PLAY / PAUSE
========================================================= */

playButton.addEventListener("click", async () => {
    if (!player) return;
    try {
        await player.togglePlay();
    } catch (error) {
        log("❌ Play/Pause: " + error.message, "error");
    }
});

/* =========================================================
   NEXT
========================================================= */

nextButton.addEventListener("click", async () => {
    if (!player) return;
    try {
        await player.nextTrack();
    } catch (error) {
        log("❌ Next: " + error.message, "error");
    }
});

/* =========================================================
   PREVIOUS
========================================================= */

previousButton.addEventListener("click", async () => {
    if (!player) return;
    try {
        await player.previousTrack();
    } catch (error) {
        log("❌ Previous: " + error.message, "error");
    }
});

/* =========================================================
   VOLUMEN
========================================================= */

volumeSlider.addEventListener("input", async () => {
    const volume = Number(volumeSlider.value) / 100;
    volumeValue.textContent = volumeSlider.value + "%";

    if (!player) return;
    try {
        await player.setVolume(volume);
    } catch (error) {
        log("❌ Volumen: " + error.message, "error");
    }
});

/* =========================================================
   LIMPIAR CONSOLA
========================================================= */

clearConsole.addEventListener("click", () => {
    systemConsole.innerHTML = "";
});

/* =========================================================
   INICIO
========================================================= */

async function init() {
    log("🔥 MOTIFY iniciado");
    console.log("🎵 Scopes:", SCOPES);

    const params = new URLSearchParams(window.location.search);
    if (params.has("code")) {
        await handleSpotifyCallback();
        return;
    }

    const savedToken = sessionStorage.getItem("motify_access_token");
    const expiration = Number(sessionStorage.getItem("motify_token_expiration") || 0);

    if (savedToken && expiration > Date.now()) {
        accessToken = savedToken;
        showPlayer();
        waitForSDK();
        return;
    }

    log("⚪ Esperando conexión con Spotify...");
}

/* =========================================================
   ARRANCAR
========================================================= */

init();