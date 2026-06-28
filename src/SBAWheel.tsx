import type { SBAResult } from "./lib/sbaCalculations";

// ─── Layout constants ─────────────────────────────────────────────────────────

const CX = 280, CY = 280;               // SVG centre  (viewBox 560 × 560)
const NUM_HOUSES = 13;
const DEG = 360 / NUM_HOUSES;           // ≈ 27.692° per house

/**
 * ROTATION_OFFSET aligns House-1 centre (visual lon = DEG/2 ≈ 13.846°)
 * to the top of the circle (SVG polar angle = −90°).
 *
 *   svgAngle = (visualLon − ROTATION_OFFSET) × π/180
 */
const ROTATION_OFFSET = DEG / 2 + 90;  // ≈ 103.846°

// Ring radii
const OUTER_R        = 272;  // outer border
const HOUSE_INNER_R  = 206;  // inner edge of house ring  (= outer edge of planet band)
const HOUSE_NUM_R    = 254;  // label row 1 — house number
const HOUSE_CON_R    = 238;  // label row 2 — constellation name
const HOUSE_THEME_R  = 222;  // label row 3 — theme name
const PLANET_INNER_R = 152;  // inner edge of planet band (= outer edge of points area)
const CENTER_R       = 25;   // centre decoration

// Stacking radii within each band (outer → inner)
const PLANET_RADII = [177, 160, 194, 143];
const POINTS_RADII = [112,  97, 128,  82];

// Two bodies within this many degrees (visual) get staggered radii
const STACK_THRESHOLD = 8;

// ─── House definitions ────────────────────────────────────────────────────────

const HOUSE_DEFS = [
  { num: 1,  short: "Aries",       theme: "Emergence",     color: "#fff5f4" },
  { num: 2,  short: "Taurus",      theme: "Stabilization", color: "#f4fff5" },
  { num: 3,  short: "Gemini",      theme: "Awareness",     color: "#fafaf0" },
  { num: 4,  short: "Cancer",      theme: "Foundation",    color: "#f0f6ff" },
  { num: 5,  short: "Leo",         theme: "Expression",    color: "#fffbf0" },
  { num: 6,  short: "Virgo",       theme: "Refinement",    color: "#f4fef0" },
  { num: 7,  short: "Libra",       theme: "Reflection",    color: "#fef0fa" },
  { num: 8,  short: "Scorpio",     theme: "Descent",       color: "#f0eeff" },
  { num: 9,  short: "Ophiuchus",   theme: "Alchemy",       color: "#eefff7" },
  { num: 10, short: "Sagittarius", theme: "Expansion",     color: "#fff8f0" },
  { num: 11, short: "Capricorn",   theme: "Contribution",  color: "#f0f0f8" },
  { num: 12, short: "Aquarius",    theme: "Dissolution",   color: "#eef6ff" },
  { num: 13, short: "Pisces",      theme: "Return",        color: "#eefffe" },
];

// ─── Styling by body type ─────────────────────────────────────────────────────

const STYLE = {
  planet: { fontSize: 9,  fill: "#2c2820", fontWeight: "500", tickW: 0.75 },
  angle:  { fontSize: 10, fill: "#5a3070", fontWeight: "700", tickW: 1.5  },
  point:  { fontSize: 8,  fill: "#3a5a40", fontWeight: "500", tickW: 0.75 },
} as const;

// ─── Label abbreviations ──────────────────────────────────────────────────────

