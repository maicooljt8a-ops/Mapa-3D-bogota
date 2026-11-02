# Bitácora: Mapa 3D de Bogotá con OpenCode

## 2026-10-30 15:47 — Configuración inicial de Blender MCP

- **Proveedor y modelo:** DeepSeek V4.1 Flash Free (OpenCode)
- **Agente:** Build
- **Prompt resumido:** Configurar entorno Blender + MCP y probar la conexión vía `blender_get_scene_info`.
- **Qué se hizo:**
  - Instalación de Blender 5.2.3.
  - Instalación del addon MCP for Blender 1.8, escuchando en el puerto 9876.
  - Configuración de `opencode.json` con el servidor MCP de Blender.
  - Prueba exitosa de `blender_get_scene_info`: escena por defecto con Cube, Light y Camera.
- **Problemas encontrados:** Ninguno.
- **Pendientes:** Crear el modelo GLB de Bogotá en Blender y la escena MapLibre GL JS.

## 2026-10-30 15:55 — Mapa web 3D de Bogotá con MapLibre GL JS

- **Proveedor y modelo:** DeepSeek V4.1 Flash Free (OpenCode)
- **Agente:** Build
- **Prompt resumido:** Crear un mapa web 3D interactivo de Bogotá con MapLibre GL JS desde CDN, solo HTML/CSS/JS estáticos, estilo OpenFreeMap liberty, terreno Terrarium, panel de capas con exageración y 8 sitios de interés en GeoJSON con popups.
- **Qué se hizo:**
  - `index.html`: mapa a pantalla completa, panel lateral de capas y deslizador; MapLibre GL JS y su CSS cargados desde jsDelivr (`@5`).
  - `style.css`: diseño sobrio en tonos neutros y verde oscuro, panel responsive y estilos de popups.
  - `main.js`: vista inicial centro [-74.08, 4.65], zoom 12, pitch 60, bearing -20; edificios 3D (`fill-extrusion`), terreno `raster-dem` Terrarium de AWS con exageración 1.5, relieve (hillshade), controles de navegación y escala, capas de sitios con popups y controles del panel.
  - `data/sitios.geojson`: 8 sitios (Monserrate, Plaza de Bolívar, Museo del Oro, Parque Simón Bolívar, Usaquén, Biblioteca Virgilio Barco, Jardín Botánico y Cerro de Guadalupe).
- **Verificación:** `node --check main.js` y validación JSON de `sitios.geojson` correctos.
- **Problemas encontrados:** El estilo liberty ya define `building-3d`; se oculta para usar una capa propia visible desde zoom 13. Se eliminó una fuente `raster-dem` vacía por error.
- **Pendientes:** Probar el mapa en navegador, añadir el modelo GLB de Blender y publicar en GitHub Pages.

## 2026-10-30 18:32 — Fase 1: descarga de edificios y DEM

- **Proveedor y modelo:** DeepSeek V4.1 Flash Free (OpenCode)
- **Agente:** Build
- **Prompt resumido:** Crear `scripts/descargar_datos.py` para descargar edificios de OSM vía Overpass (zona lat 4.595–4.625, lon -74.075 a -74.050), calcular altura y guardar `data/edificios.geojson`; descargar teselas Terrarium y guardar `data/dem.npy`; ejecutar y reportar resultados.
- **Qué se hizo:**
  - `scripts/descargar_datos.py`: consulta `nwr["building"]` con `out geom`, calcula `height` (etiqueta, `building:levels` × 3 o 9 m), redondea coordenadas a 6 decimales y escribe GeoJSON.
  - Descarga teselas Terrarium de AWS a zoom 15, decodifica RGB a metros y guarda `data/dem.npy` (1024×768, float32).
  - Resultado: **4307 edificios** y rango de elevación **2560.82–3309.78 m**.
- **Problemas encontrados:** `overpass-api.de` agotó el tiempo de lectura y conexión; `overpass.kumi.systems` y `overpass.private.coffee` respondieron 504. Se añadió `maps.mail.ru` como servidor alterno y un reintento por servidor; el segundo intento funcionó.
- **Pendientes:** Generar el modelo 3D en Blender, exportar GLB con Draco y actualizar la bitácora de la Fase 2.

## 2026-10-30 19:40 — Fase 2: modelo 3D de Bogotá en Blender

