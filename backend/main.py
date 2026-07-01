from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend import settings
from backend.birdnet_service import analyze_audio
from backend.llm_service import generate_species_card
from backend.schemas import AnalyzeResponse, SpeciesCardRequest, SpeciesCardResponse


PROJECT_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIR = PROJECT_ROOT / "frontend"

app = FastAPI(title="Taller UCM BirdNET API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/")
def index():
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze(
    file: UploadFile = File(...),
    top_k: int = Form(default=settings.DEFAULT_TOP_K),
    min_confidence: float = Form(default=settings.DEFAULT_MIN_CONFIDENCE),
):
    """Analiza un audio con BirdNET."""
    if top_k < 1 or top_k > 20:
        raise HTTPException(status_code=400, detail="top_k debe estar entre 1 y 20.")

    if min_confidence < 0 or min_confidence > 1:
        raise HTTPException(status_code=400, detail="min_confidence debe estar entre 0 y 1.")

    suffix = Path(file.filename or "audio.wav").suffix or ".wav"

    # TODO alumno:
    # Añadir validación más estricta de formato/tamaño antes de guardar.
    with NamedTemporaryFile(delete=True, suffix=suffix) as temp_file:
        temp_file.write(await file.read())
        temp_file.flush()

        try:
            detections = analyze_audio(
                Path(temp_file.name),
                top_k=top_k,
                min_confidence=min_confidence,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"No se pudo analizar el audio: {exc}",
            ) from exc

    return AnalyzeResponse(filename=file.filename or "audio", detections=detections)


@app.post("/api/species-card", response_model=SpeciesCardResponse)
def species_card(request: SpeciesCardRequest):
    """Genera una ficha divulgativa usando la salida de BirdNET."""
    try:
        return generate_species_card(request)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo generar la ficha: {exc}",
        ) from exc
