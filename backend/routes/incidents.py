from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.db.database import get_connection
from backend.services.ai_report import build_structured_investigation_report
from backend.services.envelope import with_envelope
from backend.services.forecast import run_forecast
from backend.services.hindcast import run_hindcast
from backend.services.pipeline import run_investigation
from backend.services.report_builder import generate_pdf

router = APIRouter()


class IncidentCreateRequest(BaseModel):
    incident_id: Optional[str] = None
    title: str = "Offshore Hydrocarbon Discharge Alert"
    latitude: float
    longitude: float
    area_km2: float
    detection_confidence: float
    satellite_scene: str = "Sentinel-1"
    severity: str = "HIGH"
    status: str = "UNDER INVESTIGATION"
    observation_time: Optional[str] = None


class IncidentHindcastRequest(BaseModel):
    hours_back: float = 12.0
    step_hours: float = 0.5
    estimated_age_hours: float = 4.5


class IncidentForecastRequest(BaseModel):
    horizons_hours: List[float] = Field(default_factory=lambda: [6.0, 12.0, 24.0, 48.0])


@router.post("/incidents")
def create_incident(req: IncidentCreateRequest):
    iid = req.incident_id or f"MG-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    obs_time = req.observation_time or datetime.now(timezone.utc).isoformat()
    now_iso = datetime.now(timezone.utc).isoformat()

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO incidents (
            incident_id, title, status, severity, latitude, longitude, area_km2,
            detection_confidence, satellite_scene, observation_time, created_at, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        iid,
        req.title,
        req.status,
        req.severity,
        req.latitude,
        req.longitude,
        req.area_km2,
        req.detection_confidence,
        req.satellite_scene,
        obs_time,
        now_iso,
        json.dumps({"source": "alert_system", "satellite": req.satellite_scene}),
    ))
    conn.commit()
    conn.close()

    return with_envelope({
        "incident_id": iid,
        "title": req.title,
        "status": req.status,
        "severity": req.severity,
        "latitude": req.latitude,
        "longitude": req.longitude,
        "area_km2": req.area_km2,
        "detection_confidence": req.detection_confidence,
        "satellite_scene": req.satellite_scene,
        "observation_time": obs_time,
        "created_at": now_iso,
    })


@router.get("/incidents")
@router.get("/spills")
def list_incidents():
    from backend.services.incident_registry import load_all_incidents, calculate_data_quality
    registry_incidents = load_all_incidents()
    incidents = []

    # Include all 5 central master incidents first
    for reg in registry_incidents:
        dq = calculate_data_quality(reg)
        incidents.append({
            "incident_id": reg["incidentId"],
            "title": reg["incidentName"],
            "status": reg.get("incidentType", "UNDER INVESTIGATION"),
            "severity": "HIGH",
            "latitude": reg["latitude"],
            "longitude": reg["longitude"],
            "area_km2": 22.6 if "ELSA" in reg["incidentId"] else 18.5 if "2017" in reg["incidentId"] else 20.4 if "2023" in reg["incidentId"] else 4.2,
            "detection_confidence": reg.get("detectionConfidence"),
            "satellite_scene": reg.get("satelliteSources", ["Sentinel-1"])[0] if reg.get("satelliteSources") else "N/A",
            "observation_time": reg["timestamp"],
            "created_at": reg["timestamp"],
            "satellite_status": reg.get("satelliteStatus"),
            "ais_relevance": reg.get("aisRelevance"),
            "data_completeness": dq.get("dataCompleteness"),
            "evidence_confidence": dq.get("evidenceConfidence"),
            "map_zoom": reg.get("mapZoom", 10),
            "source_urls": reg.get("sourceUrls", []),
        })

    # Include existing DB incidents if any exist and not already in list
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM incidents ORDER BY created_at DESC")
    rows = cur.fetchall()
    conn.close()

    existing_ids = {i["incident_id"] for i in incidents}
    for r in rows:
        if r["incident_id"] not in existing_ids:
            incidents.append({
                "incident_id": r["incident_id"],
                "title": r["title"],
                "status": r["status"],
                "severity": r["severity"],
                "latitude": r["latitude"],
                "longitude": r["longitude"],
                "area_km2": r["area_km2"],
                "detection_confidence": r["detection_confidence"],
                "satellite_scene": r["satellite_scene"],
                "observation_time": r["observation_time"],
                "created_at": r["created_at"],
            })

    return with_envelope({"incidents": incidents, "count": len(incidents)})


@router.get("/incidents/{incident_id}")
@router.get("/spills/{incident_id}")
def get_incident(incident_id: str):
    from backend.services.incident_registry import get_incident_by_id, calculate_data_quality
    reg = get_incident_by_id(incident_id)
    if reg:
        dq = calculate_data_quality(reg)
        return with_envelope({
            **reg,
            "incident_id": reg["incidentId"],
            "title": reg["incidentName"],
            "status": reg.get("incidentType", "UNDER INVESTIGATION"),
            "severity": "HIGH",
            "observation_time": reg["timestamp"],
            "dataQualityAnalysis": dq,
        })

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM incidents WHERE incident_id = ?", (incident_id,))
    row = cur.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found.")

    return with_envelope({
        "incident_id": row["incident_id"],
        "title": row["title"],
        "status": row["status"],
        "severity": row["severity"],
        "latitude": row["latitude"],
        "longitude": row["longitude"],
        "area_km2": row["area_km2"],
        "detection_confidence": row["detection_confidence"],
        "satellite_scene": row["satellite_scene"],
        "observation_time": row["observation_time"],
        "created_at": row["created_at"],
    })