- **Proveedor y modelo:** DeepSeek V4.1 Flash Free (OpenCode)
- **Agente:** Build
- **Prompt resumido:** Generar el modelo 3D de Bogotá desde `data/edificios.geojson` y `data/dem.npy`, con origen local en (-74.0625, 4.610), terreno mallado, edificios extruidos y apoyados, materiales rosado–vino, y exportar GLB con Draco y BLEND.
- **Qué se hizo:**
  - `scripts/generar_blender.py`: conversión lat/lon a metros, muestreo bilineal del DEM, malla de terreno con paso 2, extrusión de edificios con base en la cota mínima de su huella y 8 bandas de altura, cámara, sol y exportación.
  - Herramientas MCP usadas: `blender_execute_blender_code`, `blender_look`, `blender_get_scene_info`, `blender_get_addon_status`.
  - Paso 1: escena limpia (0 objetos).
  - Paso 2: terreno de 197 505 vértices y 196 608 caras; cota base 2740.2 m; z relativa -179.4 a 569.6 m.
  - Paso 3: **4307 edificios** en 4325 partes, unidos en 4 objetos; alturas 3.0–216.0 m.
  - Paso 4: 8 materiales `Bogota_Altura_01` a `Bogota_Altura_08` (rosado claro a vino oscuro) y material de terreno.
  - Paso 5: `models/bogota.glb` de **0.83 MB** con Draco en las 20 primitivas; `models/bogota.blend` de 6.63 MB.
- **Problemas encontrados:** Ninguno bloqueante. La distribución de edificios por chunk quedó desigual por la concentración urbana, pero se mantienen pocos objetos.
- **Pendientes:** Integrar `models/bogota.glb` en el mapa MapLibre, probar en navegador y publicar en GitHub Pages.

## 2026-10-30 20:26 — Alturas estimadas para edificios sin dato real

- **Proveedor y modelo:** DeepSeek V4.1 Flash Free (OpenCode)
- **Agente:** Build
- **Prompt resumido:** Antes de la Parte B, asignar altura estimada de 6 a 30 m a los edificios con 9 m por defecto, según el área de la huella y una variación determinista por ID, guardar `height_fuente` y documentar que no son datos reales.
- **Qué se hizo:**
  - `scripts/estimar_alturas.py`: calcula el área de la huella con la fórmula del polígono en metros locales (R = 6 378 137 m, coseno de lat 4.610).
  - Solo se modificaron los edificios con `fuente_altura = "default"`. Las alturas reales se conservaron intactas.
  - Altura base = 6 m + 24 m × log(área)/log(9000), con área acotada a 1–9000 m².
  - Variación determinista = 0.85–1.15 según los primeros 8 dígitos hexadecimales de SHA-256 del ID; se acota a 6–30 m y se redondea a 1 decimal.
  - Se añadió `height_fuente` con valor `"real"` o `"estimada"` en `data/edificios_final.geojson`.
  - Resultado: 270 alturas reales y **11 038 alturas estimadas**, rango 6.0–30.0 m, media 16.2 m.
- **Advertencia:** las alturas estimadas **no son datos reales**; son una aproximación visual reproducible para el render.
- **Problemas encontrados:** Ninguno.
- **Pendientes:** Ejecutar la Parte B en Blender y registrar los resultados finales.

## 2026-10-30 20:59 — Partes A y B: modelo completo, comparación OSM/Overture y renders

