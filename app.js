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
  CLES_STOCKAGE: { vehicules: 'zakari_vehicules', services: 'zakari_services', session: 'zakari_session_pro' },
  TAILLE_PAGE: 9
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
    paysOrigine, paysFabrication, options, image: genererPlaceholder(categorie, marque, modele)
  };
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
  v('Komatsu','PC210 Pelle','special','Occasion',142000,2021,'Diesel 4 cyl. 165ch','Hydrostatique','Japon','Japon',['Cabine climatisée','Système anti-vol GPS'])
];

/* --------------------------------------------------------------------
   3. DONNÉES INITIALES — SERVICES DE DETAILING
   -------------------------------------------------------------------- */
function s(titre, categorie, icone, description, materiel, tarifMin, unite){
  return { id: 'srv-' + (compteurId++), titre, categorie, icone, description, materiel, tarifMin, unite };
}
const SERVICES_INITIAUX = [
  s('Nettoyage Haute Pression Châssis & Moteur','gros-porteur','ic-camion',
    "Décapage haute pression (250 à 300 bars) du châssis, des essieux et du compartiment moteur pour éliminer boue, graisse et résidus routiers en profondeur.",
    ['Nettoyeur thermique 300 bars','Décontaminant ferreux','Dégraissant alcalin professionnel'], 180,'/ véhicule'),
  s('Dégraissage Lourd & Décontamination','gros-porteur','ic-spray',
    "Traitement dégraissant spécifique pour bennes, plateaux et zones de charge exposées aux hydrocarbures, avec décontamination ferreuse complète.",
    ['Canon à mousse industriel','Décontaminant ferreux','Brosses longue portée'], 220,'/ véhicule'),
  s("Valorisation d'Image de Flotte","gros-porteur","ic-polish",
    "Programme d'entretien régulier qui préserve la carrosserie, prolonge la longévité mécanique et renforce l'image de marque de votre flotte auprès de vos clients.",
    ['Cire de protection carrosserie poids lourd','Microfibres High GSM >800g/m²','Aspirateur industriel eau/poussière'], 260,'/ véhicule / mois'),
  s('Nettoyage Intérieur Injection-Extraction','poids-leger','ic-spray',
    "Shampouinage en profondeur des sièges, moquettes et tissus par injecteur/extracteur professionnel, pour un habitacle assaini et comme neuf.",
    ['Injecteur/extracteur professionnel','Shampoing hydrophobe','Aspirateur industriel eau/poussière'], 65,'/ véhicule'),
  s('Traitement Tornador — Précision Habitacle','poids-leger','ic-spray',
    "Nettoyage à air comprimé des aérations, contre-portes, coutures et recoins inaccessibles, pour un habitacle traité dans les moindres détails.",
    ['Pistolet Tornador pneumatique','Brosses microfibres souples','Produit multi-surfaces dégraissant'], 45,'/ véhicule'),
  s('Correction de Carrosserie & Polissage','poids-leger','ic-polish',
    "Correction machine à la polisseuse rotative et orbitale pour effacer les micro-rayures et hologrammes, et restituer une brillance miroir.",
    ['Polisseuse rotative & orbitale','Pads de polissage multi-grains','Pâtes abrasives professionnelles'], 150,'/ véhicule'),
  s('Protection Cire & Céramique','poids-leger','ic-polish',
    "Application d'une protection cire premium ou d'un revêtement céramique longue durée, pour un effet hydrophobe et une brillance prolongée.",
    ['Cire carnauba premium','Revêtement céramique 9H','Microfibres High GSM >800g/m²'], 190,'/ véhicule'),
  s('Traitement Ozone Anti-Odeurs','poids-leger','ic-ozone',
    "Diffusion d'ozone anti-bactérien qui neutralise les odeurs tenaces (tabac, animaux, humidité) et assainit l'ensemble de l'habitacle.",
    ['Générateur d\'ozone professionnel','Désinfectant antibactérien habitacle'], 55,'/ véhicule'),
  s('Nettoyage Jantes & Brosses Délicates','poids-leger','ic-polish',
    "Décontamination des jantes avec des brosses délicates spécifiques pour ne pas endommager les finitions, associée à un décontaminant ferreux.",
    ['Brosses jantes délicates','Décontaminant ferreux','Canon à mousse'], 35,'/ véhicule')
];

