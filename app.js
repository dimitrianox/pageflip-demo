"use strict";

/* Atlas Memories: CSS owns sizing and centering; this file owns behavior. */
(() => {
  const config = { defaultAlbum: "londres-2025", swipeThreshold: 72, preloadDistance: 1 };
  const state = { albumId: "", pages: [], current: 0, primaryVisible: true, renderToken: 0, startX: 0, startY: 0, deltaX: 0, dragging: false, horizontal: false, transitioning: false, webglReady: false };
  const ui = {};
  let webgl = null;

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    captureUi();
    bindEvents();
    try {
      await loadAlbum();
      if (!state.pages.length) throw new Error("El álbum no contiene elementos.");
      await render(0, true);
    } catch (error) {
      console.error("Atlas no pudo abrir el álbum:", error);
      ui.title.textContent = "No se pudo abrir el álbum";
      ui.location.textContent = "Revisa el enlace e inténtalo de nuevo.";
      ui.date.textContent = "";
    } finally {
      document.body.classList.add("ready");
    }
  }

  function captureUi() {
    ui.media = document.getElementById("media");
    ui.primary = document.getElementById("primaryImage");
    ui.secondary = document.getElementById("secondaryImage");
    ui.video = document.getElementById("video");
    ui.title = document.getElementById("title");
    ui.location = document.getElementById("location");
    ui.date = document.getElementById("date");
  }

  // =====================================================
  // WebGL Transition System (Demo 4 effect)
  // =====================================================

  function initWebGL() {
    if (state.webglReady || !window.THREE) return;
    
    const vertex = `varying vec2 vUv;void main() {vUv = uv;gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );}`;
    const fragment = `
      uniform float time;
      uniform float progress;
      uniform sampler2D texture1;
      uniform sampler2D texture2;
      uniform sampler2D displacement;
      uniform vec4 resolution;

      varying vec2 vUv;
      vec2 mirrored(vec2 v) {
        vec2 m = mod(v,2.);
        return mix(m,2.0 - m, step(1.0 ,m));
      }

      void main() {
        vec2 newUV = (vUv - vec2(0.5))*resolution.zw + vec2(0.5);
        vec4 noise = texture2D(displacement, mirrored(newUV+time*0.04));
        float prog = progress*0.8 -0.05 + noise.g * 0.06;
        float intpl = pow(abs(smoothstep(0., 1., (prog*2. - vUv.x + 0.5))), 10.);

        vec4 t1 = texture2D( texture1, (newUV - 0.5) * (1.0 - intpl) + 0.5 ) ;
        vec4 t2 = texture2D( texture2, (newUV - 0.5) * intpl + 0.5 );
        gl_FragColor = mix( t1, t2, intpl );
      }
    `;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    const renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(ui.media.offsetWidth, ui.media.offsetHeight);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.zIndex = '10'; // Above images
    renderer.domElement.style.pointerEvents = 'none';
    renderer.domElement.style.display = 'none'; // Start hidden
    ui.media.appendChild(renderer.domElement);

    const material = new THREE.ShaderMaterial({
      extensions: { derivatives: true },
      side: THREE.DoubleSide,
      uniforms: {
        time: { value: 0 },
        progress: { value: 0 },
        texture1: { value: null },
        texture2: { value: null },
        displacement: { value: null },
        resolution: { value: new THREE.Vector4(1, 1, 1, 1) },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const plane = new THREE.Mesh(geometry, material);
    scene.add(plane);

    // Generate procedural noise texture for displacement
    const noiseSize = 256;
    const noiseData = new Uint8Array(noiseSize * noiseSize * 4);
    for (let i = 0; i < noiseData.length; i += 4) {
      const val = Math.floor(Math.random() * 256);
      noiseData[i] = val;
      noiseData[i + 1] = val;
      noiseData[i + 2] = val;
      noiseData[i + 3] = 255;
    }
    const noiseTexture = new THREE.DataTexture(noiseData, noiseSize, noiseSize, THREE.RGBA_FORMAT);
    noiseTexture.needsUpdate = true;
    noiseTexture.wrapS = THREE.RepeatWrapping;
    noiseTexture.wrapT = THREE.RepeatWrapping;
    noiseTexture.magFilter = THREE.LinearFilter;
    noiseTexture.minFilter = THREE.LinearFilter;
    material.uniforms.displacement.value = noiseTexture;

    webgl = { scene, camera, renderer, material, plane, time: 0, isAnimating: false };

    // Handle resize
    window.addEventListener('resize', () => {
      if (webgl) {
        webgl.renderer.setSize(ui.media.offsetWidth, ui.media.offsetHeight);
        updateResolution();
      }
    });

    function updateResolution(texture) {
      if (!webgl) return;
      const w = ui.media.offsetWidth;
      const h = ui.media.offsetHeight;
      
      // Get image aspect from texture
      let imageAspect = 1;
      if (texture && texture.image) {
        imageAspect = texture.image.naturalWidth / texture.image.naturalHeight;
      }
      
      let a1, a2;
      if (h / w > imageAspect) {
        a1 = (w / h) * imageAspect;
        a2 = 1;
      } else {
        a1 = 1;
        a2 = (h / w) / imageAspect;
      }
      webgl.material.uniforms.resolution.value.set(w, h, a1, a2);
    }

    webgl.updateResolution = updateResolution;

    state.webglReady = true;
  }

  function startWebGLAnimation() {
    if (!webgl || webgl.isAnimating) return;
    webgl.isAnimating = true;
    animateWebGL();
  }

  function animateWebGL() {
    if (!webgl || !webgl.isAnimating) return;
    webgl.time += 0.05;
    webgl.material.uniforms.time.value = webgl.time;
    webgl.renderer.render(webgl.scene, webgl.camera);
    requestAnimationFrame(animateWebGL);
  }

  function transitionToImage(nextTexture, onComplete) {
    if (!webgl || !webgl.material.uniforms.texture1.value) {
      onComplete();
      return;
    }

    // Update resolution for new texture aspect ratio
    if (webgl.updateResolution) {
      webgl.updateResolution(nextTexture);
    }

    // Ensure canvas is visible during transition
    webgl.renderer.domElement.style.display = 'block';
    
    webgl.material.uniforms.texture2.value = nextTexture;
    webgl.material.uniforms.progress.value = 0;
    
    startWebGLAnimation();

    const duration = 1500; // ms
    const startTime = performance.now();

    function animate() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Ease out
      const eased = 1 - Math.pow(1 - t, 3);
      
      webgl.material.uniforms.progress.value = eased;

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        // Complete transition
        webgl.material.uniforms.texture1.value = nextTexture;
        webgl.material.uniforms.progress.value = 0;
        // Keep canvas visible
        if (onComplete) onComplete();
      }
    }

    animate();
  }

  async function loadAlbum() {
    state.albumId = new URLSearchParams(location.search).get("album") || config.defaultAlbum;
    const [album, metadata] = await Promise.all([fetchJson(albumUrl("album.json")), fetchOptionalJson(albumUrl("metadata.json"))]);
    state.pages = (Array.isArray(album.items) ? album.items : [])
      .filter(item => item && item.file && (item.type === "photo" || item.type === "video"))
      .map(item => {
        const extra = metadata[item.file] || {};
        return { type: item.type, file: item.file, date: item.date || "", title: extra.title || "", location: extra.location || "", visible: extra.visible !== false };
      });
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) throw new Error(`No se pudo cargar ${url} (${response.status}).`);
    return response.json();
  }

  async function fetchOptionalJson(url) {
    try { return await fetchJson(url); } catch (_) { return {}; }
  }

  function albumUrl(file) { return `albums/${encodeURIComponent(state.albumId)}/${file}`; }
  function mediaUrl(page) { return albumUrl(`media/${encodeURIComponent(page.file)}`); }

  async function render(index, immediate) {
    if (index < 0 || index >= state.pages.length) return;
    const page = state.pages[index];
    const token = ++state.renderToken;
    state.current = index;
    updateOverlay(page);
    resetOffset();
    if (page.type === "photo") await renderPhoto(page, token, immediate);
    else await renderVideo(page, token);
    if (token === state.renderToken) preloadAround(index);
  }

  async function renderPhoto(page, token, immediate) {
    stopVideo();
    const visible = state.primaryVisible ? ui.primary : ui.secondary;
    const next = state.primaryVisible ? ui.secondary : ui.primary;
    try { await loadImage(next, mediaUrl(page)); }
    catch (error) { if (token === state.renderToken) console.error("No se pudo cargar la imagen:", error); return; }
    if (token !== state.renderToken) return;

    // Initialize WebGL on first photo if not ready
    if (!state.webglReady && !immediate) {
      initWebGL();
    }

    next.style.translate = "0 0";
    next.style.display = "block";
    next.style.opacity = "1";

    if (immediate || visible.style.display === "none" || !visible.src || !state.webglReady) {
      // First load or no WebGL - just switch
      visible.style.display = "none";
      visible.style.opacity = "0";
      
      if (webgl && webgl.material.uniforms.texture1.value === null) {
        // Set up WebGL with first texture
        const tex = new THREE.Texture(next);
        tex.needsUpdate = true;
        webgl.material.uniforms.texture1.value = tex;
        
        // Update resolution for this texture
        if (webgl.updateResolution) {
          webgl.updateResolution(tex);
        }
        
        // Show canvas after first image
        webgl.renderer.domElement.style.display = 'block';
        startWebGLAnimation();
      }
    } else {
      // WebGL transition - create texture from next image
      const nextTex = new THREE.Texture(next);
      nextTex.needsUpdate = true;
      
      // Start transition (this shows the canvas)
      transitionToImage(nextTex, () => {
        // After transition completes, swap the primary/secondary
      });
    }
    state.primaryVisible = !state.primaryVisible;
  }

  function loadImage(image, source) {
    return new Promise((resolve, reject) => {
      const clean = () => { image.removeEventListener("load", loaded); image.removeEventListener("error", failed); };
      const loaded = () => { clean(); resolve(); };
      const failed = () => { clean(); reject(new Error(source)); };
      image.addEventListener("load", loaded, { once: true });
      image.addEventListener("error", failed, { once: true });
      image.src = source;
      if (image.complete && image.naturalWidth) loaded();
    });
  }

  async function renderVideo(page, token) {
    ui.primary.style.display = "none";
    ui.secondary.style.display = "none";
    ui.video.style.translate = "0 0";
    ui.video.style.display = "block";
    ui.video.src = mediaUrl(page);
    ui.video.load();
    try { await waitForVideo(ui.video); }
    catch (error) { if (token === state.renderToken) console.error("No se pudo cargar el video:", error); return; }
    if (token === state.renderToken) ui.video.play().catch(() => {});
  }

  function waitForVideo(video) {
    return new Promise((resolve, reject) => {
      const clean = () => { video.removeEventListener("loadeddata", ready); video.removeEventListener("error", failed); };
      const ready = () => { clean(); resolve(); };
      const failed = () => { clean(); reject(new Error(video.currentSrc)); };
      video.addEventListener("loadeddata", ready, { once: true });
      video.addEventListener("error", failed, { once: true });
    });
  }

  function stopVideo() {
    ui.video.pause();
    ui.video.removeAttribute("src");
    ui.video.load();
    ui.video.style.display = "none";
  }

  function updateOverlay(page) {
    ui.title.textContent = page.visible ? page.title : "";
    ui.location.textContent = page.visible ? page.location : "";
    ui.date.textContent = page.visible ? formatDate(page.date) : "";
  }

  function formatDate(value) {
    const match = /^(\d{4}):(\d{2})/.exec(value || "");
    if (!match) return value || "";
    const months = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
    return `${months[Number(match[2]) - 1]} · ${match[1]}`;
  }

  function go(direction) {
    const target = state.current + direction;
    if (target >= 0 && target < state.pages.length) render(target, false);
  }

  function bindEvents() {
    ui.media.addEventListener("pointerdown", pointerDown);
    ui.media.addEventListener("pointermove", pointerMove);
    ui.media.addEventListener("pointerup", pointerUp);
    ui.media.addEventListener("pointercancel", resetGesture);
    window.addEventListener("keydown", event => {
      if (event.key === "ArrowRight" || event.key === " ") { event.preventDefault(); go(1); }
      else if (event.key === "ArrowLeft") { event.preventDefault(); go(-1); }
    });
    window.addEventListener("blur", () => ui.video.pause());
    document.addEventListener("visibilitychange", () => { if (document.hidden) ui.video.pause(); });
  }

  function pointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    state.dragging = true;
    state.startX = event.clientX;
    state.startY = event.clientY;
    state.deltaX = 0;
    state.horizontal = false;
    ui.media.setPointerCapture?.(event.pointerId);
  }

  function pointerMove(event) {
    if (!state.dragging) return;
    const x = event.clientX - state.startX;
    const y = event.clientY - state.startY;
    if (!state.horizontal && Math.abs(x) > 8 && Math.abs(x) > Math.abs(y)) state.horizontal = true;
    if (!state.horizontal) return;
    state.deltaX = x;
    activeMedia().style.translate = `${x}px 0`;
  }

  function pointerUp(event) {
    if (!state.dragging) return;
    const navigate = state.horizontal && Math.abs(state.deltaX) >= config.swipeThreshold;
    const direction = state.deltaX < 0 ? 1 : -1;
    const tap = !state.horizontal && Math.abs(event.clientX - state.startX) < 8;
    resetGesture();
    if (navigate) go(direction);
    else if (tap) go(event.clientX >= innerWidth / 2 ? 1 : -1);
  }

  function resetGesture() {
    state.dragging = false;
    state.horizontal = false;
    state.deltaX = 0;
    resetOffset();
  }

  function resetOffset() {
    ui.primary.style.translate = "0 0";
    ui.secondary.style.translate = "0 0";
    ui.video.style.translate = "0 0";
  }

  function activeMedia() {
    if (ui.video.style.display === "block") return ui.video;
    return state.primaryVisible ? ui.primary : ui.secondary;
  }

  function preloadAround(index) {
    for (let offset = -config.preloadDistance; offset <= config.preloadDistance; offset += 1) {
      if (!offset || !state.pages[index + offset]) continue;
      const page = state.pages[index + offset];
      if (page.type === "photo") { const image = new Image(); image.src = mediaUrl(page); }
      else { const video = document.createElement("video"); video.preload = "metadata"; video.src = mediaUrl(page); }
    }
  }
})();
