# FLOODNET-AI
## Chennai Spatial Flood Intelligence & Evidence Ranking Dashboard

FLOODNET-AI is a geospatial machine learning project designed to support spatial flood-evidence investigation across the Chennai Metropolitan Area.

The system combines geographic characteristics, recorded flood observations, spatial data processing, and machine learning to generate relative spatial ranking scores for 100-metre grid cells.

It also aggregates the grid-level results into Greater Chennai Corporation (GCC) wards and spatial overview blocks, helping users identify areas that may deserve further investigation.

**Important:** FLOODNET-AI is an evidence-based spatial screening and ranking system. It does not predict exact flood depth, forecast future flood events, or provide calibrated flood probabilities.

---

## Project Objectives

- Process geographic and flood-related datasets for Chennai.
- Generate a 100m spatial grid for geographic analysis.
- Extract terrain and infrastructure-related features.
- Develop a positive-unlabelled ranking baseline using Random Forest.
- Generate spatial ranking scores for the study area.
- Aggregate ranking results into GCC ward-level investigation rankings.
- Visualise spatial ranking results through an interactive dashboard.
- Support further investigation of areas using recorded evidence and geographic characteristics.

## Key Features

### 1. Spatial Flood-Evidence Ranking

- 593,702 spatial grid cells.
- 100m grid resolution.
- Projected coordinate system: EPSG:32644.
- Random Forest ranking baseline.
- Four model input features:
  - Elevation
  - Slope
  - Road length
  - Road density

### 2. Positive-Unlabelled Evidence Handling

The available flood observations do not provide verified negative examples.

The project therefore distinguishes between:

- **Positive evidence:** Grid cells containing recorded positive flood-observation evidence.
- **Unlabelled cells:** Grid cells without recorded positive evidence. These are not verified flood-free locations.

The current model is a positive-unlabelled ranking baseline. Unlabelled observations are encoded as the comparison class for model training; this does not make them confirmed negative examples.

### 3. Relative Spatial Ranking Categories

The model produces uncalibrated class-1 ranking scores.

Grid cells are grouped into:

- Zero-score group
- Positive Tier 1
- Positive Tier 2
- Positive Tier 3
- Positive Tier 4
- Positive Tier 5

Positive tiers are relative ranking groups, not scientifically established flood-severity levels. Tier 5 represents the highest relative ranking group.

### 4. Automatic GCC Ward Investigation Ranking

The system aggregates grid-level results into 200 Greater Chennai Corporation wards.

Ward ranking is based on the share of assigned grid cells belonging to Positive Tier 4 and Positive Tier 5.

The dashboard displays:

- Investigation rank
- Ward number
- Zone
- Higher-priority cells
- Higher-priority percentage
- Recorded positive evidence cells

Ward rankings support relative investigation prioritisation, not calibrated flood-risk measurement.

### 5. Interactive Chennai Spatial Dashboard

The dashboard includes:

- Overall model statistics
- Spatial ranking distribution chart
- Automatic GCC ward investigation ranking
- Area investigation details
- Interactive Chennai spatial map
- Automatic spatial overview
- GCC ward boundary view
- Detailed 100m grid inspection
- Locality information for selected map blocks

---

## Current Project Statistics

| Metric | Result |
|---|---:|
| Total grid cells | 593,702 |
| Positive-score cells | 111,462 |
| Zero-score cells | 482,240 |
| Recorded positive evidence cells | 874 |
| Unlabelled cells | 592,828 |
| GCC wards | 200 |
| Grid resolution | 100m |

### Relative Ranking Distribution

| Category | Grid cells |
|---|---:|
| Zero-score group | 482,240 |
| Positive Tier 1 | 23,027 |
| Positive Tier 2 | 21,565 |
| Positive Tier 3 | 22,285 |
| Positive Tier 4 | 22,292 |
| Positive Tier 5 | 22,293 |

---

## Technology Stack

### Machine Learning and Data Processing
- Python
- Pandas
- NumPy
- Scikit-learn
- GeoPandas
- Shapely
- Pyogrio
- Joblib

### Backend
- FastAPI
- Uvicorn
- REST API

### Frontend
- React.js
- JavaScript
- Leaflet
- React Leaflet
- CSS

### Geospatial Data
- GeoPackage
- GeoJSON
- EPSG:32644
- EPSG:4326

### Development Environment
- Google Colab
- Visual Studio Code
- Git
- GitHub

---

## Data Sources

The project uses the following categories of geographic and observational data:

1. GCC flood-related records.
2. Recorded 2015 Chennai flood observations.
3. Copernicus Digital Elevation Model data.
4. OpenStreetMap road and infrastructure data.
5. Greater Chennai Corporation 2025 ward boundary data.
6. IMD/OpenCity rainfall data for investigation; rainfall was excluded from the current model because its units and station coordinates were not sufficiently verified.

GCC hazard polygons are used for geographic context and are not used as model labels or predictors.

---

## Machine Learning Methodology

### Feature Preparation

The spatial feature table contains geographic and infrastructure characteristics for the grid cells.

