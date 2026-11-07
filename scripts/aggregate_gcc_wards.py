
from pathlib import Path
import json

import geopandas as gpd
import pandas as pd


# --------------------------------------------------
# PROJECT PATHS
# --------------------------------------------------

PROJECT_ROOT = Path(r"D:\FLOODNET-AI")

RANKING_GPKG = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "phase6"
    / "floodnet_chennai_spatial_ranking.gpkg"
)

WARD_GPKG = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "administrative"
    / "gcc_wards_2025.gpkg"
)

OUTPUT_DIR = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "phase7"
)

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_GPKG = (
    OUTPUT_DIR
    / "gcc_ward_investigation_ranking.gpkg"
)

OUTPUT_CSV = (
    OUTPUT_DIR
    / "gcc_ward_investigation_ranking.csv"
)

OUTPUT_REPORT = (
    OUTPUT_DIR
    / "ward_aggregation_validation.json"
)


# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

EXPECTED_CRS = "EPSG:32644"

CATEGORIES = [
    "Zero-score group",
    "Positive Tier 1",
    "Positive Tier 2",
    "Positive Tier 3",
    "Positive Tier 4",
    "Positive Tier 5",
]

HIGH_PRIORITY_CATEGORIES = [
    "Positive Tier 4",
    "Positive Tier 5",
]


def stop(message):
    raise RuntimeError(message)


# --------------------------------------------------
# STEP 1: CHECK INPUT FILES
# --------------------------------------------------

print("=" * 65)
print("FLOODNET-AI | GCC WARD INVESTIGATION RANKING")
print("=" * 65)

for path in [RANKING_GPKG, WARD_GPKG]:

    if not path.exists():
        stop(f"Required input file not found: {path}")

print("\nSTEP 1: Input files found.")


# --------------------------------------------------
# STEP 2: LOAD WARD BOUNDARIES
# --------------------------------------------------

print("\nSTEP 2: Loading GCC ward boundaries...")

wards = gpd.read_file(
    WARD_GPKG,
    layer="gcc_wards_2025",
    engine="pyogrio",
)

if wards.empty:
    stop("Ward boundary file is empty.")

if wards.crs is None:
    stop("Ward boundary CRS is missing.")

wards = wards.to_crs(EXPECTED_CRS)

required_ward_columns = [
    "ward_id",
    "ward",
    "zone",
    "region",
    "geometry",
]

missing = [
    col for col in required_ward_columns
    if col not in wards.columns
]

if missing:
    stop(f"Missing ward columns: {missing}")

wards["ward_id"] = (
    wards["ward_id"].astype(str).str.strip()
)

if wards["ward_id"].duplicated().any():
    stop("Duplicate ward IDs found.")

if not wards.geometry.is_valid.all():
    stop("Invalid ward geometries found.")

print("Ward polygons:", len(wards))
print("Unique ward IDs:", wards["ward_id"].nunique())
print("Ward CRS:", wards.crs)


# --------------------------------------------------
# STEP 3: LOAD PHASE 6 GRID RESULTS
# --------------------------------------------------

print("\nSTEP 3: Loading Phase 6 ranking grid...")

cells = gpd.read_file(
    RANKING_GPKG,
    layer="flood_evidence_ranking",
    columns=[
        "cell_id",
        "ranking_score",
        "relative_rank_tier",
        "flood_label",
    ],
    engine="pyogrio",
)

if cells.empty:
    stop("Phase 6 ranking grid is empty.")

if cells.crs is None:
    stop("Ranking grid CRS is missing.")

cells = cells.to_crs(EXPECTED_CRS)

required_cell_columns = [
    "cell_id",
    "ranking_score",
    "relative_rank_tier",
    "flood_label",
    "geometry",
]

missing = [
    col for col in required_cell_columns
    if col not in cells.columns
]

if missing:
    stop(f"Missing ranking grid columns: {missing}")

if cells["cell_id"].duplicated().any():
    stop("Duplicate grid cell IDs found.")

cells["ranking_score"] = pd.to_numeric(
    cells["ranking_score"],
    errors="coerce",
)

cells["flood_label"] = pd.to_numeric(
    cells["flood_label"],
    errors="coerce",
)

cells["relative_rank_tier"] = (
    cells["relative_rank_tier"]
    .fillna("")
    .astype(str)
    .str.strip()
)

unexpected = (
    set(cells["relative_rank_tier"].unique())
    - set(CATEGORIES)
)

if unexpected:
    stop(f"Unexpected ranking categories: {sorted(unexpected)}")

if cells["ranking_score"].isna().any():
    stop("Ranking scores contain missing values.")

