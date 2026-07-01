"""Servicio BirdNET para completar durante el taller."""

from functools import lru_cache
from pathlib import Path

import pandas as pd

from backend.schemas import Detection


@lru_cache(maxsize=1)
def get_birdnet_model():
    """Carga el modelo acústico una sola vez y lo devuelve."""
    import birdnet

    # TODO 1 — Cargar el modelo
    # Usa birdnet.load() para cargar el modelo acústico 2.4 con backend
    # TensorFlow ("tf") y los nombres comunes de las especies en español.
    #
    raise NotImplementedError("TODO 1: cargar el modelo BirdNET")


def analyze_audio(
    audio_path: Path,
    top_k: int,
    min_confidence: float,
) -> list[Detection]:
    """Ejecuta BirdNET y devuelve las mejores detecciones de cada especie."""
    model = get_birdnet_model()

    # TODO 2 — Ejecutar la inferencia
    # Llama al modelo pasando:
    #   - La ruta del audio convertida a str.
    #   - El número máximo de resultados por segmento (top_k).
    #   - El umbral mínimo de confianza (min_confidence).
    #
    # Consulta la firma de model.predict() si necesitas localizar los nombres
    # exactos de los argumentos.
    raise NotImplementedError("TODO 2: analizar el audio con el modelo")

    # TODO 3 — Convertir el resultado
    # Convierte `predictions` en un DataFrame de pandas usando el método que
    # proporciona BirdNET y guárdalo en la variable `dataframe`.
    # dataframe = ...

    if dataframe.empty:
        return []

    detections = _normalize_predictions(dataframe)

    # TODO 4 — Aplicar el umbral de confianza
    # Conserva únicamente las detecciones cuyo `score` sea mayor o igual que
    # `min_confidence` y guarda el resultado en `filtered`.
    filtered: list[Detection] = []

    # TODO 5 — Eliminar especies duplicadas
    # BirdNET analiza ventanas de tres segundos, así que una especie puede
    # aparecer varias veces. Ordena `filtered` de mayor a menor confianza y
    # conserva una sola detección por `scientific_name`: la de mayor `score`.
    unique_detections: dict[str, Detection] = {}

    # Devuelve como máximo `top_k` detecciones.
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


def _split_species_name(species_name: str) -> tuple[str, str]:
    """Separa el formato de BirdNET: 'Nombre científico_Nombre común'."""
    if "_" not in species_name:
        return species_name, species_name

    scientific_name, common_name = species_name.split("_", maxsplit=1)
    return scientific_name.strip(), common_name.strip()


def _optional_text(value) -> str | None:
    """Convierte un valor opcional de pandas en texto o None."""
    if value is None or pd.isna(value):
        return None
    return str(value)
