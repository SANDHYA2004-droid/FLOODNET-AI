
import { useEffect, useState } from "react";

import {
  Info,
  MapPin,
  Activity,
  Mountain,
  Route,
  Search,
  Layers,
} from "lucide-react";


const PRIORITY_LABELS = {
  "Zero-score group": {
    label: "No additional investigation priority identified",
    explanation:
      "The model did not assign this location a positive ranking score. This does not mean flooding cannot occur here.",
    action:
      "Continue collecting local flood observations and relevant information.",
  },

  "Positive Tier 1": {
    label: "Lower priority for investigation",
    explanation:
      "This location received a lower score than many other positively scored locations.",
    action:
      "Include it in routine observation and evidence collection.",
  },

  "Positive Tier 2": {
    label: "Routine investigation",
    explanation:
      "This location received a relatively low score compared with higher-ranked locations.",
    action:
      "Include it in routine data collection.",
  },

  "Positive Tier 3": {
    label: "Moderate priority for investigation",
    explanation:
      "This location received a middle-range score among positively scored locations.",
    action:
      "Consider collecting additional local flood evidence.",
  },

  "Positive Tier 4": {
    label: "High priority for investigation",
    explanation:
      "This location received a comparatively high score.",
    action:
      "Prioritise further field inspection and flood-evidence collection.",
  },

  "Positive Tier 5": {
    label: "Highest priority for investigation",
    explanation:
      "This location received one of the highest scores in the study.",
    action:
      "Give this location priority for field inspection and collection of flood-related evidence.",
  },
};


const CATEGORY_FIELDS = [
  ["Zero-score group", "zero_score_group"],
  ["Positive Tier 1", "positive_tier_1"],
  ["Positive Tier 2", "positive_tier_2"],
  ["Positive Tier 3", "positive_tier_3"],
  ["Positive Tier 4", "positive_tier_4"],
  ["Positive Tier 5", "positive_tier_5"],
];


function getOverviewPriority(percentage) {
  if (percentage > 35) {
    return {
      label: "Highest concentration of higher-priority cells",
      explanation:
        "More than 35% of the grid cells in this block belong to Positive Tier 4 or Positive Tier 5.",
      action:
        "Prioritise review of available flood evidence and consider field verification.",
    };
  }

  if (percentage > 20) {
    return {
      label: "High concentration of higher-priority cells",
      explanation:
        "Between 20% and 35% of the grid cells belong to Positive Tier 4 or Positive Tier 5.",
      action:
        "Review historical flood observations and available drainage information.",
    };
  }

  if (percentage > 10) {
    return {
      label: "Moderate concentration of higher-priority cells",
      explanation:
        "Between 10% and 20% of the grid cells belong to Positive Tier 4 or Positive Tier 5.",
      action:
        "Collect additional local flood evidence and review infrastructure information.",
    };
  }

  if (percentage > 0) {
    return {
      label: "Lower concentration of higher-priority cells",
      explanation:
        "Some cells belong to Positive Tier 4 or Positive Tier 5, but their share is relatively small.",
      action:
        "Include the block in routine evidence collection.",
    };
  }

  return {
    label: "No Tier 4 or Tier 5 cells recorded",
    explanation:
      "No cells in this block belong to the two highest relative ranking groups. Other positive ranking groups may still be present.",
    action:
      "Continue collecting local flood evidence. Do not interpret this result as flood-free.",
  };
}


function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN");
}


