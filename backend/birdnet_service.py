from functools import lru_cache
from pathlib import Path

import pandas as pd

from backend.schemas import Detection


@lru_cache(maxsize=1)
def get_birdnet_model():
    """Carga el modelo una sola vez.

    La primera ejecución puede tardar porque BirdNET puede descargar modelos.
    """
    import birdnet

    # TODO cargar el modelo BirdNET:
    return birdnet.load("acoustic", "2.4", "tf", lang="es")

    # TODO para pros:
    # Probar otros backends/modelos soportados por BirdNET y comparar velocidad.


def analyze_audio(
    audio_path: Path,
    top_k: int,
    min_confidence: float,
) -> list[Detection]:
    """Ejecuta BirdNET y devuelve detecciones ordenadas por confianza."""
    model = get_birdnet_model()

    # TODO completar la llamada al modelo:
    predictions = model.predict(
        str(audio_path),
        top_k=top_k,
        default_confidence_threshold=min_confidence,
    )

    dataframe = predictions.to_dataframe()
    if dataframe.empty:
        return []

    detections = _normalize_predictions(dataframe)
    
    # TODO filtrar detecciones por confianza mínima
    filtered = [
        detection for detection in detections if detection.score >= min_confidence
    ]

    # BirdNET analiza segmentos de tres segundos, por lo que una misma especie
    # puede aparecer varias veces. Para la interfaz conservamos su mejor resultado.
    # Todo
    filtered.sort(key=lambda item: item.score, reverse=True)
    unique_detections: dict[str, Detection] = {}
    for detection in filtered:
        unique_detections.setdefault(detection.scientific_name, detection)

    # TODO alumno avanzado:
    # Comparar esta vista agrupada con una línea temporal que muestre todas
    # las apariciones de cada especie.
    return list(unique_detections.values())[:top_k]


def _normalize_predictions(dataframe: pd.DataFrame) -> list[Detection]:
    detections: list[Detection] = []

    for _, row in dataframe.iterrows():
        species_name = str(row.get("species_name", "Unknown_Unknown"))
        scientific_name, common_name = _split_species_name(species_name)

        confidence = row.get("confidence", 0)
        try:
            score = float(confidence)
        except (TypeError, ValueError):
            score = 0.0

        detections.append(
            Detection(
                scientific_name=scientific_name,
                common_name=common_name,
                score=round(score, 4),
                start_time=_optional_text(row.get("start_time")),
                end_time=_optional_text(row.get("end_time")),
            )
        )

    return detections


def _split_species_name(species_name: str) -> tuple[str, str]:
    """BirdNET suele devolver 'Nombre científico_Nombre común'."""
    if "_" not in species_name:
        return species_name, species_name

    scientific_name, common_name = species_name.split("_", maxsplit=1)
    return scientific_name.strip(), common_name.strip()


def _optional_text(value) -> str | None:
    if value is None or pd.isna(value):
        return None
    return str(value)
