
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.routes import router


app = FastAPI(
    title="FLOODNET-AI",
    description=(
        "Chennai spatial flood-evidence susceptibility "
        "screening and infrastructure intelligence platform."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "project": "FLOODNET-AI",
        "status": "running",
        "message": "Flood intelligence backend is operational.",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


app.include_router(router)
