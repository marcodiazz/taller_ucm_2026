"""Primera inferencia con BirdNET.

Uso:
    python scripts/first_inference.py
"""

from pathlib import Path

import birdnet

# TODO Definir la ruta del audio
AUDIO_PATH = Path("./sample_audio/LaCabrera.wav")


def main() -> None:
    if not AUDIO_PATH.exists():
        print(f"No existe el archivo: {AUDIO_PATH}")
        raise SystemExit(1)

    # TODO Cargar el modelo
    print("🔋 Cargando modelo BirdNET...")
    model = birdnet.load("acoustic", "2.4", "tf", lang="es")

    # TODO Hacer la predicción del audio con el modelo:
    print(f" 🔊 Analizando: {AUDIO_PATH}")
    predictions = model.predict(str(AUDIO_PATH))

    # TODO Mostrar las detecciones
    print("\n 🔍 Primeras detecciones:")
    print(predictions.to_dataframe().drop(columns=["input"]).head(10))


if __name__ == "__main__":
    main()
