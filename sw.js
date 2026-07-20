/* ==========================================================================
   ZAKARI GRUPPE — sw.js
   Service Worker : mise en cache "App Shell" + stratégie
   Stale-While-Revalidate pour un fonctionnement 100% hors-ligne.
   ========================================================================== */

const VERSION_CACHE = 'zakari-gruppe-v2.0.0';
const CACHE_STATIQUE = `${VERSION_CACHE}-statique`;
const CACHE_DYNAMIQUE = `${VERSION_CACHE}-dynamique`;

// Cœur de l'application, mis en cache dès l'installation pour un accès
// instantané même sans aucune connexion internet.
const RESSOURCES_APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './data.json',
  './icon-72.png',
  './icon-96.png',
  './icon-128.png',
  './icon-144.png',
  './icon-152.png',
  './icon-180.png',
  './icon-192.png',
  './icon-384.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './iveco-trakker-1.jpg',
  './iveco-trakker-2.jpg',
  './iveco-trakker-3.jpg',
  './iveco-trakker-4.jpg',
  './iveco-trakker-5.jpg',
  './iveco-trakker-6.jpg',
  './iveco-trakker-7.jpg',
  './iveco-sway-1.jpg',
  './iveco-sway-2.jpg',
  './iveco-sway-3.jpg',
  './daf-xf-1.jpg',
  './daf-xf-2.jpg',
  './daf-xf-3.jpg',
  './daf-xf-4.jpg',
  './daf-xf-5.jpg',
  './daf-xf-6.jpg',
  './scania-r660-1.jpg',
  './scania-r660-2.jpg',
  './man-tgx-1.jpg',
  './renault-thigh-1.jpg',
  './scania-lineup-1.jpg',
  './scania-r660-3.jpg',
  './scania-r660-4.jpg',
  './scania-r660-5.jpg',
  './toyota-landcruiser-1.jpg',
  './toyota-landcruiser-2.jpg',
  './toyota-landcruiser-3.jpg',
  './toyota-hilux-1.jpg',
  './toyota-hilux-2.jpg',
  './toyota-hilux-3.jpg',
  './ford-ranger-1.jpg',
  './ford-ranger-2.jpg',
  './ford-ranger-3.jpg',
  './ford-ranger-4.jpg',
  './ford-ranger-5.jpg'
];

/* ---------------------- INSTALLATION ---------------------- */
self.addEventListener('install', (evenement) => {
  evenement.waitUntil(
    caches.open(CACHE_STATIQUE)
      .then((cache) => cache.addAll(RESSOURCES_APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

/* ---------------------- ACTIVATION (nettoyage des anciens caches) ---------------------- */
self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(
        noms
          .filter((nom) => nom.startsWith('zakari-gruppe-') && !nom.startsWith(VERSION_CACHE))
          .map((nom) => caches.delete(nom))
      )
    ).then(() => self.clients.claim())
  );
});

/* ---------------------- STRATÉGIE STALE-WHILE-REVALIDATE ---------------------- */
async function staleWhileRevalidate(requete){
  const cache = await caches.open(CACHE_DYNAMIQUE);
  const reponseEnCache = await cache.match(requete);

  const requeteReseau = fetch(requete)
    .then((reponseReseau) => {
      // On ne met en cache que les réponses valides et de même origine (évite les erreurs opaques bloquantes)
      if (reponseReseau && reponseReseau.status === 200) {
        cache.put(requete, reponseReseau.clone());
      }
      return reponseReseau;
    })
    .catch(() => null); // Pas de réseau : on se rabat silencieusement sur le cache

  // On retourne immédiatement la version en cache (affichage instantané),
  // pendant que la version réseau se met à jour discrètement en arrière-plan.
  return reponseEnCache || (await requeteReseau) || nouvelleReponseHorsLigne();
}

function nouvelleReponseHorsLigne(){
  return new Response(
    '<h1 style="font-family:sans-serif;text-align:center;margin-top:20vh;color:#c9a227">ZAKARI GRUPPE — Contenu indisponible hors-ligne</h1>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

self.addEventListener('fetch', (evenement) => {
  const { request } = evenement;

  // On ignore les requêtes non-GET : elles doivent aller au réseau directement.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // data.json (catalogue publié par l'Accès Pro) : on tente TOUJOURS le réseau en premier
  // pour afficher la dernière version dès qu'elle est disponible, avec repli sur le cache hors-ligne.
  if (url.pathname.endsWith('/data.json') || url.pathname.endsWith('data.json')) {
    evenement.respondWith(
      fetch(request)
        .then((reponseReseau) => {
          if (reponseReseau && reponseReseau.status === 200) {
            caches.open(CACHE_DYNAMIQUE).then((cache) => cache.put(request, reponseReseau.clone()));
          }
          return reponseReseau;
        })
        .catch(() => caches.match(request).then((r) => r || nouvelleReponseHorsLigne()))
    );
    return;
  }

  evenement.respondWith(staleWhileRevalidate(request));
});
