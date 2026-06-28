import * as Astronomy from "astronomy-engine";

// ─── SBA House system ─────────────────────────────────────────────────────────

export interface SBAHouseData {
  house: number;
  constellation: string;
  name: string;
  theme: string;
  phrase: string;
}

export const SBA_HOUSES: Record<string, SBAHouseData> = {
  Aries:        { house: 1,  constellation: "Aries",        name: "Emergence",     theme: "Birth of identity, physical body, presence, instinct",                                              phrase: "I exist" },
  Taurus:       { house: 2,  constellation: "Taurus",       name: "Stabilization", theme: "Survival, resources, value, building safety",                                                      phrase: "I need to sustain myself" },
  Gemini:       { house: 3,  constellation: "Gemini",       name: "Awareness",     theme: "Learning, communication, perception, making sense of reality",                                     phrase: "I understand" },
  Cancer:       { house: 4,  constellation: "Cancer",       name: "Foundation",    theme: "Roots, home, emotional base, inner security",                                                      phrase: "I belong somewhere" },
  Leo:          { house: 5,  constellation: "Leo",          name: "Expression",    theme: "Creativity, joy, self-expression, taking up space",                                               phrase: "I create" },
  Virgo:        { house: 6,  constellation: "Virgo",        name: "Refinement",    theme: "Discipline, health, routines, improvement and adjustment",                                        phrase: "I optimize" },
  Libra:        { house: 7,  constellation: "Libra",        name: "Reflection",    theme: "Relationships, mirrors, others, seeing self through others",                                      phrase: "I meet you" },
  Scorpius:     { house: 8,  constellation: "Scorpius",     name: "Descent",       theme: "Breakdown, loss, death of identity, confronting shadow and endings",                             phrase: "I am stripped" },
  Ophiuchus:    { house: 9,  constellation: "Ophiuchus",    name: "Alchemy",       theme: "Healing, integration, inner rebuilding, wisdom from pain, rewiring self after collapse",         phrase: "I transform what I survived" },
  Sagittarius:  { house: 10, constellation: "Sagittarius",  name: "Expansion",     theme: "Meaning, truth, direction, new worldview after transformation",                                  phrase: "I rise with purpose" },
  Capricornus:  { house: 11, constellation: "Capricornus",  name: "Contribution",  theme: "Society, impact, influence, role in the collective",                                             phrase: "I give to the world" },
  Aquarius:     { house: 12, constellation: "Aquarius",     name: "Dissolution",   theme: "Letting go, surrender, ego release, spiritual detachment",                                      phrase: "I release" },
  Pisces:       { house: 13, constellation: "Pisces",       name: "Return",        theme: "Completion, reset, transition to new cycle, death of the cycle itself, rebirth potential",       phrase: "I return to begin again" },
};

export const SBA_HOUSES_ORDERED: SBAHouseData[] = Object.values(SBA_HOUSES).sort(
  (a, b) => a.house - b.house
);

function getSBAHouse(constellation: string): SBAHouseData | null {
  return SBA_HOUSES[constellation] ?? null;
}

// ─── Result interfaces ────────────────────────────────────────────────────────

export interface PlanetResult {
  body: string;
  constellation: string;
  ra: string;
  dec: string;
  eclipticLon: number;
  sbaHouseNumber: number | null;
  sbaHouseName: string;
  sbaHouseTheme: string;
  sbaHousePhrase: string;
}

export interface AngleResult {
  name: string;
  eclipticLon: number;
  eclipticLonFormatted: string;
  constellation: string;
  sbaHouseNumber: number | null;
  sbaHouseName: string;
  sbaHouseTheme: string;
  sbaHousePhrase: string;
}

export interface AdditionalPoint {
  name: string;
  eclipticLon: number;
  eclipticLonFormatted: string;
  constellation: string;
  sbaHouseNumber: number | null;
  sbaHouseName: string;
  sbaHouseTheme: string;
  sbaHousePhrase: string;
}

export interface SBAResult {
  sbaYear: number;
  sbaYearStart: string;
  sbaLunarMonth: number;
  planets: PlanetResult[];
  angles: AngleResult[];
  additionalPoints: AdditionalPoint[];
  utcDateTime: string;
}

// ─── Bodies list ──────────────────────────────────────────────────────────────

const BODIES: Array<{ name: string; body: Astronomy.Body }> = [
  { name: "Sun", body: Astronomy.Body.Sun },
  { name: "Moon", body: Astronomy.Body.Moon },
  { name: "Mercury", body: Astronomy.Body.Mercury },
  { name: "Venus", body: Astronomy.Body.Venus },
  { name: "Mars", body: Astronomy.Body.Mars },
  { name: "Jupiter", body: Astronomy.Body.Jupiter },
  { name: "Saturn", body: Astronomy.Body.Saturn },
  { name: "Uranus", body: Astronomy.Body.Uranus },
  { name: "Neptune", body: Astronomy.Body.Neptune },
  { name: "Pluto", body: Astronomy.Body.Pluto },
];