- **Proveedor y modelo:** DeepSeek V4.1 Flash Free (OpenCode)
- **Agente:** Build
- **Prompt resumido:** Parte A: descargar Overture, comparar con OSM, descargar vías/agua/zonas verdes, estimar alturas y recortar. Parte B: generar la escena completa en Blender, exportar GLB con Draco y render aéreo. Registrar todo en `BITACORA.md`, incluida la comparación OSM vs Overture y los problemas encontrados.
- **Qué se hizo:**
  - `.venv` local con `overturemaps 1.0.2` y `shapely`; trabajo dentro del proyecto y temporales de pip/estado eliminados.
  - `scripts/combinar_edificios.py`: descarga de **11 304 edificios Overture**. Comparación: OSM **4 307** (271 con `height`/`building:levels`), Overture **11 304** (270 con `height`/`num_floors`), **4 303 IDs coinciden** y 4 son solo OSM; combinado inicial de **11 308**.
  - `scripts/descargar_capas.py`: **2 658 vías**, **64 features de agua** (31 polígonos y 33 cauces) y **161 zonas verdes**.
  - `scripts/estimar_alturas.py`: 270 alturas reales conservadas y **11 038 estimadas** (6–30 m, media 16.2 m), con `height_fuente` = `"real"`/`"estimada"`.
  - `scripts/recortar_capas.py`: recorte al bbox con Shapely; `data/edificios_final.geojson` queda con **11 297 features**.
  - `scripts/generar_blender.py`: terreno recortado de **104 076 vértices** y **103 429 caras**, coloreado por elevación; **11 296 edificios** en 6 objetos (1 geometría inválida omitida); vías grises, agua azul y zonas verdes; **3 000 árboles** instanciados con malla compartida de 42 vértices.
  - Iluminación: sol desde el sureste para sombras visibles, cielo con gradiente, exposición -0.4; dos cámaras, general y detalle.
  - Exportaciones: `models/bogota_completo.glb` **2.44 MB**, `models/bogota_capas.glb` **1.38 MB** y `models/bogota.blend` **7.91 MB**. Draco en **13/13** primitivas del completo y **7/7** en capas; `COLOR_0` presente en la primitiva del terreno.
  - Renders: `renders/bogota_aerea.png` **1.77 MB** (general 1600×900) y `renders/bogota_centro.png` **2.07 MB** (detalle 1600×900). Se corrigió el encuadre para no cortar el terreno, se oscurecieron edificios/terreno, se añadió cielo con gradiente y se giró el sol para que las sombras dieran volumen.
- **Problemas encontrados:**
  - Overpass inestable: 502/timeout en `overpass-api.de` y 504 en `overpass.kumi.systems`; `maps.mail.ru` funcionó como alterno.
  - El MCP de Blender dejó de responder (`-32001 Request timed out`) tras un `blender_look`; se continuó con Blender en modo headless sobre el `.blend` guardado. El Blender abierto no recargó automáticamente el archivo: para ver la versión final hay que abrir/recargar `models/bogota.blend`.
  - El primer render quedó plano y cortaba el borde inferior; se corrigió con nueva cámara, exposición y dirección solar.
  - Una geometría inválida del dataset no se pudo extruir: el GeoJSON tiene 11 297 edificios y el modelo 11 296.
- **Pendientes:** Integrar `models/bogota_completo.glb` en el mapa MapLibre y publicar en GitHub Pages. Opcional: variar ligeramente el color por edificio para más realismo.

## 2026-10-31 13:36 — ETAPA 1 ampliada: zona lat 4.58–4.70, lon -74.12 a -74.04

- **Proveedor y modelo:** DeepSeek V4.1 Flash Free (OpenCode)
- **Agente:** Build
- **Prompt resumido:** Registrar en la bitácora la ampliación de la zona y los resultados de la ETAPA 1, aclarando que las alturas estimadas no son datos reales.
- **Qué se hizo:**
  - Se amplió la zona de trabajo a lat 4.58–4.70, lon -74.12 a -74.04.
  - Resultado de ETAPA 1: **433.017 edificios**, de los cuales **4.565** tienen altura real y **428.452** altura estimada.
  - Se descartaron **54 edificios** por quedar fuera del bbox o tener geometría no válida.
  - La zona cubre **15 localidades** de Bogotá.
  - Datos generados en `data/`: `edificios_final.geojson`, `vias.geojson`, `agua.geojson`, `zonas_verdes.geojson`, `dem.npy`, `dem_meta.json`, `localidades_en_zona.json` y `reporte_etapa1.json`; edificios Overture por bloques en `data/overture_bloques/`.
- **Advertencia:** las alturas estimadas **no son datos reales**; son una aproximación visual reproducible (6–30 m) para el render.
- **Problemas encontrados:** Ninguno bloqueante.
- **Pendientes:** ETAPA 2 por bloques (SW/SE/NW/NE): estimar tamaños, generar los GLB y validar.

## 2026-10-31 13:38 — ETAPA 2, PASO 2: estimación de tamaño por bloque