const MATERIEL_PRO = [
  { nom:'Nettoyeurs thermiques', detail:'Pression 150 à 300 bars, eau chaude' },
  { nom:'Aspirateurs industriels', detail:'Fonction eau et poussière combinée' },
  { nom:'Canons à mousse', detail:'Prélavage sans contact haute adhérence' },
  { nom:'Brosses jantes délicates', detail:'Fibres douces anti-rayures' },
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

function formaterPrix(prix){
  return new Intl.NumberFormat('fr-FR').format(prix) + ' €';
}

function peupleSelecteurs(){
  const marques = [...new Set(vehicules.map(v=>v.marque))].sort();
  const origines = [...new Set(vehicules.map(v=>v.paysOrigine))].sort();
  const selMarque = document.getElementById('filtreMarque');
  const selOrigine = document.getElementById('filtreOrigine');
  selMarque.innerHTML = '<option value="tous">Toutes les marques</option>' + marques.map(m=>`<option value="${m}">${m}</option>`).join('');
  selOrigine.innerHTML = '<option value="tous">Toutes origines</option>' + origines.map(o=>`<option value="${o}">${o}</option>`).join('');
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
  return `
  <article class="carte-vehicule" data-id="${v.id}">
    <div class="image-vehicule">
      <img src="${v.image}" alt="${v.marque} ${v.modele}" loading="lazy">
      <span class="badge-etat ${v.etat==='Neuf'?'neuf':'occasion'}">${v.etat}</span>
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
        <span>Origine marque : <b>${v.paysOrigine}</b></span>
        <span>Fabrication : <b>${v.paysFabrication}</b></span>
      </div>
      <div class="options-carte">${v.options.slice(0,3).map(o=>`<span class="tag-option">${o}</span>`).join('')}${v.options.length>3?`<span class="tag-option">+${v.options.length-3}</span>`:''}</div>
      <div class="pied-carte">
        <button class="btn btn-fantome" data-voir="${v.id}">Voir la fiche</button>
        <a class="btn btn-or" href="https://wa.me/2290196809106?text=${encodeURIComponent('Bonjour ZAKARI GRUPPE, je suis intéressé(e) par le véhicule : '+v.marque+' '+v.modele+' ('+v.annee+') à '+formaterPrix(v.prix)+'.')}" target="_blank" rel="noopener">Commander</a>
      </div>
    </div>
  </article>`;
}

function rendreVehicules(){
  const liste = vehiculesFiltres();
  const grille = document.getElementById('grilleVehicules');
  const compteur = document.getElementById('compteurVehicules');
  const visibles = liste.slice(0, vehiculesAffiches);
  compteur.textContent = `${liste.length} véhicule${liste.length>1?'s':''} — ${visibles.length} affiché${visibles.length>1?'s':''}`;
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
  return `
  <article class="carte-service">
    <span class="icone-service"><svg viewBox="0 0 24 24" fill="none"><use href="#${s.icone}"/></svg></span>
    <h3>${s.titre}</h3>
    <p>${s.description}</p>
    <div class="liste-materiel">${s.materiel.map(m=>`<span>${m}</span>`).join('')}</div>
    <div class="tarif-service">
      <span class="montant">${formaterPrix(s.tarifMin)}<sup>${s.unite}</sup></span>
      <a class="btn btn-or btn-petit" href="https://wa.me/2290196809106?text=${encodeURIComponent('Bonjour ZAKARI GRUPPE, je souhaite réserver la prestation : '+s.titre+'.')}" target="_blank" rel="noopener">Réserver</a>
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
  document.getElementById('contenuFiche').innerHTML = `
    <img src="${v.image}" alt="${v.marque} ${v.modele}" style="width:100%;aspect-ratio:16/9;object-fit:cover;margin-bottom:1.4rem">
    <p class="eyebrow">${v.marque} — ${NOMS_CATEGORIES[v.categorie]}</p>
    <h3 style="font-size:1.9rem;margin-bottom:.6rem">${v.modele}</h3>
    <p style="color:var(--or-clair);font-family:var(--f-display);font-size:1.6rem;margin-bottom:1.2rem">${formaterPrix(v.prix)}</p>
    <div class="meta-carte" style="margin-bottom:1.2rem">
      <span>État : ${v.etat}</span><span>Année : ${v.annee}</span><span>${v.moteur}</span><span>${v.transmission}</span>
    </div>
    <div class="pays-carte" style="margin-bottom:1.2rem">
      <span>Origine de la marque : <b>${v.paysOrigine}</b></span>
      <span>Fabrication du modèle : <b>${v.paysFabrication}</b></span>
    </div>
    <p class="eyebrow">Options &amp; équipements</p>
    <div class="options-carte" style="margin-bottom:1.6rem">${v.options.map(o=>`<span class="tag-option">${o}</span>`).join('')}</div>
    <a class="btn btn-or" style="width:100%" target="_blank" rel="noopener" href="https://wa.me/2290196809106?text=${encodeURIComponent('Bonjour ZAKARI GRUPPE, je suis intéressé(e) par : '+v.marque+' '+v.modele+' ('+v.annee+') — '+formaterPrix(v.prix)+'.')}">Commander sur WhatsApp</a>
  `;
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

function ouvrirFormulaireEdition(type, element){
  const form = document.getElementById('formulaireEdition');
  document.getElementById('titreModaleEdition').textContent =
    (element ? 'Modifier' : 'Ajouter') + (type==='vehicule' ? ' un véhicule' : ' une prestation');

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
        <div class="champ"><label>Prix (€)</label><input type="number" name="prix" required value="${v.prix||''}"></div>
        <div class="champ"><label>Année</label><input type="number" name="annee" required value="${v.annee||new Date().getFullYear()}"></div>
        <div class="champ"><label>Motorisation</label><input name="moteur" value="${v.moteur||''}"></div>
        <div class="champ"><label>Transmission</label><input name="transmission" value="${v.transmission||''}"></div>
        <div class="champ"><label>Pays d'origine (marque)</label><input name="paysOrigine" value="${v.paysOrigine||''}"></div>
        <div class="champ"><label>Pays de fabrication</label><input name="paysFabrication" value="${v.paysFabrication||''}"></div>
      </div>
      <div class="champ"><label>Options (séparées par des virgules)</label><textarea name="options">${(v.options||[]).join(', ')}</textarea></div>
      <div class="champ"><label>URL Photo (laisser vide pour visuel provisoire)</label><input name="image" value="${v.image&&!v.image.startsWith('data:')?v.image:''}" placeholder="https://…"></div>
      <button type="submit" class="btn btn-or" style="width:100%">${element?'Enregistrer les modifications':'Ajouter au catalogue'}</button>
    `;
    form.onsubmit = (e)=>{
      e.preventDefault();
      const fd = new FormData(form);
      const donnees = Object.fromEntries(fd.entries());
      donnees.prix = Number(donnees.prix); donnees.annee = Number(donnees.annee);
      donnees.options = donnees.options.split(',').map(o=>o.trim()).filter(Boolean);
      donnees.image = donnees.image || genererPlaceholder(donnees.categorie, donnees.marque, donnees.modele);
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
        <div class="champ"><label>Tarif à partir de (€)</label><input type="number" name="tarifMin" required value="${s.tarifMin||''}"></div>
        <div class="champ" style="grid-column:1/-1"><label>Unité (ex : / véhicule)</label><input name="unite" value="${s.unite||'/ véhicule'}"></div>
      </div>
      <div class="champ"><label>Description</label><textarea name="description" required>${s.description||''}</textarea></div>
      <div class="champ"><label>Matériel utilisé (séparé par des virgules)</label><textarea name="materiel">${(s.materiel||[]).join(', ')}</textarea></div>
      <button type="submit" class="btn btn-or" style="width:100%">${element?'Enregistrer les modifications':'Ajouter la prestation'}</button>
    `;
    form.onsubmit = (e)=>{
      e.preventDefault();
      const fd = new FormData(form);
      const donnees = Object.fromEntries(fd.entries());
      donnees.tarifMin = Number(donnees.tarifMin);
      donnees.materiel = donnees.materiel.split(',').map(m=>m.trim()).filter(Boolean);
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
   17. INITIALISATION
   -------------------------------------------------------------------- */
document.getElementById('anneeCourante').textContent = new Date().getFullYear();
majEtatReseau();
rafraichirTout();
synchroniserDepuisGoogleSheets();
