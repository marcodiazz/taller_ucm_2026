from pydantic import BaseModel, Field


class Detection(BaseModel):
    scientific_name: str
    common_name: str
    score: float = Field(ge=0, le=1)
    start_time: str | None = None
    end_time: str | None = None


class AnalyzeResponse(BaseModel):
    filename: str
    detections: list[Detection]


class SpeciesCardRequest(BaseModel):
    scientific_name: str
    common_name: str
    score: float = Field(ge=0, le=1)
    start_time: str | None = None
    end_time: str | None = None


class SpeciesCardResponse(BaseModel):
    scientific_name: str
    common_name: str
    confidence_note: str
    description: str
    habitat: str
    distribution: str
    interesting_facts: list[str]