- **Proveedor y modelo:** DeepSeek V4.1 Flash Free (OpenCode)
- **Agente:** Build
- **Prompt resumido:** Calcular edificios y MB estimados del GLB (solo edificios y vías, con Draco) para SW/SE/NW/NE; proponer simplificación si algún bloque supera 15 MB.
- **Qué se hizo:**
  - Conteo por bloque asignando cada edificio por el centro de su bbox y cada vértice de vía por su coordenada.
  - Calibración usada: 2,7275 bytes/vértice de `models/bogota_capas.glb` (1.443.052 bytes / 529.074 vértices).
  - Resultados: SW 153.693 edificios / 6,68 MB; SE 47.432 / 2,04 MB; NW 133.540 / 5,47 MB; NE 98.352 / 4,30 MB. Total: 18,49 MB.
  - Ningún bloque supera 15 MB, por lo que no se requiere simplificar ni dividir en 8 bloques.
  - Referencia: descartar huellas menores de 25 m² bajaría el total a ~13,14 MB (SW 4,58; SE 1,61; NW 3,72; NE 3,23).
- **Problemas encontrados:** Ninguno.
- **Pendientes:** Confirmar PASO 3 antes de generar los GLB por bloque.

## 2026-10-31 13:48 — ETAPA 2, PASO 3: GLB del bloque SE

- **Proveedor y modelo:** DeepSeek V4.1 Flash Free (OpenCode)
- **Agente:** Build
- **Prompt resumido:** Generar solo el bloque SE con Blender, usando `bloque_se.geojson` y vías recortadas, alturas existentes, edificios blancos y vías gris oscuro, sin terreno ni árboles; origen en el centro del bloque, índice en `models/bloques/index.json`, GLB con Draco y script reutilizable en headless.
- **Qué se hizo:**
  - `scripts/generar_bloque.py`: parametrizado con `--bloque SW|SE|NW|NE`, reutilizable con `blender -b -P scripts/generar_bloque.py -- --bloque SE`.
  - El archivo de bloque no traía `height_fuente`; se unieron `height` y `height_fuente` por `id` desde `data/edificios_final.geojson`, sin modificar sus valores.
  - Bloque SE: **47.667 edificios** en 47.702 partes (1.354 con altura real y 46.313 estimadas); **6.749 vías** recortadas al bbox en 6.766 tramos.
  - GLB: `models/bloques/bloque_se.glb`, **5.234.940 bytes (4,99 MB)**, Draco nivel 6, 2 objetos (`Edificios_SE` y `Vias_SE`), sin terreno ni árboles.
  - Origen local: lat **4,61**, lon **-74,06**, z **2801,65 m**; caja y metadatos guardados en `models/bloques/index.json`.
  - El GLB se verificó: 2 mallas, materiales blanco y gris oscuro, `KHR_draco_mesh_compression` presente.
- **Problemas encontrados:**
  - Las herramientas MCP de Blender no estaban expuestas en esta sesión; se continuó en modo headless con Blender 5.2.3, como estaba previsto.
  - El tamaño real (4,99 MB) superó la estimación del PASO 2 (2,04 MB), porque el export glTF separa vértices por normales planas. Conviene recalcular las estimaciones antes de generar SW.
  - Aviso no bloqueante: `Material.use_nodes` está deprecado para Blender 6.0.
- **Pendientes:** Validar el GLB en el visor y generar los bloques restantes con estimaciones corregidas.

## 2026-10-31 14:05 — Optimización del bloque SE y export GLB sin normales

