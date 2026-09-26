/**
 * incidentRegistry.js — Centralized Frontend Incident Registry
 * Standardized source of truth for the 5 SIH-26143 Maritime Oil Spill Cases.
 */

export const INCIDENT_REGISTRY = {
  "CASE-2025-MSC-ELSA-3": {
    incidentId: "CASE-2025-MSC-ELSA-3",
    incidentName: "MSC ELSA 3 shipwreck",
    date: "2025-05-25",
    timestamp: "2025-05-25T04:15:00Z",
    locationName: "Off Kochi / Alappuzha, Kerala",
    latitude: 9.5000,
    longitude: 75.7667,
    incidentType: "Container ship capsized/sank; oil slick detected",
    oilCargo: "367.1 MT furnace/heavy fuel oil; ~84.4 MT diesel",
    mapZoom: 10,
    mapCenter: [9.5000, 75.7667],
    satelliteStatus: "AVAILABLE",
    satelliteSources: ["Copernicus Sentinel-1A SAR (VV/VH)", "Sentinel-1 IW GRD before/after 2025-05-25"],
    aisAvailability: "AVAILABLE",
    aisRelevance: "RELEVANT",
    windAvailability: "AVAILABLE",
    currentAvailability: "AVAILABLE",
    dataCompleteness: 92,
    confidence: "HIGH",
    evidenceConfidence: "HIGH",
    detectionConfidence: 0.948,
    sourceUrls: [
      "https://www.pib.gov.in/PressReleasePage.aspx?PRID=2131395",
      "https://sdma.kerala.gov.in/ship-wreck-msc-elsa-3/",
      "https://dataspace.copernicus.eu/data-collections/copernicus-sentinel-missions/sentinel-1"
    ],
    notes: "Real incident off Kerala coast verified with official PIB and Kerala SDMA releases."
  },
  "CASE-2017-ENNORE-COLLISION": {
    incidentId: "CASE-2017-ENNORE-COLLISION",
    incidentName: "Ennore / Chennai ship collision",
    date: "2017-01-28",
    timestamp: "2017-01-28T04:00:00Z",
    locationName: "Ennore / Kamarajar Port, Chennai, Tamil Nadu",
    latitude: 13.2282,
    longitude: 80.3633,
    incidentType: "Two cargo ships collided; marine oil spill",
    oilCargo: "About 75 MT direct release; 194 MT total hydrocarbon spill",
    mapZoom: 12,
    mapCenter: [13.2282, 80.3633],
    satelliteStatus: "AVAILABLE",
    satelliteSources: ["Sentinel-1A SAR IW GRD (Copernicus CDSE)", "Sentinel-2 optical"],
    aisAvailability: "AVAILABLE",
    aisRelevance: "RELEVANT",
    windAvailability: "AVAILABLE",
    currentAvailability: "AVAILABLE",
    dataCompleteness: 89,
    confidence: "HIGH",
    evidenceConfidence: "HIGH",
    detectionConfidence: 0.923,
    sourceUrls: [
      "https://www.sciencedirect.com/science/article/pii/S0048969718301505",
      "https://pubmed.ncbi.nlm.nih.gov/34844147/",
      "https://www.nirantar.moef.gov.in/reports_docs/20240912_055307.pdf"
    ],
    notes: "Collision between MT BW Maple and MT Dawn Kanchipuram at Kamarajar Port entrance."
  },
  "CASE-2010-MSC-CHITRA": {
    incidentId: "CASE-2010-MSC-CHITRA",
    incidentName: "MSC Chitra collision",
    date: "2010-08-07",
    timestamp: "2010-08-07T09:58:00Z",
    locationName: "Mumbai, Arabian Sea",
    latitude: 18.8500,
    longitude: 72.8167,
    incidentType: "Vessel collision; container ship oil spill",
    oilCargo: "About 800 tonnes IFO-380 heavy fuel oil + ~300 containers lost",
    mapZoom: 11,
    mapCenter: [18.8500, 72.8167],
    satelliteStatus: "HISTORICAL_LIMITATION",
    satelliteSources: ["Sentinel-1: UNAVAILABLE (Non-operational in 2010; launched 2014)"],
    aisAvailability: "LIMITED_HISTORICAL",
    aisRelevance: "RELEVANT",
    windAvailability: "AVAILABLE",
    currentAvailability: "AVAILABLE",
    dataCompleteness: 58,
    confidence: "MEDIUM",
    evidenceConfidence: "MEDIUM",
    detectionConfidence: null,
    sourceUrls: [
      "https://www.mpcb.gov.in/sites/default/files/oil-spill/OilSpillinterimreport-NEERI.pdf",
      "https://www.nirantar.moef.gov.in/reports_docs/20240912_055307.pdf"
    ],
    notes: "Historical benchmark case. Sentinel-1 SAR was not operational in 2010. Synthetic radar data is strictly suppressed."
  },
  "CASE-2011-MUMBAI-URAN-PIPELINE": {
    incidentId: "CASE-2011-MUMBAI-URAN-PIPELINE",
    incidentName: "Mumbai-Uran pipeline spill",
    date: "2011-01-21",
    timestamp: "2011-01-21T08:30:00Z",
    locationName: "Mumbai, Arabian Sea",
    latitude: 19.0289,
    longitude: 72.7400,
    incidentType: "Pipeline oil spill (Subsea trunk line rupture)",
    oilCargo: "About 55 tonnes Bombay High crude oil from trunk line",
    mapZoom: 12,
    mapCenter: [19.0289, 72.7400],
    satelliteStatus: "HISTORICAL_LIMITATION",
    satelliteSources: ["Sentinel-1: UNAVAILABLE (Launched April 2014)"],
    aisAvailability: "AVAILABLE",
    aisRelevance: "LESS_RELEVANT_PIPELINE",
    windAvailability: "AVAILABLE",
    currentAvailability: "AVAILABLE",
    dataCompleteness: 64,
    confidence: "HIGH",
    evidenceConfidence: "HIGH",
    detectionConfidence: null,
    sourceUrls: [
      "https://www.nirantar.moef.gov.in/reports_docs/20240912_055307.pdf"
    ],
    notes: "Non-vessel pipeline rupture. AIS attribution is marked less relevant to avoid false polluter identification."
  },
  "CASE-2023-ENNORE-REFINERY": {
    incidentId: "CASE-2023-ENNORE-REFINERY",
    incidentName: "Ennore / Chennai refinery oil spill",
    date: "2023-12-04",
    timestamp: "2023-12-04T07:00:00Z",
    locationName: "Ennore / Manali, Chennai, Tamil Nadu",
    latitude: 13.2361,
    longitude: 80.3167,
    incidentType: "Crude oil contamination (Cyclone Michaung refinery flood discharge)",
    oilCargo: "Refinery oily effluent / sludge overflow into creek",
    mapZoom: 12,
    mapCenter: [13.2361, 80.3167],
    satelliteStatus: "AVAILABLE",
    satelliteSources: ["Sentinel-1 SAR (Copernicus CDSE)", "Sentinel-2 MSI Optical"],
    aisAvailability: "AVAILABLE",
    aisRelevance: "RELEVANT",
    windAvailability: "AVAILABLE",
    currentAvailability: "AVAILABLE",
    dataCompleteness: 94,
    confidence: "HIGH",
    evidenceConfidence: "HIGH",
    detectionConfidence: 0.952,
    sourceUrls: [
      "https://www.pib.gov.in/PressReleasePage.aspx?PRID=1987496",
      "https://dataspace.copernicus.eu/"
    ],
    notes: "Cyclone Michaung flood-induced refinery discharge through Ennore Creek."
  }
};

export function getIncidentMetadata(caseId) {
  if (!caseId) return null;
  const match = Object.values(INCIDENT_REGISTRY).find(
    (inc) => inc.incidentId === caseId || inc.incidentName.toLowerCase().includes(caseId.toLowerCase())
  );
  return match || null;
}
