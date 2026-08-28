/* =========================================================
   MOTIFY
   Spotify Web Playback Controller
   GitHub Pages / Portátil
========================================================= */


/* =========================================================
   CONFIGURACIÓN
========================================================= */

const CLIENT_ID = "c855b0a480d74d278a35821ad46ed5c8";

const REDIRECT_URI =
    "https://barrera33.github.io/Motify/";

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

let deviceSearchTimer = null;


/* =========================================================
   ELEMENTOS HTML
========================================================= */

const connectButton =
    document.getElementById("connectSpotify");

const loginSection =
    document.getElementById("loginSection");

const playerSection =
    document.getElementById("playerSection");

const connectionStatus =
    document.getElementById("connectionStatus");

const deviceIdElement =
    document.getElementById("deviceId");

const deviceStateElement =
    document.getElementById("deviceState");

const playerReadyElement =
    document.getElementById("playerReady");

const transferButton =
    document.getElementById("transferButton");

const transferMessage =
    document.getElementById("transferMessage");

const trackName =
    document.getElementById("trackName");

const artistName =
    document.getElementById("artistName");

const albumCover =
    document.getElementById("albumCover");

const playButton =
    document.getElementById("playButton");

const previousButton =
    document.getElementById("previousButton");

const nextButton =
    document.getElementById("nextButton");

const volumeSlider =
    document.getElementById("volumeSlider");

const volumeValue =
    document.getElementById("volumeValue");

const systemConsole =
    document.getElementById("systemConsole");

const clearConsole =
    document.getElementById("clearConsole");


/* =========================================================
   CONSOLA MOTIFY
========================================================= */

function log(message, type = "") {

    console.log(message);

    if (!systemConsole) {
        return;
    }

    const p = document.createElement("p");

    p.textContent = message;

    if (type) {
        p.classList.add(type);
    }

    systemConsole.appendChild(p);

    systemConsole.scrollTop =
        systemConsole.scrollHeight;
}


/* =========================================================
   PKCE
========================================================= */

function randomString(length = 64) {

    const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
        "abcdefghijklmnopqrstuvwxyz" +
        "0123456789-._~";

    const array =
        new Uint8Array(length);

    crypto.getRandomValues(array);

    let result = "";

    for (let i = 0; i < length; i++) {

        result +=
            chars[array[i] % chars.length];

    }

    return result;
}


async function sha256(plain) {

    const encoder =
        new TextEncoder();

    const data =
        encoder.encode(plain);

    return window.crypto.subtle.digest(
        "SHA-256",
        data
    );
}


function base64urlencode(arrayBuffer) {

    return btoa(
        String.fromCharCode(
            ...new Uint8Array(arrayBuffer)
        )
    )
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}


/* =========================================================
   LOGIN
========================================================= */

if (connectButton) {

    connectButton.addEventListener(
        "click",
        startSpotifyLogin
    );

}


async function startSpotifyLogin() {

    try {

        log(
            "🔐 Preparando conexión con Spotify..."
        );


        /*
           Limpiamos únicamente la sesión
           actual del navegador.

           Esto evita que MOTIFY use
           un token viejo.
        */

        clearSpotifySession();


        const verifier =
            randomString(64);


        const hashed =
            await sha256(verifier);


        const challenge =
            base64urlencode(hashed);


        sessionStorage.setItem(
            "motify_code_verifier",
            verifier
        );


        const params =
            new URLSearchParams({

                response_type: "code",

                client_id: CLIENT_ID,

                scope: SCOPES,

                redirect_uri: REDIRECT_URI,

                code_challenge_method: "S256",

                code_challenge: challenge,

                /*
                   Fuerza a Spotify a mostrar
                   la autorización.
                */

                show_dialog: "true"

            });


        const authURL =
            "https://accounts.spotify.com/authorize?" +
            params.toString();


        log(
            "🚀 Abriendo autorización de Spotify..."
        );


        window.location.href =
            authURL;


    } catch (error) {

        log(
            "❌ Error iniciando Spotify: " +
            error.message,
            "error"
        );

    }

}


