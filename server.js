const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Maharashtra BhuNaksha District Codes ──────────────────────────────────
const DISTRICT_CODES = {
  "MUMBAI CITY":               "G01",
  "MUMBAI SUBURBAN":           "G02",
  "THANE":                     "G03",
  "PALGHAR":                   "G04",
  "RAIGAD":                    "G05",
  "RATNAGIRI":                 "G06",
  "SINDHUDURG":                "G07",
  "NASHIK":                    "G08",
  "DHULE":                     "G09",
  "NANDURBAR":                 "G10",
  "JALGAON":                   "G11",
  "AHMEDNAGAR":                "G12",
  "PUNE":                      "G13",
  "SOLAPUR":                   "G14",
  "SATARA":                    "G15",
  "SANGLI":                    "G16",
  "KOLHAPUR":                  "G17",
  "CHHATRAPATI SAMBHAJINAGAR": "G18",
  "JALNA":                     "G19",
  "BEED":                      "G20",
  "LATUR":                     "G21",
  "DHARASHIV":                 "G22",
  "NANDED":                    "G23",
  "PARBHANI":                  "G24",
  "HINGOLI":                   "G25",
  "BULDHANA":                  "G26",
  "AKOLA":                     "G27",
  "WASHIM":                    "G28",
  "AMRAVATI":                  "G29",
  "YAVATMAL":                  "G30",
  "WARDHA":                    "G31",
  "NAGPUR":                    "G32",
  "BHANDARA":                  "G33",
  "GONDIA":                    "G34",
  "CHANDRAPUR":                "G35",
  "GADCHIROLI":                "G36"
};

// BhuNaksha base URL
const BHUNAKSHA_BASE = 'https://mahabhuinaksha.com';
const BHUNAKSHA_API  = 'https://mahabhuinaksha.com/api/v1';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin': 'https://mahabhuinaksha.com',
  'Referer': 'https://mahabhuinaksha.com/'
};

// ─── HELPER: fetch with timeout ────────────────────────────────────────────
async function fetchBhuNaksha(url, params = {}) {
  const resp = await axios.get(url, {
    params,
    headers: HEADERS,
    timeout: 15000
  });
  return resp.data;
}

// ──────────────────────────────────────────────────────────────────────────
// API: GET /api/districts
// Returns all districts with their codes
// ──────────────────────────────────────────────────────────────────────────
app.get('/api/districts', (req, res) => {
  const list = Object.entries(DISTRICT_CODES).map(([name, code]) => ({ name, code }));
  res.json({ success: true, data: list });
});

