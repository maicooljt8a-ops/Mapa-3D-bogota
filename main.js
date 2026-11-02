import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const CENTRO = [-74.0758, 4.5981];
const EXAGERACION_INICIAL = 1.5;
const URL_INDICE_BLOQUES = 'models/bloques/index.json';
const URL_DECODIFICADOR_DRACO = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/';
const ORDEN_BLOQUES = ['SW', 'SE', 'NW', 'NE'];
const COLOR_EDIFICIOS = 0xfaf6ec;
const COLOR_VIAS = 0x333333;

const mapa = new maplibregl.Map({
  container: 'mapa',
  style: 'https://tiles.openfreemap.org/styles/liberty',
  center: CENTRO,
  zoom: 14.5,
  pitch: 60,
  bearing: -20,
  maxPitch: 85,
  antialias: true,
  attributionControl: false
});

mapa.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
mapa.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 120 }), 'bottom-left');
mapa.addControl(
  new maplibregl.AttributionControl({
    compact: true,
    customAttribution: '© OpenFreeMap · © OpenStreetMap contributors · Elevación: AWS Terrain Tiles'
  }),
  'bottom-right'
);

function escapar(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (caracter) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[caracter]));
}

let popupActivo = null;

let indiceBloques = null;
const bloques = new Map();
let desplazamientoEdificios = 0;
let exageracionTerreno = EXAGERACION_INICIAL;
let terrenoActivo = true;
let escenaBloques = null;
let camaraBloques = null;
let renderizadorBloques = null;
let gltfLoader = null;
let dracoLoader = null;

const materialEdificios = new THREE.MeshLambertMaterial({
  color: COLOR_EDIFICIOS,
  flatShading: true,
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1
});

const materialVias = new THREE.MeshLambertMaterial({
  color: COLOR_VIAS,
  flatShading: true,
  side: THREE.DoubleSide
});

function estadoBloque(id) {
  if (!bloques.has(id)) {
    bloques.set(id, {
      activo: false,
      cargando: false,
      cargado: false,
      grupo: null,
      grupoEdificios: null,
      grupoVias: null
    });
  }
  return bloques.get(id);
}

function crearCapaBloques() {
  return {
    id: 'bloques-3d',
    type: 'custom',
    renderingMode: '3d',
    onAdd(map, gl) {
      camaraBloques = new THREE.Camera();
      escenaBloques = new THREE.Scene();

      const ambiente = new THREE.AmbientLight(0xffffff, 1.0);
      escenaBloques.add(ambiente);

      const luz = new THREE.DirectionalLight(0xffffff, 1.2);
      luz.position.set(-1, -0.8, 2);
      escenaBloques.add(luz);

      renderizadorBloques = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true
      });
      renderizadorBloques.autoClear = false;

      const lienzo = map.getCanvas();
      renderizadorBloques.setSize(lienzo.width, lienzo.height, false);
      map.on('resize', () => {
        const actual = map.getCanvas();
        renderizadorBloques.setSize(actual.width, actual.height, false);
      });
    },
    render(gl, argumentos) {
      if (!renderizadorBloques || !escenaBloques || !camaraBloques) {
        return;
      }

      const matriz = argumentos?.defaultProjectionData?.mainMatrix ?? argumentos;
      if (!matriz) {
        return;
      }

      camaraBloques.projectionMatrix.fromArray(matriz);
      camaraBloques.projectionMatrixInverse.copy(camaraBloques.projectionMatrix).invert();
      renderizadorBloques.resetState();
      renderizadorBloques.render(escenaBloques, camaraBloques);
    }
  };
}

function configurarCargadores() {
  dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(URL_DECODIFICADOR_DRACO);
  gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);
}

function exageracionActual() {
  return terrenoActivo ? exageracionTerreno : 1;
}

function aplicarTransformacion(id) {
  const estado = estadoBloque(id);
  const dato = indiceBloques?.[id];
  if (!estado.grupo || !dato) {
    return;
  }

  const exageracion = exageracionActual();
  const altitud = terrenoActivo ? dato.origen.z_m * exageracion : 0;
  const mercator = maplibregl.MercatorCoordinate.fromLngLat(
    [dato.origen.lon, dato.origen.lat],
    altitud
  );
  const escala = mercator.meterInMercatorCoordinateUnits();
  const matriz = new THREE.Matrix4()
    .makeTranslation(mercator.x, mercator.y, mercator.z)
    .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
    .multiply(new THREE.Matrix4().makeScale(escala, escala * exageracion, escala));

  estado.grupo.matrix.copy(matriz);
  estado.grupo.matrixWorldNeedsUpdate = true;
  estado.grupoEdificios.position.y = desplazamientoEdificios / exageracion;
}

function actualizarTransformaciones() {
  for (const id of bloques.keys()) {
    aplicarTransformacion(id);
  }
  mapa.triggerRepaint();
}

function hayBloquesActivos() {
  for (const estado of bloques.values()) {
    if (estado.activo) {
      return true;
    }
  }
  return false;
}