/* =========================================================
   CALLBACK SPOTIFY
========================================================= */

async function handleSpotifyCallback() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const code =
        params.get("code");

    const error =
        params.get("error");


    if (error) {

        log(
            "❌ Spotify rechazó la conexión: " +
            error,
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
            "❌ Falta el code verifier.",
            "error"
        );

        return false;
    }


    try {

        log(
            "🔄 Obteniendo token..."
        );


        const body =
            new URLSearchParams({

                client_id: CLIENT_ID,

                grant_type:
                    "authorization_code",

                code: code,

                redirect_uri:
                    REDIRECT_URI,

                code_verifier:
                    verifier

            });


        const response =
            await fetch(
                "https://accounts.spotify.com/api/token",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/x-www-form-urlencoded"
                    },

                    body:
                        body.toString()
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error_description ||
                "Spotify no entregó el token."
            );

        }


        accessToken =
            data.access_token;


        /*
           Guardamos el token solamente
           durante esta sesión del navegador.
        */

        sessionStorage.setItem(
            "motify_access_token",
            accessToken
        );


        sessionStorage.setItem(
            "motify_token_expiration",
            String(
                Date.now() +
                (
                    data.expires_in *
                    1000
                )
            )
        );


        sessionStorage.removeItem(
            "motify_code_verifier"
        );


        /*
           Eliminamos ?code=...
           de la URL.
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


        showPlayer();


        /*
           Esperamos al SDK.
        */

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


/* =========================================================
   SESIÓN
========================================================= */

function clearSpotifySession() {

    accessToken = null;

    sessionStorage.removeItem(
        "motify_access_token"
    );

    sessionStorage.removeItem(
        "motify_token_expiration"
    );

}


function tokenIsValid() {

    if (!accessToken) {

        return false;

    }


    const expiration =
        Number(
            sessionStorage.getItem(
                "motify_token_expiration"
            ) || 0
        );


    return (
        expiration >
        Date.now()
    );

}


/* =========================================================
   MOSTRAR PLAYER
========================================================= */

function showPlayer() {

    if (loginSection) {

        loginSection.classList.add(
            "hidden"
        );

    }


    if (playerSection) {

        playerSection.classList.remove(
            "hidden"
        );

    }


    if (connectionStatus) {

        connectionStatus.textContent =
            "🟡 CONECTANDO...";

        connectionStatus.className =
            "status connected";

    }

}


/* =========================================================
   ESPERAR SPOTIFY SDK
========================================================= */

