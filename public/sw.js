/* Service worker do LB Personal Trainner.
 *
 * Regra que vale mais que qualquer ganho de performance:
 * ESTE APP É MULTIUSUÁRIO E AUTENTICADO. Guardar HTML em cache faria a tela
 * de um aluno reaparecer para outro no mesmo aparelho, e mostraria treino
 * velho depois que o personal atualizasse. Por isso:
 *
 *   - navegação (HTML) -> sempre rede; se a rede cair, página de offline;
 *   - /api/foto/*      -> nunca entra em cache (foto de evolução é dado sensível);
 *   - server actions   -> nunca interceptadas (POST passa direto);
 *   - estáticos do build e ícones -> cache, porque têm hash no nome e são públicos.
 */

const VERSION = "lb-v1";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

function isCacheableAsset(url) {
  if (url.origin !== self.location.origin) return false;
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Só GET. POST de server action nunca é tocado.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Fotos de evolução: sempre rede, nunca cache.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((r) => r ?? Response.error()),
      ),
    );
    return;
  }

  if (!isCacheableAsset(url)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
