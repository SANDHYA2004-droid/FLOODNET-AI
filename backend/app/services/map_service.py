
from __future__ import annotations

from functools import lru_cache
import json
import math

import geopandas as gpd
import pandas as pd
from pyproj import Transformer


PROJECT_ROOT = r"D:\FLOODNET-AI"

GPKG_PATH = (
    PROJECT_ROOT
    + r"\data\processed\phase6\floodnet_chennai_spatial_ranking.gpkg"
)

SOURCE_CRS = "EPSG:32644"
OUTPUT_CRS = "EPSG:4326"

MAX_FEATURES = 10000
MAX_BBOX_AREA = 0.04

# The source grid is 100m.
# 10 rows x 10 columns gives a nominal 1km overview block.
CELLS_PER_BLOCK = 10

RANKING_CATEGORIES = [
    "Zero-score group",
    "Positive Tier 1",
    "Positive Tier 2",
    "Positive Tier 3",
    "Positive Tier 4",
    "Positive Tier 5",
]

MAP_COLUMNS = [
    "cell_id",
    "ranking_score",
    "ranking_percentile",
    "relative_rank_tier",
    "flood_label",
    "label_status",
    "elevation_m",
    "slope_degrees",
    "road_density_m_per_km2",
]

OVERVIEW_COLUMNS = [
    "grid_row",
    "grid_col",
    "relative_rank_tier",
]

transformer = Transformer.from_crs(
    OUTPUT_CRS,
    SOURCE_CRS,
    always_xy=True,
)


def get_map_features(
    west: float,
    south: float,
    east: float,
    north: float,
) -> dict:

    bounds = [west, south, east, north]

    if not all(math.isfinite(v) for v in bounds):
        raise ValueError("Map boundaries must be finite numbers.")

    if not (-180 <= west < east <= 180):
        raise ValueError("Invalid longitude boundaries.")

    if not (-90 <= south < north <= 90):
        raise ValueError("Invalid latitude boundaries.")

    if (east - west) * (north - south) > MAX_BBOX_AREA:
        raise ValueError(
            "Map area is too large. Zoom into the study area."
        )

    projected_bounds = transformer.transform_bounds(
        west,
        south,
        east,
        north,
        densify_pts=21,
    )

    gdf = gpd.read_file(
        GPKG_PATH,
        bbox=projected_bounds,
        columns=MAP_COLUMNS,
        engine="pyogrio",
    )

    total_found = len(gdf)
    truncated = total_found > MAX_FEATURES

    if truncated:
        gdf = gdf.iloc[:MAX_FEATURES].copy()

    if not gdf.empty:
        gdf = gdf.to_crs(OUTPUT_CRS)

        # Representative points are used for locality lookup.
        cell_points = gdf.geometry.representative_point()

        gdf["cell_center_longitude"] = cell_points.x
        gdf["cell_center_latitude"] = cell_points.y

    geojson = json.loads(
        gdf.to_json(drop_id=True)
    )

    return {
        "type": "FeatureCollection",
        "features": geojson["features"],
        "metadata": {
            "features_returned": len(gdf),
            "features_found": total_found,
            "truncated": truncated,
            "crs": OUTPUT_CRS,
            "source_crs": SOURCE_CRS,
        },
    }


