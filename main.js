import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { XRButton } from 'three/addons/webxr/XRButton.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

let camara, escenario, renderizador, cronometro, mezclador, modelo, animaciones, animacionActiva, animacionAnterior;
const objetosColisionables = [];
const estadisticas = new Stats();
const velocidadMovimiento = 2.0;

iniciarEscenario();
renderizador.setAnimationLoop(animarEscena);

function iniciarEscenario() {
    const contenedor = document.createElement('div');
    document.body.appendChild(contenedor);

    // Configuración de cámara para VR
    camara = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 2000);
    
    escenario = new THREE.Scene();
    establecerFondoCielo('Models/background/background.jpg');
    escenario.fog = new THREE.Fog(0x093d42, 200, 1500);

    // Configuración de luces (igual que antes)
    const luzHemisferica = new THREE.HemisphereLight(0x199e3b, 0x199e3b);
    luzHemisferica.position.set(0, 300, 0);
    escenario.add(luzHemisferica);

    const luzDireccional = new THREE.DirectionalLight(0xffffff);
    luzDireccional.position.set(0, 100, 100);
    luzDireccional.castShadow = true;
    luzDireccional.shadow.camera.top = 280;
    luzDireccional.shadow.camera.bottom = -100;
    luzDireccional.shadow.camera.left = -120;
    luzDireccional.shadow.camera.right = 120;
    escenario.add(luzDireccional);

    // Suelo (igual que antes)
    const suelo = new THREE.Mesh(
        new THREE.PlaneGeometry(4000, 4000),
        new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
    );
    suelo.rotation.x = -Math.PI / 2;
    suelo.receiveShadow = true;
    escenario.add(suelo);
    establecerFondoConImagen('Models/background/floor.jpg');

    // Cargar modelo del personaje
    const cargadorFBX = new FBXLoader();
    cargadorFBX.load('Models/fbx/Erika.fbx', function (objeto) {
        modelo = objeto;
        modelo.scale.set(1, 1, 1);
        
        // Configurar sombras
        modelo.traverse(function (child) {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        // Crear grupo para la cabeza/cámara en VR
        const cabezaVR = new THREE.Group();
        cabezaVR.position.set(0, 160, 0); // Altura de los ojos
        modelo.add(cabezaVR);
        
        // Añadir cámara al grupo de cabeza
        cabezaVR.add(camara);
        
        escenario.add(modelo);

        // Configurar animaciones
        mezclador = new THREE.AnimationMixer(modelo);
        animaciones = {};
        cargarAnimaciones(cargadorFBX, mezclador, animaciones);
        
        // Cargar objetos colisionables
        crearCubosColisionablesFBX('Models/fbx/source/Tree.fbx', escenario, objetosColisionables);
    });

    // Configurar renderizador para VR
    renderizador = new THREE.WebGLRenderer({ antialias: true });
    renderizador.setPixelRatio(window.devicePixelRatio);
    renderizador.setSize(window.innerWidth, window.innerHeight);
    renderizador.shadowMap.enabled = true;
    renderizador.xr.enabled = true;
    renderizador.xr.setReferenceSpaceType('local-floor'); // Importante para VR
    
    contenedor.appendChild(renderizador.domElement);
    document.body.appendChild(XRButton.createButton(renderizador, {
        onSessionStart: () => {
            // Configuración adicional cuando comienza la sesión VR
            console.log('Sesión VR iniciada');
        },
        onSessionEnd: () => {
            console.log('Sesión VR finalizada');
        }
    }));

    // Eventos y configuración adicional
    window.addEventListener('resize', ajustarVentana);
    cronometro = new THREE.Clock();
    contenedor.appendChild(estadisticas.dom);

    // GUI (igual que antes)
    const gui = new GUI({ position: { x: window.innerWidth - 300, y: 10 } });
    const carpetaLuz = gui.addFolder('Iluminación');
    const carpetaNiebla = gui.addFolder('Neblina');
    carpetaLuz.add(luzDireccional, 'intensity', 0, 2, 0.01).name('Intensidad Dirección');
    carpetaLuz.add(luzHemisferica, 'intensity', 0, 2, 0.01).name('Intensidad Hemisferio');
    carpetaNiebla.add(escenario.fog, 'far', 500, 3000, 1).name('Distancia');
}

// ... (las demás funciones como establecerFondoCielo, establecerFondoConImagen, 
// cargarAnimaciones, crearCubosColisionablesFBX permanecen iguales)

function animarEscena() {
    const delta = cronometro.getDelta();
    if (mezclador) mezclador.update(delta);

    // Solo procesar movimiento en modo VR
    if (renderizador.xr.isPresenting) {
        const session = renderizador.xr.getSession();
        if (session) {
            const gamepads = navigator.getGamepads();
            
            // Buscar los controles de los mandos de VR
            for (let i = 0; i < gamepads.length; i++) {
                const gamepad = gamepads[i];
                if (gamepad && gamepad.mapping === 'xr-standard') {
                    // Procesar movimiento con joystick izquierdo (generalmente eje 2 y 3)
                    const ejeX = gamepad.axes[2] || 0;
                    const ejeY = gamepad.axes[3] || 0;
                    
                    // Umbral para evitar drift
                    const umbral = 0.2;
                    if (Math.abs(ejeX) > umbral || Math.abs(ejeY) > umbral) {
                        const velocidad = velocidadMovimiento * delta;
                        
                        // Obtener la dirección de la cámara (sin inclinar hacia arriba/abajo)
                        const direccionCamara = new THREE.Vector3();
                        camara.getWorldDirection(direccionCamara);
                        direccionCamara.y = 0;
                        direccionCamara.normalize();
                        
                        // Calcular movimiento basado en la dirección de la cámara
                        const movimiento = new THREE.Vector3();
                        movimiento.addScaledVector(direccionCamara, -ejeY * velocidad);
                        
                        // Calcular movimiento lateral
                        const derecha = new THREE.Vector3();
                        camara.getWorldDirection(derecha);
                        derecha.y = 0;
                        derecha.cross(new THREE.Vector3(0, 1, 0)).normalize();
                        movimiento.addScaledVector(derecha, ejeX * velocidad);
                        
                        // Aplicar movimiento al modelo
                        const nuevaPosicion = modelo.position.clone().add(movimiento);
                        if (!verificarColision(nuevaPosicion)) {
                            modelo.position.copy(nuevaPosicion);
                        }
                        
                        // Rotar el modelo en la dirección del movimiento
                        if (movimiento.length() > 0) {
                            const angulo = Math.atan2(-movimiento.x, -movimiento.z);
                            modelo.rotation.y = angulo;
                        }
                        
                        // Activar animación de caminar
                        if (animacionActiva !== animaciones.walk) {
                            cambiarAnimacion(animaciones.walk);
                        }
                    } else {
                        // Sin movimiento, activar animación de reposo
                        if (animacionActiva !== animaciones.idle) {
                            cambiarAnimacion(animaciones.idle);
                        }
                    }
                }
            }
        }
    }

    renderizador.render(escenario, camara);
    estadisticas.update();
}

// ... (el resto de funciones permanecen igual)