const ABBREV: Record<string, string> = {
  Sun: "Sun", Moon: "Moon", Mercury: "Merc", Venus: "Ven",
  Mars: "Mars", Jupiter: "Jup", Saturn: "Sat", Uranus: "Uran",
  Neptune: "Nep", Pluto: "Plu",
  "Ascendant (AC)": "AC", "Midheaven (MC)": "MC",
  "North Node": "NN", "South Node": "SN",
  Chiron: "Chiron", "Lilith (Mean BML)": "Lilith", "Vertex (VX)": "VX",
};
function abbrev(name: string): string {
  if (name.startsWith("Part of Fortune")) return "Fort.";
  return ABBREV[name] ?? name.slice(0, 7);
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

/**
 * Convert a VISUAL longitude (position within the 13-segment wheel, 0–360°)
 * to SVG Cartesian coordinates.
 *
 *   svgAngle = (visualLon − ROTATION_OFFSET) × π/180
 *   x = cx + r × cos(svgAngle)
 *   y = cy + r × sin(svgAngle)
 */
function lonToXY(cx: number, cy: number, r: number, lon: number) {
  const a = (lon - ROTATION_OFFSET) * (Math.PI / 180);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/** Pie-slice SVG path.  Each house ≈ 27.7° → largeArc always 0. */
function piePath(cx: number, cy: number, r: number, s: number, e: number) {
  const p1 = lonToXY(cx, cy, r, s);
  const p2 = lonToXY(cx, cy, r, e);
  return `M ${cx} ${cy} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 0 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} Z`;
}

/**
 * Tangential text rotation — makes labels read along the arc, never upside-down.
 * midAngleDeg: angle from the +x axis (clockwise in SVG).
 */
function tangentRot(midAngleDeg: number): number {
  let rot = ((midAngleDeg + 90) % 360 + 360) % 360;
  if (rot > 90 && rot < 270) rot = (rot - 180 + 360) % 360;
  return rot;
}

// ─── Body types ───────────────────────────────────────────────────────────────

interface WheelBody {
  label: string;
  /** true ecliptic longitude (reference only, not used for segment choice) */
  eclipticLon: number;
  /**
   * Visual longitude on the wheel (0–360°) determined by sbaHouseNumber.
   * This is what lonToXY uses — it always places the body inside the
   * correct SBA house segment.
   */
  visualLon: number;
  houseNum: number | null;
  type: "planet" | "angle" | "point";
}

// ─── Visual-longitude assignment ──────────────────────────────────────────────

/**
 * Given a list of raw bodies (each with a true ecliptic longitude and an SBA
 * house number from the tables), compute a visualLon for each one that:
 *
 *  1. Falls inside the correct SBA house segment on the wheel.
 *  2. Spreads multiple bodies within the same house evenly across the segment.
 *  3. Logs a dev warning when eclipticLon would map to a different segment.
 */
function assignVisualLongitudes(
  bodies: Array<{ label: string; eclipticLon: number; houseNum: number | null; type: WheelBody["type"] }>
): WheelBody[] {

  // Group by SBA house number
  const byHouse = new Map<number, typeof bodies>();
  for (const b of bodies) {
    const h = b.houseNum ?? 0;
    if (!byHouse.has(h)) byHouse.set(h, []);
    byHouse.get(h)!.push(b);
  }

  const result: WheelBody[] = [];

  for (const [houseNum, group] of byHouse.entries()) {
    // Fallback for bodies with no valid house: use raw ecliptic longitude
    if (houseNum < 1 || houseNum > NUM_HOUSES) {
      for (const b of group) {
        result.push({ ...b, visualLon: b.eclipticLon });
      }
      continue;
    }

    const segCenter = (houseNum - 1) * DEG + DEG / 2;
    // Use 75% of the segment width to keep labels away from divider lines
    const usableSpread = DEG * 0.75;

    // Sort within the house by eclipticLon so ordering is stable and meaningful
    const sorted = [...group].sort((a, b) => a.eclipticLon - b.eclipticLon);

    sorted.forEach((b, idx) => {
      // fraction ∈ [-0.5, +0.5]
      const fraction = sorted.length === 1
        ? 0
        : (idx / (sorted.length - 1)) - 0.5;
      const visualLon = segCenter + fraction * usableSpread;

      // Dev warning: does the raw ecliptic longitude map to a different segment?
      const lonSegment = Math.floor(b.eclipticLon / DEG) + 1;
      if (lonSegment !== houseNum) {
        console.warn(
          `[SBAWheel] ${b.label}: table house=${houseNum} (constellation-based),` +
          ` but eclipticLon=${b.eclipticLon.toFixed(1)}° would fall in segment ${lonSegment}.` +
          ` Placing in house ${houseNum} to match the table.`
        );
      }

      result.push({ ...b, visualLon });
    });
  }

  return result;
}

// ─── Radius stacking ──────────────────────────────────────────────────────────

/**
 * Sort bodies by visualLon, then for each body count how many already-placed
 * bodies are within STACK_THRESHOLD visual degrees and assign a stacking radius.
 */
function assignRadii(bodies: WheelBody[], radii: number[]): Array<WheelBody & { r: number }> {
  const sorted = [...bodies].sort((a, b) => a.visualLon - b.visualLon);
  const placed: Array<WheelBody & { r: number }> = [];
  for (const b of sorted) {
    const nearby = placed.filter(p => {
      const d = Math.abs(b.visualLon - p.visualLon);
      return Math.min(d, 360 - d) < STACK_THRESHOLD;
    }).length;
    placed.push({ ...b, r: radii[Math.min(nearby, radii.length - 1)] });
  }
  return placed;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props { result: SBAResult }

export function SBAWheel({ result }: Props) {

  // Collect raw bodies from the same data the tables use
  const rawPlanetBand = [
    ...result.planets.map(p => ({
      label: abbrev(p.body),
      eclipticLon: p.eclipticLon,
      houseNum: p.sbaHouseNumber,
      type: "planet" as const,
    })),
    ...result.angles.map(a => ({
      label: abbrev(a.name),
      eclipticLon: a.eclipticLon,
      houseNum: a.sbaHouseNumber,
      type: "angle" as const,
    })),
  ];

  const rawPointsBand = result.additionalPoints
    .filter(pt => pt.eclipticLonFormatted !== "Not available yet")
    .map(pt => ({
      label: abbrev(pt.name),
      eclipticLon: pt.eclipticLon,
      houseNum: pt.sbaHouseNumber,
      type: "point" as const,
    }));

  // 1. Assign visual longitudes (respecting sbaHouseNumber from the tables)
  const planetBodiesVL = assignVisualLongitudes(rawPlanetBand);
  const pointsBodiesVL = assignVisualLongitudes(rawPointsBand);

  // 2. Assign stacking radii within each band (by visual proximity)
  const planetBand = assignRadii(planetBodiesVL, PLANET_RADII);
  const pointsBand = assignRadii(pointsBodiesVL, POINTS_RADII);

  // Helper: SVG rotate(angle, x, y) transform string
  const rotStr = (rot: number, p: { x: number; y: number }) =>
    `rotate(${rot.toFixed(1)},${p.x.toFixed(2)},${p.y.toFixed(2)})`;

  return (
    <div>
      <svg
        viewBox="0 0 560 560"
        style={{ width: "100%", maxWidth: "520px", display: "block", margin: "0 auto" }}
        aria-label="SBA Wheel — placement by constellation-based house"
      >
        {/* ── 1. House pie slices ────────────────────────────────────────── */}
        {HOUSE_DEFS.map((h, i) => (
          <path
            key={`slice-${i}`}
            d={piePath(CX, CY, OUTER_R, i * DEG, (i + 1) * DEG)}
            fill={h.color}
            stroke="#cac2ba"
            strokeWidth="0.5"
          />
        ))}

        {/* ── 2. Ring borders ────────────────────────────────────────────── */}
        <circle cx={CX} cy={CY} r={OUTER_R}        fill="none" stroke="#9a9088" strokeWidth="1.25" />
        <circle cx={CX} cy={CY} r={HOUSE_INNER_R}  fill="none" stroke="#b0a89a" strokeWidth="0.9"  />
        <circle cx={CX} cy={CY} r={PLANET_INNER_R} fill="none" stroke="#cac2ba" strokeWidth="0.6"  />

        {/* ── 3. Radial dividers — house ring ────────────────────────────── */}
        {HOUSE_DEFS.map((_, i) => {
          const p1 = lonToXY(CX, CY, HOUSE_INNER_R, i * DEG);
          const p2 = lonToXY(CX, CY, OUTER_R,       i * DEG);
          return (
            <line key={`hdiv-${i}`}
              x1={p1.x.toFixed(2)} y1={p1.y.toFixed(2)}
              x2={p2.x.toFixed(2)} y2={p2.y.toFixed(2)}
              stroke="#b0a89a" strokeWidth="0.75"
            />
          );
        })}

        {/* ── 4. Soft radial dividers — body area ────────────────────────── */}
        {HOUSE_DEFS.map((_, i) => {
          const p1 = lonToXY(CX, CY, CENTER_R + 2,      i * DEG);
          const p2 = lonToXY(CX, CY, HOUSE_INNER_R - 2, i * DEG);
          return (
            <line key={`bdiv-${i}`}
              x1={p1.x.toFixed(2)} y1={p1.y.toFixed(2)}
              x2={p2.x.toFixed(2)} y2={p2.y.toFixed(2)}
              stroke="#ddd8d0" strokeWidth="0.4"
            />
          );
        })}

        {/* ── 5. House labels — three rows at distinct radii ─────────────── */}
        {HOUSE_DEFS.map((h, i) => {
          const midLon = i * DEG + DEG / 2;
          const rot    = tangentRot(midLon - ROTATION_OFFSET);
          const pNum   = lonToXY(CX, CY, HOUSE_NUM_R,   midLon);
          const pCon   = lonToXY(CX, CY, HOUSE_CON_R,   midLon);
          const pThm   = lonToXY(CX, CY, HOUSE_THEME_R, midLon);
          return (
            <g key={`hlbl-${i}`}>
              <text x={pNum.x.toFixed(2)} y={pNum.y.toFixed(2)}
                transform={rotStr(rot, pNum)}
                textAnchor="middle" dominantBaseline="middle"
                fontFamily="Georgia, serif" fontWeight="700" fontSize="11" fill="#2a2620"
              >{h.num}</text>
              <text x={pCon.x.toFixed(2)} y={pCon.y.toFixed(2)}
                transform={rotStr(rot, pCon)}
                textAnchor="middle" dominantBaseline="middle"
                fontFamily="Georgia, serif" fontSize="7.5" fill="#555"
              >{h.short}</text>
              <text x={pThm.x.toFixed(2)} y={pThm.y.toFixed(2)}
                transform={rotStr(rot, pThm)}
                textAnchor="middle" dominantBaseline="middle"
                fontFamily="Georgia, serif" fontSize="6.5" fontStyle="italic" fill="#888"
              >{h.theme}</text>
            </g>
          );
        })}

        {/* ── 6. Tick marks at house-ring boundary (planet & angle) ─────── */}
        {planetBand.map((b, i) => {
          const inner = lonToXY(CX, CY, HOUSE_INNER_R - 7, b.visualLon);
          const outer = lonToXY(CX, CY, HOUSE_INNER_R + 4, b.visualLon);
          const st    = STYLE[b.type];
          return (
            <line key={`ptick-${i}`}
              x1={inner.x.toFixed(2)} y1={inner.y.toFixed(2)}
              x2={outer.x.toFixed(2)} y2={outer.y.toFixed(2)}
              stroke={st.fill} strokeWidth={st.tickW}
            />
          );
        })}

        {/* ── 7. Tick marks at planet-inner boundary (additional points) ─── */}
        {pointsBand.map((b, i) => {
          const inner = lonToXY(CX, CY, PLANET_INNER_R - 5, b.visualLon);
          const outer = lonToXY(CX, CY, PLANET_INNER_R + 3, b.visualLon);
          return (
            <line key={`qtick-${i}`}
              x1={inner.x.toFixed(2)} y1={inner.y.toFixed(2)}
              x2={outer.x.toFixed(2)} y2={outer.y.toFixed(2)}
              stroke={STYLE.point.fill} strokeWidth="0.75" opacity="0.6"
            />
          );
        })}

        {/* ── 8. Additional-point labels ─────────────────────────────────── */}
        {pointsBand.map((b, i) => {
          const pos = lonToXY(CX, CY, b.r, b.visualLon);
          return (
            <text key={`qlbl-${i}`}
              x={pos.x.toFixed(2)} y={pos.y.toFixed(2)}
              textAnchor="middle" dominantBaseline="middle"
              fontFamily="Georgia, serif"
              fontSize={STYLE.point.fontSize}
              fill={STYLE.point.fill}
              fontWeight={STYLE.point.fontWeight}
            >{b.label}</text>
          );
        })}

        {/* ── 9. Planet & angle labels ───────────────────────────────────── */}
        {planetBand.map((b, i) => {
          const pos = lonToXY(CX, CY, b.r, b.visualLon);
          const st  = STYLE[b.type];
          return (
            <text key={`plbl-${i}`}
              x={pos.x.toFixed(2)} y={pos.y.toFixed(2)}
              textAnchor="middle" dominantBaseline="middle"
              fontFamily="Georgia, serif"
              fontSize={st.fontSize}
              fill={st.fill}
              fontWeight={st.fontWeight}
            >{b.label}</text>
          );
        })}

        {/* ── 10. AC / MC emphasis dots on the house-ring inner boundary ─── */}
        {planetBand.filter(b => b.type === "angle").map((b, i) => {
          const pos = lonToXY(CX, CY, HOUSE_INNER_R, b.visualLon);
          return (
            <circle key={`acmc-${i}`}
              cx={pos.x.toFixed(2)} cy={pos.y.toFixed(2)}
              r="4" fill="#5a3070" stroke="#fff" strokeWidth="1"
            />
          );
        })}

        {/* ── 11. Centre decoration ──────────────────────────────────────── */}
        <circle cx={CX} cy={CY} r={CENTER_R} fill="#f5f3ef" stroke="#c0b8b0" strokeWidth="0.75" />
        <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle"
          fontSize="7" fill="#aaa" fontFamily="Georgia, serif" letterSpacing="0.5"
        >SBA</text>
      </svg>

      {/* ── Legend ─────────────────────────────────────────────────────────── */}
      <div className="wheel-legend">
        <span className="legend-planets">Bodies: Sun · Moon · Merc · Ven · Mars · Jup · Sat · Uran · Nep · Plu</span>
        <span className="legend-angles">Angles: AC · MC</span>
        <span className="legend-points">Points: NN · SN · Lilith · Fort. · VX · Chiron</span>
      </div>
    </div>
  );
}
