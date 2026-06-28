import { useState } from "react";
import { calculateSBA, SBA_HOUSES_ORDERED, type SBAResult } from "./lib/sbaCalculations";
import { SBAWheel } from "./SBAWheel";

interface FormData {
  clientName: string;
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  latitude: string;
  longitude: string;
  tzOffset: string;
}

const initialForm: FormData = {
  clientName: "",
  birthDate: "",
  birthTime: "",
  birthPlace: "",
  latitude: "",
  longitude: "",
  tzOffset: "0",
};

export default function App() {
  const [form, setForm] = useState<FormData>(initialForm);
  const [resolvedPlace, setResolvedPlace] = useState<string>("");
  const [placeError, setPlaceError] = useState<string>("");
  const [placeLoading, setPlaceLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [result, setResult] = useState<SBAResult | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [submittedName, setSubmittedName] = useState("");
  const [submittedBirth, setSubmittedBirth] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleFindPlace() {
    const query = form.birthPlace.trim();
    if (!query) {
      setPlaceError("Please enter a city and country.");
      return;
    }
    setPlaceError("");
    setResolvedPlace("");
    setPlaceLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`;
      const res = await fetch(url, {
        headers: { "Accept-Language": "en" },
      });
      if (!res.ok) throw new Error("Nominatim request failed.");
      const data = await res.json();
      if (!data || data.length === 0) {
        setPlaceError(`No results found for "${query}". Try adding a country name.`);
        return;
      }
      const place = data[0];
      const lat = parseFloat(place.lat).toFixed(4);
      const lon = parseFloat(place.lon).toFixed(4);
      const displayName: string = place.display_name ?? query;
      setForm((prev) => ({ ...prev, latitude: lat, longitude: lon }));
      setResolvedPlace(displayName);
    } catch {
      setPlaceError("Could not reach the geocoding service. Check your connection.");
    } finally {
      setPlaceLoading(false);
    }
  }

  function handlePlaceKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleFindPlace();
  }

  function validate(): string {
    if (!form.clientName.trim()) return "Client name is required.";
    if (!form.birthDate) return "Birth date is required.";
    if (!form.birthTime) return "Birth time is required.";
    const lat = parseFloat(form.latitude);
    const lon = parseFloat(form.longitude);
    const tz = parseFloat(form.tzOffset);
    if (isNaN(lat) || lat < -90 || lat > 90)
      return "Latitude is missing or invalid. Use Find Place to set it.";
    if (isNaN(lon) || lon < -180 || lon > 180)
      return "Longitude is missing or invalid. Use Find Place to set it.";
    if (isNaN(tz) || tz < -14 || tz > 14)
      return "Timezone offset must be between -14 and 14.";
    return "";
  }

  async function handleCalculate() {
    setError("");
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      await new Promise((r) => setTimeout(r, 50));
      const sbaResult = calculateSBA(
        form.birthDate,
        form.birthTime,
        parseFloat(form.tzOffset),
        parseFloat(form.latitude),
        parseFloat(form.longitude)
      );
      setResult(sbaResult);
      setSubmittedName(form.clientName.trim());
      const placeLabel = resolvedPlace || form.birthPlace || `${form.latitude}, ${form.longitude}`;
      setSubmittedBirth(
        `${form.birthDate} ${form.birthTime} · ${placeLabel} (UTC${parseFloat(form.tzOffset) >= 0 ? "+" : ""}${form.tzOffset})`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Calculation failed. Please check your inputs."
      );
    } finally {
      setLoading(false);
    }
  }

  const coordsReady = form.latitude !== "" && form.longitude !== "";

  return (
    <div className="app-container">
      <div className="app-header">
        <h1>SBA True Calculator</h1>
        <p className="subtitle">Solar-Biological-Astral Profile</p>
        <p className="system-note">Astronomy-first system (IAU sky). Not tropical astrology.</p>
      </div>

      <div className="form-section">
        <h2>Birth Data</h2>
        <div className="form-grid">
          <div className="form-group full-width">
            <label htmlFor="clientName">Client Name</label>
            <input
              id="clientName"
              name="clientName"
              type="text"
              placeholder="Full name"
              value={form.clientName}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="birthDate">Birth Date</label>
            <input
              id="birthDate"
              name="birthDate"
              type="date"
              value={form.birthDate}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="birthTime">Birth Time</label>
            <input
              id="birthTime"
              name="birthTime"
              type="time"
              value={form.birthTime}
              onChange={handleChange}
            />
          </div>

          <div className="form-group full-width">
            <label htmlFor="birthPlace">Birth Place</label>
            <div className="place-row">
              <input
                id="birthPlace"
                name="birthPlace"
                type="text"
                placeholder="e.g. Copenhagen, Denmark"
                value={form.birthPlace}
                onChange={handleChange}
                onKeyDown={handlePlaceKeyDown}
              />
              <button
                type="button"
                className="btn-find-place"
                onClick={handleFindPlace}
                disabled={placeLoading}
              >
                {placeLoading ? "Searching…" : "Find Place"}
              </button>
            </div>
            {placeError && <div className="field-error">{placeError}</div>}
            {resolvedPlace && !placeError && (
              <div className="place-resolved">
                <span className="place-check">✓</span> {resolvedPlace}
                {coordsReady && (
                  <span className="place-coords">
                    &nbsp;· {form.latitude}, {form.longitude}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="form-group full-width">
            <label htmlFor="tzOffset">Timezone Offset (hours from UTC)</label>
            <input
              id="tzOffset"
              name="tzOffset"
              type="number"
              step="0.5"
              placeholder="e.g. 0, 1, -5"
              value={form.tzOffset}
              onChange={handleChange}
              className="tz-input"
            />
            <div className="field-hint">
              Timezone still needs manual checking for now. Iceland = 0. Denmark winter = +1. Denmark summer = +2.
            </div>
          </div>
        </div>

        <div className="advanced-section">
          <button
            type="button"
            className="btn-advanced-toggle"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? "▾" : "▸"} Advanced / manual correction
          </button>

          {showAdvanced && (
            <div className="advanced-fields">
              <div className="form-grid advanced-grid">
                <div className="form-group">
                  <label htmlFor="latitude">Latitude</label>
                  <input
                    id="latitude"
                    name="latitude"
                    type="number"
                    step="0.0001"
                    placeholder="e.g. 55.6761"
                    value={form.latitude}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="longitude">Longitude</label>
                  <input
                    id="longitude"
                    name="longitude"
                    type="number"
                    step="0.0001"
                    placeholder="e.g. 12.5683"
                    value={form.longitude}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="field-hint" style={{ marginTop: "0.5rem" }}>
                These are filled automatically by Find Place. Edit only if you need to correct the coordinates.
              </div>
            </div>
          )}
        </div>

        <button
          className="btn-calculate"
          onClick={handleCalculate}
          disabled={loading}
        >
          {loading ? "Calculating..." : "Calculate SBA Profile"}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading && (
        <div className="loading-indicator">Computing planetary positions…</div>
      )}

      {result && (
        <div className="results-section">
          <div className="results-header">
            <h2>SBA Profile</h2>
            <div className="client-name-display">{submittedName}</div>
            <div className="birth-display">
              {submittedBirth} &nbsp;·&nbsp; UTC: {result.utcDateTime}
            </div>
          </div>

          <div className="sba-summary">
            <div className="sba-item">
              <span className="sba-label">SBA Year</span>
              <span className="sba-value highlight">{result.sbaYear}</span>
            </div>
            <div className="sba-item">
              <span className="sba-label">Year Start (New Moon after March Equinox)</span>
              <span className="sba-value">{result.sbaYearStart}</span>
            </div>
            <div className="sba-item">
              <span className="sba-label">SBA Lunar Month (Time-House)</span>
              <span className="sba-value highlight">{result.sbaLunarMonth}</span>
            </div>
          </div>

          <div className="section-divider" />

          {/* ── SBA Wheel ── */}
          <div className="angles-section">
            <div className="angles-heading">SBA Wheel</div>
            <p className="wheel-note">
              13 SBA houses shown as the fixed background. Placements are positioned by exact ecliptic longitude.
            </p>
            <SBAWheel result={result} />
          </div>

          <div className="section-divider" />

          {/* ── Angles ── */}
          <div className="angles-section">
            <div className="angles-heading">Angles</div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Angle</th>
                    <th>Constellation</th>
                    <th>SBA House</th>
                    <th>House Name</th>
                    <th>Ecliptic Longitude</th>
                  </tr>
                </thead>
                <tbody>
                  {result.angles.map((a) => (
                    <tr key={a.name}>
                      <td className="body-name">{a.name}</td>
                      <td className="constellation">{a.constellation}</td>
                      <td className="sba-house-num">{a.sbaHouseNumber ?? "—"}</td>
                      <td className="sba-house-name">{a.sbaHouseName}</td>
                      <td className="ra-dec">{a.eclipticLonFormatted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="angles-note">
              AC and MC depend strongly on exact birth time and location.
            </div>
          </div>

          <div className="section-divider" />

          {/* ── Additional Points ── */}
          <div className="angles-section">
            <div className="angles-heading">Additional Points</div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Point</th>
                    <th>Constellation</th>
                    <th>SBA House</th>
                    <th>House Name</th>
                    <th>Ecliptic Longitude</th>
                  </tr>
                </thead>
                <tbody>
                  {result.additionalPoints?.map((pt) => (
                    <tr key={pt.name}>
                      <td className="body-name">{pt.name}</td>
                      <td className="constellation">{pt.constellation}</td>
                      <td className="sba-house-num">{pt.sbaHouseNumber ?? "—"}</td>
                      <td className="sba-house-name">{pt.sbaHouseName}</td>
                      <td className="ra-dec">{pt.eclipticLonFormatted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="angles-note">
              North Node and Lilith use mean (averaged) positions. Chiron uses orbital elements with geocentric correction. Part of Fortune adapts to day/night birth.
            </div>
          </div>

          <div className="section-divider" />

          {/* ── Planets ── */}
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Body</th>
                  <th>Constellation</th>
                  <th>SBA House</th>
                  <th>House Name</th>
                  <th>Right Ascension</th>
                  <th>Declination</th>
                </tr>
              </thead>
              <tbody>
                {result.planets.map((p) => (
                  <tr key={p.body}>
                    <td className="body-name">{p.body}</td>
                    <td className="constellation">{p.constellation}</td>
                    <td className="sba-house-num">{p.sbaHouseNumber ?? "—"}</td>
                    <td className="sba-house-name">{p.sbaHouseName}</td>
                    <td className="ra-dec">{p.ra}</td>
                    <td className="ra-dec">{p.dec}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="section-divider" />

          {/* ── SBA House Reference ── */}
          <div className="angles-section">
            <div className="angles-heading">SBA House Reference</div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>House</th>
                    <th>Constellation</th>
                    <th>Name</th>
                    <th>Theme</th>
                    <th>Phrase</th>
                  </tr>
                </thead>
                <tbody>
                  {SBA_HOUSES_ORDERED.map((h) => (
                    <tr key={h.house}>
                      <td className="sba-house-num">{h.house}</td>
                      <td className="constellation">{h.constellation}</td>
                      <td className="sba-house-name">{h.name}</td>
                      <td className="sba-house-theme">{h.theme}</td>
                      <td className="sba-house-phrase">{h.phrase}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