if cells["flood_label"].isna().any():
    stop("Flood labels contain missing values.")

total_source_cells = len(cells)

print("Source grid cells:", total_source_cells)
print("Ranking grid CRS:", cells.crs)


# --------------------------------------------------
# STEP 4: CREATE CELL REPRESENTATIVE POINTS
# --------------------------------------------------

print("\nSTEP 4: Preparing spatial assignment...")

# Each grid cell is represented by a point inside
# its polygon. This avoids assigning cells based on
# polygon overlap area.

cell_attributes = cells.drop(
    columns="geometry"
).copy()

cell_points = gpd.GeoDataFrame(
    cell_attributes,
    geometry=cells.geometry.representative_point(),
    crs=cells.crs,
)

print("Representative points created:", len(cell_points))


# --------------------------------------------------
# STEP 5: SPATIAL JOIN CELLS TO GCC WARDS
# --------------------------------------------------

print("\nSTEP 5: Assigning grid cells to wards...")

ward_attributes = wards[
    [
        "ward_id",
        "ward",
        "zone",
        "region",
        "geometry",
    ]
].copy()

joined = gpd.sjoin(
    cell_points,
    ward_attributes,
    how="left",
    predicate="within",
)

assigned = joined[
    joined["ward_id"].notna()
].copy()

unassigned = joined[
    joined["ward_id"].isna()
].copy()

# A cell must not be counted in multiple wards.
multiple_assignments = int(
    assigned["cell_id"].duplicated().sum()
)

if multiple_assignments:
    stop(
        "Some grid cells were assigned to multiple wards. "
        "Investigate overlapping ward boundaries."
    )

assigned_count = len(assigned)
unassigned_count = len(unassigned)

if assigned_count + unassigned_count != total_source_cells:
    stop("Spatial assignment cell totals do not reconcile.")

print("Assigned cells:", assigned_count)
print("Unassigned cells:", unassigned_count)
print("Multiple assignments:", multiple_assignments)


# --------------------------------------------------
# STEP 6: AGGREGATE RANKING CATEGORIES
# --------------------------------------------------

print("\nSTEP 6: Aggregating ward-level results...")

category_counts = (
    assigned.groupby(
        ["ward_id", "relative_rank_tier"],
        observed=True,
    )
    .size()
    .unstack(fill_value=0)
    .reindex(
        columns=CATEGORIES,
        fill_value=0,
    )
)

category_counts["total_cells"] = (
    category_counts[CATEGORIES].sum(axis=1)
)

category_counts["positive_score_count"] = (
    category_counts[
        [
            "Positive Tier 1",
            "Positive Tier 2",
            "Positive Tier 3",
            "Positive Tier 4",
            "Positive Tier 5",
        ]
    ].sum(axis=1)
)

category_counts["higher_priority_count"] = (
    category_counts["Positive Tier 4"]
    + category_counts["Positive Tier 5"]
)

category_counts["higher_priority_percentage"] = (
    category_counts["higher_priority_count"]
    / category_counts["total_cells"].replace(0, pd.NA)
    * 100
)

# Recorded positive evidence is counted separately.
evidence_counts = (
    assigned.assign(
        recorded_positive_evidence=(
            assigned["flood_label"] == 1
        )
    )
    .groupby("ward_id")[
        "recorded_positive_evidence"
    ]
    .sum()
    .rename("recorded_positive_evidence_cells")
)

mean_scores = (
    assigned.groupby("ward_id")["ranking_score"]
    .mean()
    .rename("mean_uncalibrated_ranking_score")
)

summary = category_counts.join(
    evidence_counts,
    how="left",
).join(
    mean_scores,
    how="left",
)

summary = summary.reset_index()


# --------------------------------------------------
# STEP 7: INCLUDE ALL 200 WARDS
# --------------------------------------------------

print("\nSTEP 7: Building complete ward table...")

ward_metadata = wards[
    ["ward_id", "ward", "zone", "region", "geometry"]
].copy()

ward_summary = ward_metadata.merge(
    summary,
    on="ward_id",
    how="left",
    validate="one_to_one",
)

count_columns = (
    CATEGORIES
    + [
        "total_cells",
        "positive_score_count",
        "higher_priority_count",
        "recorded_positive_evidence_cells",
    ]
)

for column in count_columns:
    ward_summary[column] = (
        ward_summary[column]
        .fillna(0)
        .astype("int64")
    )

ward_summary["higher_priority_percentage"] = (
    ward_summary["higher_priority_percentage"]
    .fillna(0)
)

ward_summary["mean_uncalibrated_ranking_score"] = (
    ward_summary["mean_uncalibrated_ranking_score"]
    .fillna(0)
)

