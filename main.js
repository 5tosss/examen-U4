import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { XRButton } from 'three/addons/webxr/XRButton.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

let camara, escenario, renderizador, cronometro, mezclador, modelo, animaciones, animacionActiva, animacionAnterior;
const objetosColisionables = [];
const estadisticas = new Stats();

iniciarEscenario();
renderizador.setAnimationLoop(animarEscena);

function iniciarEscenario() {
    const contenedor = document.createElement('div');
    document.body.appendChild(contenedor);

    camara = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 2000);
    camara.position.set(0, 150, 0);

    escenario = new THREE.Scene();
    establecerFondoCielo('Models/background/background.jpg');
    escenario.fog = new THREE.Fog(0x093d42, 200, 1500);

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

    const suelo = new THREE.Mesh(
        new THREE.PlaneGeometry(4000, 4000),
        new THREE.MeshPhongMaterial({ color: 0x999999, depthWrite: false })
    );
    suelo.rotation.x = -Math.PI / 2;
    suelo.receiveShadow = true;
    escenario.add(suelo);
    establecerFondoConImagen('Models/background/floor.jpg');

    const cargadorFBX = new FBXLoader();
    cargadorFBX.load('Models/fbx/Erika.fbx', function (objeto) {
        modelo = objeto;
        modelo.scale.set(1, 1, 1);
        modelo.traverse(function (child) {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        const nodoCamara = new THREE.Object3D();
        nodoCamara.position.set(0, 160, 0); // Altura ojos
        modelo.add(nodoCamara);
        nodoCamara.add(camara);

escenario.add(modelo);
        modelo.add(camara);
        escenario.add(modelo);

        mezclador = new THREE.AnimationMixer(modelo);
        animaciones = {};
        cargarAnimaciones(cargadorFBX, mezclador, animaciones);
        crearCubosColisionablesFBX('Models/fbx/source/Tree.fbx', escenario, objetosColisionables);
    });

    renderizador = new THREE.WebGLRenderer({ antialias: true });
    renderizador.setPixelRatio(window.devicePixelRatio);
    renderizador.setSize(window.innerWidth, window.innerHeight);
    renderizador.shadowMap.enabled = true;
    renderizador.xr.enabled = true;
    contenedor.appendChild(renderizador.domElement);
    document.body.appendChild(XRButton.createButton(renderizador));

    window.addEventListener('resize', ajustarVentana);
    cronometro = new THREE.Clock();
    contenedor.appendChild(estadisticas.dom);

    const gui = new GUI({ position: { x: window.innerWidth - 300, y: 10 } });
    const carpetaLuz = gui.addFolder('Iluminación');
    const carpetaNiebla = gui.addFolder('Neblina');
    carpetaLuz.add(luzDireccional, 'intensity', 0, 2, 0.01).name('Intensidad Dirección');
    carpetaLuz.add(luzHemisferica, 'intensity', 0, 2, 0.01).name('Intensidad Hemisferio');
    carpetaNiebla.add(escenario.fog, 'far', 500, 3000, 1).name('Distancia');
}

function establecerFondoCielo(imagenRuta) {
    const loader = new THREE.TextureLoader();
    loader.load(imagenRuta, function (texture) {
        escenario.background = texture;
    });
}

function establecerFondoConImagen(imagenRuta) {
    const loader = new THREE.TextureLoader();
    loader.load(imagenRuta, function (texture) {
        const geometry = new THREE.PlaneGeometry(5000, 5000);
        const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
        const fondo = new THREE.Mesh(geometry, material);
        fondo.position.set(0, 0, -500);
        fondo.rotation.x = Math.PI / 2;
        escenario.add(fondo);
    });
}

function cargarAnimaciones(cargador, mezclador, animaciones) {
    const rutas = [
        ['Models/fbx/combatidle.fbx', 'idle'],
        ['Models/fbx/Walk.fbx', 'walk'],
        ['Models/fbx/Standing Draw Arrow.fbx', 'attack1'],
        ['Models/fbx/Standing Melee Kick.fbx', 'attack2'],
        ['Models/fbx/Standing Disarm Bow.fbx', 'defense'],
        ['Models/fbx/Standing Equip Bow.fbx', 'emote'],
        ['Models/fbx/standing_Jump.fbx', 'kick']
    ];
    rutas.forEach(([ruta, clave]) => {
        cargador.load(ruta, function (anim) {
            const accion = mezclador.clipAction(anim.animations[0]);
            animaciones[clave] = accion;
            if (clave === 'idle' && !animacionActiva) {
                animacionActiva = accion;
                animacionActiva.play();
            }
        });
    });
}

function crearCubosColisionablesFBX(rutaModelo, escenario, objetosColisionables) {
    const cargadorFBX = new FBXLoader();
    const posicionInicialPersonaje = new THREE.Vector3(0, 0, 0);
    const distanciaMinima = 300;

    cargadorFBX.load(rutaModelo, function (objeto) {
        objeto.scale.set(1, 1, 1);
        for (let i = 0; i < 80; i++) {
            let instancia, distancia;
            do {
                const posicionX = Math.random() * 2000 - 1000;
                const posicionZ = Math.random() * 2000 - 1000;
                instancia = objeto.clone();
                instancia.position.set(posicionX, 0, posicionZ);
                distancia = instancia.position.distanceTo(posicionInicialPersonaje);
            } while (distancia < distanciaMinima);
            instancia.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            escenario.add(instancia);
            objetosColisionables.push(instancia);
        }
    });
}


function cambiarAnimacion(nuevaAnimacion) {
    if (animacionActiva !== nuevaAnimacion) {
        animacionAnterior = animacionActiva;
        animacionActiva = nuevaAnimacion;
        animacionAnterior.fadeOut(0.5);
        animacionActiva.reset().fadeIn(0.5).play();
    }
}

function verificarColision(nuevaPosicion) {
    const caja = new THREE.Box3().setFromObject(modelo);
    const boundingBoxModelo = caja.clone().translate(nuevaPosicion.sub(modelo.position));
    for (let i = 0; i < objetosColisionables.length; i++) {
        const boundingBoxObjeto = new THREE.Box3().setFromObject(objetosColisionables[i]);
        if (boundingBoxModelo.intersectsBox(boundingBoxObjeto)) {
            return true;
        }
    }
    return false;
}

function animarEscena() {
    const delta = cronometro.getDelta();
    if (mezclador) mezclador.update(delta);

    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const controlador = Array.from(gamepads).find(g => g && (g.hand === 'left' || g.hand === 'right'));

    if (controlador && controlador.axes.length >= 2) {
    const ejeX = controlador.axes[2] || 0;
    const ejeY = controlador.axes[3] || 0;
    const velocidad = 150 * delta;
    const direccion = new THREE.Vector3(ejeX, 0, ejeY).multiplyScalar(velocidad);
    const direccionGlobal = direccion.applyQuaternion(camara.quaternion);
    direccionGlobal.y = 0;
    
    if (!verificarColision(modelo.position.clone().add(direccionGlobal))) {
        modelo.position.add(direccionGlobal);
    }
    
    if (ejeX !== 0 || ejeY !== 0) {
        modelo.lookAt(modelo.position.clone().add(direccionGlobal));
        if (animacionActiva !== animaciones.walk) cambiarAnimacion(animaciones.walk);
    } else {
        if (animacionActiva !== animaciones.idle) cambiarAnimacion(animaciones.idle);
    }
}


    renderizador.render(escenario, camara);
    estadisticas.update();
}




function ajustarVentana() {
    camara.aspect = window.innerWidth / window.innerHeight;
    camara.updateProjectionMatrix();
    renderizador.setSize(window.innerWidth, window.innerHeight);
}

function manejarTeclaPresionada(evento) {
    teclado[evento.key.toLowerCase()] = true;
    gestionarAnimacion();
}

function manejarTeclaSoltada(evento) {
    teclado[evento.key.toLowerCase()] = false;
    gestionarAnimacion();
}

function gestionarAnimacion() {
    if (teclado['w'] || teclado['s'] || teclado['a'] || teclado['d']) {
        if (animacionActiva !== animaciones.walk) {
            cambiarAnimacion(animaciones.walk);
        }
    } else if (teclado['f']) {
        if (animacionActiva !== animaciones.attack1) {
            cambiarAnimacion(animaciones.attack1);
        }
    } else if (teclado['shift']) {
        if (animacionActiva !== animaciones.attack2) {
            cambiarAnimacion(animaciones.attack2);
        }
    } else if (teclado['q']) {
        if (animacionActiva !== animaciones.defense) {
            cambiarAnimacion(animaciones.defense);
        }
    } else if (teclado['e']) {
        if (animacionActiva !== animaciones.emote) {
            cambiarAnimacion(animaciones.emote);
        }
    } else if (teclado[' ']) {
        if (animacionActiva !== animaciones.kick) {
            cambiarAnimacion(animaciones.kick);
        }
    } else {
        if (animacionActiva !== animaciones.idle) {
            cambiarAnimacion(animaciones.idle);
        }
    }
}
