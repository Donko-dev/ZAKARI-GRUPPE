/* ==========================================================================
   ZAKARI GRUPPE — sw.js
   Service Worker : mise en cache "App Shell" + stratégie
   Stale-While-Revalidate pour un fonctionnement 100% hors-ligne.
   ========================================================================== */

const VERSION_CACHE = 'zakari-gruppe-v1.3.0';
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
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-384.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './images/vehicules/iveco-trakker-1.jpg',
  './images/vehicules/iveco-trakker-2.jpg',
  './images/vehicules/iveco-trakker-3.jpg',
  './images/vehicules/iveco-trakker-4.jpg',
  './images/vehicules/iveco-trakker-5.jpg',
  './images/vehicules/iveco-trakker-6.jpg',
  './images/vehicules/iveco-trakker-7.jpg',
  './images/vehicules/iveco-sway-1.jpg',
  './images/vehicules/iveco-sway-2.jpg',
  './images/vehicules/iveco-sway-3.jpg',
  './images/vehicules/daf-xf-1.jpg',
  './images/vehicules/daf-xf-2.jpg',
  './images/vehicules/daf-xf-3.jpg',
  './images/vehicules/daf-xf-4.jpg',
  './images/vehicules/daf-xf-5.jpg',
  './images/vehicules/daf-xf-6.jpg',
  './images/vehicules/scania-r660-1.jpg',
  './images/vehicules/scania-r660-2.jpg',
  './images/vehicules/man-tgx-1.jpg',
  './images/vehicules/renault-thigh-1.jpg',
  './images/vehicules/scania-lineup-1.jpg',
  './images/vehicules/scania-r660-3.jpg',
  './images/vehicules/scania-r660-4.jpg',
  './images/vehicules/scania-r660-5.jpg',
  './images/vehicules/toyota-landcruiser-1.jpg',
  './images/vehicules/toyota-landcruiser-2.jpg',
  './images/vehicules/toyota-landcruiser-3.jpg',
  './images/vehicules/toyota-hilux-1.jpg',
  './images/vehicules/toyota-hilux-2.jpg',
  './images/vehicules/toyota-hilux-3.jpg',
  './images/vehicules/ford-ranger-1.jpg',
  './images/vehicules/ford-ranger-2.jpg',
  './images/vehicules/ford-ranger-3.jpg',
  './images/vehicules/ford-ranger-4.jpg',
  './images/vehicules/ford-ranger-5.jpg'
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

  // On ignore les requêtes non-GET (ex: envoi vers Google Apps Script) : elles doivent aller au réseau directement.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Les appels à l'API Google (synchronisation du catalogue) ne sont jamais mis en cache :
  // on privilégie toujours le réseau, avec repli sur le LocalStorage géré côté app.js.
  if (url.hostname.includes('google') || url.hostname.includes('script.google.com')) {
    evenement.respondWith(fetch(request).catch(() => nouvelleReponseHorsLigne()));
    return;
  }

  evenement.respondWith(staleWhileRevalidate(request));
});
