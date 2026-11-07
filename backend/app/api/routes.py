
from functools import lru_cache
from pathlib import Path
import json
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

import pandas as pd
import pyogrio

from fastapi import APIRouter, HTTPException, Query

from backend.app.services.map_service import (
    get_map_features,
    get_map_overview,
)


# --------------------------------------------------
# API CONFIGURATION
# --------------------------------------------------

router = APIRouter(
    prefix="/api",
    tags=["FLOODNET-AI"],
)

PROJECT_ROOT = Path(r"D:\FLOODNET-AI")


# --------------------------------------------------
# PHASE 6 DATA PATHS
# --------------------------------------------------

CSV_PATH = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "phase6"
    / "floodnet_chennai_spatial_ranking.csv"
)

GPKG_PATH = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "phase6"
    / "floodnet_chennai_spatial_ranking.gpkg"
)


# --------------------------------------------------
# PHASE 7 GCC WARD DATA PATH
# --------------------------------------------------

WARD_GPKG_PATH = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "phase7"
    / "gcc_ward_investigation_ranking.gpkg"
)


# --------------------------------------------------
# PHASE 6 DATA LOADERS
# --------------------------------------------------

@lru_cache(maxsize=1)
def load_ranking_data():

    if not CSV_PATH.exists():
        raise FileNotFoundError(
            f"Ranking CSV not found: {CSV_PATH}"
        )

    return pd.read_csv(
        CSV_PATH,
        usecols=[
            "ranking_score",
            "relative_rank_tier",
        ],
    )


@lru_cache(maxsize=1)
def load_label_data():

    if not GPKG_PATH.exists():
        raise FileNotFoundError(
            f"GeoPackage not found: {GPKG_PATH}"
        )

    return pyogrio.read_dataframe(
        GPKG_PATH,
        columns=["flood_label"],
        read_geometry=False,
    )


# --------------------------------------------------
# PHASE 7 GCC WARD DATA LOADER
# --------------------------------------------------

@lru_cache(maxsize=1)
def load_ward_ranking_data():
    """
    Load the aggregated GCC ward investigation rankings.

    The ward ranking is based on:
    1. Tier 4 + Tier 5 percentage.
    2. Tier 4 + Tier 5 cell count.
    3. Recorded positive evidence cell count.

    This is a relative investigation ranking.
    It is not a calibrated flood-risk measurement.
    """

    if not WARD_GPKG_PATH.exists():
        raise FileNotFoundError(
            f"GCC ward ranking GeoPackage not found: "
            f"{WARD_GPKG_PATH}"
        )

    ward_gdf = pyogrio.read_dataframe(
        WARD_GPKG_PATH
    )

    if ward_gdf.empty:
        raise ValueError(
            "GCC ward ranking GeoPackage contains no records."
        )

    if ward_gdf.crs is None:
        raise ValueError(
            "GCC ward ranking GeoPackage has no CRS."
        )

    required_columns = [
        "ward_id",
        "ward",
        "zone",
        "total_cells",
        "higher_priority_count",
        "higher_priority_percentage",
        "recorded_positive_evidence_cells",
    ]

    missing_columns = [
        column
        for column in required_columns
        if column not in ward_gdf.columns
    ]

    if missing_columns:
        raise ValueError(
            "GCC ward ranking file is missing required columns: "
            + ", ".join(missing_columns)
        )

    ward_gdf = ward_gdf.copy()

    # Validate numeric ranking fields.
    numeric_columns = [
        "total_cells",
        "higher_priority_count",
        "higher_priority_percentage",
        "recorded_positive_evidence_cells",
    ]

    for column in numeric_columns:

        ward_gdf[column] = pd.to_numeric(
            ward_gdf[column],
            errors="coerce",
        )

        if ward_gdf[column].isna().any():
            raise ValueError(
                f"Invalid or missing numeric values in {column}."
            )

    # Sort wards using the established ranking criteria.
    ward_gdf = ward_gdf.sort_values(
        by=[
            "higher_priority_percentage",
            "higher_priority_count",
            "recorded_positive_evidence_cells",
        ],
        ascending=[
            False,
            False,
            False,
        ],
        kind="stable",
    ).reset_index(drop=True)

    # Assign display ranking.
    ward_gdf["rank"] = range(
        1,
        len(ward_gdf) + 1,
    )

    # Convert to geographic coordinates for Leaflet.
    ward_gdf = ward_gdf.to_crs(
        "EPSG:4326"
    )

    return ward_gdf


# --------------------------------------------------
# DASHBOARD SUMMARY API
# --------------------------------------------------

@router.get("/summary")
def get_summary():

    try:
        ranking_df = load_ranking_data()
        label_df = load_label_data()

        tier_counts = (
            ranking_df["relative_rank_tier"]
            .value_counts()
            .to_dict()
        )

        positive_scores = ranking_df[
            ranking_df["ranking_score"] > 0
        ]

        return {
            "total_grid_cells": int(
                len(ranking_df)
            ),

            "zero_score_cells": int(
                (ranking_df["ranking_score"] == 0).sum()
            ),

            "positive_score_cells": int(
                (ranking_df["ranking_score"] > 0).sum()
            ),

            "recorded_positive_evidence_cells": int(
                (label_df["flood_label"] == 1).sum()
            ),

            "unlabelled_cells": int(
                (label_df["flood_label"] == -1).sum()
            ),

            "ranking_tier_counts": {
                str(key): int(value)
                for key, value in tier_counts.items()
            },

            "positive_score_mean": float(
                positive_scores["ranking_score"].mean()
            ) if not positive_scores.empty else 0.0,

            "score_interpretation": (
                "Uncalibrated class-1 ranking score from a "
                "positive-unlabelled baseline; not a flood probability."
            ),
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Could not load summary: {exc}",
        )