- **Proveedor y modelo:** DeepSeek V4.1 Flash Free (OpenCode)
- **Agente:** Build
- **Prompt resumido:** Optimizar `bloque_se.glb` sin cambiar su aspecto: simplificar huellas (tolerancia 0,5 m), fusionar vértices duplicados, reexportar con Draco sin normales ni atributos innecesarios, reportar vértices y tamaño, actualizar `scripts/generar_bloque.py` y no generar otros bloques.
- **Qué se hizo:**
  - `scripts/generar_bloque.py`: simplificación de huellas con RDP en metros (`TOLERANCIA_SIMPLIFICACION = 0.5`), fusión de duplicados con `bmesh.ops.remove_doubles` a 0,1 mm y exportación sin normales, tangentes, UVs, colores, atributos, extras ni animaciones; se mantiene Draco nivel 6 y los materiales.
  - Herramientas MCP usadas: `blender_execute_blender_code` y lectura de propiedades del exportador glTF.
  - El GLB importado estaba triangulado y con vértices separados por normales planas, por lo que no era fiable aislar las huellas en esa malla. Se reconstruyó solo el bloque SE desde la misma fuente y con el script actualizado, dentro de la escena MCP; alturas, materiales, origen y caja no cambian.
  - Objetos actuales: `Edificios_SE` con 511.217 vértices y `Vias_SE` con 84.198; la colección `Bloque_SE` conserva 2 objetos y el resto de la escena sigue oculto.
  - Huellas: 353.390 -> 256.844 vértices con tolerancia 0,5 m.
  - GLB nuevo: **1.446.864 bytes (1,38 MB)**, frente a 5.234.940 bytes (4,99 MB) anteriores (-72,4 %). Contiene solo `POSITION` (597.894 posiciones), `KHR_draco_mesh_compression` y 2 materiales, sin texturas ni normales.
  - `models/bloques/index.json` actualizado con el nuevo tamaño.
- **Problemas encontrados:**
  - El vértice total bajó de 2.254.554 (GLB importado) a 595.415 en Blender. La diferencia incluye la reconstrucción sin triángulos duplicados, la simplificación de huellas y el merge by distance.
  - Al no exportar normales, el aspecto de facetado depende del visor; conviene validarlo en el mapa.
- **Pendientes:** Validar el GLB en el visor y generar SW/NW/NE con el script actualizado, recalculando estimaciones.

## 2026-10-31 14:19 — Generación headless de SW, NW y NE y verificación de NE por MCP

- **Proveedor y modelo:** DeepSeek V4.1 Flash Free (OpenCode)
- **Agente:** Build
- **Prompt resumido:** Generar SW, NW y NE en headless, uno por uno, con las opciones optimizadas de SE; reportar edificios reales/estimados, vértices y tamaño; actualizar el índice de los cuatro bloques; importar solo NE por MCP en una colección nueva para verificar; registrar todo.
- **Por qué headless:** cada bloque vacía la escena y genera cientos de miles de edificios. Ejecutar cada uno en un proceso `blender -b` aislado evita bloquear o alterar la escena viva de Blender/MCP (donde quedaron SE y los objetos originales ocultos) y permite repetir cada bloque de forma limpia. El MCP se usó después solo para la verificación de NE.
- **Qué se hizo:**
  - Comando por bloque: `blender -b -P scripts/generar_bloque.py -- --bloque SW|NW|NE`, con salida 0 en los tres.
  - SW: 153.902 edificios (330 reales, 153.572 estimados; 29 sin altura), 1.689.063 vértices de malla y 1.705.530 posiciones en el GLB; `bloque_sw.glb` **4.065.260 bytes (3,88 MB)**.
  - NW: 133.768 edificios (1.124 reales, 132.644 estimados; 17 sin altura), 1.462.643 vértices de malla y 1.503.890 posiciones en el GLB; `bloque_nw.glb` **3.532.212 bytes (3,37 MB)**.
  - NE: 98.620 edificios (1.776 reales, 96.844 estimados; 8 sin altura), 1.164.345 vértices de malla y 1.179.830 posiciones en el GLB; `bloque_ne.glb` **2.834.472 bytes (2,70 MB)**.
  - Los cuatro bloques suman 433.957 edificios, 4.987.144 posiciones y 11.878.808 bytes (11,33 MB). Cada GLB contiene solo `POSITION`, Draco y sus 2 materiales.
  - `models/bloques/index.json` quedó con los cuatro bloques, con caja, origen y tamaños reales; SE conserva 47.667 edificios, 597.894 posiciones y 1.446.864 bytes.
  - Verificación MCP: `bloque_ne.glb` importado en la colección nueva `Bloque_NE_verificacion`; 2 objetos (`Edificios_NE` y `Vias_NE`), 1.179.830 vértices, 1.827.016 caras y materiales correctos. Carga en 2,25 s.
- **Problemas encontrados:**
  - Solo el aviso no bloqueante de `Material.use_nodes` deprecado para Blender 6.0.
  - No hubo fallos; no se detuvo la secuencia.
