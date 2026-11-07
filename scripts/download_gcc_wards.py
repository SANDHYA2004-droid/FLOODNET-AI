
from pathlib import Path
import json
import requests
import geopandas as gpd

PROJECT_ROOT = Path(r"D:\FLOODNET-AI")

OUTPUT_DIR = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "administrative"
)

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

GPKG_PATH = OUTPUT_DIR / "gcc_wards_2025.gpkg"
GEOJSON_PATH = OUTPUT_DIR / "gcc_wards_2025.geojson"

LAYER_URL = (
    "https://gisgcc.chennaicorporation.gov.in/"
    "server/rest/services/GCCDepts/EDPMobile2025/"
    "FeatureServer/2"
)

session = requests.Session()
session.headers.update({
    "User-Agent": "FLOODNET-AI/1.0"
})

print("STEP 1: Retrieving GCC ward IDs...")

ids_response = session.get(
    f"{LAYER_URL}/query",
    params={
        "where": "1=1",
        "returnIdsOnly": "true",
        "f": "json"
    },
    timeout=60
)

ids_response.raise_for_status()
ids_data = ids_response.json()

if "error" in ids_data:
    raise RuntimeError(ids_data["error"])

object_ids = ids_data.get("objectIds", [])

if not object_ids:
    raise RuntimeError("No ward IDs were returned.")

print("Ward boundary records found:", len(object_ids))

all_features = []
batch_size = 500

print("\nSTEP 2: Downloading ward polygons...")

for start in range(0, len(object_ids), batch_size):

    batch_ids = object_ids[start:start + batch_size]

    response = session.get(
        f"{LAYER_URL}/query",
        params={
            "objectIds": ",".join(map(str, batch_ids)),
            "outFields": "*",
            "returnGeometry": "true",
            "outSR": "32644",
            "f": "geojson"
        },
        timeout=120
    )

    response.raise_for_status()
    data = response.json()

    if "error" in data:
        raise RuntimeError(data["error"])

    features = data.get("features", [])
    all_features.extend(features)

    print(
        f"Downloaded {len(all_features)} "
        f"/ {len(object_ids)} records"
    )

if len(all_features) != len(object_ids):
    raise RuntimeError(
        "Downloaded feature count does not match ward ID count."
    )

print("\nSTEP 3: Creating GeoDataFrame...")

gdf = gpd.GeoDataFrame.from_features(
    all_features,
    crs="EPSG:32644"
)

if gdf.empty:
    raise RuntimeError("Ward GeoDataFrame is empty.")

required_columns = {
    "ward_id",
    "ward",
    "zone",
    "region"
}

missing = required_columns.difference(gdf.columns)

if missing:
    raise RuntimeError(
        f"Required ward fields missing: {sorted(missing)}"
    )

gdf["ward_id"] = gdf["ward_id"].astype(str).str.strip()
gdf["ward"] = gdf["ward"].astype(str).str.strip()
gdf["zone"] = gdf["zone"].astype(str).str.strip()

print("\nSTEP 4: Validating geometries...")

invalid_count = int((~gdf.geometry.is_valid).sum())
empty_count = int(gdf.geometry.is_empty.sum())
missing_geometry_count = int(gdf.geometry.isna().sum())

duplicate_ids = int(gdf["ward_id"].duplicated().sum())

print("CRS:", gdf.crs)
print("Ward records:", len(gdf))
print("Unique ward IDs:", gdf["ward_id"].nunique())
print("Duplicate ward IDs:", duplicate_ids)
print("Invalid geometries:", invalid_count)
print("Empty geometries:", empty_count)
print("Missing geometries:", missing_geometry_count)

if duplicate_ids:
    raise RuntimeError("Duplicate ward IDs found.")

if invalid_count or empty_count or missing_geometry_count:
    raise RuntimeError(
        "Geometry validation failed. Do not proceed to aggregation."
    )

print("\nSTEP 5: Saving boundary files...")

gdf.to_file(
    GPKG_PATH,
    layer="gcc_wards_2025",
    driver="GPKG"
)

gdf.to_file(
    GEOJSON_PATH,
    driver="GeoJSON"
)

metadata = {
    "source": "Greater Chennai Corporation GIS",
    "service": LAYER_URL,
    "layer": "EDP_wardBoundary_2025",
    "source_crs": "EPSG:32644",
    "ward_records": len(gdf),
    "unique_ward_ids": int(gdf["ward_id"].nunique()),
    "invalid_geometries": invalid_count,
    "duplicate_ward_ids": duplicate_ids
}

metadata_path = OUTPUT_DIR / "gcc_wards_2025_metadata.json"

metadata_path.write_text(
    json.dumps(metadata, indent=4),
    encoding="utf-8"
)

print("\nDOWNLOAD AND VALIDATION COMPLETE")
print("GeoPackage:", GPKG_PATH)
print("GeoJSON:", GEOJSON_PATH)
print("Metadata:", metadata_path)

print("\nWard sample:")
print(
    gdf[
        ["ward_id", "ward", "zone", "region"]
    ].head(10).to_string(index=False)
)