// ─── Math helpers ─────────────────────────────────────────────────────────────

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function normalize360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Convert apparent geocentric equatorial coordinates to ecliptic longitude (°).
 * Uses the standard coordinate rotation (no tan to avoid ±90° singularity):
 *   λ = atan2( sin(δ)·sin(ε) + cos(δ)·cos(ε)·sin(α) , cos(δ)·cos(α) )
 * @param ra_hours RA in decimal hours (0–24)
 * @param dec_deg  Declination in degrees
 * @param eps_deg  Mean obliquity of the ecliptic in degrees
 */
function equatorialToEclipticLon(ra_hours: number, dec_deg: number, eps_deg: number): number {
  const alpha = toRad(ra_hours * 15);
  const delta = toRad(dec_deg);
  const eps   = toRad(eps_deg);
  const sinLon = Math.sin(delta) * Math.sin(eps) + Math.cos(delta) * Math.cos(eps) * Math.sin(alpha);
  const cosLon = Math.cos(delta) * Math.cos(alpha);
  return normalize360(toDeg(Math.atan2(sinLon, cosLon)));
}

function julianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

/** IAU 1980 mean obliquity of the ecliptic (degrees). T in Julian centuries from J2000. */
function meanObliquity(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  return (
    23.439291111 -
    0.013004167 * T -
    1.6388889e-7 * T * T +
    5.0361111e-7 * T * T * T
  );
}

/**
 * Convert ecliptic longitude (on ecliptic plane, lat=0) to equatorial RA (hours) and Dec (degrees).
 * Used so we can pass angle positions to Astronomy.Constellation().
 */
function eclipticLonToEquatorial(
  lonDeg: number,
  eps: number
): { ra: number; dec: number } {
  const l = toRad(lonDeg);
  const e = toRad(eps);
  const raRaw = toDeg(Math.atan2(Math.sin(l) * Math.cos(e), Math.cos(l)));
  const dec = toDeg(Math.asin(Math.sin(e) * Math.sin(l)));
  return { ra: normalize360(raRaw) / 15, dec };
}

function constellationForEclipticLon(lonDeg: number, eps: number): string {
  const eq = eclipticLonToEquatorial(lonDeg, eps);
  return Astronomy.Constellation(eq.ra, eq.dec).name;
}

// ─── AC / MC ──────────────────────────────────────────────────────────────────

function calcMC(ramcDeg: number, epsDeg: number): number {
  const ramc = toRad(ramcDeg);
  const eps = toRad(epsDeg);
  return normalize360(toDeg(Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(eps))));
}

function calcAscendant(ramcDeg: number, epsDeg: number, latDeg: number): number {
  const ramc = toRad(ramcDeg);
  const eps = toRad(epsDeg);
  const lat = toRad(latDeg);
  const y = Math.cos(ramc);
  const x = -(Math.sin(ramc) * Math.cos(eps) + Math.tan(lat) * Math.sin(eps));
  return normalize360(toDeg(Math.atan2(y, x)));
}

/**
 * Vertex: western intersection of the prime vertical with the ecliptic.
 * Computed as Anti-Vertex (= AC formula with RAMC+90° and negated latitude) + 180°.
 */
function calcVertex(ramcDeg: number, epsDeg: number, latDeg: number): number {
  const antiVertex = calcAscendant(normalize360(ramcDeg + 90), epsDeg, -latDeg);
  return normalize360(antiVertex + 180);
}

// ─── Kepler orbit solver for Chiron ──────────────────────────────────────────

