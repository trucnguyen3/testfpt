const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch').default;
const path = require("path");

const app = express();
const PORT = 3005;
const projectId = '3826704';
const MIXPANEL_IMPORT_API_URL = `https://api.mixpanel.com/import?strict=1&project_id=${projectId}`;
const MIXPANEL_BASIC_AUTH = 'Basic dHJ1Y25ndXllbi4wODQ0MDgubXAtc2VydmljZS1hY2NvdW50OndLeVBTOW1rQ2pNbHNYR2dBR3d4TWxhMmlkNHlZdWNx';
const MIXPANEL_TOKEN = "d5c71d31bc37758fc8d70beecbed2365";


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 1. Receive Adjust install callback
app.post('/appsflyer/install', async (req, res) => {
  try {
    const { uid, campaign, network, tracker_name, tracker_token } = req.body;

    console.log("Data: ", uid, campaign, network, tracker_name, tracker_token)

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
      console.log('Install imported to Mixpanel successful');
      res.status(200).json({ status: 'ok' });
    }
  } catch (err) {
    console.error('Error processing install:', err);
    res.sendStatus(500);
  }
});

// 2. Optional: Alias uid to customer_id on login
app.post('/mixpanel/alias', async (req, res) => {
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

    const response_data = await fetch(MIXPANEL_IMPORT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': MIXPANEL_BASIC_AUTH,
      },
      body: `data=${payload}`,
    });

    if (!response_data.ok) {
      const text = await response_data.text();
      console.error('Mixpanel import failed:', response_data.status, text);
    } else {
      console.log('Alias imported to Mixpanel successful');
      res.status(200).json({ status: 'ok' });
    }
  } catch (err) {
    console.error('Error aliasing user:', err);
    res.sendStatus(500);
  }
});

app.post('/mixpanel/create-identity', async (req, res) => {
  try {
    const { anon_id, username } = req.body; 
    // distinct_id = YOUR_CHOSEN_USER_ID (e.g. username)
    // identified_id = ORIGINAL_ANON_ID (e.g. CleverTapID)

    if (!anon_id) {
      return res.status(400).json({ error: 'Missing anon_id' });
    }

    const payload = {
      event: "$identify",
      properties: {
        $identified_id: username, // the new permanent user id
        $anon_id: anon_id,     // the old anon/device id
        token: MIXPANEL_TOKEN
      }
    };

    const response = await fetch("https://api.mixpanel.com/track#create-identity", {
      method: "POST",
      headers: {
        "accept": "text/plain",
        "content-type": "application/x-www-form-urlencoded"
      },
      body: `data=${JSON.stringify(payload)}`
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("❌ Mixpanel identity failed:", response.status, text);
      return res.status(response.status).json({ error: text });
    }

    console.log("✅ Identity created/merged in Mixpanel successful");
    res.status(200).json({ status: "ok" });

  } catch (err) {
    console.error("❌ Error creating identity:", err);
    res.sendStatus(500);
  }
});

app.post('/mixpanel/profile', async (req, res) => {
  try {
    const { uid, campaign } = req.body;

    console.log("Data: ", uid, campaign);

    if (!uid) {
      return res.status(400).json({ error: 'Missing uid' });
    }

    // Event payload
    const event_payload = [
      {
        event: 'Profile Updated',
        properties: {
          distinct_id: uid,
          time: Math.floor(Date.now() / 1000),
          source: 'Mixpanel',
          campaign,
          $insert_id: `install_${uid}_${Date.now()}`
        }
      }
    ];

    console.log("Event payload: ", event_payload);

    const event_response_data = await fetch(MIXPANEL_IMPORT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': MIXPANEL_BASIC_AUTH
      },
      body: JSON.stringify(event_payload)
    });

    if (!event_response_data.ok) {
      const text = await event_response_data.text();
      console.error('Mixpanel import failed:', event_response_data.status, text);
      return res.status(event_response_data.status).json({ error: text });
    }

    console.log('Event imported to Mixpanel successful');

    // Profile payload
    const profile_payload = [
      {
        $token: MIXPANEL_TOKEN,
        $distinct_id: uid,
        $set: {
          $campaign: campaign
        }
      }
    ];

    const profile_response_data = await fetch("https://api.mixpanel.com/engage?ip=0", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(profile_payload)
    });

    if (!profile_response_data.ok) {
      const text = await profile_response_data.text();
      console.error('Mixpanel profile update failed:', profile_response_data.status, text);
      return res.status(profile_response_data.status).json({ error: text });
    }

    console.log('Profile updated in Mixpanel successfully');

    // ✅ Send response only once after both succeed
    res.status(200).json({ status: 'ok' });

  } catch (err) {
    console.error('Error updating profile:', err);
    res.sendStatus(500);
  }
});

app.post("/mixpanel/event", async (req, res) => {
  try {
    const { eventName, anon_id, properties = {} } = req.body;

    if (!eventName || !distinctId) {
      return res.status(400).json({ error: "Missing eventName or distinctId" });
    }

    const payload = [
      {
        event: eventName,
        properties: {
          distinct_id: anon_id,
          time: Math.floor(Date.now() / 1000), // current timestamp in seconds
          $insert_id: `${eventName}_${anon_id}_${Date.now()}`,
          ...properties,
        },
      },
    ];

    const response = await fetch(MIXPANEL_IMPORT_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": MIXPANEL_BASIC_AUTH,
        },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.text();
    console.log("Mixpanelv event response:", result);

    res.json({ status: "ok", mixpanel: result });
  } catch (error) {
    console.error("Error sending event:", error);
    res.status(500).json({ error: "Failed to send event" });
  }
});



app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Server listening at http://localhost:${PORT}`);
});
