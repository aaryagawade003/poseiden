from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from backend.config import DATA_DIR

INCIDENTS_JSON_PATH = DATA_DIR / "incidents" / "incidents.json"
CASES_DIR = DATA_DIR / "cases"


def load_all_incidents() -> List[Dict[str, Any]]:
    """Loads all structured SIH-26143 incidents from central registry."""
    if not INCIDENTS_JSON_PATH.exists():
        return []
    with open(INCIDENTS_JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
        return data.get("incidents", [])


def get_incident_by_id(incident_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves an incident by its ID (exact or case-insensitive matching)."""
    incidents = load_all_incidents()
    target = incident_id.strip().upper()
    for inc in incidents:
        if inc["incidentId"].upper() == target or inc["incidentName"].upper() == target:
            return inc
        # Also check stem or short ID
        if target in inc["incidentId"].upper():
            return inc
    return None


def calculate_data_quality(inc: Dict[str, Any]) -> Dict[str, Any]:
    """Calculates scientifically defensible Data Completeness % and Evidence Confidence."""
    weights = {
        "satellite": 0.30,
        "ais": 0.25,
        "wind": 0.15,
        "current": 0.15,
        "timestamp_precision": 0.08,
        "location_precision": 0.07,
    }

    score = 0.0

    # Satellite score
    sat_status = inc.get("satelliteStatus", inc.get("satelliteAvailability", "UNAVAILABLE"))
    if sat_status == "AVAILABLE":
        score += weights["satellite"]
    elif sat_status == "PARTIAL":
        score += weights["satellite"] * 0.5
    elif sat_status == "HISTORICAL_LIMITATION":
        # Clear acknowledgement of limitation receives partial documentation credit
        score += weights["satellite"] * 0.2

    # AIS score
    ais_rel = inc.get("aisRelevance", "RELEVANT")
    ais_avail = inc.get("aisAvailability", "UNAVAILABLE")
    if ais_avail == "AVAILABLE" and ais_rel == "RELEVANT":
        score += weights["ais"]
    elif ais_avail == "AVAILABLE" and ais_rel == "LESS_RELEVANT_PIPELINE":
        score += weights["ais"] * 0.9  # Fully documented as pipeline
    elif ais_avail == "LIMITED_HISTORICAL":
        score += weights["ais"] * 0.3

    # Wind
    if inc.get("windAvailability") == "AVAILABLE":
        score += weights["wind"]

    # Current
    if inc.get("currentAvailability") == "AVAILABLE":
        score += weights["current"]

    # Precision
    score += weights["timestamp_precision"]
    score += weights["location_precision"]

    completeness_pct = round(score * 100)

    # Determine confidence level
    if completeness_pct >= 80 and sat_status == "AVAILABLE":
        confidence = "HIGH"
    elif completeness_pct >= 50:
        confidence = "MEDIUM"
    else:
        confidence = "LOW"

    return {
        "dataCompleteness": completeness_pct,
        "evidenceConfidence": confidence,
        "perLayer": {
            "satellite": {
                "status": sat_status,
                "confidence": inc.get("detectionConfidence"),
                "sources": inc.get("satelliteSources", []),
            },
            "ais": {
                "status": inc.get("aisAvailability", "UNAVAILABLE"),
                "relevance": inc.get("aisRelevance", "RELEVANT"),
                "description": inc.get("aisDescription", ""),
            },
            "wind": {
                "status": inc.get("windAvailability", "UNAVAILABLE"),
                "source": inc.get("windSource", "ERA5"),
            },
            "current": {
                "status": inc.get("currentAvailability", "UNAVAILABLE"),
                "source": inc.get("currentSource", "CMEMS"),
            },
        },
    }