- **Pendientes:** Validar los cuatro GLB en el visor/mapa y ajustar el índice de carga del proyecto.

## 2026-11-02 09:59 — Ocultar edificios OSM con bloques GLB activos y material de edificios

- **Proveedor y modelo:** DeepSeek V4.1 Flash Free (OpenCode)
- **Agente:** Build
- **Prompt resumido:** En `main.js`, ocultar la capa `edificios-3d` del estilo base cuando algún bloque GLB esté activo y mostrarla al desactivarlos todos; añadir `polygonOffset` (factor 1, units 1) al material de edificios de three.js y usar un blanco hueso más claro; no probar en navegador; registrar en `BITACORA.md`.
- **Qué se hizo:**
  - `COLOR_EDIFICIOS` pasó de `0xf1ece2` a `0xfaf6ec` y `materialEdificios` ahora usa `polygonOffset: true`, `polygonOffsetFactor: 1` y `polygonOffsetUnits: 1`.
  - Se reemplazó el filtro por polígonos `within` (`actualizarFiltroEdificiosOsm` y `poligonoBloque`) por `actualizarVisibilidadEdificiosOsm()`, que oculta `edificios-3d` si hay bloques activos y la restaura según la casilla «Edificios 3D» al desactivarlos todos.
  - La casilla de bloques y la de edificios ahora usan esa función; también se aplica al terminar la carga inicial del índice y al fallar la carga de un bloque.
- **Problemas encontrados:** Ninguno. `node --check main.js` pasó sin errores; no se hicieron pruebas en navegador ni capturas, según lo pedido.
- **Pendientes:** Validar visualmente la alternancia de capas y la reducción de parpadeos en el navegador.

## 2026-11-02 10:09 — Preparación del despliegue en GitHub Pages

- **Proveedor y modelo:** DeepSeek V4.1 Flash Free (OpenCode)
- **Agente:** Build
- **Prompt resumido:** Preparar el proyecto para GitHub Pages con GitHub Actions: rutas locales relativas, workflow con verificación de los 4 GLB y despliegue de `_site`, `.gitignore` para excluir material no publicado, README en español, revisar tamaños y secretos, y hacer un commit local sin push.
- **Qué se hizo:**
  - Se revisaron `index.html`, `main.js` y `style.css`: `style.css`, `main.js`, `models/bloques/index.json`, las rutas `archivo` de ese índice y `data/sitios.geojson` ya son relativas; no hizo falta corregir ninguna ruta local.
  - `.github/workflows/deploy.yml`: disparadores `push` a `main` y `workflow_dispatch`; permisos de Pages; verificación de `models/bloques/index.json` y `bloque_sw/se/nw/ne.glb`; copia a `_site` solo de `index.html`, `main.js`, `style.css` y `models/bloques/`; artefacto con `actions/upload-pages-artifact@v3` y despliegue con `actions/deploy-pages@v4`.
  - `.gitignore` ampliado con `data/`, `scripts/`, `renders/`, `.venv/`, `*.blend`, `*.blend1`, `Modelfile` y `_site/`. Se retiraron del índice los `scripts/`, `renders/` y los dos `.blend` que ya estaban preparados; siguen en disco, pero no se versionan.
  - `README.md` con descripción, fuentes (Overture Maps, OpenStreetMap y AWS Terrain Tiles), herramientas (Blender con MCP, OpenCode, MapLibre GL JS y three.js), nota de alturas estimadas y flujo de publicación.
  - Rama local renombrada de `master` a `main` para coincidir con el disparador del workflow.
  - Auditoría de tamaño: ningún archivo versionado supera 50 MB. Los 5 más pesados del repositorio son `models/bloques/bloque_sw.glb` (3,88 MB), `bloque_nw.glb` (3,37 MB), `bloque_ne.glb` (2,70 MB), `models/bogota_completo.glb` (2,44 MB) y `bloque_se.glb` (1,38 MB). Los grandes de `data/` (hasta 171 MB) quedan fuera de Git por `.gitignore`.
  - Búsqueda de credenciales en el contenido versionado (`sk-`, `ghp_`, `AIza`, `AKIA`, claves privadas, `Bearer`, asignaciones de `api_key`/`secret`/`password`/`token`): sin coincidencias.
  - Commit local: `Preparar despliegue en GitHub Pages`.
