const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const path = require("path");

const app = express();
const PORT = 3005;
const projectId = '3811784';
const MIXPANEL_IMPORT_API_URL = `https://api.mixpanel.com/import?strict=1&project_id=${projectId}`;
const MIXPANEL_BASIC_AUTH = 'Basic dHJ1Y25ndXllbi4wODQ0MDgubXAtc2VydmljZS1hY2NvdW50OndLeVBTOW1rQ2pNbHNYR2dBR3d4TWxhMmlkNHlZdWNx';


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 1. Receive Adjust install callback
app.post('/appsflyer/install', async (req, res) => {
  try {
    const { uid, campaign, network, tracker_name, tracker_token } = req.body;

    if (!uid) {
      return res.status(400).json({ error: 'Missing uid' });
    }

    // Send to Mixpanel
    const payload = [
      {
        event: 'Install',
        properties: {
          distinct_id: uid,
          time: Math.floor(Date.now() / 1000),
          source: 'AppsFlyer',
          campaign,
          network,
          tracker_name,
          tracker_token,
          $insert_id: `install_${uid}_${Date.now()}` // prevent duplication
        }
      }
    ];

    console.log("AKA Anonymous data: ", payload)

    const response_data = await fetch(MIXPANEL_IMPORT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': MIXPANEL_BASIC_AUTH
      },
      body: JSON.stringify(payload)
    });

    if (!response_data.ok) {
      const text = await response_data.text();
      console.error('Mixpanel import failed:', response_data.status, text);
    } else {
      console.log('Alias event imported to Mixpanel');
    }
  } catch (err) {
    console.error('Error processing install:', err);
    res.sendStatus(500);
  }
});

// 2. Optional: Alias uid to customer_id on login
app.post('/alias', async (req, res) => {
  try {
    const { uid, customer_id } = req.body;

    if (!uid || !customer_id) {
      return res.status(400).json({ error: 'Missing uid or customer_id' });
    }

    const aliasEvent = {
      event: '$create_alias',
      properties: {
        token: MIXPANEL_TOKEN,
        distinct_id: uid,
        alias: customer_id,
        time: Math.floor(Date.now() / 1000), // REQUIRED for /import
      },
    };

    console.log("AKA Alias data: ", aliasEvent)

    // Encode to base64
    const payload = Buffer.from(JSON.stringify([aliasEvent])).toString('base64');

    // Basic Auth header: username is your API key, password is empty
    const authHeader = Buffer.from(`${MIXPANEL_API_KEY}:`).toString('base64');

    const response_data = await fetch(`https://api.mixpanel.com/import?strict=1&project_id=${MIXPANEL_PROJECT_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authHeader}`,
      },
      body: `data=${payload}`,
    });

    if (!response_data.ok) {
      const text = await response_data.text();
      console.error('Mixpanel import failed:', response_data.status, text);
    } else {
      console.log('Alias event imported to Mixpanel');
    }
  } catch (err) {
    console.error('Error aliasing user:', err);
    res.sendStatus(500);
  }
});

app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Server listening at http://localhost:${PORT}`);
});
