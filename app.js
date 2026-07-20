/* ==========================================================================
   ZAKARI GRUPPE — app.js
   Logique SPA : catalogue, filtres, PWA, panneau Accès Pro, synchronisation
   hybride vers Google Sheets (Google Apps Script) avec repli LocalStorage.
   ========================================================================== */

'use strict';

/* --------------------------------------------------------------------
   0. CONFIGURATION — à personnaliser
   -------------------------------------------------------------------- */
const CONFIG = {
  // Mot de passe local de l'espace "Accès Pro" (à changer avant mise en ligne)
  MOT_DE_PASSE_ADMIN: 'ZakariGruppe2026',
  // URL de votre Google Apps Script déployé en Web App (voir instructions en bas de fichier)
  URL_APPS_SCRIPT: 'https://script.google.com/macros/s/REMPLACER_PAR_VOTRE_ID_DE_DEPLOIEMENT/exec',
  CLES_STOCKAGE: {
    vehicules: 'zakari_vehicules', services: 'zakari_services', session: 'zakari_session_pro',
    langue: 'zakari_langue', devise: 'zakari_devise', theme: 'zakari_theme'
  },
  TAILLE_PAGE: 9,
  MAX_IMAGES: 5
};

/* --------------------------------------------------------------------
   1. GÉNÉRATEUR DE VISUELS PLACEHOLDER (en attendant les vraies photos)
   Crée une image SVG propre, thème Or/Diamant, par catégorie de véhicule.
   -------------------------------------------------------------------- */