# --------------------------------------------------
# INDIVIDUAL GRID CELL MAP API
# --------------------------------------------------

@router.get("/map/features")
def map_features(
    west: float = Query(...),
    south: float = Query(...),
    east: float = Query(...),
    north: float = Query(...),
):

    try:
        return get_map_features(
            west=west,
            south=south,
            east=east,
            north=north,
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Could not load map features: {exc}",
        )


# --------------------------------------------------
# CHENNAI SPATIAL OVERVIEW API
# --------------------------------------------------

@router.get("/map/overview")
def map_overview():

    try:
        return get_map_overview()

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Could not load map overview: {exc}",
        )


# --------------------------------------------------
# GCC WARD INVESTIGATION RANKING API
# --------------------------------------------------

@router.get("/wards/ranking")
def get_ward_ranking():
    """
    Return all GCC wards with their investigation rankings
    and geographic boundaries.

    The endpoint supports:
    - Automatic ward ranking on dashboard opening.
    - GCC ward boundary visualization.
    - Ward-level investigation statistics.
    """

    try:
        ward_gdf = load_ward_ranking_data()

        # Convert ward geometries into GeoJSON.
        geojson = json.loads(
            ward_gdf.to_json(
                drop_id=True
            )
        )

        # Extract ranked ward properties.
        ranking = [
            feature["properties"]
            for feature in geojson["features"]
        ]

        return {
            "type": "FeatureCollection",

            "features": geojson["features"],

            "ranking": ranking,

            "metadata": {
                "total_wards": int(
                    len(ward_gdf)
                ),

                "coverage": (
                    "Greater Chennai Corporation ward boundaries"
                ),

                "ranking_method": (
                    "Descending order of Tier 4 + Tier 5 "
                    "percentage, followed by higher-priority "
                    "cell count and recorded positive evidence count."
                ),

                "higher_priority_definition": (
                    "Positive Tier 4 plus Positive Tier 5 cells."
                ),

                "interpretation": (
                    "Relative spatial investigation ranking. "
                    "These values are not calibrated flood-risk "
                    "measurements or flood probabilities."
                ),

                "coverage_limitation": (
                    "Ward rankings cover the GCC ward boundaries only. "
                    "Areas outside GCC ward coverage are not classified "
                    "by this ward-ranking layer."
                ),

                "unlabelled_data_limitation": (
                    "Unlabelled grid cells are not verified "
                    "flood-free locations."
                ),
            },
        }

    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Could not load GCC ward rankings: {exc}",
        )


# --------------------------------------------------
# NOMINATIM REVERSE-GEOCODING CONFIGURATION
# --------------------------------------------------

NOMINATIM_URL = (
    "https://nominatim.openstreetmap.org/reverse"
)

NOMINATIM_HEADERS = {
    "User-Agent": (
        "FLOODNET-AI/1.0 "
        "(Chennai spatial research project)"
    )
}

# Public Nominatim usage is limited to one request per second.
_geocode_lock = threading.Lock()

_last_geocode_request = 0.0


# --------------------------------------------------
# REVERSE-GEOCODING CACHE
# --------------------------------------------------

@lru_cache(maxsize=2048)
def reverse_geocode_cached(
    latitude: float,
    longitude: float,
) -> dict:

    global _last_geocode_request

    with _geocode_lock:

        elapsed = (
            time.monotonic()
            - _last_geocode_request
        )

        if elapsed < 1.0:
            time.sleep(
                1.0 - elapsed
            )

        params = urllib.parse.urlencode({
            "lat": latitude,
            "lon": longitude,
            "format": "jsonv2",
            "addressdetails": 1,
            "zoom": 18,
        })

        request = urllib.request.Request(
            f"{NOMINATIM_URL}?{params}",
            headers=NOMINATIM_HEADERS,
        )

        try:
            with urllib.request.urlopen(
                request,
                timeout=15,
            ) as response:

                result = json.loads(
                    response.read().decode("utf-8")
                )

        finally:
            _last_geocode_request = (
                time.monotonic()
            )

    address = result.get(
        "address",
        {},
    )

    locality = (
        address.get("neighbourhood")
        or address.get("suburb")
        or address.get("quarter")
        or address.get("city_district")
        or address.get("borough")
        or address.get("village")
        or address.get("town")
        or address.get("city")
    )

    road = (
        address.get("road")
        or address.get("pedestrian")
        or address.get("residential")
    )

    landmark = (
        address.get("amenity")
        or address.get("tourism")
        or address.get("historic")
        or address.get("shop")
        or address.get("leisure")
    )

    return {
        "location_name": locality,

        "road_name": road,

        "nearby_place": landmark,

        "display_name": result.get(
            "display_name"
        ),

        "latitude": latitude,

        "longitude": longitude,

        "location_source": (
            "OpenStreetMap Nominatim"
        ),

        "location_precision": (
            "Locality information available"
            if locality
            else "Approximate address information only"
        ),
    }


# --------------------------------------------------
# REVERSE-LOCATION API
# --------------------------------------------------

@router.get("/location/reverse")
def reverse_location(
    latitude: float = Query(
        ...,
        ge=-90,
        le=90,
    ),

    longitude: float = Query(
        ...,
        ge=-180,
        le=180,
    ),
):

    try:
        return reverse_geocode_cached(
            round(latitude, 5),
            round(longitude, 5),
        )

    except urllib.error.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                f"Location provider returned HTTP {exc.code}."
            ),
        )

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Could not identify location: {exc}",
        )
