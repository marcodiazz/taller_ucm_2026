# Taller UCM — IA generativa aplicada a identificación de aves

Proyecto base para el taller: subir o grabar un audio, analizarlo con BirdNET y generar una ficha del ave con un LLM.

## Requisitos

- Python 3.11 o superior.
- Opcional: una API key de OpenAI o Google Gemini para generar fichas reales.

## Instalación

```bash
cd /Users/marcodiaz/Desktop/projects/taller_ucm
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```
### Alternativa más rápida a pip

Para acelerar la instalación de puede usar uv en vez de pip:
```bash
  uv venv --python 3.11
  source .venv/bin/activate
  uv pip install -r requirements.txt
```

  En Windows:
```bash
uv venv --python 3.11
.venv\Scripts\activate
uv pip install -r requirements.txt
```

  Para instalar uv:
```bash
python3.11 -m pip install uv
```

  Después:
```bash
uv venv --python 3.11
uv pip install -r requirements.txt
```
Edita `.env`, selecciona un proveedor y añade su clave si quieres usar generación real.

OpenAI:

```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

Google Gemini:

```bash
LLM_PROVIDER=gemini
GEMINI_API_KEY=...
```

La clave de Gemini se puede crear en [Google AI Studio](https://aistudio.google.com/apikey).

Los modelos se pueden cambiar con `OPENAI_MODEL` y `GEMINI_MODEL`. Si no hay
una clave para el proveedor seleccionado, la aplicación devuelve una ficha
simulada.

## Ejecutar la aplicación

```bash
uvicorn backend.main:app --reload
```

Abre:

```text
http://127.0.0.1:8000
```

## Flujo del proyecto

1. El usuario sube o graba un audio desde el navegador.
2. El frontend llama a `POST /api/analyze`.
3. El backend ejecuta BirdNET sobre el audio.
4. El frontend muestra las especies candidatas.
5. El usuario selecciona una especie.
6. El frontend llama a `POST /api/species-card`.
7. El backend usa un LLM para generar una ficha explicativa.

## Endpoints

### `POST /api/analyze`

Parámetros:

- `file`: archivo de audio.
- `top_k`: número máximo de detecciones devueltas.
- `min_confidence`: umbral mínimo de confianza.

Formatos recomendados para archivos: WAV, MP3, FLAC, OGG u OPUS. BirdNET
no admite directamente WebM, M4A ni AAC. Las grabaciones realizadas desde
esta interfaz se convierten automáticamente a WAV en el navegador.

### `POST /api/species-card`

Body JSON:

```json
{
  "scientific_name": "Turdus merula",
  "common_name": "Mirlo común",
  "score": 0.87,
  "start_time": "00:00:00.00",
  "end_time": "00:00:03.00"
}
```

## Actividades recomendadas para alumnos

Busca en el código los comentarios `TODO alumno`.

Ideas básicas:

- Cambiar el número de resultados.
- Ajustar el umbral de confianza.
- Mejorar cómo se muestran los resultados.
- Modificar el prompt del LLM.

Ideas avanzadas:

- Añadir filtro por localización y fecha.
- Cachear fichas generadas por especie.
- Guardar resultados en CSV o SQLite.

## Audios de ejemplo

Coloca audios de Xeno-canto u otras fuentes abiertas en la carpeta `sample_audio/`.