@lru_cache(maxsize=1)
def get_map_overview() -> dict:
    """
    Aggregate the original 100m grid into nominal 1km blocks.

    This function summarises existing ranking categories.
    It does not retrain the model or modify ranking scores.
    """

    if not GPKG_PATH:
        raise FileNotFoundError(
            "GeoPackage path is not configured."
        )

    gdf = gpd.read_file(
        GPKG_PATH,
        columns=OVERVIEW_COLUMNS,
        engine="pyogrio",
    )

    if gdf.empty:
        raise ValueError(
            "The ranking GeoPackage contains no grid cells."
        )

    if gdf.crs is None:
        raise ValueError(
            "The ranking GeoPackage has no coordinate reference system."
        )

    required_columns = {
        "grid_row",
        "grid_col",
        "relative_rank_tier",
    }

    missing_columns = required_columns.difference(gdf.columns)

    if missing_columns:
        raise ValueError(
            "Missing overview columns: "
            + ", ".join(sorted(missing_columns))
        )

    # Validate grid indices.
    for column in ["grid_row", "grid_col"]:

        numeric_values = pd.to_numeric(
            gdf[column],
            errors="coerce",
        )

        if numeric_values.isna().any():
            raise ValueError(
                f"{column} contains missing or non-numeric values."
            )

        if not (numeric_values % 1 == 0).all():
            raise ValueError(
                f"{column} contains non-integer grid indices."
            )

        gdf[column] = numeric_values.astype("int64")

    # Validate ranking categories.
    gdf["relative_rank_tier"] = (
        gdf["relative_rank_tier"]
        .fillna("")
        .astype(str)
        .str.strip()
    )

    unexpected_categories = sorted(
        set(gdf["relative_rank_tier"].unique())
        - set(RANKING_CATEGORIES)
    )

    if unexpected_categories:
        raise ValueError(
            "Unexpected ranking categories: "
            + ", ".join(unexpected_categories)
        )

    # Group every 10 source rows and columns into one block.
    gdf["block_row"] = (
        gdf["grid_row"] // CELLS_PER_BLOCK
    )

    gdf["block_col"] = (
        gdf["grid_col"] // CELLS_PER_BLOCK
    )

    gdf["overview_id"] = (
        "R"
        + gdf["block_row"].astype(str)
        + "_C"
        + gdf["block_col"].astype(str)
    )

    # Count cells in each ranking category for each block.
    category_counts = (
        gdf.groupby(
            ["overview_id", "relative_rank_tier"],
            observed=True,
        )
        .size()
        .unstack(fill_value=0)
        .reindex(
            columns=RANKING_CATEGORIES,
            fill_value=0,
        )
    )

    category_counts["total_cells"] = (
        category_counts[RANKING_CATEGORIES].sum(axis=1)
    )

    category_counts["zero_score_count"] = (
        category_counts["Zero-score group"]
    )

    positive_categories = [
        "Positive Tier 1",
        "Positive Tier 2",
        "Positive Tier 3",
        "Positive Tier 4",
        "Positive Tier 5",
    ]

    category_counts["positive_score_count"] = (
        category_counts[positive_categories].sum(axis=1)
    )

    # Higher investigation-priority concentration means
    # the combined share of Positive Tier 4 and Positive Tier 5.
    category_counts["higher_priority_count"] = (
        category_counts["Positive Tier 4"]
        + category_counts["Positive Tier 5"]
    )

    category_counts["higher_priority_percentage"] = (
        category_counts["higher_priority_count"]
        / category_counts["total_cells"]
        * 100
    )

    category_counts["dominant_category"] = (
        category_counts[RANKING_CATEGORIES].idxmax(axis=1)
    )

    # Add counts and percentages for all six categories.
    for category in RANKING_CATEGORIES:

        safe_name = (
            category.lower()
            .replace(" ", "_")
            .replace("-", "_")
        )

        category_counts[f"{safe_name}_count"] = (
            category_counts[category]
        )

        category_counts[f"{safe_name}_percentage"] = (
            category_counts[category]
            / category_counts["total_cells"]
            * 100
        )

    # Combine the original grid-cell geometries.
    # This preserves the actual study-area shape.
    block_geometries = (
        gdf[["overview_id", "geometry"]]
        .dissolve(by="overview_id")
        .reset_index()
    )

    summary_columns = [
        "total_cells",
        "zero_score_count",
        "positive_score_count",
        "higher_priority_count",
        "higher_priority_percentage",
        "dominant_category",
    ]

    for category in RANKING_CATEGORIES:

        safe_name = (
            category.lower()
            .replace(" ", "_")
            .replace("-", "_")
        )

        summary_columns.extend([
            f"{safe_name}_count",
            f"{safe_name}_percentage",
        ])

    summary = (
        category_counts[summary_columns]
        .reset_index()
    )

    overview = block_geometries.merge(
        summary,
        on="overview_id",
        how="left",
        validate="one_to_one",
    )

    overview = gpd.GeoDataFrame(
        overview,
        geometry="geometry",
        crs=gdf.crs,
    )

    
    overview = overview.to_crs(OUTPUT_CRS)

    # Representative point inside each overview block.
    overview_points = overview.geometry.representative_point()

    overview["overview_center_longitude"] = overview_points.x
    overview["overview_center_latitude"] = overview_points.y

    geojson = json.loads(
        overview.to_json(drop_id=True)
    )

    return {
        "type": "FeatureCollection",
        "features": geojson["features"],
        "metadata": {
            "overview_blocks": int(len(overview)),
            "source_grid_cells": int(len(gdf)),
            "source_grid_size_m": 100,
            "aggregation": "10 x 10 source grid cells",
            "nominal_block_size_m": 1000,
            "crs": OUTPUT_CRS,
            "score_interpretation": (
                "Uncalibrated ranking scores. Category percentages "
                "describe the composition of each block, not flood "
                "probabilities."
            ),
            "higher_priority_definition": (
                "Positive Tier 4 plus Positive Tier 5 cells."
            ),
        },
    }