const SILHOUETTES = {
  'gros-porteur': 'M2 62h8V40l14-10h58l16 14h20v18h8 M10 40h60 M74 30l16 14 M78 62a8 8 0 1 0 16 0 8 8 0 0 0-16 0 M18 62a8 8 0 1 0 16 0 8 8 0 0 0-16 0',
  'poids-leger': 'M6 52l6-16a6 6 0 0 1 6-4h44a6 6 0 0 1 6 4l6 16v14H6V52Z M6 52h88 M22 66a6 6 0 1 0 12 0 6 6 0 0 0-12 0 M70 66a6 6 0 1 0 12 0 6 6 0 0 0-12 0',
  'special': 'M14 58V30l20-12 20 12v28 M14 44h40 M58 44h22v14H58Z M22 66a6 6 0 1 0 12 0 6 6 0 0 0-12 0 M62 66a6 6 0 1 0 12 0 6 6 0 0 0-12 0'
};
function genererPlaceholder(categorie, marque, modele){
  const silh = SILHOUETTES[categorie] || SILHOUETTES['poids-leger'];
  const initiales = (marque || 'ZG').split(' ').map(m=>m[0]).join('').slice(0,3).toUpperCase();
  const id = 'g' + Math.random().toString(36).slice(2,8);
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 250">
    <defs>
      <linearGradient id="${id}bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#14161a"/><stop offset="100%" stop-color="#1b1d22"/>
      </linearGradient>
      <linearGradient id="${id}or" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f4d97a"/><stop offset="100%" stop-color="#8a6c14"/>
      </linearGradient>
      <pattern id="${id}p" width="40" height="70" patternUnits="userSpaceOnUse" patternTransform="rotate(20)">
        <path d="M0 0 L20 10 L40 0 M0 70 L20 60 L40 70" stroke="#c9a227" stroke-width="0.6" fill="none" opacity="0.35"/>
      </pattern>
    </defs>
    <rect width="400" height="250" fill="url(#${id}bg)"/>
    <rect width="400" height="250" fill="url(#${id}p)"/>
    <rect x="0" y="0" width="400" height="250" fill="none" stroke="#2a2c33" stroke-width="1"/>
    <g transform="translate(150,95) scale(2.6)" opacity="0.92">
      <path d="${silh}" fill="none" stroke="url(#${id}or)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    </g>
    <text x="200" y="215" text-anchor="middle" font-family="Jost, sans-serif" font-size="15" letter-spacing="6" fill="#e8ce7b">${initiales}</text>
    <text x="200" y="232" text-anchor="middle" font-family="monospace" font-size="8.5" letter-spacing="3" fill="#6d7280">VISUEL EN ATTENTE — PHOTO À VENIR</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

/* --------------------------------------------------------------------
   2. DONNÉES INITIALES — CATALOGUE VÉHICULES
   -------------------------------------------------------------------- */
let compteurId = 1;
function v(marque, modele, categorie, etat, prix, annee, moteur, transmission, paysOrigine, paysFabrication, options){
  return {
    id: 'veh-' + (compteurId++), marque, modele, categorie, etat, prix, annee, moteur, transmission,
    paysOrigine, paysFabrication, options, images: [genererPlaceholder(categorie, marque, modele)]
  };
}
// Rétro-compatibilité : renvoie toujours un tableau d'images valide (même pour d'anciennes fiches à image unique)
function imagesDe(item){
  if(Array.isArray(item.images) && item.images.length) return item.images;
  if(item.image) return [item.image];
  return [genererPlaceholder(item.categorie || 'poids-leger', item.marque || item.titre, item.modele || '')];
}

const VEHICULES_INITIAUX = [
  // ---- GROS PORTEURS — EUROPÉENNES ----
  v('Mercedes-Benz Trucks','Actros 1845','gros-porteur','Neuf',128000,2026,'Diesel 12.8L 449ch','Automatique 12 rapports','Allemagne','Allemagne',['Climatisation cabine','Écran multimédia 12"','Frigo cabine','Régulateur adaptatif']),
  v('MAN Trucks','TGX 18.510','gros-porteur','Neuf',119500,2025,'Diesel 12.4L 510ch','Automatique TipMatic','Allemagne','Allemagne',['Climatisation','Toit surélevé','Caméras périphériques']),
  v('Volvo Trucks','FH16 750','gros-porteur','Occasion',98000,2022,'Diesel 16L 750ch','I-Shift automatique','Suède','Belgique',['Climatisation','Écran tactile','Suspension pneumatique cabine']),
  v('Scania','R 660 V8','gros-porteur','Neuf',142000,2026,'Diesel V8 16.4L 660ch','Opticruise automatique','Suède','Suède',['Cabine haute Highline','Climatisation','Frigo','Sono premium']),
  v('DAF Trucks','XF 480','gros-porteur','Occasion',87500,2021,'Diesel 12.9L 480ch','TraXon automatique','Pays-Bas','Pays-Bas',['Climatisation','Écran 15"','Régulateur de vitesse adaptatif']),
  v('IVECO','S-Way 570','gros-porteur','Neuf',115000,2025,'Diesel 12.9L 570ch','Hi-Tronix automatique','Italie','Italie',['Climatisation','Toit ouvrant cabine','Caméras 360°']),
  v('Renault Trucks','T High 520','gros-porteur','Occasion',92000,2022,'Diesel 12.8L 520ch','Optidriver automatique','France','France',['Climatisation','Couchette double','Écran multimédia']),
  // ---- GROS PORTEURS — AMÉRICAINES ----
  v('Freightliner','Cascadia','gros-porteur','Neuf',134000,2026,'Diesel Detroit DD15 505ch','Automatique DT12','États-Unis','États-Unis',['Climatisation','Écran digital','Caméras miroirs numériques']),
  v('Peterbilt','389','gros-porteur','Occasion',105000,2020,'Diesel Cummins X15 565ch','Manuelle 18 rapports','États-Unis','États-Unis',['Capot long','Climatisation','Sièges chauffants']),
  v('Kenworth','W900','gros-porteur','Occasion',110000,2021,'Diesel PACCAR MX-13 510ch','Automatique','États-Unis','États-Unis',['Climatisation','Couchette élevée','Chromes premium']),
  v('Mack Trucks','Anthem','gros-porteur','Neuf',121000,2025,'Diesel MP8 445ch','mDRIVE automatique','États-Unis','États-Unis',['Climatisation','Écran tactile','Freinage assisté']),
  v('International','LT Series','gros-porteur','Occasion',96000,2021,'Diesel A26 450ch','Automatique Endurant','États-Unis','États-Unis',['Climatisation','Régulateur adaptatif','Caméra de recul']),
  // ---- GROS PORTEURS — JAPONAISES ----
  v('Isuzu','Giga','gros-porteur','Neuf',88000,2025,'Diesel 15.6L 510ch','Automatisée','Japon','Japon',['Climatisation','Écran multimédia','Freinage d\'urgence']),
  v('Hino','700 Series','gros-porteur','Occasion',72000,2020,'Diesel A09C 420ch','Manuelle 16 rapports','Japon','Thaïlande',['Climatisation','Suspension renforcée']),
  v('Fuso','Super Great','gros-porteur','Neuf',85000,2025,'Diesel 6R20 510ch','ShiftPilot automatique','Japon','Japon',['Climatisation','Caméras 360°','Régulateur adaptatif']),

  // ---- POIDS LÉGERS — EUROPÉENNES ----
  v('Volkswagen','Touareg','poids-leger','Neuf',68500,2026,'V6 TDI 286ch','Automatique 8 rapports','Allemagne','Slovaquie',['Climatisation bi-zone','Toit ouvrant panoramique','Écrans digitaux','Sièges cuir']),
  v('Mercedes-Benz','Classe S','poids-leger','Neuf',119000,2026,'6 cyl. 435ch hybride','Automatique 9G-Tronic','Allemagne','Allemagne',['Climatisation 4 zones','Toit ouvrant','Écrans arrière','Massage sièges']),
  v('BMW','X7','poids-leger','Occasion',74000,2023,'6 cyl. 340ch','Automatique Steptronic','Allemagne','États-Unis',['Climatisation','Toit panoramique','Écran 14.9"','Sièges massants']),
  v('Audi','Q8 e-tron','poids-leger','Neuf',89500,2026,'Électrique 408ch','Transmission intégrale quattro','Allemagne','Belgique',['Climatisation','Toit ouvrant','Écrans MMI','Assistance conduite niveau 2']),
  v('Porsche','Cayenne','poids-leger','Neuf',105000,2026,'V6 Turbo 456ch','Tiptronic S automatique','Allemagne','Allemagne',['Climatisation','Toit ouvrant panoramique','Sono Burmester','Sièges sport']),
  v('Peugeot','3008','poids-leger','Neuf',38500,2026,'PureTech 180ch','Automatique EAT8','France','France',['Climatisation auto','i-Cockpit digital','Caméra 360°']),
  v('Renault','Espace','poids-leger','Neuf',44900,2026,'E-Tech Hybride 200ch','Automatique multi-mode','France','France',['Climatisation 3 zones','Toit ouvrant','Écran 12"']),
  v('Citroën','C5 Aircross','poids-leger','Occasion',26900,2022,'PureTech 130ch','Manuelle 6 rapports','France','France',['Climatisation','Suspensions à butées hydrauliques','Caméra de recul']),
  v('Fiat','500e','poids-leger','Neuf',29900,2026,'Électrique 118ch','Automatique','Italie','Italie',['Climatisation','Toit ouvrant','Écran tactile 10"']),
  v('Alfa Romeo','Stelvio','poids-leger','Occasion',42000,2022,'2.0L Turbo 280ch','Automatique 8 rapports','Italie','Italie',['Climatisation bi-zone','Sièges sport cuir','Écran 8.8"']),
  v('Volvo Cars','XC90','poids-leger','Neuf',79500,2026,'Hybride rechargeable 455ch','Automatique 8 rapports','Suède','Suède',['Climatisation 4 zones','Toit ouvrant','Écran vertical 9"']),
  // ---- POIDS LÉGERS — AMÉRICAINES ----
  v('Ford','F-150','poids-leger','Neuf',52000,2026,'V6 EcoBoost 400ch','Automatique 10 rapports','États-Unis','États-Unis',['Climatisation','Écran 12"','Hayon motorisé']),
  v('Chevrolet','Tahoe','poids-leger','Occasion',56000,2022,'V8 5.3L 355ch','Automatique 10 rapports','États-Unis','États-Unis',['Climatisation tri-zone','Toit ouvrant','Écrans arrière']),
  v('GMC','Sierra Denali','poids-leger','Neuf',64000,2026,'V8 6.2L 420ch','Automatique 10 rapports','États-Unis','États-Unis',['Climatisation','Suspension pilotée','Écran 13.4"']),
  v('RAM','1500 Laramie','poids-leger','Neuf',58500,2026,'V8 Hemi 395ch','Automatique 8 rapports','États-Unis','États-Unis',['Climatisation','Suspension pneumatique','Écran 12"']),
  v('Jeep','Grand Cherokee','poids-leger','Occasion',48000,2023,'V6 3.6L 290ch','Automatique 8 rapports','États-Unis','États-Unis',['Climatisation','Toit ouvrant','4x4 Quadra-Trac']),
  v('Tesla','Model X','poids-leger','Neuf',99000,2026,'Électrique bi-moteur 670ch','Automatique direct','États-Unis','États-Unis',['Climatisation biozone HEPA','Portes Falcon Wing','Autopilot','Écran 17"']),
  v('Cadillac','Escalade','poids-leger','Neuf',108000,2026,'V8 6.2L 420ch','Automatique 10 rapports','États-Unis','États-Unis',['Climatisation quadri-zone','Écran incurvé 38"','Sièges massants']),
  // ---- POIDS LÉGERS — ANGLAISES ----
  v('Land Rover','Range Rover','poids-leger','Neuf',132000,2026,'V8 4.4L 530ch','Automatique 8 rapports','Royaume-Uni','Royaume-Uni',['Climatisation quatre zones','Toit panoramique','Suspension pneumatique']),
  v('Jaguar','F-Pace','poids-leger','Occasion',58000,2023,'6 cyl. 300ch','Automatique 8 rapports','Royaume-Uni','Royaume-Uni',['Climatisation','Toit ouvrant','Sono Meridian']),
  v('MINI','Countryman','poids-leger','Neuf',36500,2026,'Turbo 3 cyl. 170ch','Automatique 7 rapports','Royaume-Uni','Pays-Bas',['Climatisation','Toit ouvrant','Écran circulaire OLED']),
  v('Bentley','Continental GT','poids-leger','Neuf',225000,2026,'W12 659ch','Automatique double embrayage','Royaume-Uni','Royaume-Uni',['Climatisation 4 zones','Sièges massants','Sono Naim']),
  v('Rolls-Royce','Cullinan','poids-leger','Neuf',385000,2026,'V12 6.75L 571ch','Automatique 8 rapports','Royaume-Uni','Royaume-Uni',['Climatisation silencieuse','Étoile lumineuse','Suspension magique']),
  v('Aston Martin','DBX707','poids-leger','Neuf',210000,2026,'V8 Twin-Turbo 707ch','Automatique 9 rapports','Royaume-Uni','Royaume-Uni',['Climatisation','Sièges baquets','Sono Bowers & Wilkins']),
  // ---- POIDS LÉGERS — JAPONAISES ----
  v('Toyota','Land Cruiser','poids-leger','Neuf',72000,2026,'Turbo Diesel 3.3L 309ch','Automatique 10 rapports','Japon','Japon',['Climatisation','4x4 Multi-Terrain','Écran 12.3"']),
  v('Honda','CR-V','poids-leger','Occasion',31000,2023,'1.5L Turbo 190ch','CVT automatique','Japon','Canada',['Climatisation','Toit ouvrant','Caméra 360°']),
  v('Nissan','Patrol','poids-leger','Neuf',66500,2026,'V8 5.6L 400ch','Automatique 7 rapports','Japon','Japon',['Climatisation tri-zone','Suspension hydraulique','Écrans arrière']),
  v('Mazda','CX-90','poids-leger','Neuf',49500,2026,'6 cyl. Turbo 340ch','Automatique 8 rapports','Japon','Japon',['Climatisation','Toit ouvrant','Sono Bose']),
  v('Mitsubishi','Pajero Sport','poids-leger','Occasion',34000,2022,'Diesel 2.4L 181ch','Automatique 8 rapports','Japon','Thaïlande',['Climatisation','4x4 Super Select','Caméra de recul']),
  v('Subaru','Outback','poids-leger','Neuf',37500,2026,'2.5L Boxer 182ch','CVT Lineartronic','Japon','États-Unis',['Climatisation','Toit ouvrant','Symmetrical AWD']),
  v('Suzuki','Jimny','poids-leger','Neuf',24500,2026,'1.5L 102ch','Manuelle 5 rapports','Japon','Japon',['Climatisation','4x4 enclenchable','Barres de toit']),
  v('Lexus','LX 600','poids-leger','Neuf',108000,2026,'Twin-Turbo V6 415ch','Automatique 10 rapports','Japon','Japon',['Climatisation quatre zones','Sièges massants','Sono Mark Levinson']),
  // ---- POIDS LÉGERS — CORÉENNES ----
  v('Hyundai','Palisade','poids-leger','Neuf',46500,2026,'V6 3.8L 295ch','Automatique 8 rapports','Corée du Sud','Corée du Sud',['Climatisation tri-zone','Toit ouvrant','Écran 12.3"']),
  v('Kia','Telluride','poids-leger','Occasion',38000,2023,'V6 3.8L 291ch','Automatique 8 rapports','Corée du Sud','États-Unis',['Climatisation','Toit ouvrant','Caméra 360°']),
  v('KG Mobility','Rexton','poids-leger','Neuf',32500,2026,'Diesel 2.2L 202ch','Automatique 8 rapports','Corée du Sud','Corée du Sud',['Climatisation','4x4 enclenchable','Écran 12.3"']),

  // ---- AUTRES VÉHICULES : SPÉCIAUX & UTILITAIRES LÉGERS ----
  v('Mercedes-Benz','Sprinter Fourgon','special','Neuf',42500,2026,'Diesel 2.0L 170ch','Automatique 9G-Tronic','Allemagne','Allemagne',['Climatisation cabine','Caméra de recul','Séparation cargo']),
  v('Renault','Trafic Artisan','special','Occasion',24500,2022,'Diesel 2.0L 150ch','Manuelle 6 rapports','France','France',['Climatisation','Aménagement atelier mobile']),
  v('Volkswagen','Transporter','special','Neuf',39500,2026,'Diesel 2.0L 150ch','Automatique DSG','Allemagne','Allemagne',['Climatisation','Rangements intégrés']),
  v('John Deere','8R 410 Tracteur','special','Neuf',285000,2026,'Diesel 9.0L 410ch','Powershift automatique','États-Unis','Allemagne',['Cabine climatisée','Guidage GPS','Suspension cabine']),
  v('Caterpillar','950 GC Chargeuse','special','Occasion',165000,2021,'Diesel Cat C7.1 173ch','Automatique','États-Unis','France',['Cabine climatisée','Caméra périphérique','Godet haute capacité']),
  v('Komatsu','PC210 Pelle','special','Occasion',142000,2021,'Diesel 4 cyl. 165ch','Hydrostatique','Japon','Japon',['Cabine climatisée','Système anti-vol GPS']),

  // ---- GROS PORTEUR SUPPLÉMENTAIRE (photos réelles fournies) ----
  v('IVECO','Trakker AD380T45','gros-porteur','Occasion',79500,2021,'Diesel Cursor 13L 450ch','Automatisée ZF','Italie','Italie',['Cabine climatisée','4x4/6x4 tout-terrain','Benne basculante hydraulique','Grue auxiliaire (version chantier)'])
];

/* --------------------------------------------------------------------
   2-bis. PHOTOS RÉELLES — rattachement aux fiches (en remplacement des visuels provisoires)
   Complète au fur et à mesure des photos transmises par ZAKARI GRUPPE.
   -------------------------------------------------------------------- */
const PHOTOS_REELLES = {
  'IVECO Trakker AD380T45': [
    'images/vehicules/iveco-trakker-1.jpg','images/vehicules/iveco-trakker-3.jpg','images/vehicules/iveco-trakker-4.jpg',
    'images/vehicules/iveco-trakker-5.jpg','images/vehicules/iveco-trakker-7.jpg','images/vehicules/iveco-trakker-2.jpg',
    'images/vehicules/iveco-trakker-6.jpg'
  ],
  'IVECO S-Way 570': [
    'images/vehicules/iveco-sway-1.jpg','images/vehicules/iveco-sway-2.jpg','images/vehicules/iveco-sway-3.jpg'
  ],
  'DAF Trucks XF 480': [
    'images/vehicules/daf-xf-1.jpg','images/vehicules/daf-xf-4.jpg','images/vehicules/daf-xf-2.jpg',
    'images/vehicules/daf-xf-5.jpg','images/vehicules/daf-xf-3.jpg','images/vehicules/daf-xf-6.jpg'
  ],
  'Scania R 660 V8': [
    'images/vehicules/scania-r660-1.jpg','images/vehicules/scania-r660-2.jpg'
  ],
  'MAN Trucks TGX 18.510': [
    'images/vehicules/man-tgx-1.jpg'
  ],
  'Renault Trucks T High 520': [
    'images/vehicules/renault-thigh-1.jpg'
  ]
};
VEHICULES_INITIAUX.forEach(vehicule=>{
  const cle = `${vehicule.marque} ${vehicule.modele}`;
  if(PHOTOS_REELLES[cle]) vehicule.images = PHOTOS_REELLES[cle];
});

/* --------------------------------------------------------------------
   3. DONNÉES INITIALES — SERVICES DE DETAILING
   -------------------------------------------------------------------- */
function s(titre, categorie, icone, description, bienfaits, materiel, tarifMin, unite){
  return { id: 'srv-' + (compteurId++), titre, categorie, icone, description, bienfaits, materiel, tarifMin, unite, images: [] };
}
const SERVICES_INITIAUX = [
  // ---- PRESTATIONS GROS PORTEURS ----
  s('Lavage Haute Pression Châssis & Moteur','gros-porteur','ic-camion',
    "Lavage haute pression (250 à 300 bars) du châssis, des essieux et du compartiment moteur pour éliminer boue, sel de déneigement et résidus routiers en profondeur.",
    ['Image de marque valorisée','Longévité mécanique (anti-sel / anti-boue)','Sécurité & visibilité renforcées'],
    ['Nettoyeur thermique 300 bars','Décontaminant ferreux','Dégraissant alcalin professionnel'], 180,'/ véhicule'),
  s('Dégraissage Lourd','gros-porteur','ic-spray',
    "Traitement dégraissant intensif pour bennes, plateaux et zones de charge exposées aux hydrocarbures et graisses industrielles.",
    ['Image de marque valorisée','Longévité mécanique (anti-sel / anti-boue)','Sécurité & visibilité renforcées'],
    ['Canon à mousse industriel','Nettoyeur électrique','Brosses longue portée'], 220,'/ véhicule'),
  s('Décontamination Complète Poids Lourd','gros-porteur','ic-polish',
    "Décontamination ferreuse et minérale de la carrosserie et des jantes, pour un véhicule assaini en profondeur avant traitement de protection.",
    ['Image de marque valorisée','Longévité mécanique (anti-sel / anti-boue)','Sécurité & visibilité renforcées'],
    ['Décontaminants ferreux','Aspirateur eau/poussière','Microfibres High GSM >800g/m²'], 260,'/ véhicule'),
  // ---- PRESTATIONS POIDS LÉGERS ----
  s('Nettoyage Injecteur/Extracteur — Sièges & Tissus','poids-leger','ic-spray',
    "Shampouinage en profondeur des sièges, moquettes et tissus par injecteur/extracteur professionnel, pour un habitacle assaini et comme neuf.",
    ['Habitacle assaini en profondeur','Élimination des odeurs incrustées','Confort et hygiène retrouvés'],
    ['Injecteur/extracteur professionnel','Shampoing hydrophobe','Aspirateur eau/poussière'], 65,'/ véhicule'),
  s('Traitement Tornador — Précision Habitacle','poids-leger','ic-spray',
    "Nettoyage à air comprimé des aérations, contre-portes, coutures et recoins inaccessibles, pour un habitacle traité dans les moindres détails.",
    ['Recoins inaccessibles nettoyés','Finition détaillée','Habitacle assaini en profondeur'],
    ['Pistolet Tornador pneumatique','Brosses microfibres souples','Produit multi-surfaces dégraissant'], 45,'/ véhicule'),
  s('Polissage Carrosserie — Rotative & Orbitale','poids-leger','ic-polish',
    "Correction machine à la polisseuse rotative et orbitale pour effacer les micro-rayures et hologrammes, et restituer une brillance miroir.",
    ['Suppression des micro-rayures','Brillance miroir restituée','Valeur de revente préservée'],
    ['Polisseuse rotative & orbitale','Pads de polissage multi-grains','Pâtes abrasives professionnelles'], 150,'/ véhicule'),
  s('Protection Cire & Céramique','poids-leger','ic-polish',
    "Application d'une protection cire premium ou d'un revêtement céramique longue durée, pour un effet hydrophobe et une brillance prolongée.",
    ['Effet hydrophobe longue durée','Brillance prolongée','Protection contre les UV et intempéries'],
    ['Cire carnauba premium','Revêtement céramique 9H','Microfibres High GSM >800g/m²'], 190,'/ véhicule'),
  s('Purification Ozone Anti-Odeurs','poids-leger','ic-ozone',
    "Diffusion d'ozone anti-bactérien qui neutralise les odeurs tenaces (tabac, animaux, humidité) et assainit l'ensemble de l'habitacle.",
    ['Élimination des odeurs tenaces','Action antibactérienne','Air intérieur assaini'],
    ['Générateur d\'ozone professionnel','Désinfectant antibactérien habitacle'], 55,'/ véhicule'),
  s('Nettoyage Jantes & Brosses Nylon','poids-leger','ic-polish',
    "Décontamination des jantes avec des brosses nylon délicates spécifiques pour ne pas endommager les finitions, associée à un décontaminant ferreux.",
    ['Finitions préservées','Décontamination ferreuse complète','Éclat retrouvé des jantes'],
    ['Brosses jantes nylon','Décontaminant ferreux','Canon à mousse'], 35,'/ véhicule')
];

const MATERIEL_PRO = [
  { nom:'Nettoyeurs thermiques / électriques', detail:'Pression 150 à 300 bars, eau chaude ou froide' },
  { nom:'Aspirateurs eau/poussière', detail:'Fonction eau et poussière combinée, usage industriel' },
  { nom:'Canons à mousse', detail:'Prélavage sans contact haute adhérence' },
  { nom:'Brosses jantes nylon', detail:'Fibres douces anti-rayures' },
  { nom:'Microfibres High GSM', detail:'Grammage supérieur à 800 g/m²' },
  { nom:'Shampoings hydrophobes', detail:'Formules professionnelles concentrées' },
  { nom:'Décontaminants ferreux', detail:'Élimination des particules métalliques' },
  { nom:'Polisseuses rotatives/orbitales', detail:'Correction de carrosserie de précision' }
];

/* --------------------------------------------------------------------
   4. ÉTAT & PERSISTANCE (LocalStorage + repli hors-ligne)
   -------------------------------------------------------------------- */
let vehicules = chargerDepuisStockage(CONFIG.CLES_STOCKAGE.vehicules, VEHICULES_INITIAUX);
let services = chargerDepuisStockage(CONFIG.CLES_STOCKAGE.services, SERVICES_INITIAUX);

function chargerDepuisStockage(cle, defaut){
  try{
    const brut = localStorage.getItem(cle);
    if(brut){ return JSON.parse(brut); }
  }catch(e){ console.warn('Lecture LocalStorage impossible', e); }
  return defaut;
}
function sauvegarderStockage(cle, donnees){
  try{ localStorage.setItem(cle, JSON.stringify(donnees)); }
  catch(e){ console.warn('Écriture LocalStorage impossible', e); }
}
function sauvegarderTout(){
  sauvegarderStockage(CONFIG.CLES_STOCKAGE.vehicules, vehicules);
  sauvegarderStockage(CONFIG.CLES_STOCKAGE.services, services);
}

/* --------------------------------------------------------------------
   5. SYNCHRONISATION DISTANTE (Google Sheets via Apps Script)
   Squelette prêt à l'emploi : interroge l'URL Web App en arrière-plan.
   En cas d'échec réseau, le catalogue local (LocalStorage) fait foi.
   -------------------------------------------------------------------- */
async function synchroniserDepuisGoogleSheets(){
  definirEtatSync('attente', 'Synchronisation en cours…');
  try{
    const reponse = await fetch(CONFIG.URL_APPS_SCRIPT + '?action=lire', { method:'GET' });
    if(!reponse.ok) throw new Error('Réponse réseau invalide');
    const donnees = await reponse.json();
    if(donnees.vehicules){ vehicules = donnees.vehicules; }
    if(donnees.services){ services = donnees.services; }
    sauvegarderTout();
    definirEtatSync('ok', 'Catalogue synchronisé avec Google Sheets');
    rafraichirTout();
  }catch(erreur){
    console.info('Synchronisation distante indisponible, catalogue local utilisé.', erreur.message);
    definirEtatSync('local', 'Catalogue local (hors-ligne ou Apps Script non configuré)');
  }
}
async function envoyerVersGoogleSheets(type, action, element){
  try{
    await fetch(CONFIG.URL_APPS_SCRIPT, {
      method:'POST',
      headers:{ 'Content-Type':'text/plain' }, // text/plain évite le pré-vol CORS avec Apps Script
      body: JSON.stringify({ type, action, element })
    });
    definirEtatSync('ok', 'Modification envoyée à Google Sheets');
  }catch(erreur){
    console.info('Envoi Google Sheets impossible pour le moment ; conservé en local.', erreur.message);
    definirEtatSync('local', 'Modification conservée en local (sera à resynchroniser)');
  }
}
function definirEtatSync(etat, texte){
  const point = document.getElementById('pointSync');
  const label = document.getElementById('texteSync');
  if(!point || !label) return;
  point.className = 'point-sync' + (etat==='ok' ? ' ok' : etat==='attente' ? ' attente' : '');
  label.textContent = texte;
}

/* --------------------------------------------------------------------
   6. RENDU — GALERIE VÉHICULES
   -------------------------------------------------------------------- */
const NOMS_CATEGORIES = { 'gros-porteur':'Gros Porteur', 'poids-leger':'Poids Léger', 'special':'Spécial / Utilitaire' };
let filtres = { domaine:'vehicules', categorie:'tous', recherche:'', marque:'tous', etat:'tous', origine:'tous', tri:'recent', serviceCategorie:'tous' };
let vehiculesAffiches = CONFIG.TAILLE_PAGE;

/* --------------------------------------------------------------------
   5-bis. SÉLECTEUR MULTI-DEVISES
   Tous les prix sont saisis en EUR dans les données ; conversion locale
   dynamique à l'affichage selon la devise choisie par l'utilisateur.
   -------------------------------------------------------------------- */
const DEVISES = [
  { code:'EUR', symbole:'€',   nom:'Euro',                 taux:1,      decimales:2 },
  { code:'USD', symbole:'$',   nom:'Dollar Américain',      taux:1.08,   decimales:2 },
  { code:'GBP', symbole:'£',   nom:'Livre Sterling',        taux:0.85,   decimales:2 },
  { code:'CAD', symbole:'CA$', nom:'Dollar Canadien',       taux:1.47,   decimales:2 },
  { code:'CHF', symbole:'CHF', nom:'Franc Suisse',          taux:0.95,   decimales:2 },
  { code:'CNY', symbole:'¥',   nom:'Yuan Chinois',          taux:7.85,   decimales:2 },
  { code:'JPY', symbole:'¥',   nom:'Yen Japonais',          taux:170,    decimales:0 },
  { code:'XOF', symbole:'FCFA',nom:'Franc CFA (UEMOA)',     taux:655.96, decimales:0 },
  { code:'NGN', symbole:'₦',   nom:'Naira Nigérian',        taux:1750,   decimales:0 },
  { code:'MAD', symbole:'DH',  nom:'Dirham Marocain',       taux:10.8,   decimales:2 }
];
let deviseActuelle = chargerDepuisStockage(CONFIG.CLES_STOCKAGE.devise, 'EUR');
if(typeof deviseActuelle !== 'string') deviseActuelle = 'EUR';

function trouverDevise(code){ return DEVISES.find(d=>d.code===code) || DEVISES[0]; }

function formaterPrix(prixEUR){
  const d = trouverDevise(deviseActuelle);
  const valeur = prixEUR * d.taux;
  const nombre = new Intl.NumberFormat('fr-FR', { minimumFractionDigits:d.decimales, maximumFractionDigits:d.decimales }).format(valeur);
  return d.code==='XOF' || d.code==='NGN' ? `${nombre} ${d.symbole}` : `${d.symbole} ${nombre}`;
}

function peuplerSelecteurDevise(){
  const panneau = document.getElementById('panneauDevise');
  panneau.innerHTML = DEVISES.map(d=>`
    <button class="option-deroulant ${d.code===deviseActuelle?'actif':''}" data-devise="${d.code}" role="option">
      <span>${d.symbole}</span><span>${d.code} — ${d.nom}</span>
    </button>`).join('');
  const dActuelle = trouverDevise(deviseActuelle);
  document.getElementById('symboleDeviseActuelle').textContent = dActuelle.symbole;
  document.getElementById('codeDeviseActuelle').textContent = dActuelle.code;
}
document.getElementById('panneauDevise').addEventListener('click', e=>{
  const btn = e.target.closest('[data-devise]'); if(!btn) return;
  deviseActuelle = btn.dataset.devise;
  sauvegarderStockage(CONFIG.CLES_STOCKAGE.devise, deviseActuelle);
  peuplerSelecteurDevise();
  basculerPanneau('panneauDevise', false);
  rendreVehicules(); rendreServices();
});

function peupleSelecteurs(){
  const marques = [...new Set(vehicules.map(v=>v.marque))].sort();
  const origines = [...new Set(vehicules.map(v=>v.paysOrigine))].sort();
  const selMarque = document.getElementById('filtreMarque');
  const selOrigine = document.getElementById('filtreOrigine');
  const valeurMarque = selMarque.value, valeurOrigine = selOrigine.value;
  selMarque.innerHTML = `<option value="tous">${t('filtre_toutes_marques')}</option>` + marques.map(m=>`<option value="${m}">${m}</option>`).join('');
  selOrigine.innerHTML = `<option value="tous">${t('filtre_toutes_origines')}</option>` + origines.map(o=>`<option value="${o}">${o}</option>`).join('');
  selMarque.value = valeurMarque || 'tous';
  selOrigine.value = valeurOrigine || 'tous';
}

function vehiculesFiltres(){
  let liste = vehicules.filter(v=>{
    if(filtres.categorie!=='tous' && v.categorie!==filtres.categorie) return false;
    if(filtres.marque!=='tous' && v.marque!==filtres.marque) return false;
    if(filtres.etat!=='tous' && v.etat!==filtres.etat) return false;
    if(filtres.origine!=='tous' && v.paysOrigine!==filtres.origine) return false;
    if(filtres.recherche){
      const q = filtres.recherche.toLowerCase();
      if(!(v.marque.toLowerCase().includes(q) || v.modele.toLowerCase().includes(q))) return false;
    }
    return true;
  });
  if(filtres.tri==='prix-asc') liste.sort((a,b)=>a.prix-b.prix);
  else if(filtres.tri==='prix-desc') liste.sort((a,b)=>b.prix-a.prix);
  else liste.sort((a,b)=>b.annee-a.annee);
  return liste;
}

function carteVehiculeHTML(v){
  const nomComplet = `${v.marque} ${v.modele} (${v.annee})`;
  return `
  <article class="carte-vehicule" data-id="${v.id}">
    <div class="image-vehicule">
      <img src="${imagesDe(v)[0]}" alt="${v.marque} ${v.modele}" loading="lazy">
      <span class="badge-etat ${v.etat==='Neuf'?'neuf':'occasion'}">${v.etat==='Neuf'?t('etat_neuf'):t('etat_occasion')}</span>
      <span class="badge-categorie">${NOMS_CATEGORIES[v.categorie]}</span>
    </div>
    <div class="corps-carte">
      <div class="entete-carte">
        <div><span class="marque">${v.marque}</span><h3>${v.modele}</h3></div>
        <div class="prix-carte">${formaterPrix(v.prix)}</div>
      </div>
      <div class="meta-carte">
        <span><svg viewBox="0 0 24 24" fill="none"><use href="#ic-moteur"/></svg>${v.moteur}</span>
        <span><svg viewBox="0 0 24 24" fill="none"><use href="#ic-boite"/></svg>${v.transmission}</span>
        <span>${v.annee}</span>
      </div>
      <div class="pays-carte">
        <span>${t('label_origine')} : <b>${v.paysOrigine}</b></span>
        <span>${t('label_fabrication')} : <b>${v.paysFabrication}</b></span>
      </div>
      <div class="options-carte">${v.options.slice(0,3).map(o=>`<span class="tag-option">${o}</span>`).join('')}${v.options.length>3?`<span class="tag-option">+${v.options.length-3}</span>`:''}</div>
      <div class="pied-carte">
        <button class="btn btn-fantome" data-voir="${v.id}">${t('btn_voir_fiche')}</button>
        <button class="btn btn-or" data-commander data-nom-produit="${nomComplet.replace(/"/g,'&quot;')}" data-prix-produit="${v.prix}">${t('btn_commander')}</button>
      </div>
    </div>
  </article>`;
}

function rendreVehicules(){
  const liste = vehiculesFiltres();
  const grille = document.getElementById('grilleVehicules');
  const compteur = document.getElementById('compteurVehicules');
  const visibles = liste.slice(0, vehiculesAffiches);
  compteur.textContent = t('compteur_texte').replace('{total}', liste.length).replace('{visibles}', visibles.length);
  document.getElementById('statVehicules').textContent = vehicules.length;
  document.getElementById('btnPlusVehicules').style.display = vehiculesAffiches < liste.length ? 'inline-flex' : 'none';
  if(!liste.length){
    grille.innerHTML = `<div class="etat-vide"><svg viewBox="0 0 24 24" fill="none"><use href="#ic-recherche"/></svg><p>Aucun véhicule ne correspond à ces filtres.</p></div>`;
    return;
  }
  grille.innerHTML = visibles.map(carteVehiculeHTML).join('');
}

/* --------------------------------------------------------------------
   7. RENDU — GALERIE SERVICES
   -------------------------------------------------------------------- */
function carteServiceHTML(s){
  const aUneImage = Array.isArray(s.images) && s.images.length > 0;
  return `
  <article class="carte-service">
    ${aUneImage ? `<img src="${s.images[0]}" alt="${s.titre}" style="width:calc(100% + 4rem);margin:-2rem -2rem 0;aspect-ratio:16/8;object-fit:cover">` : ''}
    <span class="icone-service"><svg viewBox="0 0 24 24" fill="none"><use href="#${s.icone}"/></svg></span>
    <h3>${s.titre}</h3>
    <p>${s.description}</p>
    <span class="libelle-bloc">${t('service_bienfaits')}</span>
    <div class="bienfaits-service">${(s.bienfaits||[]).map(b=>`<span>${b}</span>`).join('')}</div>
    <span class="libelle-bloc">${t('service_materiel')}</span>
    <div class="liste-materiel">${s.materiel.map(m=>`<span>${m}</span>`).join('')}</div>
    <div class="tarif-service">
      <span class="montant">${formaterPrix(s.tarifMin)}<sup>${s.unite}</sup></span>
      <button class="btn btn-or btn-petit" data-commander data-nom-produit="${s.titre.replace(/"/g,'&quot;')}" data-prix-produit="${s.tarifMin}">${t('btn_reserver')}</button>
    </div>
  </article>`;
}
function rendreServices(){
  const liste = services.filter(s=> filtres.serviceCategorie==='tous' || s.categorie===filtres.serviceCategorie);
  document.getElementById('grilleServices').innerHTML = liste.map(carteServiceHTML).join('') ||
    `<div class="etat-vide"><p>Aucune prestation dans cette catégorie.</p></div>`;
}
function rendreMateriel(){
  document.getElementById('grilleMateriel').innerHTML = MATERIEL_PRO.map(m=>`<div class="item-materiel"><b>${m.nom}</b><span>${m.detail}</span></div>`).join('');
}

function rafraichirTout(){ peupleSelecteurs(); rendreVehicules(); rendreServices(); rendreMateriel(); }

/* --------------------------------------------------------------------
   8. FICHE VÉHICULE DÉTAILLÉE (MODALE)
   -------------------------------------------------------------------- */
function ouvrirFiche(id){
  const v = vehicules.find(x=>x.id===id);
  if(!v) return;
  const images = imagesDe(v);
  const nomComplet = `${v.marque} ${v.modele} (${v.annee})`;
  document.getElementById('contenuFiche').innerHTML = `
    <img src="${images[0]}" alt="${v.marque} ${v.modele}" style="width:100%;aspect-ratio:16/9;object-fit:cover;margin-bottom:.6rem" id="imagePrincipaleFiche">
    ${images.length>1 ? `<div style="display:flex;gap:.5rem;margin-bottom:1.4rem;flex-wrap:wrap">${images.map((img,i)=>`<img src="${img}" data-vignette="${i}" style="width:64px;height:48px;object-fit:cover;cursor:pointer;border:1px solid var(--ligne)">`).join('')}</div>` : '<div style="margin-bottom:1.4rem"></div>'}
    <p class="eyebrow">${v.marque} — ${NOMS_CATEGORIES[v.categorie]}</p>
    <h3 style="font-size:1.9rem;margin-bottom:.6rem">${v.modele}</h3>
    <p style="color:var(--or-clair);font-family:var(--f-display);font-size:1.6rem;margin-bottom:1.2rem">${formaterPrix(v.prix)}</p>
    <div class="meta-carte" style="margin-bottom:1.2rem">
      <span>${t('label_etat')} : ${v.etat==='Neuf'?t('etat_neuf'):t('etat_occasion')}</span><span>${t('label_annee')} : ${v.annee}</span><span>${v.moteur}</span><span>${v.transmission}</span>
    </div>
    <div class="pays-carte" style="margin-bottom:1.2rem">
      <span>${t('label_origine')} : <b>${v.paysOrigine}</b></span>
      <span>${t('label_fabrication')} : <b>${v.paysFabrication}</b></span>
    </div>
    <p class="eyebrow">${t('fiche_options_titre')}</p>
    <div class="options-carte" style="margin-bottom:1.6rem">${v.options.map(o=>`<span class="tag-option">${o}</span>`).join('')}</div>
    <button class="btn btn-or" style="width:100%" data-commander data-nom-produit="${nomComplet.replace(/"/g,'&quot;')}" data-prix-produit="${v.prix}">${t('fiche_commander_whatsapp')}</button>
  `;
  document.querySelectorAll('[data-vignette]').forEach(vign=>{
    vign.addEventListener('click', ()=>{ document.getElementById('imagePrincipaleFiche').src = images[Number(vign.dataset.vignette)]; });
  });
  ouvrirModale('modaleFiche');
}

/* --------------------------------------------------------------------
   9. GESTION DES MODALES
   -------------------------------------------------------------------- */
function ouvrirModale(id){ document.getElementById(id).classList.add('ouverte'); document.body.style.overflow='hidden'; }
function fermerModale(id){ document.getElementById(id).classList.remove('ouverte'); document.body.style.overflow=''; }
document.querySelectorAll('[data-fermer]').forEach(btn=>{
  btn.addEventListener('click', ()=>fermerModale(btn.dataset.fermer));
});
document.querySelectorAll('.superposition').forEach(sup=>{
  sup.addEventListener('click', e=>{ if(e.target===sup) fermerModale(sup.id); });
});
document.addEventListener('keydown', e=>{
  if(e.key==='Escape') document.querySelectorAll('.superposition.ouverte').forEach(s=>fermerModale(s.id));
});

/* --------------------------------------------------------------------
   10. NAVIGATION, ONGLETS DE DOMAINE, FILTRES, RECHERCHE
   -------------------------------------------------------------------- */
document.getElementById('btnBurger').addEventListener('click', ()=>{
  document.getElementById('liensNav').classList.toggle('ouvert');
});
document.querySelectorAll('.liens-nav a').forEach(a=>a.addEventListener('click', ()=>{
  document.getElementById('liensNav').classList.remove('ouvert');
}));

document.querySelectorAll('.onglet-domaine').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.onglet-domaine').forEach(b=>b.classList.remove('actif'));
    btn.classList.add('actif');
    const domaine = btn.dataset.domaine;
    document.getElementById('domaineVehicules').style.display = domaine==='vehicules' ? '' : 'none';
    document.getElementById('domaineServices').style.display = domaine==='services' ? '' : 'none';
  });
});

