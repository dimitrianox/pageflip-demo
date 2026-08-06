"use strict";

/* Atlas Memories: CSS owns sizing and centering; this file owns behavior. */
(() => {
  const config = { defaultAlbum: "londres-2025", swipeThreshold: 72, preloadDistance: 1 };
  const state = { albumId: "", pages: [], current: 0, primaryVisible: true, renderToken: 0, startX: 0, startY: 0, deltaX: 0, dragging: false, horizontal: false };
  const ui = {};

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
    next.style.translate = "0 0";
    next.style.display = "block";
    next.style.opacity = "1";
    if (immediate || visible.style.display === "none" || !visible.src) {
      visible.style.display = "none";
      visible.style.opacity = "0";
    } else {
      visible.style.opacity = "0";
      setTimeout(() => { if (token === state.renderToken) visible.style.display = "none"; }, 260);
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