# Add category percentages.
for category in CATEGORIES:

    safe_name = (
        category.lower()
        .replace(" ", "_")
        .replace("-", "_")
    )

    ward_summary[f"{safe_name}_percentage"] = (
        ward_summary[category]
        / ward_summary["total_cells"].replace(0, pd.NA)
        * 100
    ).fillna(0)


# --------------------------------------------------
# STEP 8: CREATE RELATIVE INVESTIGATION RANKING
# --------------------------------------------------

print("\nSTEP 8: Ranking wards...")

# Primary sort: percentage of cells in Tier 4 + Tier 5.
# Tie-breakers: higher-priority cell count, then
# recorded positive evidence count.
#
# This is a relative investigation ranking, not a
# calibrated flood-risk score.

ranked = ward_summary.sort_values(
    by=[
        "higher_priority_percentage",
        "higher_priority_count",
        "recorded_positive_evidence_cells",
    ],
    ascending=[False, False, False],
).reset_index(drop=True)

ranked["investigation_rank"] = pd.Series(
    range(1, len(ranked) + 1),
    dtype="int64",
)

ranked["investigation_priority"] = "Relative ranking"

ranked.loc[
    ranked["total_cells"] == 0,
    "investigation_priority",
] = "Insufficient grid coverage"

ranked.loc[
    ranked["total_cells"] > 0,
    "investigation_priority",
] = "Ranked for further investigation"


# --------------------------------------------------
# STEP 9: VALIDATE AGGREGATION
# --------------------------------------------------

print("\nSTEP 9: Validating ward aggregation...")

ward_cell_total = int(ranked["total_cells"].sum())

if ward_cell_total != assigned_count:
    stop(
        "Ward aggregation total does not match "
        "the number of spatially assigned cells."
    )

if len(ranked) != len(wards):
    stop("Final ward count does not match boundary count.")

if not (
    ranked["higher_priority_count"]
    <= ranked["total_cells"]
).all():
    stop("Higher-priority counts exceed total ward cells.")

if not (
    (ranked["higher_priority_percentage"] >= 0)
    & (ranked["higher_priority_percentage"] <= 100)
).all():
    stop("Invalid higher-priority percentages found.")

tier_sum = int(
    ranked[CATEGORIES].sum().sum()
)

if tier_sum != assigned_count:
    stop("Ranking category totals do not reconcile.")

report = {
    "status": "VALIDATION_PASSED",
    "source_grid_cells": int(total_source_cells),
    "gcc_ward_polygons": int(len(wards)),
    "unique_ward_ids": int(wards["ward_id"].nunique()),
    "assigned_grid_cells": int(assigned_count),
    "unassigned_grid_cells": int(unassigned_count),
    "multiple_assignments": int(multiple_assignments),
    "ward_aggregated_cells": int(ward_cell_total),
    "category_count_total": int(tier_sum),
    "crs": EXPECTED_CRS,
    "ranking_method": (
        "Descending Tier 4 + Tier 5 percentage; "
        "ties broken by higher-priority cell count "
        "and recorded positive evidence count."
    ),
    "interpretation": (
        "Relative investigation screening only. "
        "Not a calibrated flood probability, official "
        "flood-risk classification, or prediction."
    ),
}

OUTPUT_REPORT.write_text(
    json.dumps(report, indent=4),
    encoding="utf-8",
)


# --------------------------------------------------
# STEP 10: SAVE RESULTS
# --------------------------------------------------

print("\nSTEP 10: Saving ward ranking outputs...")

ranked = gpd.GeoDataFrame(
    ranked,
    geometry="geometry",
    crs=EXPECTED_CRS,
)

ranked.to_file(
    OUTPUT_GPKG,
    layer="ward_investigation_ranking",
    driver="GPKG",
)

ranked.drop(
    columns="geometry"
).to_csv(
    OUTPUT_CSV,
    index=False,
)

print("\n" + "=" * 65)
print("WARD RANKING COMPLETED")
print("=" * 65)

print("\nVALIDATION REPORT")
print(json.dumps(report, indent=4))

print("\nTOP 15 WARDS")

display_columns = [
    "investigation_rank",
    "ward",
    "zone",
    "total_cells",
    "higher_priority_count",
    "higher_priority_percentage",
    "recorded_positive_evidence_cells",
]

print(
    ranked[display_columns]
    .head(15)
    .to_string(index=False)
)

print("\nOUTPUT FILES")
print("GeoPackage:", OUTPUT_GPKG)
print("CSV:", OUTPUT_CSV)
print("Validation:", OUTPUT_REPORT)
