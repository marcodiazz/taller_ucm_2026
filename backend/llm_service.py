import json

from backend import settings
from backend.schemas import SpeciesCardRequest, SpeciesCardResponse

SYSTEM_PROMPT = (
    "Eres un divulgador experto en aves y bioacústica. Respondes siempre en español."
)


def generate_species_card(request: SpeciesCardRequest) -> SpeciesCardResponse:
    """Genera una ficha con el proveedor configurado en LLM_PROVIDER."""
    provider = settings.LLM_PROVIDER

    if provider == "openai":
        if not settings.OPENAI_API_KEY:
            return _mock_species_card(request)
        return _generate_with_openai(request)

    if provider == "gemini":
        if not settings.GEMINI_API_KEY:
            return _mock_species_card(request)
        return _generate_with_gemini(request)

    raise ValueError(f"Proveedor LLM no válido: '{provider}'. Usa 'openai' o 'gemini'.")


def _generate_with_openai(request: SpeciesCardRequest) -> SpeciesCardResponse:
    """Genera la ficha mediante OpenAI."""
    from openai import OpenAI

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    response = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_prompt(request)},
        ],
        response_format={"type": "json_object"},
        temperature=0.4,
    )

    content = response.choices[0].message.content or "{}"
    return SpeciesCardResponse(**json.loads(content))


def _generate_with_gemini(request: SpeciesCardRequest) -> SpeciesCardResponse:
    """Genera la ficha mediante Google Gemini."""
    from google import genai

    # El context manager cierra las conexiones HTTP al terminar la petición.
    with genai.Client(api_key=settings.GEMINI_API_KEY) as client:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=f"{SYSTEM_PROMPT}\n\n{_build_prompt(request)}",
            config={
                "response_mime_type": "application/json",
                "response_json_schema": SpeciesCardResponse.model_json_schema(),
                "temperature": 0.4,
            },
        )

    return SpeciesCardResponse.model_validate_json(response.text)


def _build_prompt(request: SpeciesCardRequest) -> str:
    """Construye el mismo prompt para todos los proveedores."""
    # TODO alumno:
    # Modificar este prompt para controlar tono, longitud, idioma,
    # nivel técnico o advertencias sobre incertidumbre.
    return f"""
Genera una ficha breve en español sobre esta especie detectada por BirdNET.

Datos de la detección:
- Nombre científico: {request.scientific_name}
- Nombre común: {request.common_name}
- Confianza del modelo: {request.score:.2f}
- Segmento: {request.start_time or "desconocido"} - {request.end_time or "desconocido"}

Reglas:
- No afirmes que la identificación es segura.
- Explica que la predicción depende de la calidad del audio.
- Si la confianza es baja, indícalo claramente.
- Completa todos los campos del esquema solicitado.
- interesting_facts debe contener 2 o 3 elementos.
""".strip()


def _mock_species_card(request: SpeciesCardRequest) -> SpeciesCardResponse:
    """Fallback para que el taller funcione sin una clave configurada."""
    if request.score >= 0.7:
        confidence_note = "La confianza del modelo es alta, aunque conviene validar la detección escuchando el audio."
    elif request.score >= 0.3:
        confidence_note = "La confianza es media: esta especie es una candidata razonable, no una identificación definitiva."
    else:
        confidence_note = (
            "La confianza es baja: el resultado debe tratarse solo como una pista."
        )

    return SpeciesCardResponse(
        scientific_name=request.scientific_name,
        common_name=request.common_name,
        confidence_note=confidence_note,
        description=(
            f"{request.common_name} ({request.scientific_name}) es la especie seleccionada "
            "a partir de la salida de BirdNET. Esta ficha es simulada porque "
            f"no hay una clave configurada para {settings.LLM_PROVIDER}."
        ),
        habitat="Hábitat no consultado en modo simulado.",
        distribution="Distribución no consultada en modo simulado.",
        interesting_facts=[
            "BirdNET analiza fragmentos de audio y devuelve especies candidatas con una puntuación de confianza.",
            "El LLM no escucha el audio: solo explica la detección producida por el modelo especializado.",
        ],
    )
