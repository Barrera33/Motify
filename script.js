```javascript
/* =========================================================
   MOTIFY
   Spotify Web Playback Controller
   Versión portátil - GitHub Pages
========================================================= */

/* =========================
   CONFIGURACIÓN
========================= */

const CLIENT_ID = "c855b0a480d74d278a35821ad46ed5c8";

const REDIRECT_URI = "https://barrera33.github.io/Motify/";

const SCOPES = [
    "streaming",
    "user-read-email",
    "user-read-private",
    "user-read-playback-state",
    "user-modify-playback-state"
].join(" ");


/* =========================
   VARIABLES
========================= */

let accessToken = null;
let player = null;
let deviceId = null;
let currentState = null;
let playerInitializing = false;


/* =========================
   ELEMENTOS
========================= */

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


/* =========================
   LOG
========================= */

function log(message, type) {

    console.log(message);

    if (!systemConsole) return;

    const p = document.createElement("p");

    p.textContent = message;

    if (type) {
        p.classList.add(type);
    }

    systemConsole.appendChild(p);

    systemConsole.scrollTop = systemConsole.scrollHeight;
}


/* =========================
   PKCE
========================= */

function randomString(length) {

    const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
        "abcdefghijklmnopqrstuvwxyz" +
        "0123456789-._~";

    const array = new Uint8Array(length);

    crypto.getRandomValues(array);

    let result = "";

    for (let i = 0; i < length; i++) {
        result += chars[array[i] % chars.length];
    }

    return result;
}


async function sha256(value) {

    const encoder = new TextEncoder();

    const data = encoder.encode(value);

    return crypto.subtle.digest("SHA-256", data);
}


function base64urlencode(buffer) {

    const bytes = new Uint8Array(buffer);

    let binary = "";

    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }

    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}


/* =========================
   LOGIN
========================= */

if (connectButton) {

    connectButton.addEventListener(
        "click",
        startSpotifyLogin
    );

}


async function startSpotifyLogin() {

    try {

        log("🔐 Preparando conexión con Spotify...");


        /*
           Nueva sesión.
        */

        sessionStorage.removeItem(
            "motify_access_token"
        );

        sessionStorage.removeItem(
            "motify_token_expiration"
        );

        sessionStorage.removeItem(
            "motify_code_verifier"
        );


        const verifier = randomString(64);

        const hash = await sha256(verifier);

        const challenge = base64urlencode(hash);


        sessionStorage.setItem(
            "motify_code_verifier",
            verifier
        );


        const params = new URLSearchParams();

        params.set("response_type", "code");
        params.set("client_id", CLIENT_ID);
        params.set("scope", SCOPES);
        params.set("redirect_uri", REDIRECT_URI);
        params.set("code_challenge_method", "S256");
        params.set("code_challenge", challenge);

        /*
           Hace que Spotify muestre nuevamente
           la pantalla de autorización.
        */

        params.set("show_dialog", "true");


        const authURL =
            "https://accounts.spotify.com/authorize?" +
            params.toString();


        log("🚀 Abriendo Spotify...");


        window.location.href = authURL;


    } catch (error) {

        log(
            "❌ Error iniciando Spotify: " +
            error.message,
            "error"
        );

    }

}


/* =========================
   CALLBACK
========================= */

async function handleSpotifyCallback() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const code = params.get("code");

    const error = params.get("error");


    if (error) {

        log(
            "❌ Spotify rechazó la conexión: " + error,
            "error"
        );

        return false;
    }


    if (!code) {
        return false;
    }


    const verifier =
        sessionStorage.getItem(
            "motify_code_verifier"
        );


    if (!verifier) {

        log(
            "❌ No se encontró el código de seguridad.",
            "error"
        );

        return false;
    }


    try {

        log("🔄 Obteniendo token de Spotify...");


        const body = new URLSearchParams();

        body.set(
            "client_id",
            CLIENT_ID
        );

        body.set(
            "grant_type",
            "authorization_code"
        );

        body.set(
            "code",
            code
        );

        body.set(
            "redirect_uri",
            REDIRECT_URI
        );

        body.set(
            "code_verifier",
            verifier
        );


        const response = await fetch(
            "https://accounts.spotify.com/api/token",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded"
                },

                body: body.toString()
            }
        );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error_description ||
                "Spotify no pudo entregar el token."
            );

        }


        accessToken =
            data.access_token;


        sessionStorage.setItem(
            "motify_access_token",
            accessToken
        );


        sessionStorage.setItem(
            "motify_token_expiration",
            String(
                Date.now() +
                data.expires_in * 1000
            )
        );


        sessionStorage.removeItem(
            "motify_code_verifier"
        );


        /*
           Quitamos ?code= de la URL.
        */

        window.history.replaceState(
            {},
            document.title,
            REDIRECT_URI
        );


        log(
            "🟢 Spotify conectado.",
            "success"
        );


        /*
           AHORA SÍ mostramos la interfaz.
        */

        showPlayer();


        waitForSDK();


        return true;


    } catch (error) {

        log(
            "❌ Error obteniendo token: " +
            error.message,
            "error"
        );

        return false;
    }

}


/* =========================
   MOSTRAR INTERFAZ
========================= */

function showPlayer() {

    if (loginSection) {
        loginSection.classList.add("hidden");
    }

    if (playerSection) {
        playerSection.classList.remove("hidden");
    }

    if (connectionStatus) {

        connectionStatus.textContent =
            "🟡 CONECTANDO...";

        connectionStatus.className =
            "status connected";
    }

}


/* =========================
   ESPERAR SDK
========================= */

function waitForSDK() {

    if (window.Spotify) {

        initializeSpotifyPlayer();

        return;
    }


    log(
        "⏳ Esperando Spotify Web Playback SDK..."
    );


    setTimeout(
        waitForSDK,
        500
    );

}


/* =========================
   CREAR PLAYER
========================= */

function initializeSpotifyPlayer() {

    if (player) {
        return;
    }


    if (playerInitializing) {
        return;
    }


    if (!accessToken) {

        log(
            "❌ No hay token de Spotify.",
            "error"
        );

        return;
    }


    if (!window.Spotify) {

        log(
            "⏳ Spotify SDK todavía no está disponible."
        );

        return;
    }


    playerInitializing = true;


    log("🎧 Creando MOTIFY...");


    player = new Spotify.Player({

        name: "MOTIFY",

        getOAuthToken: callback => {

            const token =
                sessionStorage.getItem(
                    "motify_access_token"
                );

            if (token) {
                callback(token);
            }

        },

        volume: 0.5

    });


    /* =========================
       READY
    ========================= */

    player.addListener(
        "ready",
        async data => {

            deviceId = data.device_id;


            log(
                "🔥 MOTIFY READY " +
                deviceId,
                "success"
            );


            if (deviceIdElement) {
                deviceIdElement.textContent =
                    deviceId;
            }


            if (deviceStateElement) {
                deviceStateElement.textContent =
                    "READY";
            }


            if (playerReadyElement) {

                playerReadyElement.textContent =
                    "● READY";

                playerReadyElement.classList.add(
                    "ready"
                );

            }


            if (connectionStatus) {

                connectionStatus.textContent =
                    "🟢 MOTIFY CONECTADO";

                connectionStatus.className =
                    "status connected";

            }


            if (transferButton) {
                transferButton.disabled = false;
            }


            if (transferMessage) {

                transferMessage.textContent =
                    "MOTIFY está listo para recibir Spotify.";

            }


            await waitForDeviceInSpotify();

        }
    );


    /* =========================
       NOT READY
    ========================= */

    player.addListener(
        "not_ready",
        data => {

            log(
                "🔴 MOTIFY desconectado: " +
                data.device_id,
                "error"
            );


            if (data.device_id !== deviceId) {
                return;
            }


            if (deviceStateElement) {
                deviceStateElement.textContent =
                    "OFFLINE";
            }


            if (playerReadyElement) {

                playerReadyElement.textContent =
                    "OFFLINE";

                playerReadyElement.classList.remove(
                    "ready"
                );

            }


            if (transferButton) {
                transferButton.disabled = true;
            }

        }
    );


    /* =========================
       ESTADO DE CANCIÓN
    ========================= */

    player.addListener(
        "player_state_changed",
        state => {

            if (!state) {
                return;
            }


            currentState = state;


            const track =
                state.track_window.current_track;


            if (!track) {
                return;
            }


            if (trackName) {

                trackName.textContent =
                    track.name;

            }


            if (artistName) {

                artistName.textContent =
                    track.artists
                        .map(
                            artist =>
                                artist.name
                        )
                        .join(", ");

            }


            /*
               IMPORTANTE:
               No usamos innerHTML ni template strings
               para crear la imagen.
               Así evitamos el error "Unexpected identifier src".
            */

            if (
                albumCover &&
                track.album &&
                track.album.images &&
                track.album.images.length > 0
            ) {

                albumCover.textContent = "";

                const image =
                    document.createElement("img");

                image.src =
                    track.album.images[0].url;

                image.alt =
                    "Portada del álbum";

                albumCover.appendChild(image);

            }


            if (playButton) {

                playButton.textContent =
                    state.paused
                        ? "▶"
                        : "⏸";

            }

        }
    );


    /* =========================
       ERRORES
    ========================= */

    player.addListener(
        "initialization_error",
        data => {

            log(
                "❌ Initialization error: " +
                data.message,
                "error"
            );

        }
    );


    player.addListener(
        "authentication_error",
        data => {

            log(
                "❌ Authentication error: " +
                data.message,
                "error"
            );

        }
    );


    player.addListener(
        "account_error",
        data => {

            log(
                "❌ Account error: " +
                data.message,
                "error"
            );

        }
    );


    player.addListener(
        "playback_error",
        data => {

            log(
                "❌ Playback error: " +
                data.message,
                "error"
            );

        }
    );


    player.addListener(
        "autoplay_failed",
        () => {

            log(
                "⚠️ El navegador bloqueó la reproducción automática."
            );

        }
    );


    /* =========================
       CONECTAR
    ========================= */

    player.connect()
        .then(success => {

            if (success) {

                log(
                    "🟢 Web Playback conectado.",
                    "success"
                );

            } else {

                log(
                    "❌ No se pudo conectar MOTIFY.",
                    "error"
                );

            }

        })
        .catch(error => {

            log(
                "❌ Error conectando MOTIFY: " +
                error.message,
                "error"
            );

        });

}


/* =========================
   BUSCAR MOTIFY
========================= */

async function waitForDeviceInSpotify(
    attempts = 0
) {

    if (!deviceId || !accessToken) {
        return false;
    }


    if (attempts >= 15) {

        log(
            "⚠️ Spotify tardó demasiado en mostrar MOTIFY."
        );

        return false;
    }


    try {

        const response = await fetch(
            "https://api.spotify.com/v1/me/player/devices",
            {
                headers: {
                    Authorization:
                        "Bearer " +
                        accessToken
                }
            }
        );


        if (response.status === 401) {

            log(
                "❌ Token expirado.",
                "error"
            );

            return false;
        }


        if (!response.ok) {

            log(
                "⚠️ Spotify respondió " +
                response.status,
                "error"
            );

            return false;
        }


        const data =
            await response.json();


        const motify =
            data.devices.find(
                device =>
                    device.id === deviceId ||
                    device.name === "MOTIFY"
            );


        if (motify) {

            deviceId =
                motify.id;


            if (deviceIdElement) {

                deviceIdElement.textContent =
                    deviceId;

            }


            if (deviceStateElement) {

                deviceStateElement.textContent =
                    "VISIBLE EN SPOTIFY";

            }


            if (transferButton) {
                transferButton.disabled = false;
            }


            if (transferMessage) {

                transferMessage.textContent =
                    "MOTIFY está listo para transferir.";

            }


            log(
                "✅ Spotify detectó MOTIFY.",
                "success"
            );


            log(
                "🆔 Device ID confirmado: " +
                deviceId,
                "success"
            );


            return true;
        }


        log(
            "⏳ Spotify todavía está registrando MOTIFY..."
        );


        setTimeout(
            () => {

                waitForDeviceInSpotify(
                    attempts + 1
                );

            },
            1500
        );


    } catch (error) {

        log(
            "⚠️ Error consultando dispositivos: " +
            error.message,
            "error"
        );

        return false;
    }

}


/* =========================
   TRANSFERIR
========================= */

if (transferButton) {

    transferButton.addEventListener(
        "click",
        transferToMotify
    );

}


async function transferToMotify() {

    if (!deviceId) {

        log(
            "❌ MOTIFY no tiene Device ID.",
            "error"
        );

        return;
    }


    if (!accessToken) {

        log(
            "❌ No hay sesión de Spotify.",
            "error"
        );

        return;
    }


    transferButton.disabled = true;


    if (transferMessage) {

        transferMessage.textContent =
            "🚀 Transfiriendo a MOTIFY...";

    }


    log(
        "🚀 TRANSFIRIENDO A MOTIFY",
        "success"
    );


    try {

        const response = await fetch(
            "https://api.spotify.com/v1/me/player",
            {
                method: "PUT",

                headers: {

                    Authorization:
                        "Bearer " +
                        accessToken,

                    "Content-Type":
                        "application/json"

                },

                body: JSON.stringify({

                    device_ids: [
                        deviceId
                    ],

                    play: true

                })

            }
        );


        if (response.status === 204) {

            log(
                "🎉 ¡MOTIFY ES EL REPRODUCTOR ACTIVO!",
                "success"
            );


            if (transferMessage) {

                transferMessage.textContent =
                    "🟢 ¡Reproducción transferida a MOTIFY!";

            }


            if (deviceStateElement) {

                deviceStateElement.textContent =
                    "REPRODUCIENDO";

            }


            if (connectionStatus) {

                connectionStatus.textContent =
                    "🟢 MOTIFY REPRODUCIENDO";

            }

        } else {

            const text =
                await response.text();

            log(
                "❌ Error de transferencia " +
                response.status +
                ": " +
                text,
                "error"
            );

        }


    } catch (error) {

        log(
            "❌ Error transfiriendo: " +
            error.message,
            "error"
        );

    }


    transferButton.disabled = false;

}


/* =========================
   PLAY / PAUSE
========================= */

if (playButton) {

    playButton.addEventListener(
        "click",
        async () => {

            if (!player) return;

            try {

                await player.togglePlay();

            } catch (error) {

                log(
                    "❌ Play/Pause: " +
                    error.message,
                    "error"
                );

            }

        }
    );

}


/* =========================
   SIGUIENTE
========================= */

if (nextButton) {

    nextButton.addEventListener(
        "click",
        async () => {

            if (!player) return;

            try {

                await player.nextTrack();

            } catch (error) {

                log(
                    "❌ Siguiente: " +
                    error.message,
                    "error"
                );

            }

        }
    );

}


/* =========================
   ANTERIOR
========================= */

if (previousButton) {

    previousButton.addEventListener(
        "click",
        async () => {

            if (!player) return;

            try {

                await player.previousTrack();

            } catch (error) {

                log(
                    "❌ Anterior: " +
                    error.message,
                    "error"
                );

            }

        }
    );

}


/* =========================
   VOLUMEN
========================= */

if (volumeSlider) {

    volumeSlider.addEventListener(
        "input",
        async () => {

            const volume =
                Number(volumeSlider.value) / 100;


            if (volumeValue) {

                volumeValue.textContent =
                    volumeSlider.value + "%";

            }


            if (!player) return;


            try {

                await player.setVolume(volume);

            } catch (error) {

                log(
                    "❌ Volumen: " +
                    error.message,
                    "error"
                );

            }

        }
    );

}


/* =========================
   LIMPIAR CONSOLA
========================= */

if (clearConsole) {

    clearConsole.addEventListener(
        "click",
        () => {

            if (systemConsole) {
                systemConsole.innerHTML = "";
            }

        }
    );

}


/* =========================
   INICIO
========================= */

async function init() {

    log("🔥 MOTIFY iniciado");

    console.log(
        "🎵 Scopes:",
        SCOPES
    );


    const params =
        new URLSearchParams(
            window.location.search
        );


    /*
       CASO 1:
       Spotify acaba de devolver el código.
    */

    if (params.has("code")) {

        await handleSpotifyCallback();

        return;
    }


    /*
       CASO 2:
       Spotify devolvió un error.
    */

    if (params.has("error")) {

        log(
            "❌ Spotify devolvió: " +
            params.get("error"),
            "error"
        );

        return;
    }


    /*
       CASO 3:
       Página normal.
       Mostramos la pantalla inicial.
    */

    log(
        "⚪ Esperando conexión con Spotify..."
    );

}


/* =========================
   ARRANCAR
========================= */

init();
```