// ──────────────────────────────────────────────────────────────────────────
// API: GET /api/talukas?districtCode=G26
// Fetch taluka list from BhuNaksha
// ──────────────────────────────────────────────────────────────────────────
app.get('/api/talukas', async (req, res) => {
  const { districtCode } = req.query;
  if (!districtCode) return res.status(400).json({ success: false, error: 'districtCode required' });

  try {
    // BhuNaksha API - get talukas
    const data = await fetchBhuNaksha(`${BHUNAKSHA_BASE}/geoserver/ows`, {
      service: 'WFS',
      version: '1.0.0',
      request: 'GetFeature',
      typeName: 'bhunakasha:MH_TALUKA',
      outputFormat: 'application/json',
      CQL_FILTER: `DISTRICT_CD='${districtCode}'`,
      propertyName: 'TALUKA_CD,TALUKA_NM'
    });

    const talukas = data.features
      ? data.features.map(f => ({
          code: f.properties.TALUKA_CD,
          name: f.properties.TALUKA_NM
        }))
      : [];

    res.json({ success: true, data: talukas });
  } catch (err) {
    console.error('Taluka fetch error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// API: GET /api/villages?districtCode=G26&talukaCode=T001
// ──────────────────────────────────────────────────────────────────────────
app.get('/api/villages', async (req, res) => {
  const { districtCode, talukaCode } = req.query;
  if (!districtCode || !talukaCode) {
    return res.status(400).json({ success: false, error: 'districtCode and talukaCode required' });
  }

  try {
    const data = await fetchBhuNaksha(`${BHUNAKSHA_BASE}/geoserver/ows`, {
      service: 'WFS',
      version: '1.0.0',
      request: 'GetFeature',
      typeName: 'bhunakasha:MH_VILLAGE',
      outputFormat: 'application/json',
      CQL_FILTER: `DISTRICT_CD='${districtCode}' AND TALUKA_CD='${talukaCode}'`,
      propertyName: 'VILLAGE_CD,VILLAGE_NM'
    });

    const villages = data.features
      ? data.features.map(f => ({
          code: f.properties.VILLAGE_CD,
          name: f.properties.VILLAGE_NM
        }))
      : [];

    res.json({ success: true, data: villages });
  } catch (err) {
    console.error('Village fetch error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// API: GET /api/plot-boundary
// Real BhuNaksha plot boundary - returns GeoJSON
// ?districtCode=G26&talukaCode=T003&villageCode=V001&surveyNo=9
// ──────────────────────────────────────────────────────────────────────────
app.get('/api/plot-boundary', async (req, res) => {
  const { districtCode, talukaCode, villageCode, surveyNo } = req.query;

  if (!districtCode || !talukaCode || !villageCode || !surveyNo) {
    return res.status(400).json({
      success: false,
      error: 'districtCode, talukaCode, villageCode, surveyNo - सर्व required आहेत'
    });
  }

  try {
    // Primary attempt: WFS GetFeature
    const data = await fetchBhuNaksha(`${BHUNAKSHA_BASE}/geoserver/ows`, {
      service: 'WFS',
      version: '1.0.0',
      request: 'GetFeature',
      typeName: 'bhunakasha:MH_CADASTRAL',
      outputFormat: 'application/json',
      CQL_FILTER: `DISTRICT_CD='${districtCode}' AND TALUKA_CD='${talukaCode}' AND VILLAGE_CD='${villageCode}' AND SURVEY_NO='${surveyNo}'`
    });

    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const props = feature.properties || {};

      // Calculate area from geometry if possible
      const coords = feature.geometry?.coordinates;

      return res.json({
        success: true,
        source: 'BhuNaksha WFS',
        geojson: feature,
        metadata: {
          surveyNo:   props.SURVEY_NO  || surveyNo,
          districtNm: props.DISTRICT_NM || '',
          talukaNm:   props.TALUKA_NM  || '',
          villageNm:  props.VILLAGE_NM || '',
          area:       props.AREA       || '',
          areaSqMtr:  props.AREA_SQ_MTR || '',
          ownerName:  props.KHATEDAR_NM || '',
        }
      });
    }

    // If no features found
    return res.status(404).json({
      success: false,
      error: `Survey No. ${surveyNo} साठी boundary आढळली नाही. Village code तपासा.`
    });

  } catch (err) {
    console.error('Plot boundary error:', err.message);

    // Try alternate BhuNaksha endpoint
    try {
      const altData = await fetchBhuNaksha(`${BHUNAKSHA_BASE}/api/getData`, {
        state: '27',
        district: districtCode,
        taluka: talukaCode,
        village: villageCode,
        surveyNo: surveyNo
      });

      if (altData && altData.geometry) {
        return res.json({
          success: true,
          source: 'BhuNaksha API v2',
          geojson: altData,
          metadata: altData.properties || {}
        });
      }
    } catch (e2) {
      console.error('Alt endpoint also failed:', e2.message);
    }

    return res.status(500).json({ success: false, error: `BhuNaksha API error: ${err.message}` });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// API: GET /api/plot-by-name
// Lookup by district/taluka/village NAME → get codes → get boundary
// This is the user-friendly endpoint
// ──────────────────────────────────────────────────────────────────────────
app.get('/api/plot-by-name', async (req, res) => {
  const { district, taluka, village, surveyNo } = req.query;

  if (!district || !taluka || !village || !surveyNo) {
    return res.status(400).json({ success: false, error: 'district, taluka, village, surveyNo required' });
  }

  try {
    // Step 1: Get district code
    const distUpper = district.toUpperCase().trim();
    const districtCode = DISTRICT_CODES[distUpper];
    if (!districtCode) {
      return res.status(404).json({ success: false, error: `District "${district}" code आढळला नाही` });
    }

    // Step 2: Fetch talukas → find code
    let talukaCode = null;
    try {
      const talukaData = await fetchBhuNaksha(`${BHUNAKSHA_BASE}/geoserver/ows`, {
        service: 'WFS',
        version: '1.0.0',
        request: 'GetFeature',
        typeName: 'bhunakasha:MH_TALUKA',
        outputFormat: 'application/json',
        CQL_FILTER: `DISTRICT_CD='${districtCode}'`,
        propertyName: 'TALUKA_CD,TALUKA_NM'
      });

      const talukaUpper = taluka.toUpperCase().trim();
      const match = talukaData.features?.find(f =>
        f.properties.TALUKA_NM?.toUpperCase().includes(talukaUpper) ||
        talukaUpper.includes(f.properties.TALUKA_NM?.toUpperCase())
      );
      talukaCode = match?.properties.TALUKA_CD;
    } catch (e) {
      return res.status(500).json({ success: false, error: `Taluka lookup failed: ${e.message}` });
    }

    if (!talukaCode) {
      return res.status(404).json({ success: false, error: `Taluka "${taluka}" code आढळला नाही` });
    }

    // Step 3: Fetch villages → find code
    let villageCode = null;
    try {
      const villageData = await fetchBhuNaksha(`${BHUNAKSHA_BASE}/geoserver/ows`, {
        service: 'WFS',
        version: '1.0.0',
        request: 'GetFeature',
        typeName: 'bhunakasha:MH_VILLAGE',
        outputFormat: 'application/json',
        CQL_FILTER: `DISTRICT_CD='${districtCode}' AND TALUKA_CD='${talukaCode}'`,
        propertyName: 'VILLAGE_CD,VILLAGE_NM'
      });

      const villageUpper = village.toUpperCase().trim();
      const match = villageData.features?.find(f =>
        f.properties.VILLAGE_NM?.toUpperCase().includes(villageUpper) ||
        villageUpper.includes(f.properties.VILLAGE_NM?.toUpperCase())
      );
      villageCode = match?.properties.VILLAGE_CD;
    } catch (e) {
      return res.status(500).json({ success: false, error: `Village lookup failed: ${e.message}` });
    }

    if (!villageCode) {
      return res.status(404).json({ success: false, error: `Village "${village}" code आढळला नाही` });
    }

    // Step 4: Get actual plot boundary
    const boundaryData = await fetchBhuNaksha(`${BHUNAKSHA_BASE}/geoserver/ows`, {
      service: 'WFS',
      version: '1.0.0',
      request: 'GetFeature',
      typeName: 'bhunakasha:MH_CADASTRAL',
      outputFormat: 'application/json',
      CQL_FILTER: `DISTRICT_CD='${districtCode}' AND TALUKA_CD='${talukaCode}' AND VILLAGE_CD='${villageCode}' AND SURVEY_NO='${surveyNo}'`
    });

    if (!boundaryData.features || boundaryData.features.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Survey No. ${surveyNo} साठी boundary मिळाली नाही. Survey number exact असणे आवश्यक आहे.`,
        codes: { districtCode, talukaCode, villageCode }
      });
    }

    const feature = boundaryData.features[0];
    const props   = feature.properties || {};

    res.json({
      success:  true,
      source:   'BhuNaksha Live Data',
      geojson:  feature,
      codes:    { districtCode, talukaCode, villageCode },
      metadata: {
        surveyNo:  props.SURVEY_NO  || surveyNo,
        village:   props.VILLAGE_NM || village,
        taluka:    props.TALUKA_NM  || taluka,
        district:  props.DISTRICT_NM|| district,
        area:      props.AREA       || '',
        areaSqMtr: props.AREA_SQ_MTR|| '',
        ownerName: props.KHATEDAR_NM|| ''
      }
    });

  } catch (err) {
    console.error('plot-by-name error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// API: GET /api/neighboring-plots
// Get all neighboring survey numbers for a given plot
// ──────────────────────────────────────────────────────────────────────────
app.get('/api/neighboring-plots', async (req, res) => {
  const { districtCode, talukaCode, villageCode, surveyNo } = req.query;

  if (!districtCode || !talukaCode || !villageCode || !surveyNo) {
    return res.status(400).json({ success: false, error: 'All codes + surveyNo required' });
  }

  try {
    // First get main plot to get its bbox
    const mainData = await fetchBhuNaksha(`${BHUNAKSHA_BASE}/geoserver/ows`, {
      service: 'WFS',
      version: '1.0.0',
      request: 'GetFeature',
      typeName: 'bhunakasha:MH_CADASTRAL',
      outputFormat: 'application/json',
      CQL_FILTER: `DISTRICT_CD='${districtCode}' AND TALUKA_CD='${talukaCode}' AND VILLAGE_CD='${villageCode}' AND SURVEY_NO='${surveyNo}'`
    });

    if (!mainData.features?.length) {
      return res.status(404).json({ success: false, error: 'Main plot not found' });
    }

    const mainFeature = mainData.features[0];
    // Get bbox of main plot
    const coords = getAllCoords(mainFeature.geometry);
    const bbox = getBbox(coords);
    // Expand bbox slightly to find neighbors
    const expand = 0.0005;
    const expandedBbox = [bbox[0]-expand, bbox[1]-expand, bbox[2]+expand, bbox[3]+expand];

    // Get all plots in that area
    const neighborData = await fetchBhuNaksha(`${BHUNAKSHA_BASE}/geoserver/ows`, {
      service: 'WFS',
      version: '1.0.0',
      request: 'GetFeature',
      typeName: 'bhunakasha:MH_CADASTRAL',
      outputFormat: 'application/json',
      BBOX: expandedBbox.join(',') + ',EPSG:4326',
      CQL_FILTER: `DISTRICT_CD='${districtCode}' AND TALUKA_CD='${talukaCode}' AND VILLAGE_CD='${villageCode}'`
    });

    res.json({
      success: true,
      mainPlot: mainFeature,
      neighbors: neighborData.features || [],
      bbox: expandedBbox
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper: get all coordinates from geometry
function getAllCoords(geometry) {
  if (!geometry) return [];
  let coords = [];
  const flatten = (arr) => {
    if (typeof arr[0] === 'number') coords.push(arr);
    else arr.forEach(flatten);
  };
  flatten(geometry.coordinates);
  return coords;
}

function getBbox(coords) {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  coords.forEach(([lng, lat]) => {
    minLng = Math.min(minLng, lng); minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng); maxLat = Math.max(maxLat, lat);
  });
  return [minLng, minLat, maxLng, maxLat];
}

// ──────────────────────────────────────────────────────────────────────────
// Serve frontend
// ──────────────────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ PrintsHubh BhuNaksha Server running on port ${PORT}`);
});