document.getElementById('chipsCategories').addEventListener('click', e=>{
  const chip = e.target.closest('.chip'); if(!chip) return;
  document.querySelectorAll('#chipsCategories .chip').forEach(c=>c.classList.remove('actif'));
  chip.classList.add('actif');
  filtres.categorie = chip.dataset.categorie;
  vehiculesAffiches = CONFIG.TAILLE_PAGE;
  rendreVehicules();
});
document.querySelectorAll('[data-service-cat]').forEach(chip=>{
  chip.addEventListener('click', ()=>{
    chip.parentElement.querySelectorAll('.chip').forEach(c=>c.classList.remove('actif'));
    chip.classList.add('actif');
    filtres.serviceCategorie = chip.dataset.serviceCat;
    rendreServices();
  });
});

document.getElementById('rechercheVehicule').addEventListener('input', e=>{
  filtres.recherche = e.target.value; vehiculesAffiches = CONFIG.TAILLE_PAGE; rendreVehicules();
});
['filtreMarque','filtreEtat','filtreOrigine','filtreTri'].forEach(id=>{
  document.getElementById(id).addEventListener('change', e=>{
    const map = { filtreMarque:'marque', filtreEtat:'etat', filtreOrigine:'origine', filtreTri:'tri' };
    filtres[map[id]] = e.target.value; vehiculesAffiches = CONFIG.TAILLE_PAGE; rendreVehicules();
  });
});
document.getElementById('btnPlusVehicules').addEventListener('click', ()=>{
  vehiculesAffiches += CONFIG.TAILLE_PAGE; rendreVehicules();
});
document.getElementById('grilleVehicules').addEventListener('click', e=>{
  const btn = e.target.closest('[data-voir]'); if(btn) ouvrirFiche(btn.dataset.voir);
});

