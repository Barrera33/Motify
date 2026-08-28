/* =========================================================
   MOTIFY
   Spotify Web Playback Controller
   Versión portátil - GitHub Pages
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
let playerInitializing = false;


/* =========================================================
   ELEMENTOS
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

    if (!systemConsole) return;

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

    const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
        "abcdefghijklmnopqrstuvwxyz" +
        "0123456789-._~";

    const randomValues =
        new Uint8Array(length);

    crypto.getRandomValues(randomValues);

    let result = "";

    for (let i = 0; i < length; i++) {

        result +=
            characters[
                randomValues[i] %
                characters.length
            ];
    }

    return result;
}


async function sha256(value) {

    const encoder =
        new TextEncoder();

    const data =
        encoder.encode(value);

    return crypto.subtle.digest(
        "SHA-256",
        data
    );
}


function base64urlencode(buffer) {

    const bytes =
        new Uint8Array(buffer);

    let binary = "";

    for (let i = 0; i < bytes.length; i++) {

        binary +=
            String.fromCharCode(bytes[i]);
    }

    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}


/* =========================================================
   LOGIN SPOTIFY
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
           Generamos PKCE
        */

        const verifier =
            randomString(64);

        const hash =
            await sha256(verifier);

        const challenge =
            base64urlencode(hash);


        /*
           Guardamos el verifier.
           sessionStorage funciona tanto
           en tu PC como en el colegio.
        */

        sessionStorage.setItem(
            "motify_code_verifier",
            verifier
        );


        /*
           URL de autorización
        */

        const params =
            new URLSearchParams();

        params.set(
            "response_type",
            "code"
        );

        params.set(
            "client_id",
            CLIENT_ID
        );

        params.set(
            "scope",
            SCOPES
        );

        params.set(
            "redirect_uri",
            REDIRECT_URI
        );

        params.set(
            "code_challenge_method",
            "S256"
        );

        params.set(
            "code_challenge",
            challenge
        );

        /*
           Hace que Spotify muestre
           la pantalla de autorización.
        */

        params.set(
            "show_dialog",
            "true"
        );


        const authorizationURL =
            "https://accounts.spotify.com/authorize?" +
            params.toString();


        log(
            "🚀 Abriendo autorización de Spotify..."
        );


        window.location.href =
            authorizationURL;

    }

    catch (error) {

        log(
            "❌ Error iniciando Spotify: " +
            error.message,
            "error"
        );

    }
}


/* =========================================================
   CALLBACK DE SPOTIFY
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


    /*
       Spotify rechazó
    */

    if (error) {

        log(
            "❌ Spotify rechazó la conexión: " +
            error,
            "error"
        );

        return false;
    }


    /*
       No hay código
    */

    if (!code) {

        return false;
    }


    /*
       Recuperamos PKCE verifier
    */

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

        log(
            "🔄 Conectando con Spotify..."
        );


        /*
           Intercambio del código
           por access token.
        */

        const body =
            new URLSearchParams();

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
                "Spotify no pudo entregar el token."
            );
        }


        /*
           Guardamos token
        */

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
           MUY IMPORTANTE:

           Quitamos ?code=...
           de la URL.

           Volvemos a la interfaz
           principal de MOTIFY.
        */

        window.history.replaceState(
            {},
            document.title,
            REDIRECT_URI
        );


        log(
            "🟢 Spotify conectado correctamente.",
            "success"
        );


        /*
           MOSTRAMOS LA INTERFAZ
        */

        showPlayer();


        /*
           Esperamos SDK
        */

        waitForSDK();


        return true;

    }

    catch (error) {

        log(
            "❌ Error conectando Spotify: " +
            error.message,
            "error"
        );

        return false;
    }
}


/* =========================================================
   MOSTRAR INTERFAZ DEL REPRODUCTOR
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


    log(
        "🎵 Interfaz MOTIFY cargada."
    );
}


/* =========================================================
   ESPERAR SPOTIFY SDK
========================================================= */

