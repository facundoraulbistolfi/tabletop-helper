import { useState, useEffect, useCallback, useMemo, useRef } from “react”;

// ═══════════════════════════════════════════
// SEEDED RANDOM
// ═══════════════════════════════════════════
function mulberry32(a) {
return function () {
a |= 0; a = (a + 0x6d2b79f5) | 0;
let t = Math.imul(a ^ (a >>> 15), 1 | a);
t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
}

// ═══════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════
const MAP_SIZE = 19;
const ORIGIN = 9;

const SHIPS = [
{ id: “sloop”,      name: “Sloop”,          desc: “Ligero y rápido. Poca carga, mucha agilidad.”,  hull: 28, supplies: 22, ammo: 8,  gold: 10, cannons: 4, armor: 0, speed: 3, maxSupplies: 30, maxAmmo: 12, cost: 0 },
{ id: “brigantine”, name: “Bergantín”,      desc: “Equilibrado. El barco del capitán prudente.”,   hull: 42, supplies: 28, ammo: 12, gold: 5,  cannons: 6, armor: 1, speed: 2, maxSupplies: 38, maxAmmo: 16, cost: 3 },
{ id: “galleon”,    name: “Galeón”,         desc: “Fortaleza flotante. Lento pero letal.”,         hull: 62, supplies: 34, ammo: 16, gold: 0,  cannons: 9, armor: 3, speed: 1, maxSupplies: 48, maxAmmo: 24, cost: 6 },
{ id: “ghost”,      name: “Navío Fantasma”, desc: “No debería existir. Frágil pero temible.”,      hull: 24, supplies: 20, ammo: 20, gold: 20, cannons: 8, armor: 0, speed: 4, maxSupplies: 28, maxAmmo: 28, cost: 10 },
];

const TILE = {
water:     { icon: “”,    label: “Mar Abierto”,        color: “#1e3a5a”, accent: “#2a5278” },
home_port: { icon: “⚓”,   label: “Puerto de Origen”,   color: “#4a7a4a”, accent: “#c9a84c” },
port:      { icon: “🏘”,   label: “Puerto”,             color: “#3a6a4a”, accent: “#8bc96a” },
island:    { icon: “🏝”,   label: “Isla”,               color: “#6b8e4e”, accent: “#a8c878” },
reef:      { icon: “🪸”,   label: “Arrecife”,           color: “#3a6a5a”, accent: “#5a9a7a” },
storm:     { icon: “⛈”,   label: “Tormenta”,           color: “#2a2a4a”, accent: “#6a6a8a” },
pirates:   { icon: “🏴‍☠️”, label: “Navío Pirata”,      color: “#5a2a2a”, accent: “#c94a4a” },
monster:   { icon: “🐙”,   label: “Criatura Marina”,    color: “#4a1a3a”, accent: “#a04a7a” },
merchant:  { icon: “🤝”,   label: “Mercader”,           color: “#5a4a2a”, accent: “#c9a84c” },
ruins:     { icon: “🏚”,   label: “Ruinas Sumergidas”,  color: “#3a2a4a”, accent: “#8a6aaa” },
mystery:   { icon: “❓”,   label: “Anomalía”,           color: “#2a3a5a”, accent: “#6a8aaa” },
ghost_ship:{ icon: “👻”,   label: “Navío Fantasma”,     color: “#2a2a3a”, accent: “#8a8aaa” },
leviathan: { icon: “💀”,   label: “El Leviatán”,        color: “#5a1a1a”, accent: “#e84a4a” },
};

const RELICS = [
{ id: “compass”,   name: “Brújula Maldita”,            desc: “+2 velocidad, -5 moral”,          mods: { speed: 2, morale: -5 } },
{ id: “anchor”,    name: “Ancla de Hierro Negro”,      desc: “+2 armadura, -1 velocidad”,       mods: { armor: 2, speed: -1 } },
{ id: “skull”,     name: “Cráneo del Capitán Rojo”,    desc: “+3 daño de cañones”,              mods: { cannons: 3 } },
{ id: “chalice”,   name: “Cáliz del Maelstrom”,        desc: “+1 casco cada 2 turnos”,          healPerTurn: true },
{ id: “flag”,      name: “Bandera Negra”,              desc: “Los piratas ofrecen tregua 50%”,  pirateTruce: true },
{ id: “pearl”,     name: “Perla Abisal”,               desc: “+15 moral máximo e inicial”,      mods: { morale: 15, maxMorale: 15 } },
{ id: “lantern”,   name: “Farol de las Profundidades”, desc: “Radio de visión +1”,              revealBoost: true },
{ id: “krakenEye”, name: “Ojo del Kraken”,             desc: “+4 daño contra el Leviatán”,      bossDmg: 4 },
{ id: “sextant”,   name: “Sextante Estelar”,           desc: “Cada 3 turnos no cuesta víveres”, discountMove: true },
];

const PERKS = [
{ id: “seasoned”,   name: “Tripulación Curtida”, desc: “+10 moral inicial”,            effect: { morale: 10 } },
{ id: “stocked”,    name: “Bodega Llena”,        desc: “+8 suministros iniciales”,     effect: { supplies: 8 } },
{ id: “armed”,      name: “Arsenal Extra”,       desc: “+6 munición inicial”,          effect: { ammo: 6 } },
{ id: “wealthy”,    name: “Mecenas Anónimo”,     desc: “+15 oro inicial”,              effect: { gold: 15 } },
{ id: “reinforced”, name: “Casco Reforzado”,     desc: “+10 casco máximo e inicial”,   effect: { hull: 10, maxHull: 10 } },
];

const ENEMIES = {
pirates:    [{ name: “Corsario”,         base: { hull: 18, atk: 5,  def: 1, spd: 2 } },
{ name: “Bucanero”,         base: { hull: 26, atk: 7,  def: 2, spd: 2 } },
{ name: “Capitán Pirata”,   base: { hull: 36, atk: 9,  def: 3, spd: 3 } }],
monster:    [{ name: “Serpiente Marina”, base: { hull: 28, atk: 8,  def: 2, spd: 3 } },
{ name: “Kraken Joven”,     base: { hull: 42, atk: 10, def: 3, spd: 1 } },
{ name: “Bestia Abisal”,    base: { hull: 54, atk: 12, def: 4, spd: 2 } }],
ghost_ship: [{ name: “Navío Maldito”,    base: { hull: 38, atk: 8,  def: 5, spd: 2 } }],
leviathan:  [{ name: “El Leviatán”,      base: { hull: 95, atk: 14, def: 5, spd: 2 } }],
};

// ═══════════════════════════════════════════
// MAP GENERATION
// ═══════════════════════════════════════════
function tileDist(x, y) {
return Math.max(Math.abs(x - ORIGIN), Math.abs(y - ORIGIN));
}

function rollContent(dist, rng) {
if (dist <= 1) return null;
const contentChance = Math.min(0.55, 0.18 + dist * 0.05);
if (rng() > contentChance) return null;

let pool;
if (dist <= 3) {
pool = [[“island”, 4], [“reef”, 2], [“mystery”, 1], [“merchant”, 2], [“pirates”, 1], [“storm”, 1]];
} else if (dist <= 5) {
pool = [[“island”, 2], [“reef”, 2], [“mystery”, 2], [“merchant”, 1], [“pirates”, 3], [“ruins”, 2], [“storm”, 2], [“port”, 1], [“monster”, 1]];
} else {
pool = [[“reef”, 2], [“mystery”, 2], [“pirates”, 2], [“ruins”, 3], [“storm”, 2], [“monster”, 3], [“ghost_ship”, 2], [“island”, 1]];
}
const total = pool.reduce((s, [, w]) => s + w, 0);
let r = rng() * total;
for (const [type, w] of pool) { r -= w; if (r <= 0) return type; }
return pool[0][0];
}

function generateGridMap(seed) {
const rng = mulberry32(seed);
const tiles = [];
for (let y = 0; y < MAP_SIZE; y++) {
tiles.push([]);
for (let x = 0; x < MAP_SIZE; x++) {
const d = tileDist(x, y);
let type;
if (x === ORIGIN && y === ORIGIN) type = “home_port”;
else type = rollContent(d, rng) || “water”;
tiles[y].push({ x, y, type, dist: d });
}
}

// Ensure at least 1 trading port in mid zone
let hasPort = false;
for (let y = 0; y < MAP_SIZE && !hasPort; y++) for (let x = 0; x < MAP_SIZE && !hasPort; x++)
if (tiles[y][x].type === “port”) hasPort = true;
if (!hasPort) {
for (let tries = 0; tries < 50; tries++) {
const x = Math.floor(rng() * MAP_SIZE), y = Math.floor(rng() * MAP_SIZE);
const d = tileDist(x, y);
if (d >= 3 && d <= 5) { tiles[y][x].type = “port”; break; }
}
}

// Place the Leviathan at a far tile
const far = [];
for (let y = 0; y < MAP_SIZE; y++) for (let x = 0; x < MAP_SIZE; x++) {
if (tileDist(x, y) >= 7 && tiles[y][x].type !== “home_port”) far.push([x, y]);
}
if (far.length > 0) {
const [lx, ly] = far[Math.floor(rng() * far.length)];
tiles[ly][lx].type = “leviathan”;
}

return { tiles };
}

// ═══════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════
const WATER_EVENTS = [
{ title: “Aguas Calmas”,        text: “El mar se extiende quieto bajo un sol plateado.”,                   effect: { morale: 2 } },
{ title: “Banco de Peces”,      text: “Un cardumen brillante cruza bajo el casco. Pesca fácil.”,           effect: { supplies: 3 } },
{ title: “Delfines”,            text: “Un grupo de delfines escolta al barco. Buen presagio.”,             effect: { morale: 3 } },
{ title: “Viento Favorable”,    text: “Las velas se hinchan sin esfuerzo.”,                                effect: { supplies: 1 } },
{ title: “Niebla Densa”,        text: “Una niebla imposible los rodea. Pierden horas buscando el rumbo.”,  effect: { supplies: -2, morale: -1 } },
{ title: “Calma Chicha”,        text: “Ni una brisa. La tripulación murmura.”,                             effect: { morale: -3, supplies: -1 } },
{ title: “Luces Submarinas”,    text: “Luces se mueven bajo el barco toda la noche. Nadie duerme.”,        effect: { morale: -3 } },
{ title: “Botella a la Deriva”, text: “Recuperan una botella con un mapa rasgado. Puede valer algo.”,      effect: { gold: 4 } },
{ title: “Restos Flotantes”,    text: “Recogen tablones y sogas de un naufragio antiguo.”,                 effect: { supplies: 2 } },
{ title: “Canto de Sirenas”,    text: “Un canto hipnótico llega con el viento. Dos tripulantes se lanzan al agua.”, effect: { morale: -6, gold: 6 } },
];

function genTileEvent(type, dist, rng) {
const diff = 1 + dist * 0.25;
switch (type) {
case “island”:
return rng() > 0.5
? { title: “Isla Selvática”, text: “Una isla cubierta de vegetación espesa. Se oyen animales entre los árboles.”, choices: [
{ label: “Explorar el interior”,   text: “Enviar un grupo a buscar suministros.”,     effect: { supplies: 6 }, risk: { morale: -8, chance: 0.25, text: “Emboscada. Pierden tripulantes.” } },
{ label: “Recolectar en la costa”, text: “Seguro pero modesto.”,                       effect: { supplies: 3 } },
{ label: “Zarpar sin desembarcar”, text: “No perder tiempo.”,                          effect: {} },
]}
: { title: “Isla Volcánica”, text: “Humo se eleva desde el centro. El aire huele a azufre.”, choices: [
{ label: “Minar el cráter”,      text: “Riquezas bajo la lava.”,                       effect: { gold: 14 }, risk: { hull: Math.floor(-10 * diff), chance: 0.35 } },
{ label: “Llenar cantimploras”,  text: “Hay un manantial dulce.”,                      effect: { supplies: 5, morale: 3 } },
{ label: “Irse”,                 text: “”,                                             effect: {} },
]};
case “reef”:
return { title: “Arrecife Traicionero”, text: “Rocas afiladas asoman bajo el agua oscura.”, choices: [
{ label: “Navegar con cuidado”, text: “Lento pero seguro.”,                                 effect: { supplies: -3 } },
{ label: “Forzar el paso”,      text: “Confiar en la velocidad.”,                           effect: {}, risk: { hull: Math.floor(-12 * diff), chance: 0.45, text: “¡El arrecife desgarra el casco!” } },
{ label: “Buscar perlas”,       text: “Corales con perlas. Si es que las hay.”,             effect: { gold: 8 }, risk: { hull: -6, chance: 0.3 } },
]};
case “storm”:
return { title: “Tormenta”, text: “Nubes negras devoran el horizonte. El viento aúlla.”, choices: [
{ label: “Atravesar el ojo”,    text: “Directo al caos.”,                                    effect: { morale: 4 }, risk: { hull: Math.floor(-10 * diff), chance: 0.6, text: “La tormenta azota el casco.” } },
{ label: “Rodear con cuidado”,  text: “Más seguro pero costoso.”,                            effect: { supplies: Math.floor(-4 * diff) } },
{ label: “Anclar y esperar”,    text: “Perder tiempo pero proteger el barco.”,               effect: { supplies: -2, morale: -3 } },
]};
case “ruins”:
return rng() > 0.4
? { title: “Ruinas Sumergidas”, text: “Columnas de piedra emergen del agua. Algo brilla en las profundidades.”, choices: [
{ label: “Bucear a las profundidades”, text: “Enviar buceadores.”,                          effect: { gold: 10, relic: true },  risk: { morale: -10, hull: -5, chance: 0.3, text: “Algo acechaba en las ruinas…” } },
{ label: “Saquear en superficie”,      text: “Solo lo fácil.”,                              effect: { gold: 5 } },
{ label: “Rezar y seguir”,             text: “Algunas cosas no se tocan.”,                  effect: { morale: 3 } },
]}
: { title: “Templo Hundido”, text: “Un templo a medio hundir. Cantos guturales desde adentro.”, choices: [
{ label: “Entrar al santuario”, text: “La curiosidad puede ser recompensada.”,              effect: { relic: true }, risk: { morale: -15, chance: 0.4, text: “La reliquia está maldita.” } },
{ label: “Ofrecer oro”,         text: “Una ofrenda por si acaso.”,                          effect: { gold: -5, morale: 5 }, requires: { gold: 5 } },
{ label: “Retirarse”,           text: “”,                                                   effect: {} },
]};
case “mystery”: {
const myst = [
{ title: “Niebla Viva”,      text: “Una niebla imposible rodea el barco. Se escuchan voces familiares llamándote.”, choices: [
{ label: “Seguir las voces”, text: “Pueden guiar… o perder.”,     effect: { gold: 16, morale: -5 }, risk: { hull: -10, chance: 0.3 } },
{ label: “Avanzar a ciegas”, text: “Confiar en el instinto.”,       effect: { morale: -3 } },
]},
{ title: “Barco Abandonado”, text: “Un barco a la deriva, intacto. No hay nadie a bordo.”, choices: [
{ label: “Abordarlo”,        text: “Todo es nuestro.”,              effect: { supplies: 6, ammo: 4, gold: 8 }, risk: { morale: -10, chance: 0.3, text: “Algo los sigue desde entonces…” } },
{ label: “Quemarlo”,         text: “No confiar en regalos.”,        effect: { morale: 5 } },
]},
{ title: “Maelstrom”,        text: “Un remolino gigante succiona todo a su alrededor.”, choices: [
{ label: “Lanzarse al centro”, text: “¿Locura o destino?”,          effect: { relic: true, morale: 5 }, risk: { hull: -20, chance: 0.5, text: “El barco apenas sobrevive.” } },
{ label: “Huir a toda vela”,   text: “No vale la pena morir hoy.”,   effect: { supplies: -3 } },
]},
{ title: “Isla de Huesos”,   text: “Una isla hecha completamente de huesos blancos. Nadie habla.”, choices: [
{ label: “Buscar entre los restos”, text: “”,                       effect: { gold: 12, relic: true }, risk: { morale: -12, hull: -8, chance: 0.4, text: “Los huesos empiezan a moverse…” } },
{ label: “Alejarse rápido”,         text: “”,                       effect: { morale: -3 } },
]},
];
return myst[Math.floor(rng() * myst.length)];
}
case “merchant”:
return { title: “Mercader Errante”, text: “Un barco mercader ondea bandera de paz. Tiene mercancía para ofrecer.”, choices: [
{ label: “Comprar suministros (8 oro)”,        text: “+10 suministros”,  effect: { gold: -8, supplies: 10 }, requires: { gold: 8 } },
{ label: “Comprar munición (6 oro)”,           text: “+6 munición”,       effect: { gold: -6, ammo: 6 },      requires: { gold: 6 } },
{ label: “Comprar ron (5 oro)”,                text: “+10 moral”,         effect: { gold: -5, morale: 10 },   requires: { gold: 5 } },
{ label: “Intercambiar por reliquia (15 oro)”, text: “Objeto extraño del mercader”, effect: { gold: -15, relic: true }, requires: { gold: 15 } },
{ label: “Despedirse”,                         text: “”,                 effect: {} },
]};
case “ghost_ship”:
return { title: “Navío Fantasma”, text: “Un barco translúcido se materializa entre la bruma. Sus velas brillan con luz muerta.”, choices: [
{ label: “Enfrentarlo”,          text: “Destruir lo que no debería existir.”,      effect: { combat: “ghost_ship” } },
{ label: “Ofrecer tributo (12)”, text: “Los muertos respetan el oro.”,             effect: { gold: -12, morale: 5, relic: true }, requires: { gold: 12 } },
{ label: “Huir”,                 text: “Rezar y escapar.”,                         effect: { morale: -8, supplies: -3 } },
]};
case “pirates”:
return { title: “Velas Piratas”, text: “Un barco pirata corta las olas hacia ustedes. Izan bandera negra.”, choices: [
{ label: “Preparar los cañones”,    text: “Enfrentarlos de frente.”,                effect: { combat: “pirates” } },
{ label: “Intentar huir”,           text: “No todas las batallas valen la pena.”,   effect: { supplies: -3, morale: -2 } },
{ label: “Pagar tributo (10 oro)”,  text: “A veces el oro compra paso.”,            effect: { gold: -10, morale: -3 }, requires: { gold: 10 }, risk: { combat: “pirates”, chance: 0.3, text: “¡Mentían! Tomaron el oro y atacan igual.” } },
]};
case “monster”:
return { title: “Algo Enorme”, text: “Una sombra masiva se mueve bajo el barco. Olas rompen sin causa.”, choices: [
{ label: “Atacar antes de que suba”, text: “Mejor ofensa que defensa.”,             effect: { combat: “monster” } },
{ label: “Quedarse inmóvil”,         text: “Rezar y esperar.”,                      effect: { morale: -6 }, risk: { combat: “monster”, chance: 0.5 } },
]};
default:
return null;
}
}

function pickRelic(ownedIds, rng) {
const avail = RELICS.filter(r => !ownedIds.includes(r.id));
if (!avail.length) return null;
return avail[Math.floor(rng() * avail.length)];
}

function generateShop(rng, isHome = false) {
const discount = isHome ? 0.7 : 1;
const items = [
{ id: “repair”,    name: “Reparar Casco”,        desc: “Restaurar 18 puntos de casco”,            cost: Math.floor(10 * discount), effect: { hull: 18 } },
{ id: “supplies”,  name: “Provisiones”,          desc: “+12 suministros”,                         cost: Math.floor(8 * discount),  effect: { supplies: 12 } },
{ id: “ammo”,      name: “Munición”,             desc: “+10 munición”,                            cost: Math.floor(8 * discount),  effect: { ammo: 10 } },
{ id: “crew”,      name: “Reclutar Tripulación”, desc: “+18 moral”,                               cost: Math.floor(12 * discount), effect: { morale: 18 } },
{ id: “cannon”,    name: “Mejorar Cañones”,      desc: “+2 daño permanente”,                      cost: Math.floor(18 * discount), effect: { cannons: 2 } },
{ id: “hull_up”,   name: “Reforzar Casco”,       desc: “+10 casco máximo”,                        cost: Math.floor(15 * discount), effect: { maxHull: 10 } },
{ id: “sails”,     name: “Velas Nuevas”,         desc: “+1 velocidad permanente”,                 cost: Math.floor(22 * discount), effect: { speed: 1 } },
{ id: “hold”,      name: “Ampliar Bodega”,       desc: “+6 capacidad de suministros y munición”,  cost: Math.floor(14 * discount), effect: { maxSupplies: 6, maxAmmo: 6 } },
{ id: “armor_up”,  name: “Blindaje”,             desc: “+1 armadura permanente”,                  cost: Math.floor(16 * discount), effect: { armor: 1 } },
];
const count = isHome ? 5 : 4;
return items.sort(() => rng() - 0.5).slice(0, count);
}

// ═══════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════
const COLORS = {
bg: “#0a0e17”, bgDeep: “#060812”,
panel: “#151d2e”, panelBorder: “#2a3548”,
gold: “#c9a84c”, goldDark: “#8b7a3a”,
text: “#c8bfa0”, textDim: “#7a7060”,
danger: “#a83232”, dangerLight: “#e85858”,
safe: “#6ca66c”,
sea: “#1a3a5a”, seaLight: “#2a5278”, seaDeep: “#0f2540”,
fog: “#0a1420”,
};

const S = {
page: { minHeight: “100vh”, background: COLORS.bg, color: COLORS.text, fontFamily: “‘Palatino Linotype’, ‘Book Antiqua’, Palatino, Georgia, serif” },
panel: { background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, borderRadius: 6, padding: “10px 12px” },
btn: { background: “linear-gradient(180deg, #2a3a4a 0%, #1a2a3a 100%)”, border: `1px solid ${COLORS.panelBorder}`, color: COLORS.gold, padding: “8px 14px”, borderRadius: 4, cursor: “pointer”, fontFamily: “inherit”, fontSize: 13, textAlign: “center”, transition: “all 0.15s” },
btnHover: { borderColor: COLORS.gold, filter: “brightness(1.2)” },
btnDisabled: { opacity: 0.4, cursor: “default”, filter: “none” },
btnDanger: { background: “linear-gradient(180deg, #3a2020 0%, #2a1515 100%)”, borderColor: “#5a2020”, color: “#d88” },
title: { color: COLORS.gold, fontWeight: “bold”, fontSize: 16, marginBottom: 6 },
};

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════
function Btn({ onClick, disabled, danger, style, children }) {
const [h, setH] = useState(false);
return (
<button
onClick={disabled ? undefined : onClick}
onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
style={{ …S.btn, …(danger ? S.btnDanger : {}), …(h && !disabled ? S.btnHover : {}), …(disabled ? S.btnDisabled : {}), …style }}
>{children}</button>
);
}

function Bar({ value, max, color = COLORS.gold, height = 6 }) {
const pct = Math.max(0, Math.min(100, (value / max) * 100));
return (
<div style={{ background: “#1a1a2a”, borderRadius: 3, height, overflow: “hidden”, border: “1px solid #2a2a3a” }}>
<div style={{ width: `${pct}%`, height: “100%”, background: color, transition: “width 0.3s” }} />
</div>
);
}

// ═══════════════════════════════════════════
// META PROGRESS
// ═══════════════════════════════════════════
const DEFAULT_META = { runs: 0, victories: 0, bestDist: 0, glory: 0, unlockedShips: [“sloop”], unlockedPerks: [] };

function useMeta() {
const [meta, setMeta] = useState(DEFAULT_META);
const [loaded, setLoaded] = useState(false);
useEffect(() => {
(async () => {
try {
const r = await window.storage.get(“sea-of-ashes-meta-v2”);
if (r && r.value) setMeta({ …DEFAULT_META, …JSON.parse(r.value) });
} catch {}
setLoaded(true);
})();
}, []);
const saveMeta = useCallback(async (m) => {
setMeta(m);
try { await window.storage.set(“sea-of-ashes-meta-v2”, JSON.stringify(m)); } catch {}
}, []);
return { meta, saveMeta, loaded };
}

// ═══════════════════════════════════════════
// TITLE SCREEN
// ═══════════════════════════════════════════
function TitleScreen({ meta, onStart, onReset }) {
return (
<div style={{ …S.page, display: “flex”, flexDirection: “column”, alignItems: “center”, justifyContent: “center”, padding: 20, textAlign: “center”, minHeight: “100vh”,
background: `radial-gradient(ellipse at 50% 30%, #1a2a4a 0%, ${COLORS.bg} 70%)` }}>
<div style={{ fontSize: 40, marginBottom: 4, filter: “drop-shadow(0 0 20px rgba(200,170,80,0.4))” }}>⚓</div>
<div style={{ fontSize: 9, letterSpacing: 6, color: COLORS.goldDark, marginBottom: 4, textTransform: “uppercase” }}>Un Roguelike Naval</div>
<h1 style={{ fontSize: 38, color: COLORS.gold, margin: “0 0 4px 0”, textShadow: “0 0 30px rgba(200,170,80,0.4)”, letterSpacing: 3, fontWeight: “normal” }}>SEA OF ASHES</h1>
<div style={{ width: 180, height: 1, background: `linear-gradient(90deg, transparent, ${COLORS.goldDark}, transparent)`, margin: “12px 0” }} />
<p style={{ fontSize: 13, color: COLORS.textDim, maxWidth: 320, lineHeight: 1.6, marginBottom: 24, fontStyle: “italic” }}>
“Más allá del puerto las cartas no sirven. Cada milla al oeste es un juramento contra los dioses.”
</p>
<Btn onClick={onStart} style={{ fontSize: 18, padding: “14px 44px”, letterSpacing: 1 }}>ZARPAR</Btn>
<div style={{ marginTop: 24, …S.panel, padding: “10px 16px”, fontSize: 12, minWidth: 220 }}>
<div style={{ color: COLORS.gold }}>Registro del Capitán</div>
<div style={{ marginTop: 4 }}>Travesías: {meta.runs} · Victorias: {meta.victories}</div>
<div>Distancia máxima alcanzada: {meta.bestDist}</div>
<div>Gloria acumulada: <span style={{ color: COLORS.gold }}>{meta.glory} ✦</span></div>
<div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 4 }}>
Barcos {meta.unlockedShips.length}/{SHIPS.length} · Perks {meta.unlockedPerks.length}/{PERKS.length}
</div>
</div>
{meta.runs > 0 && (
<button onClick={onReset} style={{ background: “none”, border: “none”, color: COLORS.textDim, cursor: “pointer”, fontSize: 11, marginTop: 12, fontFamily: “inherit”, textDecoration: “underline” }}>
Borrar progreso
</button>
)}
</div>
);
}

// ═══════════════════════════════════════════
// SHIP SELECT
// ═══════════════════════════════════════════
function ShipSelect({ meta, saveMeta, onSelect, onBack }) {
const [sel, setSel] = useState(“sloop”);
const [selPerks, setSelPerks] = useState([]);

const togglePerk = (id) =>
setSelPerks(p => p.includes(id) ? p.filter(x => x !== id) : p.length < 2 ? […p, id] : p);

const unlockShip = async (s) => {
if (meta.glory < s.cost) return;
const newMeta = { …meta, glory: meta.glory - s.cost, unlockedShips: […meta.unlockedShips, s.id] };
await saveMeta(newMeta);
setSel(s.id);
};

const ship = SHIPS.find(s => s.id === sel);

return (
<div style={{ …S.page, display: “flex”, flexDirection: “column”, padding: 14, gap: 10, minHeight: “100vh” }}>
<div style={{ display: “flex”, justifyContent: “space-between”, alignItems: “center” }}>
<Btn onClick={onBack} style={{ padding: “6px 12px”, fontSize: 12 }}>← Volver</Btn>
<div style={{ fontSize: 12, color: COLORS.gold }}>Gloria: {meta.glory} ✦</div>
</div>
<div style={S.title}>Elegir Embarcación</div>
<div style={{ display: “grid”, gridTemplateColumns: “1fr 1fr”, gap: 8 }}>
{SHIPS.map(s => {
const unlocked = meta.unlockedShips.includes(s.id);
const selected = sel === s.id;
return (
<div key={s.id} onClick={() => unlocked && setSel(s.id)} style={{
…S.panel, cursor: unlocked ? “pointer” : “default”,
borderColor: selected ? COLORS.gold : COLORS.panelBorder,
opacity: unlocked ? 1 : 0.65,
boxShadow: selected ? “0 0 12px rgba(200,170,80,0.3)” : “none”,
padding: “10px 10px”,
}}>
<div style={{ fontSize: 14, color: unlocked ? COLORS.gold : COLORS.textDim, fontWeight: “bold” }}>{s.name}</div>
<div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2, minHeight: 28 }}>{s.desc}</div>
{unlocked ? (
<div style={{ fontSize: 10, color: COLORS.textDim, marginTop: 4 }}>
❤{s.hull} ⚔{s.cannons} 🛡{s.armor} 💨{s.speed}
</div>
) : (
<Btn onClick={(e) => { e.stopPropagation(); unlockShip(s); }}
disabled={meta.glory < s.cost}
style={{ fontSize: 10, marginTop: 4, padding: “4px 8px”, width: “100%” }}>
Desbloquear ({s.cost} ✦)
</Btn>
)}
</div>
);
})}
</div>

```
  {meta.unlockedPerks.length > 0 && (
    <>
      <div style={{ ...S.title, marginTop: 4 }}>Perks (máx. 2)</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {PERKS.filter(p => meta.unlockedPerks.includes(p.id)).map(p => (
          <div key={p.id} onClick={() => togglePerk(p.id)} style={{
            ...S.panel, cursor: "pointer", padding: "7px 12px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            borderColor: selPerks.includes(p.id) ? COLORS.gold : COLORS.panelBorder,
          }}>
            <div>
              <div style={{ fontSize: 13, color: selPerks.includes(p.id) ? COLORS.gold : COLORS.text }}>{p.name}</div>
              <div style={{ fontSize: 11, color: COLORS.textDim }}>{p.desc}</div>
            </div>
            <div style={{ fontSize: 18, color: COLORS.gold }}>{selPerks.includes(p.id) ? "✓" : "○"}</div>
          </div>
        ))}
      </div>
    </>
  )}

  <Btn onClick={() => onSelect(sel, selPerks)} style={{ fontSize: 16, padding: "12px", marginTop: 8 }}>
    Zarpar con {ship?.name}
  </Btn>
</div>
```

);
}

// ═══════════════════════════════════════════
// MAP GRID VIEWPORT
// ═══════════════════════════════════════════
const VIEW = 9;

function MapGrid({ map, shipPos, revealed, visited, cleared, onMove, canInteract }) {
const half = Math.floor(VIEW / 2);
const cells = [];

for (let dy = -half; dy <= half; dy++) {
for (let dx = -half; dx <= half; dx++) {
const tx = shipPos.x + dx, ty = shipPos.y + dy;
const outOfBounds = tx < 0 || tx >= MAP_SIZE || ty < 0 || ty >= MAP_SIZE;
const key = `${tx},${ty}`;
const tile = outOfBounds ? null : map.tiles[ty][tx];
const isShip = !outOfBounds && tx === shipPos.x && ty === shipPos.y;
const isRevealed = !outOfBounds && revealed.has(key);
const isVisited = !outOfBounds && visited.has(key);
const isCleared = !outOfBounds && cleared.has(key);
const isAdjacent = !outOfBounds && !isShip && Math.max(Math.abs(dx), Math.abs(dy)) === 1;
const canMove = canInteract && isAdjacent;

```
  let bg, icon = "", borderCol = "transparent";

  if (outOfBounds) {
    bg = "#030610";
  } else if (!isRevealed) {
    bg = COLORS.fog;
  } else {
    const effType = isCleared ? "water" : tile.type;
    const ti = TILE[effType];
    bg = ti.color;
    if (isVisited && effType === "water") bg = COLORS.seaLight;
    icon = ti.icon;
  }

  if (isShip) { icon = "⛵"; borderCol = COLORS.gold; }
  else if (canMove) borderCol = COLORS.gold + "90";

  cells.push(
    <div
      key={`${dx},${dy}`}
      onClick={canMove ? () => onMove(tx, ty) : undefined}
      style={{
        aspectRatio: "1",
        background: bg,
        border: `1.5px solid ${borderCol}`,
        borderRadius: 3,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "min(4.2vw, 20px)",
        cursor: canMove ? "pointer" : "default",
        boxShadow: isShip ? "0 0 10px rgba(200,170,80,0.6)" : canMove ? "inset 0 0 8px rgba(200,170,80,0.25)" : "none",
        transition: "all 0.2s",
        animation: canMove ? "pulseCell 1.8s ease-in-out infinite" : "none",
        overflow: "hidden",
      }}
    >
      {icon && <span style={{ filter: isShip ? "drop-shadow(0 0 3px rgba(0,0,0,0.8))" : "none" }}>{icon}</span>}
    </div>
  );
}
```

}

return (
<div style={{ position: “relative”, width: “100%” }}>
<div style={{
display: “grid”,
gridTemplateColumns: `repeat(${VIEW}, 1fr)`,
gap: 2,
padding: 4,
background: `linear-gradient(180deg, ${COLORS.seaDeep} 0%, ${COLORS.bgDeep} 100%)`,
borderRadius: 6,
border: `1px solid ${COLORS.panelBorder}`,
}}>
{cells}
</div>
<style>{`@keyframes pulseCell { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.75; transform: scale(0.94); } }`}</style>
</div>
);
}

// ═══════════════════════════════════════════
// MINIMAP
// ═══════════════════════════════════════════
function Minimap({ map, shipPos, revealed, visited }) {
const size = 5;
return (
<div style={{
display: “grid”,
gridTemplateColumns: `repeat(${MAP_SIZE}, ${size}px)`,
gap: 1,
padding: 3,
background: “#04060c”,
borderRadius: 4,
border: `1px solid ${COLORS.panelBorder}`,
width: “fit-content”,
}}>
{map.tiles.flat().map(tile => {
const key = `${tile.x},${tile.y}`;
const isShip = tile.x === shipPos.x && tile.y === shipPos.y;
const isRev = revealed.has(key);
const isVis = visited.has(key);
const isHome = tile.type === “home_port”;
let bg = “#0a0f1a”;
if (isRev) {
if (isHome) bg = COLORS.gold;
else if (tile.type !== “water”) bg = TILE[tile.type].accent;
else if (isVis) bg = COLORS.seaLight;
else bg = COLORS.sea;
}
if (isShip) bg = “#fff”;
return (
<div key={key} style={{
width: size, height: size,
background: bg,
borderRadius: isShip ? “50%” : 1,
boxShadow: isShip ? “0 0 4px #fff” : “none”,
}} />
);
})}
</div>
);
}

// ═══════════════════════════════════════════
// PANELS
// ═══════════════════════════════════════════
function EventPanel({ event, player, onChoice, dist }) {
if (!event) return null;
return (
<div style={{ …S.panel, marginTop: 8 }}>
<div style={{ display: “flex”, justifyContent: “space-between”, alignItems: “flex-start” }}>
<div style={{ fontSize: 16, color: COLORS.gold, fontWeight: “bold” }}>{event.title}</div>
<div style={{ fontSize: 10, color: COLORS.textDim }}>Dist: {dist}</div>
</div>
<div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.5, marginTop: 4, marginBottom: 10 }}>{event.text}</div>
<div style={{ display: “flex”, flexDirection: “column”, gap: 6 }}>
{event.choices.map((c, i) => {
const cantAfford = c.requires && Object.entries(c.requires).some(([k, v]) => (player[k] || 0) < v);
return (
<Btn key={i} onClick={() => onChoice(i)} disabled={cantAfford} style={{ textAlign: “left”, padding: “8px 12px” }}>
<div style={{ fontWeight: “bold”, fontSize: 13 }}>{c.label}</div>
{c.text && <div style={{ fontSize: 11, color: cantAfford ? “#666” : COLORS.textDim, marginTop: 2 }}>
{c.text}{cantAfford && “ (sin recursos)”}
</div>}
</Btn>
);
})}
</div>
</div>
);
}

function CombatPanel({ combat, player, onAction }) {
if (!combat) return null;
const e = combat.enemy;
return (
<div style={{ …S.panel, marginTop: 8 }}>
<div style={{ display: “flex”, justifyContent: “space-between”, gap: 10, marginBottom: 8 }}>
<div style={{ flex: 1 }}>
<div style={{ fontSize: 14, color: COLORS.dangerLight, fontWeight: “bold” }}>⚔ {e.name}</div>
<Bar value={e.hull} max={e.maxHull} color={COLORS.dangerLight} />
<div style={{ fontSize: 10, color: COLORS.textDim, marginTop: 2 }}>{e.hull}/{e.maxHull} · ATK {e.atk} · DEF {e.def}</div>
</div>
<div style={{ flex: 1, textAlign: “right” }}>
<div style={{ fontSize: 14, color: COLORS.gold }}>Tu barco</div>
<Bar value={player.hull} max={player.maxHull} color={COLORS.gold} />
<div style={{ fontSize: 10, color: COLORS.textDim, marginTop: 2 }}>{player.hull}/{player.maxHull} · ⚔{player.cannons} 🛡{player.armor} 💣{player.ammo}</div>
</div>
</div>
{combat.log.length > 0 && (
<div style={{ fontSize: 11, color: COLORS.textDim, padding: “6px 10px”, background: “#0a0e17”, borderRadius: 4, marginBottom: 8, maxHeight: 64, overflowY: “auto” }}>
{combat.log.slice(-3).map((l, i) => <div key={i}>{l}</div>)}
</div>
)}
{combat.done ? (
<Btn onClick={() => onAction(“end”)} style={{ width: “100%” }}>
{combat.won ? “🎉 Victoria — Recoger botín” : combat.fled ? “🏳 Escapaste” : “💀 Continuar”}
</Btn>
) : (
<div style={{ display: “grid”, gridTemplateColumns: “1fr 1fr”, gap: 6 }}>
<Btn onClick={() => onAction(“fire”)} disabled={player.ammo <= 0}>🔥 Disparar{player.ammo <= 0 ? “ (sin mun.)” : “”}</Btn>
<Btn onClick={() => onAction(“brace”)}>🛡 Reforzar</Btn>
<Btn onClick={() => onAction(“maneuver”)}>💨 Maniobrar</Btn>
<Btn onClick={() => onAction(“flee”)} disabled={combat.boss}>🏳 Huir{combat.boss ? “ (no)” : “”}</Btn>
</div>
)}
</div>
);
}

function ShopPanel({ items, player, onBuy, onLeave, isHome }) {
return (
<div style={{ …S.panel, marginTop: 8 }}>
<div style={{ …S.title, fontSize: 16 }}>{isHome ? “⚓ Astillero del Puerto” : “🏘 Puerto — Mercado”}</div>
<div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 8 }}>Oro disponible: <span style={{ color: COLORS.gold }}>{player.gold}</span>{isHome && “ · precios con descuento”}</div>
<div style={{ display: “flex”, flexDirection: “column”, gap: 2 }}>
{items.map((item, i) => {
const cantAfford = player.gold < item.cost;
return (
<div key={i} style={{ display: “flex”, justifyContent: “space-between”, alignItems: “center”, padding: “6px 0”, borderBottom: `1px solid ${COLORS.panelBorder}` }}>
<div style={{ flex: 1, paddingRight: 8 }}>
<div style={{ fontSize: 13, color: COLORS.text }}>{item.name}</div>
<div style={{ fontSize: 11, color: COLORS.textDim }}>{item.desc}</div>
</div>
<Btn onClick={() => onBuy(i)} disabled={cantAfford} style={{ padding: “4px 10px”, fontSize: 12, minWidth: 72 }}>
{item.cost} 💰
</Btn>
</div>
);
})}
</div>
<Btn onClick={onLeave} style={{ width: “100%”, marginTop: 10 }}>Volver</Btn>
</div>
);
}

function ResultPanel({ result, onContinue }) {
if (!result) return null;
return (
<div style={{ …S.panel, marginTop: 8, borderColor: result.bad ? COLORS.danger : COLORS.safe }}>
<div style={{ fontSize: 14, color: result.bad ? COLORS.dangerLight : COLORS.safe, fontWeight: “bold”, marginBottom: 4 }}>{result.title}</div>
<div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.5, marginBottom: 6 }}>{result.text}</div>
{result.changes && result.changes.length > 0 && (
<div style={{ fontSize: 12, marginBottom: 8, display: “flex”, flexWrap: “wrap”, gap: 8 }}>
{result.changes.map((c, i) => (
<span key={i} style={{ color: c.pos ? COLORS.safe : c.neg ? COLORS.dangerLight : COLORS.gold }}>{c.text}</span>
))}
</div>
)}
<Btn onClick={onContinue} style={{ width: “100%” }}>Continuar</Btn>
</div>
);
}

function HomePortPanel({ onRest, onRetreat, onLeave, onShop }) {
return (
<div style={{ …S.panel, marginTop: 8, borderColor: COLORS.gold }}>
<div style={{ …S.title, fontSize: 16 }}>⚓ Puerto de Origen</div>
<div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 10, lineHeight: 1.4, fontStyle: “italic” }}>
El viejo puerto de partida. El abrigo antes del mar desconocido.
</div>
<div style={{ display: “flex”, flexDirection: “column”, gap: 6 }}>
<Btn onClick={onRest} style={{ textAlign: “left” }}>
<div style={{ fontWeight: “bold”, fontSize: 13 }}>🛏 Descansar</div>
<div style={{ fontSize: 11, color: COLORS.textDim }}>Casco al máximo · +15 suministros · +10 moral</div>
</Btn>
<Btn onClick={onShop} style={{ textAlign: “left” }}>
<div style={{ fontWeight: “bold”, fontSize: 13 }}>⚒ Astillero</div>
<div style={{ fontSize: 11, color: COLORS.textDim }}>Mejoras del barco con descuento</div>
</Btn>
<Btn onClick={onRetreat} danger style={{ textAlign: “left” }}>
<div style={{ fontWeight: “bold”, fontSize: 13 }}>🏳 Retirarse con honor</div>
<div style={{ fontSize: 11, color: “#b88” }}>Terminar la travesía y ganar gloria por la distancia explorada</div>
</Btn>
<Btn onClick={onLeave} style={{ width: “100%”, marginTop: 4 }}>Zarpar de nuevo</Btn>
</div>
</div>
);
}

// ═══════════════════════════════════════════
// END SCREEN
// ═══════════════════════════════════════════
function EndScreen({ victory, retreat, stats, onMenu }) {
const title = victory ? “¡VICTORIA!” : retreat ? “Retirada con Honor” : “Naufragio”;
const color = victory ? COLORS.gold : retreat ? COLORS.safe : COLORS.dangerLight;
const icon = victory ? “🏆” : retreat ? “⚓” : “💀”;
const flavor = victory
? “El Leviatán yace en el fondo. Tu nombre resuena en cada taberna del puerto.”
: retreat
? “Has vuelto al puerto con lo explorado. Un capitán sabio sabe cuándo volver.”
: “El mar oscuro reclama tu barco y tu tripulación. Tu leyenda se hunde en silencio.”;

return (
<div style={{ …S.page, display: “flex”, flexDirection: “column”, alignItems: “center”, justifyContent: “center”, padding: 20, textAlign: “center”, minHeight: “100vh” }}>
<div style={{ fontSize: 42, marginBottom: 6 }}>{icon}</div>
<h2 style={{ fontSize: 28, color, margin: “0 0 8px 0”, letterSpacing: 2, fontWeight: “normal” }}>{title}</h2>
<p style={{ color: COLORS.textDim, fontSize: 13, maxWidth: 320, lineHeight: 1.6, marginBottom: 18, fontStyle: “italic” }}>{flavor}</p>
<div style={{ …S.panel, minWidth: 240, textAlign: “left”, fontSize: 13, padding: 14 }}>
<div style={{ color: COLORS.gold, marginBottom: 6 }}>Resumen de Travesía</div>
<div>Distancia máxima: <b>{stats.maxDist}</b></div>
<div>Tiles explorados: <b>{stats.explored}</b></div>
<div>Combates ganados: <b>{stats.combatsWon}</b></div>
<div>Oro recolectado: <b>{stats.goldEarned}</b></div>
<div>Reliquias: <b>{stats.relics}</b></div>
<div style={{ marginTop: 6, color: COLORS.gold, fontWeight: “bold” }}>Gloria ganada: +{stats.gloryEarned} ✦</div>
</div>
<Btn onClick={onMenu} style={{ fontSize: 16, padding: “12px 30px”, marginTop: 18 }}>Volver al menú</Btn>
</div>
);
}

// ═══════════════════════════════════════════
// GAME SCREEN
// ═══════════════════════════════════════════
function GameScreen({ shipId, perks, meta, saveMeta, onEnd }) {
const seed = useMemo(() => Math.floor(Math.random() * 999999), []);
const rngRef = useRef(mulberry32(seed + 1337));
const rng = useCallback(() => rngRef.current(), []);

const [map] = useState(() => generateGridMap(seed));
const [shipPos, setShipPos] = useState({ x: ORIGIN, y: ORIGIN });

const [player, setPlayer] = useState(() => {
const ship = SHIPS.find(s => s.id === shipId) || SHIPS[0];
const p = {
hull: ship.hull, maxHull: ship.hull,
supplies: ship.supplies, maxSupplies: ship.maxSupplies,
morale: 50, maxMorale: 100,
ammo: ship.ammo, maxAmmo: ship.maxAmmo,
gold: ship.gold,
cannons: ship.cannons, armor: ship.armor, speed: ship.speed,
relics: [],
};
for (const pid of perks) {
const pk = PERKS.find(x => x.id === pid);
if (pk) for (const [k, v] of Object.entries(pk.effect)) p[k] = (p[k] || 0) + v;
}
return p;
});

const [revealed, setRevealed] = useState(() => {
const s = new Set();
for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
const nx = ORIGIN + dx, ny = ORIGIN + dy;
if (nx >= 0 && nx < MAP_SIZE && ny >= 0 && ny < MAP_SIZE) s.add(`${nx},${ny}`);
}
return s;
});
const [visited, setVisited] = useState(() => new Set([`${ORIGIN},${ORIGIN}`]));
const [cleared, setCleared] = useState(() => new Set());
const [turn, setTurn] = useState(0);

const [phase, setPhase] = useState(“home”); // start at home
const [event, setEvent] = useState(null);
const [result, setResult] = useState(null);
const [combat, setCombat] = useState(null);
const [shop, setShop] = useState(null);
const [log, setLog] = useState([“⚓ Zarpas del puerto hacia el mar desconocido…”]);
const [stats, setStats] = useState({ maxDist: 0, explored: 1, combatsWon: 0, goldEarned: 0, relics: 0 });
const [gameOver, setGameOver] = useState(null);

const addLog = useCallback((msg) => setLog(prev => […prev.slice(-30), msg]), []);

const clamp = useCallback((p) => ({
…p,
hull: Math.min(p.maxHull, Math.max(0, p.hull)),
supplies: Math.min(p.maxSupplies, Math.max(0, p.supplies)),
morale: Math.max(0, Math.min(p.maxMorale || 100, p.morale)),
ammo: Math.min(p.maxAmmo, Math.max(0, p.ammo)),
gold: Math.max(0, p.gold),
}), []);

const applyEffect = useCallback((eff, p) => {
const np = { …p };
const changes = [];
const labels = { hull: “casco”, supplies: “víveres”, morale: “moral”, ammo: “munición”, gold: “oro”, cannons: “cañones”, armor: “armadura”, speed: “velocidad” };
for (const [k, v] of Object.entries(eff)) {
if (k === “relic” || k === “combat”) continue;
if (k === “maxHull”) { np.maxHull += v; np.hull += v; changes.push({ text: `+${v} casco máx`, pos: v > 0, neg: v < 0 }); }
else if (k === “maxSupplies”) { np.maxSupplies += v; changes.push({ text: `+${v} bodega víveres`, pos: v > 0 }); }
else if (k === “maxAmmo”) { np.maxAmmo += v; changes.push({ text: `+${v} bodega munición`, pos: v > 0 }); }
else if (np[k] !== undefined) {
np[k] += v;
if (v !== 0 && labels[k]) changes.push({ text: `${v > 0 ? "+" : ""}${v} ${labels[k]}`, pos: v > 0, neg: v < 0 });
}
}
return { player: clamp(np), changes };
}, [clamp]);

// End run
const endRun = useCallback((victory, retreat, msg) => {
const dist = tileDist(shipPos.x, shipPos.y);
const maxDist = Math.max(stats.maxDist, dist);
const gloryEarned = victory ? 15 + Math.floor(maxDist * 1.5) : retreat ? Math.floor(maxDist * 1.5) : Math.max(1, Math.floor(maxDist * 0.7));
const finalStats = { …stats, maxDist, gloryEarned };
addLog(msg);

```
const newMeta = { ...meta };
newMeta.runs += 1;
newMeta.glory += gloryEarned;
if (victory) newMeta.victories += 1;
if (maxDist > newMeta.bestDist) newMeta.bestDist = maxDist;

if (newMeta.runs >= 1 && !newMeta.unlockedPerks.includes("seasoned")) newMeta.unlockedPerks.push("seasoned");
if (newMeta.runs >= 2 && !newMeta.unlockedPerks.includes("stocked"))  newMeta.unlockedPerks.push("stocked");
if (newMeta.bestDist >= 4 && !newMeta.unlockedPerks.includes("armed")) newMeta.unlockedPerks.push("armed");
if (newMeta.bestDist >= 6 && !newMeta.unlockedPerks.includes("wealthy")) newMeta.unlockedPerks.push("wealthy");
if (newMeta.victories >= 1 && !newMeta.unlockedPerks.includes("reinforced")) newMeta.unlockedPerks.push("reinforced");

saveMeta(newMeta);
setGameOver({ victory, retreat, stats: finalStats });
```

}, [shipPos, stats, meta, saveMeta, addLog]);

// Check death
useEffect(() => {
if (gameOver) return;
if (player.hull <= 0) endRun(false, false, “El casco cede. El mar te traga.”);
else if (player.morale <= 0) endRun(false, false, “¡Motín! La tripulación te lanza por la borda.”);
}, [player.hull, player.morale, gameOver, endRun]);

// Reveal around a position
const revealAt = useCallback((x, y) => {
const hasLantern = player.relics.some(r => r.id === “lantern”);
const radius = hasLantern ? 3 : 2;
setRevealed(prev => {
const next = new Set(prev);
for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
const nx = x + dx, ny = y + dy;
if (nx >= 0 && nx < MAP_SIZE && ny >= 0 && ny < MAP_SIZE) next.add(`${nx},${ny}`);
}
return next;
});
}, [player.relics]);

const markCleared = useCallback((x, y) => setCleared(prev => new Set([…prev, `${x},${y}`])), []);

// Combat start
const startCombat = useCallback((type, dist, isBoss = false) => {
const pool = ENEMIES[type] || ENEMIES.pirates;
const tier = Math.min(pool.length - 1, Math.floor(dist / 3));
const tpl = pool[tier];
const scaling = 1 + Math.max(0, dist - 2) * 0.12;
const enemy = {
name: tpl.name,
hull: Math.floor(tpl.base.hull * scaling),
maxHull: Math.floor(tpl.base.hull * scaling),
atk: Math.floor(tpl.base.atk * scaling),
def: tpl.base.def,
spd: tpl.base.spd,
gold: Math.floor(8 + dist * 2 + rng() * 8),
ammo: type === “monster” ? 0 : Math.floor(1 + rng() * 4),
};
setCombat({ enemy, log: [`¡${enemy.name} aparece!`], done: false, won: false, boss: isBoss });
setPhase(“combat”);
addLog(`⚔ Combate contra ${enemy.name}`);
}, [rng, addLog]);

// Handle tile content after moving
const handleTileContent = useCallback((tile, p) => {
if (tile.type === “home_port”) {
setPhase(“home”);
return;
}
if (tile.type === “port”) {
setShop(generateShop(rng, false));
setPhase(“shop”);
return;
}
if (tile.type === “leviathan”) {
startCombat(“leviathan”, tile.dist, true);
return;
}
if (tile.type === “pirates” && p.relics.some(r => r.pirateTruce) && rng() < 0.5) {
setResult({ title: “Bandera Negra”, text: “Los piratas reconocen tu bandera y te dejan pasar.”, bad: false, changes: [] });
setPhase(“result”);
markCleared(tile.x, tile.y);
return;
}
const ev = genTileEvent(tile.type, tile.dist, rng);
if (ev) {
setEvent(ev);
setPhase(“event”);
} else {
setPhase(“map”);
}
}, [rng, startCombat, markCleared]);

// Water random event after move
const rollWaterEvent = useCallback((p) => {
if (rng() > 0.12) return null;
const ev = WATER_EVENTS[Math.floor(rng() * WATER_EVENTS.length)];
const { player: np, changes } = applyEffect(ev.effect, p);
setPlayer(np);
setResult({ title: ev.title, text: ev.text, bad: (ev.effect.morale || 0) < 0 || (ev.effect.hull || 0) < 0, changes });
setPhase(“result”);
return np;
}, [applyEffect, rng]);

// Move to adjacent tile
const handleMove = useCallback((x, y) => {
if (phase !== “map” || gameOver) return;
if (x < 0 || x >= MAP_SIZE || y < 0 || y >= MAP_SIZE) return;
const dx = Math.abs(x - shipPos.x), dy = Math.abs(y - shipPos.y);
if (Math.max(dx, dy) !== 1) return;

```
const tile = map.tiles[y][x];
const isCleared = cleared.has(`${x},${y}`);
const newTurn = turn + 1;

// Supply cost (with sextant discount)
const hasSextant = player.relics.some(r => r.discountMove);
const cost = hasSextant && newTurn % 3 === 0 ? 0 : 1;
let np = { ...player, supplies: player.supplies - cost };

// No supplies = hull damage + morale
if (np.supplies < 0) {
  np.hull -= 2;
  np.morale -= 4;
  np.supplies = 0;
  addLog("⚠ Sin suministros. Casco y moral sufren.");
} else if (np.supplies <= 4) {
  np.morale -= 1;
}

// Chalice regen every 2 turns
const chalice = np.relics.find(r => r.id === "chalice");
if (chalice && newTurn % 2 === 0) np.hull = Math.min(np.maxHull, np.hull + 1);

const clamped = clamp(np);
setPlayer(clamped);
setShipPos({ x, y });
setVisited(prev => new Set([...prev, `${x},${y}`]));
revealAt(x, y);
setTurn(newTurn);
setStats(prev => ({
  ...prev,
  explored: prev.explored + (visited.has(`${x},${y}`) ? 0 : 1),
  maxDist: Math.max(prev.maxDist, tile.dist),
}));

if (tile.type !== "water" && !isCleared) addLog(`${TILE[tile.type].icon} ${TILE[tile.type].label} (dist ${tile.dist})`);

if (!isCleared && tile.type !== "water") {
  handleTileContent(tile, clamped);
} else {
  rollWaterEvent(clamped);
}
```

}, [phase, gameOver, shipPos, map, cleared, turn, player, addLog, clamp, revealAt, visited, handleTileContent, rollWaterEvent]);

// Combat action
const handleCombatAction = useCallback((action) => {
if (!combat) return;

```
if (action === "end") {
  if (combat.won) {
    const { player: np } = applyEffect({ gold: combat.enemy.gold, ammo: combat.enemy.ammo }, player);
    setPlayer(np);
    setStats(prev => ({ ...prev, combatsWon: prev.combatsWon + 1, goldEarned: prev.goldEarned + combat.enemy.gold }));
    addLog(`✓ Victoria. +${combat.enemy.gold} oro${combat.enemy.ammo ? `, +${combat.enemy.ammo} mun.` : ""}`);
    markCleared(shipPos.x, shipPos.y);

    if (combat.boss) {
      endRun(true, false, "🏆 ¡El Leviatán ha caído!");
      return;
    }
  } else if (combat.fled) {
    addLog("🏳 Escapaste del combate.");
  }
  setCombat(null);
  setPhase("map");
  return;
}

const e = { ...combat.enemy };
const np = { ...player };
const clog = [...combat.log];
let bracing = false;

const bossBonus = combat.boss ? (np.relics.find(r => r.bossDmg)?.bossDmg || 0) : 0;

switch (action) {
  case "fire": {
    const dmg = Math.max(1, np.cannons + bossBonus - e.def);
    e.hull -= dmg; np.ammo -= 1;
    clog.push(`🔥 Disparas: ${dmg} daño.`);
    break;
  }
  case "brace":
    bracing = true;
    clog.push("🛡 Te preparas para el impacto.");
    break;
  case "maneuver": {
    const dodgeChance = 0.28 + np.speed * 0.08;
    if (rng() < dodgeChance) {
      const dmg = Math.max(1, Math.floor(np.cannons * 0.5) + bossBonus - e.def);
      e.hull -= dmg;
      clog.push(`💨 Maniobra exitosa. Contragolpe: ${dmg} daño.`);
    } else {
      clog.push("💨 Maniobra fallida. Turno perdido.");
    }
    break;
  }
  case "flee": {
    if (combat.boss) return;
    const fleeChance = 0.25 + (np.speed - e.spd) * 0.12;
    if (rng() < Math.max(0.15, fleeChance)) {
      clog.push("🏳 ¡Escapas!");
      setCombat({ ...combat, log: clog, done: true, won: false, fled: true });
      return;
    } else {
      clog.push("🏳 No logras escapar.");
    }
    break;
  }
}

if (e.hull <= 0) {
  clog.push(`💀 ${e.name} se hunde.`);
  setCombat({ ...combat, enemy: { ...e, hull: 0 }, log: clog, done: true, won: true });
  return;
}

// Enemy turn
let eDmg = Math.max(1, e.atk - np.armor);
if (bracing) eDmg = Math.max(1, Math.floor(eDmg * 0.5));
if (rng() < np.speed * 0.04) {
  clog.push(`${e.name} ataca pero falla.`);
} else {
  np.hull -= eDmg;
  clog.push(`${e.name} golpea: ${eDmg} daño${bracing ? " (reforzado)" : ""}.`);
}

setPlayer(clamp(np));
if (np.hull <= 0) {
  clog.push("💀 Tu barco se hunde...");
  setCombat({ ...combat, enemy: e, log: clog, done: true, won: false });
  return;
}
setCombat({ ...combat, enemy: e, log: clog, done: false });
```

}, [combat, player, rng, clamp, applyEffect, addLog, markCleared, shipPos, endRun]);

// Event choice
const handleEventChoice = useCallback((idx) => {
if (!event) return;
const c = event.choices[idx];

```
if (c.effect.combat) {
  const tile = map.tiles[shipPos.y][shipPos.x];
  startCombat(c.effect.combat, tile.dist, false);
  setEvent(null);
  return;
}

const base = applyEffect(c.effect, player);
let np = base.player;
let changes = base.changes;
let bad = false;
let resultText = c.label + ".";

if (c.effect.relic) {
  const rel = pickRelic(np.relics.map(r => r.id), rng);
  if (rel) {
    np = { ...np, relics: [...np.relics, rel] };
    if (rel.mods) for (const [k, v] of Object.entries(rel.mods)) np[k] = (np[k] || 0) + v;
    np = clamp(np);
    changes.push({ text: `✦ Reliquia: ${rel.name}`, pos: true });
    setStats(prev => ({ ...prev, relics: prev.relics + 1 }));
    addLog(`✦ ${rel.name}`);
  }
}

if (c.risk && rng() < c.risk.chance) {
  bad = true;
  if (c.risk.combat) {
    const tile = map.tiles[shipPos.y][shipPos.x];
    setEvent(null);
    setPlayer(np);
    startCombat(c.risk.combat, tile.dist, false);
    return;
  }
  for (const [k, v] of Object.entries(c.risk)) {
    if (k === "chance" || k === "text" || k === "combat") continue;
    np[k] = (np[k] || 0) + v;
    const labels = { hull: "casco", supplies: "víveres", morale: "moral", ammo: "munición", gold: "oro" };
    if (labels[k]) changes.push({ text: `${v > 0 ? "+" : ""}${v} ${labels[k]}`, pos: v > 0, neg: v < 0 });
  }
  np = clamp(np);
  resultText = c.risk.text || "Algo salió mal...";
}

setPlayer(np);
setEvent(null);
markCleared(shipPos.x, shipPos.y);
setResult({
  title: bad ? "Mala suerte..." : "Resultado",
  text: resultText,
  bad,
  changes,
});
setPhase("result");
```

}, [event, player, applyEffect, clamp, rng, map.tiles, shipPos, startCombat, markCleared, addLog]);

// Shop buy
const handleBuy = useCallback((i) => {
if (!shop) return;
const item = shop[i];
if (player.gold < item.cost) return;
const { player: np } = applyEffect({ gold: -item.cost, …item.effect }, player);
setPlayer(np);
addLog(`🛒 ${item.name}`);
setShop(prev => prev.filter((_, j) => j !== i));
}, [shop, player, applyEffect, addLog]);

// Home port actions
const homeRest = useCallback(() => {
const np = clamp({ …player, hull: player.maxHull, supplies: Math.min(player.maxSupplies, player.supplies + 15), morale: Math.min(player.maxMorale || 100, player.morale + 10) });
setPlayer(np);
addLog(“⚓ Descansas en el puerto. Barco restaurado.”);
}, [player, clamp, addLog]);

const homeShop = useCallback(() => {
setShop(generateShop(rng, true));
setPhase(“shop”);
}, [rng]);

const homeRetreat = useCallback(() => {
endRun(false, true, “⚓ Te retiras con el botín acumulado.”);
}, [endRun]);

// RENDER
if (gameOver) return <EndScreen {…gameOver} onMenu={onEnd} />;

const currentTile = map.tiles[shipPos.y][shipPos.x];
const currentTileInfo = TILE[currentTile.type];

return (
<div style={{ …S.page, display: “flex”, flexDirection: “column”, minHeight: “100vh” }}>
{/* Resource bar */}
<div style={{ background: COLORS.panel, borderBottom: `1px solid ${COLORS.panelBorder}`, padding: “6px 10px”, display: “flex”, flexWrap: “wrap”, gap: 6, fontSize: 11, alignItems: “center”, position: “sticky”, top: 0, zIndex: 10 }}>
<span style={{ color: COLORS.dangerLight }}>❤ {player.hull}/{player.maxHull}</span>
<span style={{ color: “#6a9” }}>🍞 {player.supplies}/{player.maxSupplies}</span>
<span style={{ color: “#8ad” }}>😊 {player.morale}</span>
<span style={{ color: “#da8” }}>💣 {player.ammo}/{player.maxAmmo}</span>
<span style={{ color: COLORS.gold }}>💰 {player.gold}</span>
<span style={{ flex: 1 }} />
<span style={{ color: COLORS.textDim }}>Dist {currentTile.dist} · T{turn}</span>
</div>

```
  {/* Main content */}
  <div style={{ flex: 1, padding: "8px 10px 10px" }}>
    {/* Current location + minimap */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: COLORS.gold }}>
          {currentTileInfo.icon} {currentTileInfo.label}
        </div>
        {player.relics.length > 0 && (
          <div style={{ fontSize: 10, color: COLORS.textDim, marginTop: 2 }}>
            ✦ {player.relics.map(r => r.name).join(" · ")}
          </div>
        )}
      </div>
      <Minimap map={map} shipPos={shipPos} revealed={revealed} visited={visited} />
    </div>

    {/* Map */}
    <MapGrid
      map={map}
      shipPos={shipPos}
      revealed={revealed}
      visited={visited}
      cleared={cleared}
      onMove={handleMove}
      canInteract={phase === "map"}
    />
    {phase === "map" && (
      <div style={{ fontSize: 10, color: COLORS.textDim, textAlign: "center", marginTop: 6, opacity: 0.8 }}>
        Tocá un tile adyacente (pulsante) para mover. Cada paso gasta 1 víver.
      </div>
    )}

    {phase === "event" && <EventPanel event={event} player={player} onChoice={handleEventChoice} dist={currentTile.dist} />}
    {phase === "result" && <ResultPanel result={result} onContinue={() => { setResult(null); setPhase(currentTile.type === "home_port" ? "home" : "map"); }} />}
    {phase === "combat" && <CombatPanel combat={combat} player={player} onAction={handleCombatAction} />}
    {phase === "shop" && <ShopPanel items={shop} player={player} onBuy={handleBuy} onLeave={() => { setShop(null); setPhase(currentTile.type === "home_port" ? "home" : "map"); }} isHome={currentTile.type === "home_port"} />}
    {phase === "home" && (
      <HomePortPanel
        onRest={homeRest}
        onShop={homeShop}
        onRetreat={homeRetreat}
        onLeave={() => setPhase("map")}
      />
    )}

    {/* Ship stats compact */}
    <div style={{ ...S.panel, marginTop: 8, padding: "8px 10px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", fontSize: 11 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ color: COLORS.textDim, width: 44 }}>❤ Casco</span>
          <div style={{ flex: 1 }}><Bar value={player.hull} max={player.maxHull} color={COLORS.dangerLight} /></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ color: COLORS.textDim, width: 44 }}>🍞 Vív.</span>
          <div style={{ flex: 1 }}><Bar value={player.supplies} max={player.maxSupplies} color="#6a9" /></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ color: COLORS.textDim, width: 44 }}>😊 Moral</span>
          <div style={{ flex: 1 }}><Bar value={player.morale} max={player.maxMorale || 100} color="#8ad" /></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ color: COLORS.textDim, width: 44 }}>💣 Mun.</span>
          <div style={{ flex: 1 }}><Bar value={player.ammo} max={player.maxAmmo} color="#da8" /></div>
        </div>
      </div>
      <div style={{ fontSize: 10, color: COLORS.textDim, marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span>⚔ Cañones {player.cannons}</span><span>🛡 Armadura {player.armor}</span><span>💨 Velocidad {player.speed}</span>
      </div>
    </div>

    {/* Log */}
    <div style={{ marginTop: 8, padding: "6px 10px", background: "#0a0e1780", borderRadius: 4, maxHeight: 80, overflowY: "auto", fontSize: 11, color: COLORS.textDim, border: `1px solid ${COLORS.panelBorder}` }}>
      {log.slice(-6).map((l, i, arr) => <div key={i} style={{ opacity: 0.5 + (i / arr.length) * 0.5 }}>{l}</div>)}
    </div>
  </div>
</div>
```

);
}

// ═══════════════════════════════════════════
// APP ROOT
// ═══════════════════════════════════════════
export default function App() {
const { meta, saveMeta, loaded } = useMeta();
const [screen, setScreen] = useState(“title”);
const [cfg, setCfg] = useState(null);

if (!loaded) return <div style={{ …S.page, display: “flex”, alignItems: “center”, justifyContent: “center”, minHeight: “100vh” }}><div style={{ color: COLORS.gold }}>Cargando…</div></div>;

if (screen === “title”) {
return <TitleScreen meta={meta} onStart={() => setScreen(“select”)} onReset={async () => {
if (confirm(”¿Borrar todo el progreso entre runs?”)) await saveMeta(DEFAULT_META);
}} />;
}
if (screen === “select”) {
return <ShipSelect meta={meta} saveMeta={saveMeta} onBack={() => setScreen(“title”)}
onSelect={(shipId, perks) => { setCfg({ shipId, perks }); setScreen(“game”); }} />;
}
if (screen === “game” && cfg) {
return <GameScreen shipId={cfg.shipId} perks={cfg.perks} meta={meta} saveMeta={saveMeta}
onEnd={() => { setCfg(null); setScreen(“title”); }} />;
}
return null;
}