/* --------------------------------------------------------------------
   11. FORMULAIRE DE CONTACT → WHATSAPP
   -------------------------------------------------------------------- */
document.getElementById('formulaireContact').addEventListener('submit', e=>{
  e.preventDefault();
  const champs = e.target.querySelectorAll('input, select, textarea');
  const [nom, motif, message] = champs;
  const texte = `Bonjour ZAKARI GRUPPE,%0AJe m'appelle ${encodeURIComponent(nom.value)}.%0AMotif : ${encodeURIComponent(motif.value)}.%0AMessage : ${encodeURIComponent(message.value)}`;
  window.open(`https://wa.me/2290196809106?text=${texte}`, '_blank');
});

/* --------------------------------------------------------------------
   12. ACCÈS PRO — AUTHENTIFICATION LOCALE
   -------------------------------------------------------------------- */
document.getElementById('btnAccesPro').addEventListener('click', ()=>{
  if(sessionStorage.getItem(CONFIG.CLES_STOCKAGE.session)==='ok'){ ouvrirPanneauAdmin(); }
  else{ ouvrirModale('modaleLogin'); }
});
document.getElementById('formulaireLogin').addEventListener('submit', e=>{
  e.preventDefault();
  const saisi = document.getElementById('motDePasseAdmin').value;
  if(saisi === CONFIG.MOT_DE_PASSE_ADMIN){
    sessionStorage.setItem(CONFIG.CLES_STOCKAGE.session, 'ok');
    document.getElementById('erreurLogin').style.display='none';
    document.getElementById('formulaireLogin').reset();
    fermerModale('modaleLogin');
    ouvrirPanneauAdmin();
  } else {
    document.getElementById('erreurLogin').style.display='block';
  }
});

/* --------------------------------------------------------------------
   13. PANNEAU ADMIN — CRUD VÉHICULES & SERVICES
   -------------------------------------------------------------------- */
let ongletAdmin = 'vehicules';
function ouvrirPanneauAdmin(){ rendreTableAdmin(); ouvrirModale('modaleAdmin'); }

document.querySelectorAll('[data-admin-tab]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('[data-admin-tab]').forEach(b=>b.classList.remove('actif'));
    btn.classList.add('actif');
    ongletAdmin = btn.dataset.adminTab;
    rendreTableAdmin();
  });
});

function rendreTableAdmin(){
  const entete = document.getElementById('enteteTableAdmin');
  const corps = document.getElementById('corpsTableAdmin');
  if(ongletAdmin==='vehicules'){
    entete.innerHTML = `<tr><th>Marque</th><th>Modèle</th><th>Catégorie</th><th>Prix</th><th>État</th><th>Actions</th></tr>`;
    corps.innerHTML = vehicules.map(v=>`
      <tr>
        <td>${v.marque}</td><td>${v.modele}</td><td>${NOMS_CATEGORIES[v.categorie]}</td><td>${formaterPrix(v.prix)}</td><td>${v.etat}</td>
        <td class="actions-table">
          <button data-edit-vehicule="${v.id}"><svg viewBox="0 0 24 24"><use href="#ic-edit"/></svg></button>
          <button data-suppr-vehicule="${v.id}"><svg viewBox="0 0 24 24"><use href="#ic-trash"/></svg></button>
        </td>
      </tr>`).join('');
  } else {
    entete.innerHTML = `<tr><th>Prestation</th><th>Catégorie</th><th>Tarif</th><th>Actions</th></tr>`;
    corps.innerHTML = services.map(s=>`
      <tr>
        <td>${s.titre}</td><td>${s.categorie==='gros-porteur'?'Gros Porteur':'Poids Léger'}</td><td>${formaterPrix(s.tarifMin)} ${s.unite}</td>
        <td class="actions-table">
          <button data-edit-service="${s.id}"><svg viewBox="0 0 24 24"><use href="#ic-edit"/></svg></button>
          <button data-suppr-service="${s.id}"><svg viewBox="0 0 24 24"><use href="#ic-trash"/></svg></button>
        </td>
      </tr>`).join('');
  }
}

document.getElementById('corpsTableAdmin').addEventListener('click', e=>{
  const editV = e.target.closest('[data-edit-vehicule]');
  const supprV = e.target.closest('[data-suppr-vehicule]');
  const editS = e.target.closest('[data-edit-service]');
  const supprS = e.target.closest('[data-suppr-service]');
  if(editV) ouvrirFormulaireEdition('vehicule', vehicules.find(v=>v.id===editV.dataset.editVehicule));
  if(editS) ouvrirFormulaireEdition('service', services.find(s=>s.id===editS.dataset.editService));
  if(supprV){
    const v = vehicules.find(x=>x.id===supprV.dataset.supprVehicule);
    if(confirm(`Supprimer ${v.marque} ${v.modele} du catalogue ?`)){
      vehicules = vehicules.filter(x=>x.id!==v.id);
      sauvegarderTout(); envoyerVersGoogleSheets('vehicule','supprimer',v);
      rendreTableAdmin(); rendreVehicules(); afficherToast('Véhicule supprimé.');
    }
  }
  if(supprS){
    const s = services.find(x=>x.id===supprS.dataset.supprService);
    if(confirm(`Supprimer la prestation « ${s.titre} » ?`)){
      services = services.filter(x=>x.id!==s.id);
      sauvegarderTout(); envoyerVersGoogleSheets('service','supprimer',s);
      rendreTableAdmin(); rendreServices(); afficherToast('Prestation supprimée.');
    }
  }
});

