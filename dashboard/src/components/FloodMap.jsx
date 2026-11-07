
import {
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";

import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
  useMapEvents,
} from "react-leaflet";

import {
  fetchMapFeatures,
  fetchMapOverview,
} from "../services/api";

import "leaflet/dist/leaflet.css";

const INITIAL_BOUNDS = [
  [12.85, 80.05],
  [13.25, 80.35],
];

// Switch to individual 100m cells at this zoom level.
const DETAIL_ZOOM = 13;

const TIER_COLORS = {
  "Zero-score group": "#dce3e8",
  "Positive Tier 1": "#c6e7df",
  "Positive Tier 2": "#8fd3bd",
  "Positive Tier 3": "#f5d77e",
  "Positive Tier 4": "#eea45f",
  "Positive Tier 5": "#d9534f",
};

// Overview and ward colours represent relative percentages,
// not scientifically established flood-risk thresholds.
function getOverviewColor(percentage) {
  if (percentage === 0) return "#dce3e8";
  if (percentage <= 5) return "#c6e7df";
  if (percentage <= 10) return "#8fd3bd";
  if (percentage <= 20) return "#f5d77e";
  if (percentage <= 35) return "#eea45f";

  return "#d9534f";
}

function getTierColor(tier) {
  return TIER_COLORS[tier] || "#94a3b8";
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function formatPercentage(value) {
  return Number(value || 0).toFixed(2);
}

// --------------------------------------------------
// MAP CONTROLLER
// --------------------------------------------------

function MapController({ onViewChange, mapMode }) {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(INITIAL_BOUNDS, {
      padding: [10, 10],
    });
  }, [map]);

  // When switching back from ward view, restore the
  // automatic overview/detail behaviour at current bounds.
  useEffect(() => {
    if (mapMode !== "automatic") return;

    const bounds = map.getBounds();

    onViewChange({
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
      zoom: map.getZoom(),
    });
  }, [map, mapMode, onViewChange]);

  useMapEvents({
    moveend: () => {
      const bounds = map.getBounds();

      onViewChange({
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
        zoom: map.getZoom(),
      });
    },
  });

  return null;
}

// --------------------------------------------------
// OVERVIEW LAYER
// --------------------------------------------------

function OverviewLayer({ data, onCellSelect }) {
  if (!data) return null;

  const styleFeature = (feature) => {
    const percentage = Number(
      feature.properties.higher_priority_percentage || 0
    );

    return {
      fillColor: getOverviewColor(percentage),
      weight: 0.25,
      opacity: 0.55,
      color: "#52616b",
      fillOpacity: 0.82,
    };
  };

  const onEachFeature = (feature, layer) => {
    const p = feature.properties;

    const percentage = Number(
      p.higher_priority_percentage || 0
    );

    const popup = `
      <div style="min-width:220px">
        <strong>Overview block: ${p.overview_id}</strong>
        <hr/>

        <b>Total grid cells:</b>
        ${formatNumber(p.total_cells)}
        <br/>

        <b>Zero-score cells:</b>
        ${formatNumber(p.zero_score_count)}
        <br/>

        <b>Positive-score cells:</b>
        ${formatNumber(p.positive_score_count)}
        <br/>

        <hr/>

        <b>Tier 4 + Tier 5 cells:</b>
        ${formatNumber(p.higher_priority_count)}
        <br/>

        <b>Tier 4 + Tier 5 share:</b>
        ${formatPercentage(percentage)}%

        <hr/>

        <b>Dominant category:</b>
        ${p.dominant_category}

        <hr/>

        <small>
          Click this block to view its locality
          and investigation details.
        </small>
      </div>
    `;

    layer.bindPopup(popup);

    layer.on("click", () => {
      onCellSelect?.({
        ...p,
        selection_type: "overview",
        overview_center_latitude:
          p.overview_center_latitude ?? null,
        overview_center_longitude:
          p.overview_center_longitude ?? null,
      });
    });
  };

  return (
    <GeoJSON
      key="chennai-overview"
      data={data}
      style={styleFeature}
      onEachFeature={onEachFeature}
    />
  );
}

// --------------------------------------------------
// DETAILED 100m GRID LAYER
// --------------------------------------------------

