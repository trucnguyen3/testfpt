const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
const PORT = 3005;
const MIXPANEL_TOKEN = 'd7ecd6759520106d4adbba6c5a3b1d61';

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 1. Receive Adjust install callback
app.post('/appsflyer/install', async (req, res) => {
  try {
    const { uid, campaign, network, tracker_name, tracker_token } = req.body;

    if (!uid) {
      return res.status(400).json({ error: 'Missing uid' });
    }

    // Build Mixpanel "Install" event
    const installEvent = {
      event: 'Install',
      properties: {
        token: MIXPANEL_TOKEN,
        distinct_id: uid,        // Use Adjust uid
        time: Math.floor(Date.now() / 1000),
        source: 'AppsFlyer',
        campaign,
        network,
        tracker_name,
        tracker_token
      }
    };

    // Send to Mixpanel
    const payload = Buffer.from(JSON.stringify([installEvent])).toString('base64');

    await fetch('https://api.mixpanel.com/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${payload}`
    });

    res.sendStatus(200);
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
        alias: customer_id
      }
    };

    const payload = Buffer.from(JSON.stringify([aliasEvent])).toString('base64');

    await fetch('https://api.mixpanel.com/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${payload}`
    });

    res.sendStatus(200);
  } catch (err) {
    console.error('Error aliasing user:', err);
    res.sendStatus(500);
  }
});

app.use(express.static('public'));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Server listening at http://localhost:${PORT}`);
});