function actualizarVisibilidadEdificiosOsm() {
  if (!mapa.getLayer('edificios-3d')) {
    return;
  }

  const casilla = document.getElementById('capa-edificios');
  const visible = !hayBloquesActivos() && (!casilla || casilla.checked);
  mapa.setLayoutProperty('edificios-3d', 'visibility', visible ? 'visible' : 'none');
}

function mostrarEstadoBloque(id, texto, error = false) {
  const estado = document.querySelector(`[data-estado="${id}"]`);
  if (!estado) {
    return;
  }
  estado.textContent = texto;
  estado.classList.toggle('error', error);
}

async function cargarBloque(id) {
  const estado = estadoBloque(id);
  const dato = indiceBloques?.[id];
  if (!dato || estado.cargando || estado.cargado) {
    return;
  }

  estado.cargando = true;
  mostrarEstadoBloque(id, 'cargando…');

  try {
    const gltf = await gltfLoader.loadAsync(dato.archivo);
    const mallas = [];
    gltf.scene.traverse((objeto) => {
      if (objeto.isMesh) {
        mallas.push(objeto);
      }
    });

    const grupo = new THREE.Group();
    grupo.matrixAutoUpdate = false;
    const grupoEdificios = new THREE.Group();
    const grupoVias = new THREE.Group();

    for (const malla of mallas) {
      const nombre = `${malla.name} ${malla.material?.name ?? ''}`.toLowerCase();
      const esVia = nombre.includes('via');
      malla.material = esVia ? materialVias : materialEdificios;
      malla.frustumCulled = false;
      (esVia ? grupoVias : grupoEdificios).add(malla);
    }

    grupo.add(grupoEdificios, grupoVias);
    escenaBloques.add(grupo);

    estado.grupo = grupo;
    estado.grupoEdificios = grupoEdificios;
    estado.grupoVias = grupoVias;
    estado.cargado = true;
    estado.cargando = false;
    grupo.visible = estado.activo;

    aplicarTransformacion(id);
    actualizarVisibilidadEdificiosOsm();
    mapa.triggerRepaint();
    mostrarEstadoBloque(id, '');
  } catch (error) {
    console.error(`No se pudo cargar el bloque ${id}`, error);
    estado.cargando = false;
    estado.cargado = false;
    estado.activo = false;
    const casilla = document.querySelector(`input[data-bloque="${id}"]`);
    if (casilla) {
      casilla.checked = false;
    }
    actualizarVisibilidadEdificiosOsm();
    mostrarEstadoBloque(id, 'error', true);
  }
}

function configurarPanelBloques() {
  for (const id of ORDEN_BLOQUES) {
    const estado = estadoBloque(id);
    const casilla = document.querySelector(`input[data-bloque="${id}"]`);
    if (!casilla) {
      continue;
    }

    casilla.addEventListener('change', () => {
      estado.activo = casilla.checked;
      actualizarVisibilidadEdificiosOsm();
      if (!estado.activo) {
        if (estado.grupo) {
          estado.grupo.visible = false;
        }
        mapa.triggerRepaint();
        return;
      }

      if (estado.cargado) {
        estado.grupo.visible = true;
        mapa.triggerRepaint();
      } else {
        cargarBloque(id);
      }
    });
  }

  const controlAjuste = document.getElementById('ajuste-edificios');
  const valorAjuste = document.getElementById('valor-ajuste');
  if (!controlAjuste || !valorAjuste) {
    return;
  }

  controlAjuste.addEventListener('input', (evento) => {
    desplazamientoEdificios = Number(evento.target.value);
    valorAjuste.textContent = `${desplazamientoEdificios > 0 ? '+' : ''}${desplazamientoEdificios} m`;
    actualizarTransformaciones();
  });
}

async function iniciarBloques() {
  configurarPanelBloques();

  try {
    const respuesta = await fetch(URL_INDICE_BLOQUES);
    if (!respuesta.ok) {
      throw new Error(`HTTP ${respuesta.status}`);
    }
    const indice = await respuesta.json();
    indiceBloques = indice.bloques ?? {};
  } catch (error) {
    console.error('No se pudo cargar el índice de bloques', error);
    for (const id of ORDEN_BLOQUES) {
      mostrarEstadoBloque(id, 'sin índice', true);
    }
    return;
  }

  configurarCargadores();

  for (const id of ORDEN_BLOQUES) {
    const estado = estadoBloque(id);
    const casilla = document.querySelector(`input[data-bloque="${id}"]`);
    if (!casilla) {
      continue;
    }

    if (!indiceBloques[id]) {
      casilla.disabled = true;
      mostrarEstadoBloque(id, 'no disponible');
      continue;
    }

    estado.activo = casilla.checked;
    if (estado.activo) {
      cargarBloque(id);
    }
  }

  actualizarVisibilidadEdificiosOsm();
}