function waitForSDK() {

    if (!accessToken) {

        log(
            "❌ No hay token. Esperando conexión..."
        );

        return;

    }


    if (window.Spotify) {

        spotifySDKReady = true;

        log(
            "🎵 Spotify SDK READY",
            "success"
        );

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


/* =========================================================
   CREAR REPRODUCTOR MOTIFY
========================================================= */

function initializeSpotifyPlayer() {

    if (player) {

        log(
            "ℹ️ MOTIFY Player ya existe."
        );

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


    log(
        "🎧 Creando MOTIFY..."
    );


    player =
        new Spotify.Player({

            name: "MOTIFY",

            getOAuthToken:
                callback => {

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


    /* =====================================================
       MOTIFY READY
    ===================================================== */

    player.addListener(
        "ready",
        async ({ device_id }) => {

            deviceId =
                device_id;


            console.log(
                "🔥 MOTIFY READY",
                deviceId
            );


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

                transferButton.disabled =
                    false;

            }


            if (transferMessage) {

                transferMessage.textContent =
                    "MOTIFY está listo para recibir Spotify.";

            }


            /*
               Ahora buscamos el dispositivo
               en Spotify.
            */

            waitForDeviceInSpotify();

        }
    );


    /* =====================================================
       NOT READY
    ===================================================== */

    player.addListener(
        "not_ready",
        ({ device_id }) => {

            log(
                "🔴 MOTIFY desconectado: " +
                device_id,
                "error"
            );


            if (
                device_id === deviceId
            ) {

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

                    transferButton.disabled =
                        true;

                }

            }

        }
    );


    /* =====================================================
       ESTADO DE REPRODUCCIÓN
    ===================================================== */

    player.addListener(
        "player_state_changed",
        state => {

            if (!state) {

                return;

            }


            currentState =
                state;


            const track =
                state
                    .track_window
                    ?.current_track;


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


            if (
                track.album &&
                track.album.images &&
                track.album.images.length
            ) {

                if (albumCover) {

                    albumCover.innerHTML =
                        `<img src="${track.album.images[0].url}" alt="Album">`;

                }

            }


            if (playButton) {

                playButton.textContent =
                    state.paused
                        ? "▶"
                        : "⏸";

            }

        }
    );


    /* =====================================================
       ERRORES
    ===================================================== */

    player.addListener(
        "initialization_error",
        ({ message }) => {

            log(
                "❌ Initialization error: " +
                message,
                "error"
            );

        }
    );


    player.addListener(
        "authentication_error",
        ({ message }) => {

            log(
                "❌ Authentication error: " +
                message,
                "error"
            );

            clearSpotifySession();

        }
    );


    player.addListener(
        "account_error",
        ({ message }) => {

            log(
                "❌ Account error: " +
                message,
                "error"
            );

        }
    );


    player.addListener(
        "playback_error",
        ({ message }) => {

            log(
                "❌ Playback error: " +
                message,
                "error"
            );

        }
    );


    /* =====================================================
       CONECTAR SDK
    ===================================================== */

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


/* =========================================================
   BUSCAR DEVICE ID EN SPOTIFY
========================================================= */

async function waitForDeviceInSpotify(
    attempts = 0
) {

    if (!deviceId) {

        return false;

    }


    if (!accessToken) {

        return false;

    }


    if (attempts >= 20) {

        log(
            "⚠️ MOTIFY tiene Device ID, pero Spotify tardó en registrarlo."
        );

        if (deviceStateElement) {

            deviceStateElement.textContent =
                "READY";

        }

        return false;

    }


    try {

        const response =
            await fetch(
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
                "❌ Token expirado. Vuelve a conectar Spotify.",
                "error"
            );

            clearSpotifySession();

            return false;

        }


        if (!response.ok) {

            log(
                "⚠️ Spotify respondió " +
                response.status,
                "error"
            );

            scheduleDeviceSearch(
                attempts
            );

            return false;

        }


        const data =
            await response.json();


        console.log(
            "🎧 DISPOSITIVOS:",
            data.devices
        );


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

                transferButton.disabled =
                    false;

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


        scheduleDeviceSearch(
            attempts
        );


    } catch (error) {

        log(
            "⚠️ Error consultando dispositivos: " +
            error.message,
            "error"
        );

        scheduleDeviceSearch(
            attempts
        );

        return false;

    }

}


function scheduleDeviceSearch(
    attempts
) {

    if (deviceSearchTimer) {

        clearTimeout(
            deviceSearchTimer
        );

    }


    deviceSearchTimer =
        setTimeout(
            () => {

                waitForDeviceInSpotify(
                    attempts + 1
                );

            },
            1500
        );

}


/* =========================================================
   TRANSFERIR A MOTIFY
========================================================= */

if (transferButton) {

    transferButton.addEventListener(
        "click",
        transferToMotify
    );

}


async function transferToMotify() {

    if (!deviceId) {

        log(
            "❌ MOTIFY todavía no tiene Device ID.",
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


    if (transferButton) {

        transferButton.disabled =
            true;

    }


    if (transferMessage) {

        transferMessage.textContent =
            "🚀 Transfiriendo a MOTIFY...";

    }


    log(
        "🚀 TRANSFIRIENDO A MOTIFY",
        "success"
    );


    log(
        "🆔 Device: " +
        deviceId
    );


    try {

        /*
           Primero comprobamos que
           Spotify siga viendo MOTIFY.
        */

        const devicesResponse =
            await fetch(
                "https://api.spotify.com/v1/me/player/devices",
                {
                    headers: {
                        Authorization:
                            "Bearer " +
                            accessToken
                    }
                }
            );


        if (
            devicesResponse.status === 401
        ) {

            throw new Error(
                "Token expirado."
            );

        }


        const devicesData =
            await devicesResponse.json();


        const motify =
            devicesData.devices.find(
                device =>
                    device.id === deviceId ||
                    device.name === "MOTIFY"
            );


        if (!motify) {

            log(
                "⚠️ Spotify todavía no ve MOTIFY.",
                "error"
            );


            if (transferMessage) {

                transferMessage.textContent =
                    "⚠️ Spotify todavía no detecta MOTIFY.";

            }


            waitForDeviceInSpotify();

            return;

        }


        /*
           Actualizamos el ID por seguridad.
        */

        deviceId =
            motify.id;


        if (deviceIdElement) {

            deviceIdElement.textContent =
                deviceId;

        }


        /*
           Transferencia.
        */

        const response =
            await fetch(
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

                    body:
                        JSON.stringify({

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
                "❌ Transfer error " +
                response.status +
                ": " +
                text,
                "error"
            );


            if (transferMessage) {

                transferMessage.textContent =
                    "❌ No se pudo transferir.";

            }

        }


    } catch (error) {

        log(
            "❌ Error transfiriendo: " +
            error.message,
            "error"
        );


        if (transferMessage) {

            transferMessage.textContent =
                "❌ Error de conexión.";

        }

    }


    if (transferButton) {

        transferButton.disabled =
            false;

    }

}


/* =========================================================
   PLAY / PAUSE
========================================================= */

if (playButton) {

    playButton.addEventListener(
        "click",
        async () => {

            if (!player) {

                return;

            }


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


/* =========================================================
   SIGUIENTE
========================================================= */

if (nextButton) {

    nextButton.addEventListener(
        "click",
        async () => {

            if (!player) {

                return;

            }


            try {

                await player.nextTrack();

            } catch (error) {

                log(
                    "❌ Next: " +
                    error.message,
                    "error"
                );

            }

        }
    );

}


/* =========================================================
   ANTERIOR
========================================================= */

if (previousButton) {

    previousButton.addEventListener(
        "click",
        async () => {

            if (!player) {

                return;

            }


            try {

                await player.previousTrack();

            } catch (error) {

                log(
                    "❌ Previous: " +
                    error.message,
                    "error"
                );

            }

        }
    );

}


/* =========================================================
   VOLUMEN
========================================================= */

if (volumeSlider) {

    volumeSlider.addEventListener(
        "input",
        async () => {

            const volume =
                Number(
                    volumeSlider.value
                ) / 100;


            if (volumeValue) {

                volumeValue.textContent =
                    volumeSlider.value +
                    "%";

            }


            if (!player) {

                return;

            }


            try {

                await player.setVolume(
                    volume
                );

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


/* =========================================================
   LIMPIAR CONSOLA
========================================================= */

if (clearConsole) {

    clearConsole.addEventListener(
        "click",
        () => {

            if (systemConsole) {

                systemConsole.innerHTML =
                    "";

            }

        }
    );

}


/* =========================================================
   INICIO
========================================================= */

async function init() {

    log(
        "🔥 MOTIFY iniciado"
    );


    console.log(
        "🎵 Scopes:",
        SCOPES
    );


    /*
       Revisamos si Spotify acaba de
       devolver ?code=...
    */

    const params =
        new URLSearchParams(
            window.location.search
        );


    if (params.has("error")) {

        const error =
            params.get("error");


        log(
            "❌ Spotify devolvió: " +
            error,
            "error"
        );

        return;

    }


    if (params.has("code")) {

        await handleSpotifyCallback();

        return;

    }


    /*
       IMPORTANTE:

       NO iniciamos MOTIFY usando
       automáticamente un token viejo.

       Cada navegador/computador puede
       iniciar su propia sesión.
    */

    clearSpotifySession();


    log(
        "⚪ Esperando conexión con Spotify..."
    );

}


/* =========================================================
   ARRANCAR
========================================================= */

init();