function waitForSDK() {

    if (window.Spotify) {

        log(
            "🎵 Spotify SDK encontrado.",
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
            "ℹ️ MOTIFY Player ya está creado."
        );

        return;
    }


    if (playerInitializing) {

        return;
    }


    if (!accessToken) {

        log(
            "❌ No existe token de Spotify.",
            "error"
        );

        return;
    }


    if (!window.Spotify) {

        log(
            "❌ Spotify SDK todavía no está disponible.",
            "error"
        );

        return;
    }


    playerInitializing = true;


    log(
        "🎧 Creando reproductor MOTIFY..."
    );


    player =
        new Spotify.Player({

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


    /* =====================================================
       MOTIFY READY
    ===================================================== */

    player.addListener(
        "ready",
        async data => {

            deviceId =
                data.device_id;


            log(
                "🔥 MOTIFY READY",
                "success"
            );


            log(
                "🆔 Device ID: " +
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
               Comprobamos que Spotify
               vea el dispositivo.
            */

            await waitForDeviceInSpotify();
        }
    );


    /* =====================================================
       MOTIFY NOT READY
    ===================================================== */

    player.addListener(
        "not_ready",
        data => {

            log(
                "🔴 MOTIFY desconectado.",
                "error"
            );


            if (
                data.device_id ===
                deviceId
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
       CAMBIO DE CANCIÓN
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
                state.track_window &&
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
               Portada

               IMPORTANTE:
               usamos createElement para evitar
               problemas con HTML dentro de strings.
            */

            if (
                albumCover &&
                track.album &&
                track.album.images &&
                track.album.images.length > 0
            ) {

                albumCover.innerHTML = "";

                const image =
                    document.createElement(
                        "img"
                    );

                image.src =
                    track.album.images[0].url;

                image.alt =
                    "Album";

                albumCover.appendChild(
                    image
                );
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


    /* =====================================================
       CONECTAR PLAYER
    ===================================================== */

    player.connect()
        .then(success => {

            if (success) {

                log(
                    "🟢 Web Playback conectado.",
                    "success"
                );

            }

            else {

                log(
                    "❌ No se pudo conectar MOTIFY.",
                    "error"
                );
            }
        });
}


/* =========================================================
   BUSCAR MOTIFY EN SPOTIFY
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


    if (attempts >= 15) {

        log(
            "⚠️ Spotify todavía no muestra MOTIFY."
        );

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
                "❌ Token expirado.",
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

            return false;
        }


        const data =
            await response.json();


        const devices =
            data.devices || [];


        console.log(
            "🎧 DISPOSITIVOS:",
            devices
        );


        const motify =
            devices.find(
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


            return true;
        }


        log(
            "⏳ Esperando que Spotify detecte MOTIFY..."
        );


        setTimeout(
            () => {

                waitForDeviceInSpotify(
                    attempts + 1
                );

            },
            1500
        );


    }

    catch (error) {

        log(
            "⚠️ Error consultando dispositivos: " +
            error.message,
            "error"
        );

        return false;
    }
}


/* =========================================================
   LIMPIAR SESIÓN
========================================================= */

function clearSpotifySession() {

    accessToken = null;

    deviceId = null;


    sessionStorage.removeItem(
        "motify_access_token"
    );

    sessionStorage.removeItem(
        "motify_token_expiration"
    );

    sessionStorage.removeItem(
        "motify_code_verifier"
    );
}


/* =========================================================
   TRANSFERIR SPOTIFY → MOTIFY
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


    try {

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

        }

        else {

            const text =
                await response.text();


            log(
                "❌ Error de transferencia " +
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

    }

    catch (error) {

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

            }

            catch (error) {

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

            }

            catch (error) {

                log(
                    "❌ Siguiente: " +
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

            }

            catch (error) {

                log(
                    "❌ Anterior: " +
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

            }

            catch (error) {

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

                systemConsole.innerHTML = "";
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


    const params =
        new URLSearchParams(
            window.location.search
        );


    /*
       =====================================================
       CASO 1
       Spotify acaba de devolver ?code=...
       =====================================================
    */

    if (params.has("code")) {

        log(
            "🔑 Código de Spotify recibido."
        );


        await handleSpotifyCallback();

        return;
    }


    /*
       =====================================================
       CASO 2
       Spotify devolvió un error
       =====================================================
    */

    if (params.has("error")) {

        await handleSpotifyCallback();

        return;
    }


    /*
       =====================================================
       CASO 3
       No hay código.
       Mostramos la pantalla inicial.
       =====================================================
    */

    if (loginSection) {

        loginSection.classList.remove(
            "hidden"
        );
    }


    if (playerSection) {

        playerSection.classList.add(
            "hidden"
        );
    }


    if (connectionStatus) {

        connectionStatus.textContent =
            "🔴 DESCONECTADO";

        connectionStatus.className =
            "status disconnected";
    }


    log(
        "⚪ Esperando conexión con Spotify..."
    );
}


/* =========================================================
   ARRANCAR
========================================================= */

init();