mapa.on('load', () => {
  mapa.addSource('terreno', {
    type: 'raster-dem',
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    encoding: 'terrarium',
    tileSize: 256,
    maxzoom: 15
  });

  const primeraEtiqueta = mapa.getStyle().layers.find((capa) => capa.type === 'symbol');
  const antesDe = primeraEtiqueta ? primeraEtiqueta.id : undefined;

  mapa.addLayer({
    id: 'relieve',
    type: 'hillshade',
    source: 'terreno',
    paint: {
      'hillshade-exaggeration': 0.35,
      'hillshade-shadow-color': '#6b665f',
      'hillshade-highlight-color': '#ffffff',
      'hillshade-accent-color': '#8a857c'
    }
  }, antesDe);

  if (mapa.getLayer('building-3d')) {
    mapa.setLayoutProperty('building-3d', 'visibility', 'none');
  }

  mapa.addLayer({
    id: 'edificios-3d',
    type: 'fill-extrusion',
    source: 'openmaptiles',
    'source-layer': 'building',
    minzoom: 13,
    filter: ['!', ['has', 'hide_3d']],
    paint: {
      'fill-extrusion-color': '#d8d2c8',
      'fill-extrusion-height': ['coalesce', ['get', 'render_height'], ['get', 'height'], 8],
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
      'fill-extrusion-opacity': 0.9
    }
  }, antesDe);

  mapa.addSource('sitios', {
    type: 'geojson',
    data: 'data/sitios.geojson'
  });

  mapa.addLayer({
    id: 'sitios-puntos',
    type: 'circle',
    source: 'sitios',
    paint: {
      'circle-radius': 7,
      'circle-color': '#33544a',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
      'circle-pitch-alignment': 'map'
    }
  }, antesDe);

  mapa.addLayer({
    id: 'sitios-etiquetas',
    type: 'symbol',
    source: 'sitios',
    minzoom: 11,
    layout: {
      'text-field': ['get', 'nombre'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 12,
      'text-offset': [0, 1.1],
      'text-anchor': 'top',
      'text-max-width': 9,
      'text-padding': 2
    },
    paint: {
      'text-color': '#2b2f33',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.4
    }
  }, antesDe);

  mapa.setTerrain({ source: 'terreno', exaggeration: EXAGERACION_INICIAL });
  mapa.addLayer(crearCapaBloques(), antesDe);

  mapa.on('click', 'sitios-puntos', (evento) => {
    const sitio = evento.features[0];
    const propiedades = sitio.properties;
    const coordenadas = sitio.geometry.coordinates.slice();

    if (popupActivo) {
      popupActivo.remove();
    }

    popupActivo = new maplibregl.Popup({ offset: 12, maxWidth: '280px' })
      .setLngLat(coordenadas)
      .setHTML(
        `<div class="popup">` +
        `<h3>${escapar(propiedades.nombre)}</h3>` +
        `<p class="popup-categoria">${escapar(propiedades.categoria)}</p>` +
        `<p>${escapar(propiedades.descripcion)}</p>` +
        `</div>`
      )
      .addTo(mapa);
  });

  mapa.on('mouseenter', 'sitios-puntos', () => {
    mapa.getCanvas().style.cursor = 'pointer';
  });

  mapa.on('mouseleave', 'sitios-puntos', () => {
    mapa.getCanvas().style.cursor = '';
  });

  const capaEdificios = document.getElementById('capa-edificios');
  const capaTerreno = document.getElementById('capa-terreno');
  const capaRelieve = document.getElementById('capa-relieve');
  const capaSitios = document.getElementById('capa-sitios');
  const controlExageracion = document.getElementById('exageracion');
  const valorExageracion = document.getElementById('valor-exageracion');

  capaEdificios.addEventListener('change', () => {
    actualizarVisibilidadEdificiosOsm();
  });

  capaTerreno.addEventListener('change', (evento) => {
    const activo = evento.target.checked;
    controlExageracion.disabled = !activo;
    terrenoActivo = activo;
    exageracionTerreno = Number(controlExageracion.value);

    if (activo) {
      mapa.setTerrain({
        source: 'terreno',
        exaggeration: exageracionTerreno
      });
    } else {
      mapa.setTerrain(null);
    }

    actualizarTransformaciones();
  });

  controlExageracion.addEventListener('input', (evento) => {
    const valor = Number(evento.target.value);
    valorExageracion.textContent = `${valor.toFixed(1)}×`;
    exageracionTerreno = valor;

    if (capaTerreno.checked) {
      terrenoActivo = true;
      mapa.setTerrain({ source: 'terreno', exaggeration: valor });
    }

    actualizarTransformaciones();
  });

  capaRelieve.addEventListener('change', (evento) => {
    mapa.setLayoutProperty('relieve', 'visibility', evento.target.checked ? 'visible' : 'none');
  });

  capaSitios.addEventListener('change', (evento) => {
    const visibilidad = evento.target.checked ? 'visible' : 'none';
    mapa.setLayoutProperty('sitios-puntos', 'visibility', visibilidad);
    mapa.setLayoutProperty('sitios-etiquetas', 'visibility', visibilidad);
  });

  iniciarBloques();
});