function DetailedLayer({ data, onCellSelect }) {
  if (!data) return null;

  const styleFeature = (feature) => ({
    fillColor: getTierColor(
      feature.properties.relative_rank_tier
    ),
    weight: 0.35,
    opacity: 0.65,
    color: "#52616b",
    fillOpacity: 0.75,
  });

  const onEachFeature = (feature, layer) => {
    const p = feature.properties;

    const popup = `
      <div style="min-width:180px">
        <strong>${p.cell_id}</strong>
        <hr/>

        <b>Ranking tier:</b>
        ${p.relative_rank_tier}
        <br/>

        <b>Ranking score:</b>
        ${Number(p.ranking_score).toFixed(4)}
        <br/>

        <b>Percentile:</b>
        ${Number(p.ranking_percentile).toFixed(2)}
        <br/>

        <b>Elevation:</b>
        ${p.elevation_m ?? "N/A"} m
        <br/>

        <b>Road density:</b>
        ${p.road_density_m_per_km2 ?? "N/A"}
      </div>
    `;

    layer.bindPopup(popup);

    layer.on("click", () => {
      onCellSelect?.({
        ...p,
        selection_type: "cell",
      });
    });
  };

  return (
    <GeoJSON
      key={JSON.stringify(data.metadata)}
      data={data}
      style={styleFeature}
      onEachFeature={onEachFeature}
    />
  );
}

// --------------------------------------------------
// GCC WARD LAYER
// --------------------------------------------------

function WardLayer({ data }) {
  if (!data || !Array.isArray(data.features)) {
    return null;
  }

  const styleFeature = (feature) => {
    const percentage = Number(
      feature.properties.higher_priority_percentage || 0
    );

    return {
      fillColor: getOverviewColor(percentage),
      weight: 1,
      opacity: 0.9,
      color: "#34495e",
      fillOpacity: 0.75,
    };
  };

  const onEachFeature = (feature, layer) => {
    const p = feature.properties;

    const wardNumber =
      p.ward ?? p.ward_number ?? p.ward_id ?? "N/A";

    const zone = p.zone ?? "N/A";

    const rank =
      p.investigation_rank ?? p.rank ?? "N/A";

    const totalCells = Number(p.total_cells || 0);

    const higherPriorityCount = Number(
      p.higher_priority_count || 0
    );

    const percentage = Number(
      p.higher_priority_percentage || 0
    );

    const evidence = Number(
      p.recorded_positive_evidence_cells || 0
    );

    const popup = `
      <div style="min-width:240px">

        <strong>GCC Ward ${wardNumber}</strong>

        <hr/>

        <b>Zone:</b> ${zone}
        <br/>

        <b>Investigation rank:</b> ${rank}
        <br/>

        <b>Investigation classification:</b>
        ${p.investigation_priority || "Relative investigation ranking"}

        <hr/>

        <b>Total assigned grid cells:</b>
        ${formatNumber(totalCells)}
        <br/>

        <b>Tier 4 + Tier 5 cells:</b>
        ${formatNumber(higherPriorityCount)}
        <br/>

        <b>Tier 4 + Tier 5 share:</b>
        ${formatPercentage(percentage)}%
        <br/>

        <b>Recorded positive evidence cells:</b>
        ${formatNumber(evidence)}

        <hr/>

        <small>
          This is a relative investigation-priority ranking,
          not a calibrated flood-risk measurement.
          A positive ranking does not confirm flooding.
        </small>

      </div>
    `;

    layer.bindPopup(popup);

    layer.on("mouseover", () => {
      layer.setStyle({
        weight: 2.5,
        color: "#172554",
        fillOpacity: 0.9,
      });

      layer.bringToFront();
    });

    layer.on("mouseout", () => {
      layer.setStyle(styleFeature(feature));
    });
  };

  return (
    <GeoJSON
      key="gcc-ward-investigation-layer"
      data={data}
      style={styleFeature}
      onEachFeature={onEachFeature}
    />
  );
}

// --------------------------------------------------
// MAIN FLOOD MAP COMPONENT
// --------------------------------------------------

