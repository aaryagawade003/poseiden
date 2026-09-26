import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_central_incident_registry_and_list():
    res = client.get("/api/incidents")
    assert res.status_code == 200
    data = res.json()["data"]
    incidents = data["incidents"]
    assert len(incidents) >= 5

    inc_ids = [i["incident_id"] for i in incidents]
    assert "CASE-2025-MSC-ELSA-3" in inc_ids
    assert "CASE-2017-ENNORE-COLLISION" in inc_ids
    assert "CASE-2010-MSC-CHITRA" in inc_ids
    assert "CASE-2011-MUMBAI-URAN-PIPELINE" in inc_ids
    assert "CASE-2023-ENNORE-REFINERY" in inc_ids


def test_incident_1_msc_elsa_3():
    # MSC ELSA 3: Kerala Coast, 2025-05-25, Sentinel-1 Available, AIS Relevant
    res = client.get("/api/incidents/CASE-2025-MSC-ELSA-3")
    assert res.status_code == 200
    inc = res.json()["data"]
    assert inc["date"] == "2025-05-25"
    assert inc["latitude"] == 9.5000
    assert inc["longitude"] == 75.7667
    assert inc["satelliteStatus"] == "AVAILABLE"
    assert inc["aisRelevance"] == "RELEVANT"
    assert inc["mapZoom"] == 10

    # Satellite sub-endpoint
    r_sat = client.get("/api/incidents/CASE-2025-MSC-ELSA-3/satellite")
    assert r_sat.status_code == 200
    assert r_sat.json()["data"]["satelliteStatus"] == "AVAILABLE"

    # AIS sub-endpoint
    r_ais = client.get("/api/incidents/CASE-2025-MSC-ELSA-3/ais")
    assert r_ais.status_code == 200
    assert r_ais.json()["data"]["vessel_count"] > 0


def test_incident_2_ennore_2017():
    # Ennore 2017: Kamarajar Port, 2017-01-28, Sentinel-1 Available, Port Collision
    res = client.get("/api/incidents/CASE-2017-ENNORE-COLLISION")
    assert res.status_code == 200
    inc = res.json()["data"]
    assert inc["date"] == "2017-01-28"
    assert inc["latitude"] == 13.2282
    assert inc["longitude"] == 80.3633
    assert inc["mapZoom"] == 12
    assert inc["satelliteStatus"] == "AVAILABLE"
    assert inc["aisRelevance"] == "RELEVANT"

    # Pipeline analyze test
    res_an = client.post("/api/cases/CASE-2017-ENNORE-COLLISION/analyze")
    assert res_an.status_code == 200
    an = res_an.json()["data"]
    assert an["detection"]["detected"] is True
    # Dawn Kanchipuram should be top suspect involved in collision
    assert len(an["attribution"]["ranked"]) > 0


def test_incident_3_msc_chitra_2010_historical_limitation():
    # MSC Chitra 2010: Mumbai, 2010-08-07, Sentinel-1 UNAVAILABLE (historical limitation)
    res = client.get("/api/incidents/CASE-2010-MSC-CHITRA")
    assert res.status_code == 200
    inc = res.json()["data"]
    assert inc["date"] == "2010-08-07"
    assert inc["latitude"] == 18.8500
    assert inc["longitude"] == 72.8167
    assert inc["satelliteStatus"] == "HISTORICAL_LIMITATION"
    assert inc["mapZoom"] == 11

    # Analysis must NOT fabricate detection or crash
    res_an = client.post("/api/cases/CASE-2010-MSC-CHITRA/analyze")
    assert res_an.status_code == 200
    an = res_an.json()["data"]
    assert an["detection"]["detected"] is False
    assert "Historical" in an["detection"]["status"]


def test_incident_4_mumbai_uran_pipeline_spill():
    # Mumbai-Uran 2011: Pipeline spill, 2011-01-21, AIS marked less relevant, no false polluter
    res = client.get("/api/incidents/CASE-2011-MUMBAI-URAN-PIPELINE")
    assert res.status_code == 200
    inc = res.json()["data"]
    assert inc["date"] == "2011-01-21"
    assert inc["latitude"] == 19.0289
    assert inc["longitude"] == 72.7400
    assert inc["aisRelevance"] == "LESS_RELEVANT_PIPELINE"
    assert inc["mapZoom"] == 12

    # Analysis must suppress vessel attribution and attribute to pipeline infrastructure
    res_an = client.post("/api/cases/CASE-2011-MUMBAI-URAN-PIPELINE/analyze")
    assert res_an.status_code == 200
    an = res_an.json()["data"]
    assert an["attribution"]["is_pipeline_incident"] is True
    assert an["attribution"]["attribution_suppressed"] is True
    top = an["attribution"]["ranked"][0]
    assert "PIPELINE" in top["mmsi"] or "PIPELINE" in top["name"]


def test_incident_5_ennore_2023_refinery_spill():
    # Ennore 2023: Cyclone Michaung refinery flood discharge, 2023-12-04
    res = client.get("/api/incidents/CASE-2023-ENNORE-REFINERY")
    assert res.status_code == 200
    inc = res.json()["data"]
    assert inc["date"] == "2023-12-04"
    assert inc["latitude"] == 13.2361
    assert inc["longitude"] == 80.3167
    assert inc["satelliteStatus"] == "AVAILABLE"
    assert inc["mapZoom"] == 12

    # Evidence sub-endpoint
    r_ev = client.get("/api/incidents/CASE-2023-ENNORE-REFINERY/evidence")
    assert r_ev.status_code == 200
    ev = r_ev.json()["data"]
    assert len(ev["evidenceItems"]) > 0
    assert ev["dataCompleteness"] >= 80


def test_all_cases_endpoint_integrity():
    res = client.get("/api/cases")
    assert res.status_code == 200
    cases = res.json()["data"]["cases"]
    assert len(cases) >= 5
    for c in cases:
        assert "map_zoom" in c
        assert "coordinates" in c
        assert "satellite_status" in c
        assert "ais_relevance" in c
        assert "data_completeness" in c
        assert "evidence_confidence" in c