function CellDetails({ cell }) {
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");


  const isOverview =
    cell?.selection_type === "overview";


  const latitude = isOverview
    ? cell?.overview_center_latitude
    : cell?.cell_center_latitude;

  const longitude = isOverview
    ? cell?.overview_center_longitude
    : cell?.cell_center_longitude;


  useEffect(() => {
    if (
      !cell ||
      latitude == null ||
      longitude == null
    ) {
      setLocation(null);

      setLocationError(
        cell
          ? "Location coordinates are unavailable."
          : ""
      );

      return;
    }

    const controller = new AbortController();

    async function getLocation() {
      setLocationLoading(true);
      setLocationError("");
      setLocation(null);

      try {
        const params = new URLSearchParams({
          latitude,
          longitude,
        });

        const response = await fetch(
          `http://127.0.0.1:8000/api/location/reverse?${params}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(
            "Unable to retrieve location information."
          );
        }

        const result = await response.json();

        setLocation(result);

      } catch (error) {
        if (error.name !== "AbortError") {
          setLocationError(
            "Location name is currently unavailable."
          );
        }

      } finally {
        if (!controller.signal.aborted) {
          setLocationLoading(false);
        }
      }
    }

    getLocation();

    return () => controller.abort();

  }, [
    cell?.selection_type,
    cell?.cell_id,
    cell?.overview_id,
    latitude,
    longitude,
  ]);


  if (!cell) {
    return (
      <section className="cell-details">
        <div className="empty-cell">
          <Info size={30} />

          <h3>Location Investigation Details</h3>

          <p>
            Select an overview block or individual grid cell
            on the map to view its locality, investigation
            priority and geographic characteristics.
          </p>
        </div>
      </section>
    );
  }


  // OVERVIEW BLOCK DETAILS
  if (isOverview) {
    const percentage = Number(
      cell.higher_priority_percentage || 0
    );

    const priority = getOverviewPriority(percentage);

    return (
      <section className="cell-details">

        <div className="cell-details-heading">
          <Layers size={21} />

          <div>
            <h3>Area Investigation Details</h3>
            <p>{cell.overview_id}</p>
          </div>
        </div>


        <div className="location-information">

          {locationLoading ? (
            <p>
              <Search size={15} />
              Finding locality name...
            </p>
          ) : location ? (
            <>
              <h2>
                {location.location_name ||
                  "Locality not identified"}
              </h2>

              {location.road_name && (
                <p>{location.road_name}</p>
              )}

              {location.display_name && (
                <small>{location.display_name}</small>
              )}
            </>
          ) : (
            <p className="location-unavailable">
              {locationError ||
                "Locality information unavailable."}
            </p>
          )}

        </div>


        <div className="selected-tier">
          <span>Area Investigation Priority</span>
          <strong>{priority.label}</strong>
        </div>


        <div className="priority-explanation">
          <h4>Why is this area highlighted?</h4>

          <p>{priority.explanation}</p>

          <h4>Suggested investigation action</h4>

          <p>{priority.action}</p>
        </div>


        <div className="cell-detail-grid">

          <div className="cell-detail-item">
            <Layers size={18} />

            <div>
              <span>Total grid cells</span>
              <strong>
                {formatNumber(cell.total_cells)}
              </strong>
            </div>
          </div>


          <div className="cell-detail-item">
            <Activity size={18} />

            <div>
              <span>Positive-score cells</span>
              <strong>
                {formatNumber(cell.positive_score_count)}
              </strong>
            </div>
          </div>


          <div className="cell-detail-item">
            <Activity size={18} />

            <div>
              <span>Tier 4 + Tier 5 cells</span>
              <strong>
                {formatNumber(cell.higher_priority_count)}
              </strong>
            </div>
          </div>


          <div className="cell-detail-item">
            <Activity size={18} />

            <div>
              <span>Tier 4 + Tier 5 share</span>
              <strong>
                {percentage.toFixed(2)}%
              </strong>
            </div>
          </div>

        </div>


        <div className="priority-explanation">
          <h4>Ranking category distribution</h4>

          {CATEGORY_FIELDS.map(([label, prefix]) => {
            const count = Number(
              cell[`${prefix}_count`] || 0
            );

            const share = Number(
              cell[`${prefix}_percentage`] || 0
            );

            return (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12px",
                  padding: "5px 0",
                  fontSize: "13px",
                }}
              >
                <span>{label}</span>

                <strong>
                  {formatNumber(count)}
                  {" · "}
                  {share.toFixed(1)}%
                </strong>
              </div>
            );
          })}

        </div>


        <p className="cell-note">
          These area statistics describe the composition
          of the model's relative ranking groups. They are
          not calibrated flood probabilities or confirmed
          flood boundaries. Locality identification is
          approximate and based on the representative
          point of the selected block.
        </p>

      </section>
    );
  }


  // INDIVIDUAL 100m CELL DETAILS

  const priority =
    PRIORITY_LABELS[cell.relative_rank_tier] ||
    PRIORITY_LABELS["Zero-score group"];


  const roadDensity =
    cell.road_density_m_per_km2 == null
      ? "Unavailable"
      : Number(cell.road_density_m_per_km2) === 0
        ? "No road length recorded"
        : `${Number(
            cell.road_density_m_per_km2
          ).toFixed(2)} m/km²`;


  const details = [
    {
      label: "Model Ranking Score",
      value: Number(cell.ranking_score).toFixed(5),
      icon: Activity,
    },
    {
      label: "Ranking Percentile",
      value: Number(cell.ranking_percentile).toFixed(2),
      icon: Activity,
    },
    {
      label: "Land Elevation",
      value:
        cell.elevation_m == null
          ? "Unavailable"
          : `${Number(cell.elevation_m).toFixed(2)} m`,
      icon: Mountain,
    },
    {
      label: "Recorded Road Density",
      value: roadDensity,
      icon: Route,
    },
  ];


  return (
    <section className="cell-details">

      <div className="cell-details-heading">
        <MapPin size={21} />

        <div>
          <h3>Selected Grid Cell</h3>
          <p>{cell.cell_id}</p>
        </div>
      </div>


      <div className="location-information">

        {locationLoading ? (
          <p>
            <Search size={15} />
            Finding location name...
          </p>
        ) : location ? (
          <>
            <h2>
              {location.location_name ||
                "Locality not identified"}
            </h2>

            {location.road_name && (
              <p>{location.road_name}</p>
            )}

            {location.display_name && (
              <small>{location.display_name}</small>
            )}
          </>
        ) : (
          <p className="location-unavailable">
            {locationError ||
              "Location information unavailable."}
          </p>
        )}

      </div>


      <div className="selected-tier">
        <span>Investigation Priority</span>
        <strong>{priority.label}</strong>
      </div>


      <div className="priority-explanation">

        <h4>Why is this location highlighted?</h4>
        <p>{priority.explanation}</p>

        <h4>Suggested action</h4>
        <p>{priority.action}</p>

      </div>


      <div className="cell-detail-grid">

        {details.map((detail) => {
          const Icon = detail.icon;

          return (
            <div
              className="cell-detail-item"
              key={detail.label}
            >
              <Icon size={18} />

              <div>
                <span>{detail.label}</span>
                <strong>{detail.value}</strong>
              </div>
            </div>
          );
        })}

      </div>


      <p className="cell-note">
        Investigation priorities are based on uncalibrated
        model ranking scores. They are not confirmed flood
        severity levels, flood probabilities or predictions.
        A zero score does not establish that a location is
        flood-free. Zero recorded road density does not
        confirm that roads are absent; map data may be
        incomplete.
      </p>

    </section>
  );
}

export default CellDetails;