/** Solve Kepler's equation M = E - e*sin(E) for E (radians), Newton-Raphson. */
function solveKepler(M: number, e: number): number {
  let E = M;
  for (let i = 0; i < 100; i++) {
    const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

interface OrbitalElements {
  epochJD: number;
  e: number;
  a: number;
  i: number;
  Omega: number;
  omega: number;
  M0: number;
  n: number;
}

function helioEclipticFromElements(
  jd: number,
  el: OrbitalElements
): { lon: number; lat: number; r: number } {
  const M = toRad(normalize360(el.M0 + el.n * (jd - el.epochJD)));
  const E = solveKepler(M, el.e);
  const nu = 2 * Math.atan2(
    Math.sqrt(1 + el.e) * Math.sin(E / 2),
    Math.sqrt(1 - el.e) * Math.cos(E / 2)
  );
  const r = el.a * (1 - el.e * Math.cos(E));
  const omega = toRad(el.omega);
  const Omega = toRad(el.Omega);
  const incl = toRad(el.i);
  const u = nu + omega;
  const lon = Math.atan2(Math.sin(u) * Math.cos(incl), Math.cos(u)) + Omega;
  const lat = Math.asin(Math.sin(u) * Math.sin(incl));
  return { lon: normalize360(toDeg(lon)), lat: toDeg(lat), r };
}

function geocentricEclipticLon(
  helio: { lon: number; lat: number; r: number },
  earthVec: Astronomy.Vector
): number {
  const lonR = toRad(helio.lon);
  const latR = toRad(helio.lat);
  const cx = helio.r * Math.cos(latR) * Math.cos(lonR);
  const cy = helio.r * Math.cos(latR) * Math.sin(lonR);

  const earthEcl = Astronomy.Ecliptic(earthVec);
  const earthR = earthVec.Length();
  const elon = toRad(earthEcl.elon);
  const elat = toRad(earthEcl.elat);
  const ex = earthR * Math.cos(elat) * Math.cos(elon);
  const ey = earthR * Math.cos(elat) * Math.sin(elon);

  return normalize360(toDeg(Math.atan2(cy - ey, cx - ex)));
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function formatEclipticLon(deg: number): string {
  const d = Math.floor(deg);
  const mTotal = (deg - d) * 60;
  const m = Math.floor(mTotal);
  const s = Math.round((mTotal - m) * 60);
  return `${String(d).padStart(3, "\u2007")}° ${String(m).padStart(2, "0")}' ${String(s).padStart(2, "0")}''`;
}

function formatRA(ra: number): string {
  const totalSeconds = Math.round(ra * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

function formatDec(dec: number): string {
  const sign = dec >= 0 ? "+" : "-";
  const abs = Math.abs(dec);
  const d = Math.floor(abs);
  const mTotal = (abs - d) * 60;
  const m = Math.floor(mTotal);
  const s = Math.round((mTotal - m) * 60);
  return `${sign}${String(d).padStart(2, "0")}° ${String(m).padStart(2, "0")}' ${String(s).padStart(2, "0")}''`;
}

function formatDate(date: Date): string {
  return date.toISOString().replace("T", " ").substring(0, 19) + " UTC";
}

function formatDateShort(date: Date): string {
  return date.toISOString().substring(0, 10);
}

// ─── SBA house annotation helpers ────────────────────────────────────────────

function withHouse(constellation: string): {
  sbaHouseNumber: number | null;
  sbaHouseName: string;
  sbaHouseTheme: string;
  sbaHousePhrase: string;
} {
  const h = getSBAHouse(constellation);
  return {
    sbaHouseNumber: h ? h.house : null,
    sbaHouseName: h ? h.name : "—",
    sbaHouseTheme: h ? h.theme : "—",
    sbaHousePhrase: h ? h.phrase : "—",
  };
}

// ─── Main calculation ─────────────────────────────────────────────────────────

export function calculateSBA(
  birthDate: string,
  birthTime: string,
  tzOffset: number,
  latitude: number,
  longitude: number
): SBAResult {
  const [year, month, day] = birthDate.split("-").map(Number);
  const [hour, minute] = birthTime.split(":").map(Number);

  const localMs =
    Date.UTC(year, month - 1, day, hour, minute) - tzOffset * 3600 * 1000;
  const utcDate = new Date(localMs);

  const observer = new Astronomy.Observer(latitude, longitude, 0);
  const jd = julianDate(utcDate);
  const eps = meanObliquity(jd);

  // ── Planets ───────────────────────────────────────────────────────────────
  const planets: PlanetResult[] = BODIES.map(({ name, body }) => {
    const equatorial = Astronomy.Equator(body, utcDate, observer, false, true);
    const con = Astronomy.Constellation(equatorial.ra, equatorial.dec);
    const eclLon = equatorialToEclipticLon(equatorial.ra, equatorial.dec, eps);
    return {
      body: name,
      constellation: con.name,
      ra: formatRA(equatorial.ra),
      dec: formatDec(equatorial.dec),
      eclipticLon: eclLon,
      ...withHouse(con.name),
    };
  });

  // ── AC / MC / RAMC ────────────────────────────────────────────────────────
  const gstHours = Astronomy.SiderealTime(utcDate);
  const lstHours = ((gstHours + longitude / 15) % 24 + 24) % 24;
  const ramcDeg = lstHours * 15;

  const mcLon = calcMC(ramcDeg, eps);
  const acLon = calcAscendant(ramcDeg, eps, latitude);

  function makeAngle(name: string, lon: number): AngleResult {
    const con = constellationForEclipticLon(lon, eps);
    return {
      name,
      eclipticLon: lon,
      eclipticLonFormatted: formatEclipticLon(lon),
      constellation: con,
      ...withHouse(con),
    };
  }

  const angles: AngleResult[] = [
    makeAngle("Ascendant (AC)", acLon),
    makeAngle("Midheaven (MC)", mcLon),
  ];

  // ── Additional points (each independently guarded) ────────────────────────

  const d = jd - 2451545.0;

  const unavailable: AdditionalPoint = {
    name: "",
    eclipticLon: 0,
    eclipticLonFormatted: "Not available yet",
    constellation: "—",
    sbaHouseNumber: null,
    sbaHouseName: "—",
    sbaHouseTheme: "—",
    sbaHousePhrase: "—",
  };

  function tryPoint(label: string, compute: () => number): AdditionalPoint {
    try {
      const lon = compute();
      const con = constellationForEclipticLon(lon, eps);
      return {
        name: label,
        eclipticLon: lon,
        eclipticLonFormatted: formatEclipticLon(lon),
        constellation: con,
        ...withHouse(con),
      };
    } catch (err) {
      console.error(`[SBA] Additional point "${label}" failed:`, err);
      return { ...unavailable, name: label };
    }
  }

  // 1. Mean North Node: Ω = 125.0445479 − 0.0529539297·d
  const northNodePoint = tryPoint("North Node", () =>
    normalize360(125.0445479 - 0.0529539297 * d)
  );

  // 2. South Node: opposite of North Node
  const southNodePoint = tryPoint("South Node", () =>
    normalize360(northNodePoint.eclipticLon + 180)
  );

  // 3. Chiron (Keplerian geocentric ecliptic longitude)
  const chironPoint = tryPoint("Chiron", () => {
    const chironElements: OrbitalElements = {
      epochJD: 2452195.5,
      e: 0.38303,
      a: 13.6253,
      i: 6.9218,
      Omega: 339.1968,
      omega: 338.7706,
      M0: 350.6744,
      n: 0.019549,
    };
    const chironHelio = helioEclipticFromElements(jd, chironElements);
    const earthVec = Astronomy.HelioVector(Astronomy.Body.Earth, utcDate);
    return geocentricEclipticLon(chironHelio, earthVec);
  });

  // 4. Mean Black Moon Lilith (mean lunar apogee)
  const lilithPoint = tryPoint("Lilith (Mean BML)", () =>
    normalize360(83.3532465 + 0.11140353 * d)
  );

  // 5. Part of Fortune (day/night aware)
  // SunPosition() = geocentric ecliptic; EclipticGeoMoon() = geocentric ecliptic of Moon.
  let isDayBirth = false;
  const pofPoint = tryPoint("Part of Fortune", () => {
    const sunLon = Astronomy.SunPosition(utcDate).elon;
    const moonLon = Astronomy.EclipticGeoMoon(utcDate).lon;
    const sunEq = Astronomy.Equator(Astronomy.Body.Sun, utcDate, observer, false, true);
    const sunHorizon = Astronomy.Horizon(utcDate, observer, sunEq.ra, sunEq.dec, "normal");
    isDayBirth = sunHorizon.altitude > 0;
    return isDayBirth
      ? normalize360(acLon + moonLon - sunLon)
      : normalize360(acLon - moonLon + sunLon);
  });
  if (pofPoint.eclipticLonFormatted !== "Not available yet") {
    pofPoint.name = `Part of Fortune (${isDayBirth ? "day" : "night"})`;
  }

  // 6. Vertex
  const vertexPoint = tryPoint("Vertex (VX)", () =>
    calcVertex(ramcDeg, eps, latitude)
  );

  const additionalPoints: AdditionalPoint[] = [
    northNodePoint,
    southNodePoint,
    chironPoint,
    lilithPoint,
    pofPoint,
    vertexPoint,
  ];

  // ── SBA Year ──────────────────────────────────────────────────────────────
  const marchEquinoxSearch = Astronomy.SearchSunLongitude(
    0,
    new Date(Date.UTC(year - 1, 11, 1)),
    400
  );
  if (!marchEquinoxSearch) throw new Error("Could not find March equinox for the birth year.");

  const firstNewMoon = Astronomy.SearchMoonPhase(0, marchEquinoxSearch.date, 35);
  if (!firstNewMoon) throw new Error("Could not find first new moon after March equinox.");

  const sbaYearStart = firstNewMoon.date;
  let lunarMonth = 1;
  let searchDate = new Date(sbaYearStart.getTime());

  if (utcDate >= sbaYearStart) {
    while (true) {
      const searchFrom = new Date(searchDate.getTime() + 1000);
      const nextNewMoon = Astronomy.SearchMoonPhase(0, searchFrom, 35);
      if (!nextNewMoon || nextNewMoon.date > utcDate) break;
      lunarMonth++;
      searchDate = nextNewMoon.date;
    }
  }

  return {
    sbaYear: year,
    sbaYearStart: formatDateShort(sbaYearStart),
    sbaLunarMonth: lunarMonth,
    planets,
    angles,
    additionalPoints,
    utcDateTime: formatDate(utcDate),
  };
}