function FloodMap({ onCellSelect, wardData }) {
  const [overview, setOverview] = useState(null);
  const [features, setFeatures] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [zoomLevel, setZoomLevel] = useState(11);

  const [viewMode, setViewMode] = useState("overview");

  // automatic = existing overview/detail map
  // wards = GCC ward investigation ranking
  const [mapMode, setMapMode] = useState("automatic");

  // Prevent old detailed requests replacing newer ones.
  const requestId = useRef(0);

  // Remember the previous automatic map mode.
  const previousMode = useRef("overview");

  // ------------------------------------------------
  // LOAD COMPLETE CITYWIDE OVERVIEW
  // ------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      setLoading(true);
      setError("");

      try {
        const result = await fetchMapOverview();

        if (cancelled) return;

        setOverview(result);
      } catch (err) {
        if (!cancelled) {
          setError(
            err.message ||
            "Unable to load Chennai overview."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadOverview();

    return () => {
      cancelled = true;
    };
  }, []);

  // ------------------------------------------------
  // LOAD INDIVIDUAL 100m GRID CELLS
  // ------------------------------------------------

  const loadDetailedFeatures = useCallback(async (bounds) => {
    const currentRequest = ++requestId.current;

    setLoading(true);
    setError("");

    try {
      const result = await fetchMapFeatures(bounds);

      if (currentRequest !== requestId.current) {
        return;
      }

      setFeatures(result);
    } catch (err) {
      if (currentRequest === requestId.current) {
        setError(
          err.message ||
          "Unable to load detailed map features."
        );
      }
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
      }
    }
  }, []);

  // ------------------------------------------------
  // HANDLE ZOOM AND MAP MOVEMENT
  // ------------------------------------------------

  const handleViewChange = useCallback((view) => {
    setZoomLevel(view.zoom);

    // Do not load grid data while ward mode is active.
    if (mapMode === "wards") {
      return;
    }

    const isDetailed = view.zoom >= DETAIL_ZOOM;

    const nextMode = isDetailed
      ? "detailed"
      : "overview";

    if (previousMode.current !== nextMode) {
      onCellSelect?.(null);
      previousMode.current = nextMode;
    }

    if (isDetailed) {
      setViewMode("detailed");
      loadDetailedFeatures(view);
    } else {
      requestId.current += 1;

      setViewMode("overview");
      setFeatures(null);
      setError("");
      setLoading(false);
    }
  }, [
    loadDetailedFeatures,
    onCellSelect,
    mapMode,
  ]);

  // ------------------------------------------------
  // MAP MODE SWITCHING
  // ------------------------------------------------

  const showWard = mapMode === "wards";

  const showOverview =
    mapMode === "automatic" &&
    viewMode === "overview";

  const showDetailed =
    mapMode === "automatic" &&
    viewMode === "detailed";

  function switchToWardView() {
    // Invalidate any outstanding grid-cell request.
    requestId.current += 1;

    setMapMode("wards");
    setError("");
    setLoading(false);
    onCellSelect?.(null);
  }

  function switchToAutomaticView() {
    setMapMode("automatic");
    setError("");
    onCellSelect?.(null);
  }

  // ------------------------------------------------
  // MODE BUTTON STYLES
  // ------------------------------------------------

  const activeButtonStyle = {
    background: "#173b57",
    color: "#ffffff",
    border: "1px solid #173b57",
    padding: "9px 14px",
    borderRadius: "7px",
    cursor: "pointer",
    fontWeight: 600,
  };

  const inactiveButtonStyle = {
    background: "#ffffff",
    color: "#263746",
    border: "1px solid #cbd5e1",
    padding: "9px 14px",
    borderRadius: "7px",
    cursor: "pointer",
    fontWeight: 500,
  };

  // ------------------------------------------------
  // RENDER
  // ------------------------------------------------

  return (
    <section className="map-panel">

      <div className="panel-heading map-heading">

        <div>
          <h2>Chennai Spatial Intelligence Map</h2>

          <p>
            {showWard
              ? "Greater Chennai Corporation ward investigation ranking"
              : showOverview
                ? "Automatic area-wise investigation priority overview"
                : "Individual 100m grid cells · Detailed ranking view"}
          </p>
        </div>

        <div>
          {loading && (
            <span className="map-loading">
              Loading map data...
            </span>
          )}

          {!loading && (
            <span className="map-loading">
              {showWard
                ? "GCC ward view"
                : showOverview
                  ? "Citywide overview"
                  : "Detailed grid view"}
            </span>
          )}
        </div>

      </div>

      {/* MAP MODE CONTROLS */}

      <div
        className="ward-map-controls"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          margin: "12px 0",
        }}
      >

        <button
          type="button"
          onClick={switchToAutomaticView}
          style={
            !showWard
              ? activeButtonStyle
              : inactiveButtonStyle
          }
        >
          Automatic Spatial View
        </button>

        <button
          type="button"
          onClick={switchToWardView}
          style={
            showWard
              ? activeButtonStyle
              : inactiveButtonStyle
          }
        >
          GCC Ward View
        </button>

      </div>

      {error && (
        <p className="error-message">
          {error}
        </p>
      )}

      {showWard && !wardData && (
        <p className="error-message">
          GCC ward ranking data is not available.
          Check the ward ranking API.
        </p>
      )}

      <MapContainer
        center={[13.05, 80.2]}
        zoom={11}
        scrollWheelZoom
        className="flood-map"
      >

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController
          onViewChange={handleViewChange}
          mapMode={mapMode}
        />

        {/* GCC WARD VIEW */}

        {showWard && wardData && (
          <WardLayer data={wardData} />
        )}

        {/* AUTOMATIC CITYWIDE OVERVIEW */}

        {showOverview && overview && (
          <OverviewLayer
            data={overview}
            onCellSelect={onCellSelect}
          />
        )}

        {/* DETAILED 100m GRID VIEW */}

        {showDetailed && features && (
          <DetailedLayer
            data={features}
            onCellSelect={onCellSelect}
          />
        )}

      </MapContainer>

      {/* ------------------------------------------ */}
      {/* MAP LEGEND                                 */}
      {/* ------------------------------------------ */}

      {showWard ? (

        <div className="map-legend">

          <strong>
            Share of Tier 4 + Tier 5 cells in each GCC ward
          </strong>

          <div className="legend-items">

            {[
              ["0%", "#dce3e8"],
              ["0–5%", "#c6e7df"],
              ["5–10%", "#8fd3bd"],
              ["10–20%", "#f5d77e"],
              ["20–35%", "#eea45f"],
              ["Above 35%", "#d9534f"],
            ].map(([label, color]) => (

              <div
                className="legend-item"
                key={label}
              >

                <span
                  className="legend-color"
                  style={{
                    backgroundColor: color,
                  }}
                />

                {label}

              </div>

            ))}

          </div>

          <p className="map-disclaimer">
            Ward colours show relative investigation-priority
            percentages. They are not calibrated flood-risk
            categories.
          </p>

        </div>

      ) : showOverview ? (

        <div className="map-legend">

          <strong>
            Share of Tier 4 + Tier 5 cells in each block
          </strong>

          <div className="legend-items">

            {[
              ["0%", "#dce3e8"],
              ["0–5%", "#c6e7df"],
              ["5–10%", "#8fd3bd"],
              ["10–20%", "#f5d77e"],
              ["20–35%", "#eea45f"],
              ["Above 35%", "#d9534f"],
            ].map(([label, color]) => (

              <div
                className="legend-item"
                key={label}
              >

                <span
                  className="legend-color"
                  style={{
                    backgroundColor: color,
                  }}
                />

                {label}

              </div>

            ))}

          </div>

        </div>

      ) : (

        <div className="map-legend">

          <strong>Relative ranking tiers</strong>

          <div className="legend-items">

            {Object.entries(TIER_COLORS).map(
              ([tier, color]) => (

                <div
                  className="legend-item"
                  key={tier}
                >

                  <span
                    className="legend-color"
                    style={{
                      backgroundColor: color,
                    }}
                  />

                  {tier}

                </div>

              )
            )}

          </div>

        </div>

      )}

      {/* ------------------------------------------ */}
      {/* SCIENTIFIC DISCLAIMER                      */}
      {/* ------------------------------------------ */}

      <p className="map-disclaimer">

        {showWard
          ? "Ward colours represent the percentage of assigned grid cells in Positive Tier 4 and Positive Tier 5. These are relative investigation rankings, not calibrated flood probabilities or confirmed flood zones. Click a ward to inspect its ranking and recorded evidence count. Only cells assigned to GCC ward boundaries are included."
          : showOverview
            ? "Overview colours show the percentage of Tier 4 and Tier 5 cells within each spatial block. These are relative investigation rankings, not calibrated flood probabilities or confirmed flood zones. Click an overview block for its investigation details. Zoom in to inspect individual 100m cells."
            : "These are uncalibrated model ranking scores based on available flood evidence and spatial features. They are not flood probabilities, confirmed flood boundaries, or predictions of future flood events. Zero-score cells are not verified flood-free."}

      </p>

      {!showWard && (
        <p className="map-disclaimer">
          Current zoom level: {zoomLevel}.
          {" "}
          {showOverview
            ? "Zoom in to view individual grid cells."
            : "Zoom out to return to the Chennai-wide overview."}
        </p>
      )}

    </section>
  );
}

export default FloodMap;
