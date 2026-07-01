from pathlib import Path

import birdnet

from backend import settings

AUDIO_PATH = Path("./sample_audio/Petirrojo.mp3")

LATITUDE = 40.8647
LONGITUDE = -3.6164


def main() -> None:
    if not AUDIO_PATH.exists():
        raise SystemExit(f"No existe el archivo: {AUDIO_PATH}")

    print("🌍 Calculando especies probables para la ubicación...")
    geo_model = birdnet.load("geo", "2.4", "tf", lang="es")

    geo_predictions = geo_model.predict(
        LATITUDE,
        LONGITUDE,
        min_confidence=0.03,
    )

    species = geo_predictions.to_dataframe()["species_name"].tolist()
    print(f"Especies posibles en la zona: {len(species)}")

    print("🔋 Cargando modelo acústico...")
    acoustic_model = birdnet.load("acoustic", "2.4", "tf", lang="es")

    print(f"🔊 Analizando: {AUDIO_PATH}")
    predictions = acoustic_model.predict(
        str(AUDIO_PATH),
        top_k=10,
        default_confidence_threshold=0.1,
        custom_species_list=species,
    )

    print(predictions.to_dataframe().drop(columns=["input"]).head(10))

    # predictions_df = (
    #     predictions.to_dataframe()
    #     .sort_values("confidence", ascending=False)
    #     .drop_duplicates(subset="species_name", keep="first")
    # )


def call_llm(especie: str):
    from google import genai

    prompt = f"""
    Dame una lista de características y datos curisos sobre la siguiente especie de ave:
        {especie}
    """

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=prompt,
    )
    print(response.text)


if __name__ == "__main__":
    main()
    call_llm(especie="Vencejo Común")