@router.get("/incidents/{incident_id}/satellite")
def get_incident_satellite(incident_id: str):
    from backend.services.incident_registry import get_incident_by_id
    reg = get_incident_by_id(incident_id)
    if not reg:
        raise HTTPException(status_code=404, detail="Incident not found in registry")
    return with_envelope({
        "incident_id": reg["incidentId"],
        "satelliteAvailability": reg.get("satelliteAvailability"),
        "satelliteStatus": reg.get("satelliteStatus"),
        "sources": reg.get("satelliteSources", []),
        "detectionConfidence": reg.get("detectionConfidence"),
        "notes": reg.get("dataQuality", {}).get("satelliteLimitationNote"),
    })


@router.get("/incidents/{incident_id}/ais")
def get_incident_ais(incident_id: str):
    from backend.services.incident_registry import get_incident_by_id
    from backend.routes.cases import _load_case_file
    reg = get_incident_by_id(incident_id)
    if not reg:
        raise HTTPException(status_code=404, detail="Incident not found")
    try:
        case_data = _load_case_file(reg["incidentId"])
        vessels = case_data.get("inputs", {}).get("ais", {}).get("vessels", [])
    except Exception:
        vessels = []
    return with_envelope({
        "incident_id": reg["incidentId"],
        "aisAvailability": reg.get("aisAvailability"),
        "aisRelevance": reg.get("aisRelevance"),
        "description": reg.get("aisDescription"),
        "vessels": vessels,
        "vessel_count": len(vessels),
    })


@router.get("/incidents/{incident_id}/environment")
def get_incident_environment(incident_id: str):
    from backend.services.incident_registry import get_incident_by_id
    from backend.routes.cases import _load_case_file
    reg = get_incident_by_id(incident_id)
    if not reg:
        raise HTTPException(status_code=404, detail="Incident not found")
    try:
        case_data = _load_case_file(reg["incidentId"])
        wind = case_data.get("inputs", {}).get("wind", {})
        curr = case_data.get("inputs", {}).get("ocean_current", {})
    except Exception:
        wind, curr = {}, {}
    return with_envelope({
        "incident_id": reg["incidentId"],
        "wind": wind,
        "ocean_current": curr,
    })


@router.get("/incidents/{incident_id}/timeline")
def get_incident_timeline(incident_id: str):
    from backend.services.incident_registry import get_incident_by_id
    reg = get_incident_by_id(incident_id)
    if not reg:
        raise HTTPException(status_code=404, detail="Incident not found")
    return with_envelope({
        "incident_id": reg["incidentId"],
        "date": reg["date"],
        "timestamp": reg["timestamp"],
        "investigationWindow": reg.get("investigationWindow", {}),
        "timelineStart": reg.get("timelineStart"),
        "timelineEnd": reg.get("timelineEnd"),
    })


@router.get("/incidents/{incident_id}/evidence")
def get_incident_evidence(incident_id: str):
    from backend.services.incident_registry import get_incident_by_id, calculate_data_quality
    reg = get_incident_by_id(incident_id)
    if not reg:
        raise HTTPException(status_code=404, detail="Incident not found")
    dq = calculate_data_quality(reg)
    return with_envelope({
        "incident_id": reg["incidentId"],
        "evidenceItems": reg.get("evidenceItems", []),
        "sourceUrls": reg.get("sourceUrls", []),
        "dataQuality": dq,
        "dataCompleteness": dq.get("dataCompleteness"),
        "evidenceConfidence": dq.get("evidenceConfidence"),
    })


@router.post("/spills/{incident_id}/hindcast")
@router.post("/investigations/{incident_id}/backtrack")
def incident_hindcast(incident_id: str, req: IncidentHindcastRequest = IncidentHindcastRequest()):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM incidents WHERE incident_id = ?", (incident_id,))
    row = cur.fetchone()
    conn.close()

    lat = row["latitude"] if row else 19.12
    lon = row["longitude"] if row else 71.85
    obs_time = row["observation_time"] if row else "2026-03-14T06:30:00Z"

    hc = run_hindcast(
        centroid={"latitude": lat, "longitude": lon},
        observation_time=obs_time,
        hours_back=req.hours_back,
        step_hours=req.step_hours,
        estimated_age_hours=req.estimated_age_hours,
    )
    return with_envelope(hc)


@router.post("/spills/{incident_id}/forecast")
@router.post("/investigations/{incident_id}/forward-track")
def incident_forecast(incident_id: str, req: IncidentForecastRequest = IncidentForecastRequest()):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM incidents WHERE incident_id = ?", (incident_id,))
    row = cur.fetchone()
    conn.close()

    lat = row["latitude"] if row else 19.12
    lon = row["longitude"] if row else 71.85
    obs_time = row["observation_time"] if row else "2026-03-14T06:30:00Z"

    fc = run_forecast(
        centroid={"latitude": lat, "longitude": lon},
        observation_time=obs_time,
        horizons_hours=req.horizons_hours,
    )
    return with_envelope(fc)


@router.get("/incidents/{incident_id}/report")
@router.get("/investigations/{incident_id}/generate-report")
@router.post("/investigations/{incident_id}/generate-report")
def get_incident_report(incident_id: str):
    inv = run_investigation()
    structured = build_structured_investigation_report(inv.get("data", inv))
    pdf_info = generate_pdf(inv.get("data", inv))
    structured["pdf_download_url"] = pdf_info.get("download_url")
    structured["pdf_filename"] = pdf_info.get("filename")
    return with_envelope(structured)