document.getElementById('btnAjouterElement').addEventListener('click', ()=>{
  ouvrirFormulaireEdition(ongletAdmin==='vehicules' ? 'vehicule' : 'service', null);
});

/* Zone de gestion visuelle des images (jusqu'à 5, par URL ou import local en Base64) */
function rendreZoneImages(imagesActuelles){
  const zone = document.getElementById('zoneImagesAdmin');
  if(!zone) return;
  zone.innerHTML = imagesActuelles.map((img,i)=>`
    <div class="vignette-image"><img src="${img}" alt="Visuel ${i+1}"><button type="button" data-retirer-image="${i}" aria-label="Retirer">✕</button></div>
  `).join('') + (imagesActuelles.length < CONFIG.MAX_IMAGES ? `
    <button type="button" class="ajouter-image-btn" id="btnAjouterImage"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><use href="#ic-plus"/></svg>Ajouter</button>` : '');
  zone.querySelectorAll('[data-retirer-image]').forEach(b=>{
    b.addEventListener('click', ()=>{ imagesActuelles.splice(Number(b.dataset.retirerImage),1); rendreZoneImages(imagesActuelles); });
  });
  const btnAjout = document.getElementById('btnAjouterImage');
  if(btnAjout){
    btnAjout.addEventListener('click', ()=>{
      const inputFichier = document.getElementById('inputFichierImage');
      inputFichier.click();
    });
  }
}

function ouvrirFormulaireEdition(type, element){
  const form = document.getElementById('formulaireEdition');
  document.getElementById('titreModaleEdition').textContent =
    (element ? 'Modifier' : 'Ajouter') + (type==='vehicule' ? ' un véhicule' : ' une prestation');

  // Copie de travail du tableau d'images (max 5), modifiée localement avant sauvegarde
  const imagesActuelles = element ? [...imagesDe(element)] : [];

  const blocImages = `
    <div class="champ">
      <label>Photos (jusqu'à ${CONFIG.MAX_IMAGES} — import local ou lien URL)</label>
      <div class="zone-images-admin" id="zoneImagesAdmin"></div>
      <input type="file" id="inputFichierImage" accept="image/*" multiple style="display:none">
      <div style="display:flex;gap:.5rem">
        <input type="text" id="inputUrlImage" placeholder="https://… puis Entrée ou Ajouter" style="flex:1;padding:.7em 1em;background:var(--noir-abysse);border:1px solid var(--ligne);color:var(--diamant)">
        <button type="button" class="btn btn-fantome btn-petit" id="btnAjouterUrlImage">Ajouter le lien</button>
      </div>
      <span class="note-champ">Les images importées localement (Base64) sont enregistrées uniquement sur cet appareil.</span>
    </div>`;

  if(type==='vehicule'){
    const v = element || {};
    form.innerHTML = `
      <div class="grille-form-2">
        <div class="champ"><label>Marque</label><input name="marque" required value="${v.marque||''}"></div>
        <div class="champ"><label>Modèle</label><input name="modele" required value="${v.modele||''}"></div>
        <div class="champ"><label>Catégorie</label>
          <select name="categorie">
            <option value="gros-porteur" ${v.categorie==='gros-porteur'?'selected':''}>Gros Porteur</option>
            <option value="poids-leger" ${v.categorie==='poids-leger'?'selected':''}>Poids Léger</option>
            <option value="special" ${v.categorie==='special'?'selected':''}>Spécial / Utilitaire</option>
          </select>
        </div>
        <div class="champ"><label>État</label>
          <select name="etat"><option ${v.etat==='Neuf'?'selected':''}>Neuf</option><option ${v.etat==='Occasion'?'selected':''}>Occasion</option></select>
        </div>
        <div class="champ"><label>Prix de référence (€)</label><input type="number" name="prix" required value="${v.prix||''}"></div>
        <div class="champ"><label>Année</label><input type="number" name="annee" required value="${v.annee||new Date().getFullYear()}"></div>
        <div class="champ"><label>Motorisation</label><input name="moteur" value="${v.moteur||''}"></div>
        <div class="champ"><label>Transmission</label><input name="transmission" value="${v.transmission||''}"></div>
        <div class="champ"><label>Pays d'origine (marque)</label><input name="paysOrigine" value="${v.paysOrigine||''}"></div>
        <div class="champ"><label>Pays de fabrication</label><input name="paysFabrication" value="${v.paysFabrication||''}"></div>
      </div>
      <div class="champ"><label>Options (séparées par des virgules)</label><textarea name="options">${(v.options||[]).join(', ')}</textarea></div>
      ${blocImages}
      <button type="submit" class="btn btn-or" style="width:100%">${element?'Enregistrer les modifications':'Ajouter au catalogue'}</button>
    `;
    initialiserZoneImages(imagesActuelles);
    form.onsubmit = (e)=>{
      e.preventDefault();
      const fd = new FormData(form);
      const donnees = Object.fromEntries(fd.entries());
      donnees.prix = Number(donnees.prix); donnees.annee = Number(donnees.annee);
      donnees.options = donnees.options.split(',').map(o=>o.trim()).filter(Boolean);
      donnees.images = imagesActuelles.length ? imagesActuelles : [genererPlaceholder(donnees.categorie, donnees.marque, donnees.modele)];
      if(element){
        Object.assign(element, donnees);
        envoyerVersGoogleSheets('vehicule','modifier',element);
        afficherToast('Véhicule mis à jour.');
      } else {
        donnees.id = 'veh-' + (compteurId++);
        vehicules.unshift(donnees);
        envoyerVersGoogleSheets('vehicule','ajouter',donnees);
        afficherToast('Véhicule ajouté au catalogue.');
      }
      sauvegarderTout(); rendreTableAdmin(); rendreVehicules(); peupleSelecteurs(); fermerModale('modaleEdition');
    };
  } else {
    const s = element || {};
    form.innerHTML = `
      <div class="grille-form-2">
        <div class="champ" style="grid-column:1/-1"><label>Titre de la prestation</label><input name="titre" required value="${s.titre||''}"></div>
        <div class="champ"><label>Catégorie</label>
          <select name="categorie"><option value="gros-porteur" ${s.categorie==='gros-porteur'?'selected':''}>Gros Porteur</option><option value="poids-leger" ${s.categorie==='poids-leger'?'selected':''}>Poids Léger</option></select>
        </div>
        <div class="champ"><label>Tarif de référence à partir de (€)</label><input type="number" name="tarifMin" required value="${s.tarifMin||''}"></div>
        <div class="champ" style="grid-column:1/-1"><label>Unité (ex : / véhicule)</label><input name="unite" value="${s.unite||'/ véhicule'}"></div>
      </div>
      <div class="champ"><label>Description complète</label><textarea name="description" required>${s.description||''}</textarea></div>
      <div class="champ"><label>Bienfaits ciblés (séparés par des virgules)</label><textarea name="bienfaits">${(s.bienfaits||[]).join(', ')}</textarea></div>
      <div class="champ"><label>Matériel utilisé (séparé par des virgules)</label><textarea name="materiel">${(s.materiel||[]).join(', ')}</textarea></div>
      ${blocImages}
      <button type="submit" class="btn btn-or" style="width:100%">${element?'Enregistrer les modifications':'Ajouter la prestation'}</button>
    `;
    initialiserZoneImages(imagesActuelles);
    form.onsubmit = (e)=>{
      e.preventDefault();
      const fd = new FormData(form);
      const donnees = Object.fromEntries(fd.entries());
      donnees.tarifMin = Number(donnees.tarifMin);
      donnees.bienfaits = donnees.bienfaits.split(',').map(b=>b.trim()).filter(Boolean);
      donnees.materiel = donnees.materiel.split(',').map(m=>m.trim()).filter(Boolean);
      donnees.images = imagesActuelles;
      donnees.icone = s.icone || 'ic-spray';
      if(element){
        Object.assign(element, donnees);
        envoyerVersGoogleSheets('service','modifier',element);
        afficherToast('Prestation mise à jour.');
      } else {
        donnees.id = 'srv-' + (compteurId++);
        services.unshift(donnees);
        envoyerVersGoogleSheets('service','ajouter',donnees);
        afficherToast('Prestation ajoutée.');
      }
      sauvegarderTout(); rendreTableAdmin(); rendreServices(); fermerModale('modaleEdition');
    };
  }
  ouvrirModale('modaleEdition');
}

function initialiserZoneImages(imagesActuelles){
  rendreZoneImages(imagesActuelles);
  const inputFichier = document.getElementById('inputFichierImage');
  inputFichier.addEventListener('change', ()=>{
    const fichiers = Array.from(inputFichier.files).slice(0, CONFIG.MAX_IMAGES - imagesActuelles.length);
    fichiers.forEach(fichier=>{
      const lecteur = new FileReader();
      lecteur.onload = ()=>{
        if(imagesActuelles.length < CONFIG.MAX_IMAGES){ imagesActuelles.push(lecteur.result); rendreZoneImages(imagesActuelles); }
      };
      lecteur.readAsDataURL(fichier);
    });
    inputFichier.value = '';
  });
  const btnUrl = document.getElementById('btnAjouterUrlImage');
  const inputUrl = document.getElementById('inputUrlImage');
  function ajouterUrl(){
    const url = inputUrl.value.trim();
    if(url && imagesActuelles.length < CONFIG.MAX_IMAGES){ imagesActuelles.push(url); inputUrl.value=''; rendreZoneImages(imagesActuelles); }
  }
  btnUrl.addEventListener('click', ajouterUrl);
  inputUrl.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); ajouterUrl(); } });
}

/* --------------------------------------------------------------------
   14. TOAST DE NOTIFICATION
   -------------------------------------------------------------------- */
let toastTimeout;
function afficherToast(texte){
  const toast = document.getElementById('toast');
  toast.textContent = texte;
  toast.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(()=>toast.classList.remove('visible'), 3200);
}

/* --------------------------------------------------------------------
   15. ÉTAT RÉSEAU / BANDEAU HORS-LIGNE
   -------------------------------------------------------------------- */
function majEtatReseau(){
  document.getElementById('bandeauHorsLigne').classList.toggle('visible', !navigator.onLine);
}
window.addEventListener('online', ()=>{ majEtatReseau(); synchroniserDepuisGoogleSheets(); });
window.addEventListener('offline', majEtatReseau);

/* --------------------------------------------------------------------
   16. PWA — INSTALLATION PERSONNALISÉE
   -------------------------------------------------------------------- */
let evenementInstallDiffere = null;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  evenementInstallDiffere = e;
  document.getElementById('btnInstaller').classList.add('visible');
});
document.getElementById('btnInstaller').addEventListener('click', async ()=>{
  if(!evenementInstallDiffere) return;
  evenementInstallDiffere.prompt();
  const { outcome } = await evenementInstallDiffere.userChoice;
  if(outcome==='accepted') afficherToast('Application installée avec succès.');
  evenementInstallDiffere = null;
  document.getElementById('btnInstaller').classList.remove('visible');
});
window.addEventListener('appinstalled', ()=>{
  document.getElementById('btnInstaller').classList.remove('visible');
});

if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(err=>console.warn('Échec enregistrement Service Worker :', err));
  });
}

/* --------------------------------------------------------------------
   18. MENUS DÉROULANTS GÉNÉRIQUES (langue / devise)
   -------------------------------------------------------------------- */
function basculerPanneau(idPanneau, forcer){
  const panneau = document.getElementById(idPanneau);
  const doitOuvrir = forcer !== undefined ? forcer : !panneau.classList.contains('ouvert');
  document.querySelectorAll('.panneau-deroulant').forEach(p=>p.classList.remove('ouvert'));
  if(doitOuvrir) panneau.classList.add('ouvert');
}
document.getElementById('btnLangue').addEventListener('click', ()=>basculerPanneau('panneauLangue'));
document.getElementById('btnDevise').addEventListener('click', ()=>basculerPanneau('panneauDevise'));
document.addEventListener('click', e=>{
  if(!e.target.closest('.menu-deroulant')) document.querySelectorAll('.panneau-deroulant').forEach(p=>p.classList.remove('ouvert'));
});

/* --------------------------------------------------------------------
   19. SYSTÈME 8 LANGUES AVEC DRAPEAUX
   -------------------------------------------------------------------- */
const LANGUES = [
  { code:'fr', drapeau:'🇫🇷', nom:'Français' },
  { code:'en', drapeau:'🇬🇧', nom:'English' },
  { code:'de', drapeau:'🇩🇪', nom:'Deutsch' },
  { code:'es', drapeau:'🇪🇸', nom:'Español' },
  { code:'pt', drapeau:'🇵🇹', nom:'Português' },
  { code:'ru', drapeau:'🇷🇺', nom:'Русский' },
  { code:'zh', drapeau:'🇨🇳', nom:'中文' },
  { code:'ar', drapeau:'🇸🇦', nom:'العربية' }
];