- **Problemas encontrados:** `data/sitios.geojson` no se copia a `_site` según lo indicado, por lo que la capa de sitios de interés no cargará en Pages. Si se quiere conservar, habría que incorporar el GeoJSON a `main.js` o incluirlo explícitamente en el artefacto. Git no tenía identidad configurada; el commit se creó con una identidad puntual (`maico <maico@localhost>`) sin modificar la configuración del repositorio ni la global.
- **Pendientes:** Hacer push a `main`, habilitar GitHub Pages con origen GitHub Actions y validar el despliegue.

## 2026-11-02 10:20 — Incluir la capa de sitios en el despliegue

- **Proveedor y modelo:** DeepSeek V4.1 Flash Free (OpenCode)
- **Agente:** Build
- **Prompt resumido:** Copiar `data/sitios.geojson` a `layers/sitios.geojson`, cargarlo desde `main.js` con ruta relativa, incluir `layers/` en la verificación y la copia a `_site` del workflow, y hacer un commit local sin push.
- **Qué se hizo:**
  - Copia de `data/sitios.geojson` a `layers/sitios.geojson` (2998 bytes); `data/` sigue fuera de Git.
  - `main.js`: la fuente `sitios` ahora carga `layers/sitios.geojson`.
  - `.github/workflows/deploy.yml`: la verificación incluye `layers/sitios.geojson` y la preparación de `_site` crea `_site/layers` y copia su contenido.
  - `README.md` actualizado con la nueva ruta y el contenido publicado.
  - Verificación: `node --check main.js` correcto y YAML del workflow parseado sin errores.
  - Commit local: `Incluir capa de sitios`.
- **Problemas encontrados:** Ninguno.
- **Pendientes:** Hacer push a `main` y validar el despliegue en GitHub Pages.

## 2026-11-02 10:42 — Mejoras de interfaz y manejo de errores del mapa

- **Proveedor y modelo:** DeepSeek V4.1 Flash Free (OpenCode)
- **Agente:** Build
- **Prompt resumido:** Revisar solo el código de `main.js`, `index.html` y `style.css` para detectar errores o riesgos en carga de GLB/GeoJSON, indicador de carga, orientación/escala, atribución, nota de alturas y diseño responsivo; aplicar mejoras y hacer un commit local sin push.
- **Riesgos encontrados:**
  - Si fallaba el índice de bloques, las casillas seguían activas y podían ocultar los edificios OSM sin cargar ningún GLB.
  - Una carga GLB vacía se marcaba como exitosa; no había indicador global de progreso ni mensaje visible de error.
  - La fuente GeoJSON se agregaba sin validar la respuesta y sus errores quedaban solo en la consola; los eventos de sitios podían registrar capas aún inexistentes.
  - La atribución estaba en modo compacto (podía quedar oculta), la nota de alturas era ambigua y los controles móviles eran pequeños.
  - La transformación de los bloques asumía coordenadas válidas del índice sin comprobarlas.
- **Qué se hizo:**
  - `index.html`: aviso de estado con `aria-live` y botón de cierre; nota de alturas más explícita.
  - `style.css`: estilos del aviso de carga/error, cierre accesible, `overscroll-behavior`, controles móviles más grandes, atribución responsive y límites de ancho.
  - `main.js`: validación del índice y de las coordenadas de origen; detección de GLB sin mallas; indicador global de bloques en carga; errores visibles con cierre; casillas deshabilitadas si falta el índice; carga del GeoJSON con `fetch`, validación de `FeatureCollection`, manejo de errores y eventos solo después de crear las capas.
  - Atribución visible (`compact: false`) incluyendo OpenFreeMap, OpenStreetMap, Overture Maps y AWS Terrain Tiles.
  - Orientación/escala revisadas: se mantiene la rotación X de 90° para GLB Y-up, la escala por origen Mercator y el ajuste de altitud; se añadieron guardas para datos no finitos.
  - Verificación: `node --check main.js` y `git diff --check` sin errores; sin pruebas de navegador ni capturas.
  - Commit local: `Mejoras de interfaz del mapa`.
- **Problemas encontrados:** Ninguno bloqueante.
- **Pendientes:** Validar visualmente en navegador cuando el usuario lo autorice y confirmar el despliegue en GitHub Pages.