The current model uses:

- `elevation_m`
- `slope_degrees`
- `road_length_m`
- `road_density_m_per_km2`

### Model

The current baseline uses a Random Forest classifier with:

- 120 estimators
- Maximum depth of 14
- Minimum samples per leaf of 5
- Balanced subsampling of classes
- Random state of 42

Missing feature values are handled using median imputation, with missing-value indicators enabled.

### Validation

The project uses spatial-block validation and a separate geographic holdout evaluation to examine ranking performance across different geographic areas.

The reported metrics must be interpreted carefully because unlabelled cells are not verified negative examples.

The resulting scores are uncalibrated ranking scores, not probabilities of flooding.

---

## Backend API

The FastAPI backend provides endpoints for dashboard data.

| Endpoint | Purpose |
|---|---|
| `/api/summary` | Overall model and grid statistics |
| `/api/map/overview` | Spatial overview blocks |
| `/api/map/features` | Detailed grid features within map bounds |
| `/api/wards/ranking` | GCC ward investigation ranking |
| `/api/location/reverse` | Locality information for selected map locations |

The frontend retrieves these endpoints to display the dashboard and map layers.

---

## Project Structure

```text
FLOODNET-AI/
│
├── backend/
│   └── app/
│       ├── api/
│       │   └── routes.py
│       └── services/
│           └── map_service.py
│
├── dashboard/
│   └── src/
│       ├── components/
│       │   ├── FloodMap.jsx
│       │   ├── WardRanking.jsx
│       │   ├── SummaryCards.jsx
│       │   ├── RankingChart.jsx
│       │   └── CellDetails.jsx
│       ├── services/
│       │   └── api.js
│       ├── App.jsx
│       └── App.css
│
├── data/
│   ├── raw/
│   └── processed/
│       ├── phase6/
│       └── phase7/
│
├── models/
│   └── phase5/
│
├── reports/
│   ├── phase5/
│   ├── phase6/
│   └── phase7/
│
├── scripts/
│   ├── download_gcc_wards.py
│   └── aggregate_gcc_wards.py
│
├── .gitignore
└── README.md
```

---

## Running the Project Locally

### Requirements

- Python 3.13 or a compatible Python environment
- Node.js and npm
- Git
- Required project datasets and model artifacts

### 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd FLOODNET-AI
```

### 2. Set Up the Python Environment

On Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Install the backend dependencies:

```powershell
pip install -r requirements.txt
```

If your repository does not yet contain a `requirements.txt`, create one from your working environment before using this command.

### 3. Start the Backend

Run the FastAPI application using the project's actual application entry point.

For example, if the FastAPI instance is named `app` in `backend/app/main.py`:

```powershell
python -m uvicorn backend.app.main:app --reload
```

### 4. Start the Frontend

Open another terminal:

```powershell
cd dashboard
npm install
npm run dev
```

Open the local development URL printed by Vite in the terminal.

---

## Scientific Limitations and Responsible Interpretation

FLOODNET-AI is a research prototype for spatial investigation.

The following limitations must be considered:

1. Recorded positive observations do not represent complete flood coverage.
2. Unlabelled cells must not be interpreted as confirmed flood-free locations.
3. Model scores are uncalibrated ranking scores, not flood probabilities.
4. Positive ranking tiers do not establish flood severity.
5. A positive ranking score does not confirm that flooding occurred.
6. A zero score does not establish that an area is flood-free.
7. OpenStreetMap road coverage may be incomplete. Zero recorded road density does not prove that roads are physically absent.
8. Rainfall was excluded from the current model because its units and station coordinates were not sufficiently verified.
9. GCC ward rankings cover only grid cells assigned to the 200 GCC ward boundaries. Areas outside that coverage are not ranked in the ward table.
10. Ward-level and block-level percentages are relative screening indicators, not calibrated risk measurements.

The dashboard is intended to support evidence review and further investigation. It must not replace official flood warnings, emergency response systems, engineering assessments, or field verification.

---

## Future Enhancements

- Integrate verified rainfall observations.
- Improve flood-observation coverage and label quality.
- Incorporate additional validated hydrological and terrain features.
- Evaluate more advanced positive-unlabelled learning methods.
- Improve spatial validation and independent ground-truth evaluation.
- Add field-verification workflows.
- Improve ward and locality-level investigation reporting.

---

## Project Status

**Current status:** Spatial ranking pipeline and interactive dashboard implemented.

Completed capabilities include:

- Spatial data preparation
- Feature engineering
- Positive-unlabelled data audit
- Random Forest ranking baseline
- Spatial ranking generation
- GCC ward aggregation
- Backend API integration
- Interactive dashboard and map integration

---

## Disclaimer

FLOODNET-AI is an academic and research-oriented spatial intelligence prototype. Its outputs are relative model rankings based on available evidence and geographic features. They are not official flood-risk classifications, confirmed flood boundaries, future flood predictions, or calibrated probabilities.

**FLOODNET-AI — Chennai Spatial Flood Intelligence**