const TRADUCTIONS = {
  fr:{ nav_accueil:'Accueil', nav_vehicules:'Véhicules', nav_services:'Services', nav_contact:'Contact', nav_installer:"Installer l'app",
    hero_eyebrow:"Depuis le Bénin, vers l'excellence automobile", hero_titre:"L'exigence <em>ZAKARI</em><br>a quatre roues.",
    hero_baseline:"Vente de véhicules neufs et d'occasion — poids lourds, tourisme et engins spéciaux — associée à un atelier de detailing haut de gamme.",
    hero_cta1:'Découvrir le catalogue', hero_cta2:'Voir les prestations', hero_stat1:'Véhicules référencés', hero_stat2:'Continents de marques', hero_stat3:'Disponible hors-ligne',
    onglet_vehicules:'Galerie Véhicules', onglet_services:'Services & Detailing',
    domaine1_eyebrow:'Domaine 1', domaine1_titre:'Galerie de vente de véhicules', domaine1_sous:"Neufs et d'occasion — gros porteurs, poids légers et véhicules spéciaux.",
    chip_tous:'Tous', chip_gros:'Gros Porteurs', chip_leger:'Poids Légers', chip_special:'Spéciaux & Utilitaires', chip_toutes_prestations:'Toutes les prestations',
    recherche_placeholder:'Rechercher une marque, un modèle…',
    domaine2_eyebrow:'Domaine 2', domaine2_titre:"Services d'entretien & de nettoyage", domaine2_sous:'Un detailing de précision, pour flottes lourdes et véhicules de prestige.',
    materiel_eyebrow:'Matériel professionnel', materiel_titre:"L'arsenal ZAKARI Detailing",
    contact_eyebrow:'Nous joindre', contact_titre:'Un projet, un véhicule, une prestation ?', contact_sous:'Nos équipes en Allemagne et au Bénin répondent directement sur WhatsApp.',
    pied_desc:'Négoce de véhicules et atelier de detailing premium — une confidentialité totale, une exigence intacte.', pied_navigation:'Navigation', pied_domaines:'Domaines', pied_detailing:'Detailing Premium', pied_boutique:'Boutique partenaire',
    commande_eyebrow:'Quel bureau souhaitez-vous contacter ?', commande_titre:'Choisissez le bureau le plus proche de vous', pays_allemagne:'Bureau Allemagne', pays_benin:'Bureau Bénin',
    site_soustitre:'VÉHICULES · DETAILING', etat_neuf:'Neuf', etat_occasion:'Occasion',
    label_origine:'Origine marque', label_fabrication:'Fabrication', label_etat:'État', label_annee:'Année',
    btn_voir_fiche:'Voir la fiche', btn_commander:'Commander', btn_reserver:'Réserver', btn_charger_plus:'Charger plus de véhicules',
    compteur_texte:'{total} véhicule(s) — {visibles} affiché(s)',
    filtre_toutes_marques:'Toutes les marques', filtre_neuf_occasion:'Neuf & Occasion', filtre_toutes_origines:'Toutes origines',
    filtre_plus_recents:'Plus récents', filtre_prix_asc:'Prix croissant', filtre_prix_desc:'Prix décroissant',
    fiche_options_titre:'Options & équipements', fiche_commander_whatsapp:'Commander sur WhatsApp',
    service_bienfaits:'Bienfaits ciblés', service_materiel:'Matériel professionnel utilisé',
    pied_powered_by:'Powered by', pied_boutique_desc:'Boutique officielle de scripts, codes sources et outils par EMPIRE CODE.', pied_visiter:'Visiter', pied_droits:'Tous droits réservés',
    confidentialite_texte:"Une idée d'outil sur mesure, fonctionnant hors connexion, hors serveur, hors base de données, pour votre activité et votre confidentialité ? Écrivez-nous. Par : WhatsApp : +2290196809106, email : empiredonko@gmail.com.",
    canal_whatsapp_allemagne:'WhatsApp — Allemagne', canal_whatsapp_benin:'WhatsApp — Bénin', canal_email_benin:'Email — Bénin',
    form_nom:'Nom complet', form_demande:'Votre demande', form_option1:"Achat d'un véhicule", form_option2:'Vente / reprise', form_option3:'Prestation de detailing', form_option4:'Autre demande',
    form_message:'Message', form_message_placeholder:'Décrivez votre besoin…', form_envoyer:'Envoyer sur WhatsApp' },
  en:{ nav_accueil:'Home', nav_vehicules:'Vehicles', nav_services:'Services', nav_contact:'Contact', nav_installer:'Install app',
    hero_eyebrow:'From Benin, towards automotive excellence', hero_titre:"The <em>ZAKARI</em> standard,<br>on four wheels.",
    hero_baseline:'New and used vehicle sales — heavy trucks, passenger cars and special equipment — paired with a premium detailing workshop.',
    hero_cta1:'Browse the catalog', hero_cta2:'View our services', hero_stat1:'Listed vehicles', hero_stat2:'Continents of brands', hero_stat3:'Available offline',
    onglet_vehicules:'Vehicle Gallery', onglet_services:'Services & Detailing',
    domaine1_eyebrow:'Domain 1', domaine1_titre:'Vehicle sales gallery', domaine1_sous:'New and used — heavy trucks, passenger cars and special vehicles.',
    chip_tous:'All', chip_gros:'Heavy Trucks', chip_leger:'Passenger Vehicles', chip_special:'Special & Utility', chip_toutes_prestations:'All services',
    recherche_placeholder:'Search a brand, a model…',
    domaine2_eyebrow:'Domain 2', domaine2_titre:'Cleaning & maintenance services', domaine2_sous:'Precision detailing, for heavy fleets and prestige vehicles.',
    materiel_eyebrow:'Professional equipment', materiel_titre:'The ZAKARI Detailing arsenal',
    contact_eyebrow:'Get in touch', contact_titre:'A project, a vehicle, a service?', contact_sous:'Our teams in Germany and Benin reply directly on WhatsApp.',
    pied_desc:'Vehicle trading and premium detailing workshop — total confidentiality, unwavering standards.', pied_navigation:'Navigation', pied_domaines:'Domains', pied_detailing:'Premium Detailing', pied_boutique:'Partner shop',
    commande_eyebrow:'Which office would you like to contact?', commande_titre:'Choose the office nearest to you', pays_allemagne:'Germany Office', pays_benin:'Benin Office',
    site_soustitre:'VEHICLES · DETAILING', etat_neuf:'New', etat_occasion:'Used',
    label_origine:'Brand origin', label_fabrication:'Manufactured in', label_etat:'Condition', label_annee:'Year',
    btn_voir_fiche:'View details', btn_commander:'Order', btn_reserver:'Book', btn_charger_plus:'Load more vehicles',
    compteur_texte:'{total} vehicle(s) — {visibles} shown',
    filtre_toutes_marques:'All brands', filtre_neuf_occasion:'New & Used', filtre_toutes_origines:'All origins',
    filtre_plus_recents:'Newest first', filtre_prix_asc:'Price: low to high', filtre_prix_desc:'Price: high to low',
    fiche_options_titre:'Options & equipment', fiche_commander_whatsapp:'Order on WhatsApp',
    service_bienfaits:'Targeted benefits', service_materiel:'Professional equipment used',
    pied_powered_by:'Powered by', pied_boutique_desc:'Official store for scripts, source code and tools by EMPIRE CODE.', pied_visiter:'Visit', pied_droits:'All rights reserved',
    confidentialite_texte:'Need a custom tool that works offline, without a server, without a database, for your business and your privacy? Write to us. Via: WhatsApp: +2290196809106, email: empiredonko@gmail.com.',
    canal_whatsapp_allemagne:'WhatsApp — Germany', canal_whatsapp_benin:'WhatsApp — Benin', canal_email_benin:'Email — Benin',
    form_nom:'Full name', form_demande:'Your request', form_option1:'Buying a vehicle', form_option2:'Selling / trade-in', form_option3:'Detailing service', form_option4:'Other request',
    form_message:'Message', form_message_placeholder:'Describe what you need…', form_envoyer:'Send on WhatsApp' },
  de:{ nav_accueil:'Start', nav_vehicules:'Fahrzeuge', nav_services:'Dienstleistungen', nav_contact:'Kontakt', nav_installer:'App installieren',
    hero_eyebrow:'Von Benin aus, für automobile Exzellenz', hero_titre:'Der <em>ZAKARI</em>-Anspruch,<br>auf vier Rädern.',
    hero_baseline:'Verkauf von Neu- und Gebrauchtfahrzeugen — Lkw, Pkw und Sonderfahrzeuge — kombiniert mit einer Premium-Detailing-Werkstatt.',
    hero_cta1:'Katalog entdecken', hero_cta2:'Leistungen ansehen', hero_stat1:'Gelistete Fahrzeuge', hero_stat2:'Kontinente an Marken', hero_stat3:'Offline verfügbar',
    onglet_vehicules:'Fahrzeuggalerie', onglet_services:'Service & Detailing',
    domaine1_eyebrow:'Bereich 1', domaine1_titre:'Fahrzeugverkaufsgalerie', domaine1_sous:'Neu und gebraucht — Lkw, Pkw und Sonderfahrzeuge.',
    chip_tous:'Alle', chip_gros:'Lkw', chip_leger:'Pkw', chip_special:'Sonder & Nutzfahrzeuge', chip_toutes_prestations:'Alle Leistungen',
    recherche_placeholder:'Marke oder Modell suchen…',
    domaine2_eyebrow:'Bereich 2', domaine2_titre:'Pflege- & Reinigungsdienste', domaine2_sous:'Präzisions-Detailing für schwere Flotten und Prestigefahrzeuge.',
    materiel_eyebrow:'Profi-Ausrüstung', materiel_titre:'Das ZAKARI-Detailing-Arsenal',
    contact_eyebrow:'Kontakt aufnehmen', contact_titre:'Ein Projekt, ein Fahrzeug, eine Leistung?', contact_sous:'Unsere Teams in Deutschland und Benin antworten direkt auf WhatsApp.',
    pied_desc:'Fahrzeughandel und Premium-Detailing-Werkstatt — absolute Vertraulichkeit, unveränderter Anspruch.', pied_navigation:'Navigation', pied_domaines:'Bereiche', pied_detailing:'Premium Detailing', pied_boutique:'Partner-Shop',
    commande_eyebrow:'Welches Büro möchten Sie kontaktieren?', commande_titre:'Wählen Sie das Büro in Ihrer Nähe', pays_allemagne:'Büro Deutschland', pays_benin:'Büro Benin',
    site_soustitre:'FAHRZEUGE · DETAILING', etat_neuf:'Neu', etat_occasion:'Gebraucht',
    label_origine:'Markenherkunft', label_fabrication:'Herstellungsland', label_etat:'Zustand', label_annee:'Baujahr',
    btn_voir_fiche:'Details ansehen', btn_commander:'Bestellen', btn_reserver:'Buchen', btn_charger_plus:'Weitere Fahrzeuge laden',
    compteur_texte:'{total} Fahrzeug(e) — {visibles} angezeigt',
    filtre_toutes_marques:'Alle Marken', filtre_neuf_occasion:'Neu & Gebraucht', filtre_toutes_origines:'Alle Herkünfte',
    filtre_plus_recents:'Neueste zuerst', filtre_prix_asc:'Preis aufsteigend', filtre_prix_desc:'Preis absteigend',
    fiche_options_titre:'Optionen & Ausstattung', fiche_commander_whatsapp:'Über WhatsApp bestellen',
    service_bienfaits:'Gezielte Vorteile', service_materiel:'Verwendete Profi-Ausrüstung',
    pied_powered_by:'Powered by', pied_boutique_desc:'Offizieller Shop für Skripte, Quellcode und Tools von EMPIRE CODE.', pied_visiter:'Besuchen', pied_droits:'Alle Rechte vorbehalten',
    confidentialite_texte:'Eine Idee für ein maßgeschneidertes Tool, das offline funktioniert, ohne Server, ohne Datenbank, für Ihr Unternehmen und Ihre Vertraulichkeit? Schreiben Sie uns. Über: WhatsApp: +2290196809106, E-Mail: empiredonko@gmail.com.',
    canal_whatsapp_allemagne:'WhatsApp — Deutschland', canal_whatsapp_benin:'WhatsApp — Benin', canal_email_benin:'E-Mail — Benin',
    form_nom:'Vollständiger Name', form_demande:'Ihr Anliegen', form_option1:'Fahrzeugkauf', form_option2:'Verkauf / Inzahlungnahme', form_option3:'Detailing-Leistung', form_option4:'Andere Anfrage',
    form_message:'Nachricht', form_message_placeholder:'Beschreiben Sie Ihr Anliegen…', form_envoyer:'Über WhatsApp senden' },
  es:{ nav_accueil:'Inicio', nav_vehicules:'Vehículos', nav_services:'Servicios', nav_contact:'Contacto', nav_installer:'Instalar app',
    hero_eyebrow:'Desde Benín, hacia la excelencia automotriz', hero_titre:'La exigencia <em>ZAKARI</em>,<br>sobre cuatro ruedas.',
    hero_baseline:'Venta de vehículos nuevos y usados — camiones, turismos y vehículos especiales — junto a un taller de detailing premium.',
    hero_cta1:'Ver el catálogo', hero_cta2:'Ver los servicios', hero_stat1:'Vehículos listados', hero_stat2:'Continentes de marcas', hero_stat3:'Disponible sin conexión',
    onglet_vehicules:'Galería de Vehículos', onglet_services:'Servicios y Detailing',
    domaine1_eyebrow:'Ámbito 1', domaine1_titre:'Galería de venta de vehículos', domaine1_sous:'Nuevos y usados — camiones, turismos y vehículos especiales.',
    chip_tous:'Todos', chip_gros:'Camiones', chip_leger:'Turismos', chip_special:'Especiales y Utilitarios', chip_toutes_prestations:'Todos los servicios',
    recherche_placeholder:'Buscar una marca, un modelo…',
    domaine2_eyebrow:'Ámbito 2', domaine2_titre:'Servicios de limpieza y mantenimiento', domaine2_sous:'Detailing de precisión, para flotas pesadas y vehículos de prestigio.',
    materiel_eyebrow:'Equipamiento profesional', materiel_titre:'El arsenal ZAKARI Detailing',
    contact_eyebrow:'Contáctenos', contact_titre:'¿Un proyecto, un vehículo, un servicio?', contact_sous:'Nuestros equipos en Alemania y Benín responden directamente por WhatsApp.',
    pied_desc:'Comercio de vehículos y taller de detailing premium — confidencialidad total, exigencia intacta.', pied_navigation:'Navegación', pied_domaines:'Ámbitos', pied_detailing:'Detailing Premium', pied_boutique:'Tienda asociada',
    commande_eyebrow:'¿Qué oficina desea contactar?', commande_titre:'Elija la oficina más cercana a usted', pays_allemagne:'Oficina Alemania', pays_benin:'Oficina Benín',
    site_soustitre:'VEHÍCULOS · DETAILING', etat_neuf:'Nuevo', etat_occasion:'Usado',
    label_origine:'Origen de la marca', label_fabrication:'Fabricación', label_etat:'Estado', label_annee:'Año',
    btn_voir_fiche:'Ver ficha', btn_commander:'Pedir', btn_reserver:'Reservar', btn_charger_plus:'Cargar más vehículos',
    compteur_texte:'{total} vehículo(s) — {visibles} mostrado(s)',
    filtre_toutes_marques:'Todas las marcas', filtre_neuf_occasion:'Nuevo y Usado', filtre_toutes_origines:'Todos los orígenes',
    filtre_plus_recents:'Más recientes', filtre_prix_asc:'Precio ascendente', filtre_prix_desc:'Precio descendente',
    fiche_options_titre:'Opciones y equipamiento', fiche_commander_whatsapp:'Pedir por WhatsApp',
    service_bienfaits:'Beneficios específicos', service_materiel:'Equipo profesional utilizado',
    pied_powered_by:'Desarrollado por', pied_boutique_desc:'Tienda oficial de scripts, código fuente y herramientas de EMPIRE CODE.', pied_visiter:'Visitar', pied_droits:'Todos los derechos reservados',
    confidentialite_texte:'¿Una idea de herramienta a medida, que funcione sin conexión, sin servidor, sin base de datos, para su actividad y su confidencialidad? Escríbanos. Por: WhatsApp: +2290196809106, correo: empiredonko@gmail.com.',
    canal_whatsapp_allemagne:'WhatsApp — Alemania', canal_whatsapp_benin:'WhatsApp — Benín', canal_email_benin:'Correo — Benín',
    form_nom:'Nombre completo', form_demande:'Su solicitud', form_option1:'Compra de un vehículo', form_option2:'Venta / recompra', form_option3:'Servicio de detailing', form_option4:'Otra solicitud',
    form_message:'Mensaje', form_message_placeholder:'Describa su necesidad…', form_envoyer:'Enviar por WhatsApp' },
  pt:{ nav_accueil:'Início', nav_vehicules:'Veículos', nav_services:'Serviços', nav_contact:'Contato', nav_installer:'Instalar app',
    hero_eyebrow:'Do Benin, rumo à excelência automóvel', hero_titre:'A exigência <em>ZAKARI</em>,<br>sobre quatro rodas.',
    hero_baseline:'Venda de veículos novos e usados — camiões, ligeiros e veículos especiais — aliada a uma oficina de detailing premium.',
    hero_cta1:'Ver catálogo', hero_cta2:'Ver serviços', hero_stat1:'Veículos listados', hero_stat2:'Continentes de marcas', hero_stat3:'Disponível offline',
    onglet_vehicules:'Galeria de Veículos', onglet_services:'Serviços e Detailing',
    domaine1_eyebrow:'Domínio 1', domaine1_titre:'Galeria de venda de veículos', domaine1_sous:'Novos e usados — camiões, ligeiros e veículos especiais.',
    chip_tous:'Todos', chip_gros:'Camiões', chip_leger:'Ligeiros', chip_special:'Especiais e Utilitários', chip_toutes_prestations:'Todos os serviços',
    recherche_placeholder:'Pesquisar marca ou modelo…',
    domaine2_eyebrow:'Domínio 2', domaine2_titre:'Serviços de limpeza e manutenção', domaine2_sous:'Detailing de precisão, para frotas pesadas e veículos de prestígio.',
    materiel_eyebrow:'Equipamento profissional', materiel_titre:'O arsenal ZAKARI Detailing',
    contact_eyebrow:'Fale connosco', contact_titre:'Um projeto, um veículo, um serviço?', contact_sous:'As nossas equipas na Alemanha e no Benin respondem diretamente no WhatsApp.',
    pied_desc:'Comércio de veículos e oficina de detailing premium — confidencialidade total, exigência intacta.', pied_navigation:'Navegação', pied_domaines:'Domínios', pied_detailing:'Detailing Premium', pied_boutique:'Loja parceira',
    commande_eyebrow:'Qual escritório deseja contactar?', commande_titre:'Escolha o escritório mais próximo de si', pays_allemagne:'Escritório Alemanha', pays_benin:'Escritório Benin',
    site_soustitre:'VEÍCULOS · DETAILING', etat_neuf:'Novo', etat_occasion:'Usado',
    label_origine:'Origem da marca', label_fabrication:'Fabricação', label_etat:'Estado', label_annee:'Ano',
    btn_voir_fiche:'Ver ficha', btn_commander:'Encomendar', btn_reserver:'Reservar', btn_charger_plus:'Carregar mais veículos',
    compteur_texte:'{total} veículo(s) — {visibles} exibido(s)',
    filtre_toutes_marques:'Todas as marcas', filtre_neuf_occasion:'Novo e Usado', filtre_toutes_origines:'Todas as origens',
    filtre_plus_recents:'Mais recentes', filtre_prix_asc:'Preço crescente', filtre_prix_desc:'Preço decrescente',
    fiche_options_titre:'Opções e equipamento', fiche_commander_whatsapp:'Encomendar via WhatsApp',
    service_bienfaits:'Benefícios visados', service_materiel:'Equipamento profissional utilizado',
    pied_powered_by:'Desenvolvido por', pied_boutique_desc:'Loja oficial de scripts, código-fonte e ferramentas da EMPIRE CODE.', pied_visiter:'Visitar', pied_droits:'Todos os direitos reservados',
    confidentialite_texte:'Uma ideia de ferramenta sob medida, funcionando offline, sem servidor, sem base de dados, para a sua atividade e a sua confidencialidade? Escreva-nos. Via: WhatsApp: +2290196809106, e-mail: empiredonko@gmail.com.',
    canal_whatsapp_allemagne:'WhatsApp — Alemanha', canal_whatsapp_benin:'WhatsApp — Benin', canal_email_benin:'E-mail — Benin',
    form_nom:'Nome completo', form_demande:'O seu pedido', form_option1:'Compra de um veículo', form_option2:'Venda / retoma', form_option3:'Serviço de detailing', form_option4:'Outro pedido',
    form_message:'Mensagem', form_message_placeholder:'Descreva a sua necessidade…', form_envoyer:'Enviar via WhatsApp' },
  ru:{ nav_accueil:'Главная', nav_vehicules:'Автомобили', nav_services:'Услуги', nav_contact:'Контакты', nav_installer:'Установить приложение',
    hero_eyebrow:'Из Бенина — к автомобильному совершенству', hero_titre:'Стандарт <em>ZAKARI</em><br>на четырёх колёсах.',
    hero_baseline:'Продажа новых и подержанных автомобилей — грузовики, легковые и спецтехника — вместе с премиальной студией детейлинга.',
    hero_cta1:'Открыть каталог', hero_cta2:'Смотреть услуги', hero_stat1:'Автомобилей в каталоге', hero_stat2:'Континента брендов', hero_stat3:'Доступно офлайн',
    onglet_vehicules:'Галерея автомобилей', onglet_services:'Услуги и детейлинг',
    domaine1_eyebrow:'Раздел 1', domaine1_titre:'Галерея продажи автомобилей', domaine1_sous:'Новые и с пробегом — грузовики, легковые и спецтехника.',
    chip_tous:'Все', chip_gros:'Грузовики', chip_leger:'Легковые', chip_special:'Спецтехника', chip_toutes_prestations:'Все услуги',
    recherche_placeholder:'Поиск марки или модели…',
    domaine2_eyebrow:'Раздел 2', domaine2_titre:'Услуги по чистке и обслуживанию', domaine2_sous:'Точный детейлинг для тяжёлого автопарка и премиальных авто.',
    materiel_eyebrow:'Профессиональное оборудование', materiel_titre:'Арсенал ZAKARI Detailing',
    contact_eyebrow:'Связаться с нами', contact_titre:'Проект, автомобиль или услуга?', contact_sous:'Наши команды в Германии и Бенине отвечают напрямую в WhatsApp.',
    pied_desc:'Торговля автомобилями и премиальная студия детейлинга — полная конфиденциальность, неизменные стандарты.', pied_navigation:'Навигация', pied_domaines:'Разделы', pied_detailing:'Премиальный детейлинг', pied_boutique:'Партнёрский магазин',
    commande_eyebrow:'С каким офисом вы хотите связаться?', commande_titre:'Выберите ближайший к вам офис', pays_allemagne:'Офис в Германии', pays_benin:'Офис в Бенине',
    site_soustitre:'АВТОМОБИЛИ · ДЕТЕЙЛИНГ', etat_neuf:'Новый', etat_occasion:'С пробегом',
    label_origine:'Страна бренда', label_fabrication:'Производство', label_etat:'Состояние', label_annee:'Год',
    btn_voir_fiche:'Подробнее', btn_commander:'Заказать', btn_reserver:'Забронировать', btn_charger_plus:'Показать больше автомобилей',
    compteur_texte:'{total} автомоб. — показано {visibles}',
    filtre_toutes_marques:'Все марки', filtre_neuf_occasion:'Новые и с пробегом', filtre_toutes_origines:'Все страны',
    filtre_plus_recents:'Сначала новые', filtre_prix_asc:'Цена по возрастанию', filtre_prix_desc:'Цена по убыванию',
    fiche_options_titre:'Опции и оснащение', fiche_commander_whatsapp:'Заказать через WhatsApp',
    service_bienfaits:'Целевые преимущества', service_materiel:'Используемое профессиональное оборудование',
    pied_powered_by:'Разработано', pied_boutique_desc:'Официальный магазин скриптов, исходного кода и инструментов от EMPIRE CODE.', pied_visiter:'Перейти', pied_droits:'Все права защищены',
    confidentialite_texte:'Нужен индивидуальный инструмент, работающий офлайн, без сервера, без базы данных, для вашего бизнеса и конфиденциальности? Напишите нам. Через WhatsApp: +2290196809106, email: empiredonko@gmail.com.',
    canal_whatsapp_allemagne:'WhatsApp — Германия', canal_whatsapp_benin:'WhatsApp — Бенин', canal_email_benin:'Email — Бенин',
    form_nom:'Полное имя', form_demande:'Ваш запрос', form_option1:'Покупка автомобиля', form_option2:'Продажа / трейд-ин', form_option3:'Услуга детейлинга', form_option4:'Другой запрос',
    form_message:'Сообщение', form_message_placeholder:'Опишите вашу потребность…', form_envoyer:'Отправить через WhatsApp' },
  zh:{ nav_accueil:'首页', nav_vehicules:'车辆', nav_services:'服务', nav_contact:'联系我们', nav_installer:'安装应用',
    hero_eyebrow:'源自贝宁，追求汽车卓越', hero_titre:'<em>ZAKARI</em> 品质<br>驰骋四轮。',
    hero_baseline:'新车与二手车销售——重型卡车、乘用车与特种车辆——搭配高端汽车美容工坊。',
    hero_cta1:'浏览目录', hero_cta2:'查看服务', hero_stat1:'在售车辆', hero_stat2:'品牌覆盖大洲', hero_stat3:'离线可用',
    onglet_vehicules:'车辆展廊', onglet_services:'服务与美容',
    domaine1_eyebrow:'领域一', domaine1_titre:'车辆销售展廊', domaine1_sous:'新车与二手车——重型卡车、乘用车与特种车辆。',
    chip_tous:'全部', chip_gros:'重型卡车', chip_leger:'乘用车', chip_special:'特种与商用车', chip_toutes_prestations:'全部服务',
    recherche_placeholder:'搜索品牌或型号…',
    domaine2_eyebrow:'领域二', domaine2_titre:'清洁与保养服务', domaine2_sous:'为重型车队与豪华车打造的精细美容服务。',
    materiel_eyebrow:'专业设备', materiel_titre:'ZAKARI 美容装备库',
    contact_eyebrow:'联系我们', contact_titre:'项目、车辆或服务咨询？', contact_sous:'我们在德国和贝宁的团队会直接通过 WhatsApp 回复您。',
    pied_desc:'车辆贸易与高端汽车美容工坊——绝对保密，品质如一。', pied_navigation:'导航', pied_domaines:'业务领域', pied_detailing:'高端美容', pied_boutique:'合作商店',
    commande_eyebrow:'您想联系哪个办事处？', commande_titre:'请选择离您最近的办事处', pays_allemagne:'德国办事处', pays_benin:'贝宁办事处',
    site_soustitre:'车辆 · 美容', etat_neuf:'全新', etat_occasion:'二手',
    label_origine:'品牌产地', label_fabrication:'制造产地', label_etat:'状态', label_annee:'年份',
    btn_voir_fiche:'查看详情', btn_commander:'订购', btn_reserver:'预约', btn_charger_plus:'加载更多车辆',
    compteur_texte:'共 {total} 辆 — 显示 {visibles} 辆',
    filtre_toutes_marques:'所有品牌', filtre_neuf_occasion:'全新与二手', filtre_toutes_origines:'所有产地',
    filtre_plus_recents:'最新优先', filtre_prix_asc:'价格从低到高', filtre_prix_desc:'价格从高到低',
    fiche_options_titre:'选装与配置', fiche_commander_whatsapp:'通过 WhatsApp 订购',
    service_bienfaits:'针对性效益', service_materiel:'使用的专业设备',
    pied_powered_by:'技术支持', pied_boutique_desc:'EMPIRE CODE 官方脚本、源代码与工具商店。', pied_visiter:'访问', pied_droits:'版权所有',
    confidentialite_texte:'需要为您的业务量身定制、离线运行、无需服务器、无需数据库的隐私保护工具？请联系我们。方式：WhatsApp：+2290196809106，邮箱：empiredonko@gmail.com。',
    canal_whatsapp_allemagne:'WhatsApp — 德国', canal_whatsapp_benin:'WhatsApp — 贝宁', canal_email_benin:'邮箱 — 贝宁',
    form_nom:'姓名', form_demande:'您的需求', form_option1:'购买车辆', form_option2:'出售 / 以旧换新', form_option3:'汽车美容服务', form_option4:'其他需求',
    form_message:'留言', form_message_placeholder:'请描述您的需求…', form_envoyer:'通过 WhatsApp 发送' },
  ar:{ nav_accueil:'الرئيسية', nav_vehicules:'المركبات', nav_services:'الخدمات', nav_contact:'اتصل بنا', nav_installer:'تثبيت التطبيق',
    hero_eyebrow:'من بنين نحو التميز في عالم السيارات', hero_titre:'معيار <em>ZAKARI</em><br>على أربع عجلات.',
    hero_baseline:'بيع المركبات الجديدة والمستعملة — الشاحنات الثقيلة والسيارات الخاصة والمعدات الخاصة — إلى جانب ورشة تلميع فاخرة.',
    hero_cta1:'تصفح الكتالوج', hero_cta2:'عرض الخدمات', hero_stat1:'مركبة مدرجة', hero_stat2:'قارات من العلامات التجارية', hero_stat3:'متاح دون اتصال',
    onglet_vehicules:'معرض المركبات', onglet_services:'الخدمات والتلميع',
    domaine1_eyebrow:'المجال الأول', domaine1_titre:'معرض بيع المركبات', domaine1_sous:'جديدة ومستعملة — شاحنات ثقيلة وسيارات ومركبات خاصة.',
    chip_tous:'الكل', chip_gros:'شاحنات ثقيلة', chip_leger:'سيارات خفيفة', chip_special:'خاصة ومركبات المرافق', chip_toutes_prestations:'جميع الخدمات',
    recherche_placeholder:'ابحث عن ماركة أو طراز…',
    domaine2_eyebrow:'المجال الثاني', domaine2_titre:'خدمات التنظيف والصيانة', domaine2_sous:'تلميع دقيق للأساطيل الثقيلة والمركبات الفاخرة.',
    materiel_eyebrow:'معدات احترافية', materiel_titre:'ترسانة ZAKARI للتلميع',
    contact_eyebrow:'تواصل معنا', contact_titre:'مشروع أو مركبة أو خدمة؟', contact_sous:'فرقنا في ألمانيا وبنين تجيب مباشرة عبر واتساب.',
    pied_desc:'تجارة المركبات وورشة تلميع فاخرة — سرية تامة ومعايير لا تتغير.', pied_navigation:'التنقل', pied_domaines:'المجالات', pied_detailing:'تلميع فاخر', pied_boutique:'متجر شريك',
    commande_eyebrow:'ما هو المكتب الذي تريد التواصل معه؟', commande_titre:'اختر المكتب الأقرب إليك', pays_allemagne:'مكتب ألمانيا', pays_benin:'مكتب بنين',
    site_soustitre:'المركبات · التلميع', etat_neuf:'جديد', etat_occasion:'مستعمل',
    label_origine:'بلد العلامة', label_fabrication:'بلد التصنيع', label_etat:'الحالة', label_annee:'السنة',
    btn_voir_fiche:'عرض التفاصيل', btn_commander:'اطلب الآن', btn_reserver:'احجز الآن', btn_charger_plus:'تحميل المزيد من المركبات',
    compteur_texte:'{total} مركبة — يتم عرض {visibles}',
    filtre_toutes_marques:'كل الماركات', filtre_neuf_occasion:'جديد ومستعمل', filtre_toutes_origines:'كل بلدان المنشأ',
    filtre_plus_recents:'الأحدث أولاً', filtre_prix_asc:'السعر تصاعديًا', filtre_prix_desc:'السعر تنازليًا',
    fiche_options_titre:'الخيارات والتجهيزات', fiche_commander_whatsapp:'اطلب عبر واتساب',
    service_bienfaits:'الفوائد المستهدفة', service_materiel:'المعدات الاحترافية المستخدمة',
    pied_powered_by:'مدعوم من', pied_boutique_desc:'المتجر الرسمي للسكربتات والأكواد المصدرية والأدوات من EMPIRE CODE.', pied_visiter:'زيارة', pied_droits:'جميع الحقوق محفوظة',
    confidentialite_texte:'فكرة أداة مخصصة تعمل دون اتصال، دون خادم، دون قاعدة بيانات، لنشاطك وسريتك؟ راسلنا. عبر واتساب: +2290196809106، البريد الإلكتروني: empiredonko@gmail.com.',
    canal_whatsapp_allemagne:'واتساب — ألمانيا', canal_whatsapp_benin:'واتساب — بنين', canal_email_benin:'البريد الإلكتروني — بنين',
    form_nom:'الاسم الكامل', form_demande:'طلبك', form_option1:'شراء مركبة', form_option2:'بيع / استبدال', form_option3:'خدمة تلميع', form_option4:'طلب آخر',
    form_message:'الرسالة', form_message_placeholder:'صف احتياجك…', form_envoyer:'إرسال عبر واتساب' }
};

function t(cle){
  const dict = TRADUCTIONS[langueActuelle] || TRADUCTIONS.fr;
  return dict[cle] !== undefined ? dict[cle] : (TRADUCTIONS.fr[cle] || cle);
}

let langueActuelle = chargerDepuisStockage(CONFIG.CLES_STOCKAGE.langue, 'fr');
if(typeof langueActuelle !== 'string') langueActuelle = 'fr';

function peuplerSelecteurLangue(){
  const panneau = document.getElementById('panneauLangue');
  panneau.innerHTML = LANGUES.map(l=>`
    <button class="option-deroulant ${l.code===langueActuelle?'actif':''}" data-langue="${l.code}" role="option">
      <span class="drapeau">${l.drapeau}</span><span>${l.nom}</span>
    </button>`).join('');
  const lActuelle = LANGUES.find(l=>l.code===langueActuelle) || LANGUES[0];
  document.getElementById('drapeauActuel').textContent = lActuelle.drapeau;
  document.getElementById('codeLangueActuel').textContent = lActuelle.code.toUpperCase();
}
function appliquerLangue(code){
  langueActuelle = code;
  sauvegarderStockage(CONFIG.CLES_STOCKAGE.langue, code);
  const dict = TRADUCTIONS[code] || TRADUCTIONS.fr;
  document.documentElement.lang = code;
  document.documentElement.dir = code==='ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const cle = el.dataset.i18n;
    if(dict[cle]) el.textContent = dict[cle];
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el=>{
    const cle = el.dataset.i18nHtml;
    if(dict[cle]) el.innerHTML = dict[cle];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{
    const cle = el.dataset.i18nPlaceholder;
    if(dict[cle]) el.setAttribute('placeholder', dict[cle]);
  });
  peuplerSelecteurLangue();
  // Recalcule tout le contenu généré dynamiquement (cartes, filtres, compteurs, formulaires)
  if(typeof rafraichirTout === 'function') rafraichirTout();
  if(typeof peupleSelecteurs === 'function') peupleSelecteurs();
}
document.getElementById('panneauLangue').addEventListener('click', e=>{
  const btn = e.target.closest('[data-langue]'); if(!btn) return;
  appliquerLangue(btn.dataset.langue);
  basculerPanneau('panneauLangue', false);
});

/* --------------------------------------------------------------------
   20. BASCULE DE THÈME CLAIR / SOMBRE
   -------------------------------------------------------------------- */
let themeActuel = chargerDepuisStockage(CONFIG.CLES_STOCKAGE.theme, 'sombre');
if(typeof themeActuel !== 'string') themeActuel = 'sombre';
function appliquerTheme(theme){
  themeActuel = theme;
  document.documentElement.setAttribute('data-theme', theme==='clair' ? 'clair' : 'sombre');
  sauvegarderStockage(CONFIG.CLES_STOCKAGE.theme, theme);
}
document.getElementById('btnTheme').addEventListener('click', ()=>{
  appliquerTheme(themeActuel==='clair' ? 'sombre' : 'clair');
});

/* --------------------------------------------------------------------
   21. TUNNEL DE COMMANDE WHATSAPP GÉOGRAPHIQUE
   Au clic sur "Commander" / "Réserver", l'utilisateur choisit son pays
   avant l'ouverture de WhatsApp avec un message pré-rempli (nom + prix).
   -------------------------------------------------------------------- */
let elementEnCommande = null;
function ouvrirTunnelCommande(nom, prixEUR){
  elementEnCommande = { nom, prixEUR };
  document.getElementById('recapCommande').innerHTML = `<b>${nom}</b><br>${formaterPrix(prixEUR)}`;
  ouvrirModale('modaleCommande');
}
document.querySelectorAll('.option-pays').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if(!elementEnCommande) return;
    const numero = btn.dataset.numero;
    const texte = encodeURIComponent(`Bonjour ZAKARI GRUPPE, je suis intéressé(e) par : ${elementEnCommande.nom} — ${formaterPrix(elementEnCommande.prixEUR)}.`);
    window.open(`https://wa.me/${numero}?text=${texte}`, '_blank');
    fermerModale('modaleCommande');
  });
});
// Délégation globale : tout élément marqué data-commander déclenche le tunnel géographique
document.addEventListener('click', e=>{
  const btn = e.target.closest('[data-commander]'); if(!btn) return;
  e.preventDefault();
  ouvrirTunnelCommande(btn.dataset.nomProduit, Number(btn.dataset.prixProduit));
});

/* --------------------------------------------------------------------
   17. INITIALISATION
   -------------------------------------------------------------------- */
document.getElementById('anneeCourante').textContent = new Date().getFullYear();
appliquerTheme(themeActuel);
peuplerSelecteurDevise();
appliquerLangue(langueActuelle);
majEtatReseau();
rafraichirTout();
synchroniserDepuisGoogleSheets();
