# Tekion TechCam

A mobile-optimized video recording app built on **Twilio Serverless Functions**. Users can start a recorded video session, which is automatically composed into a single MP4 and uploaded to Firebase Storage. Recordings from the last 24 hours are listed in the UI with options to view or send via SMS.

---

## Features

- **Live video recording** via Twilio Video (group rooms with server-side recording)
- **Automatic MP4 composition** — Twilio combines audio and video tracks into a single `.mp4` file
- **Firebase Storage upload** — completed recordings are streamed directly to Firebase
- **24-hour recording list** — paginated (10 per page), sorted newest first, showing display name, room, and timestamp
- **In-browser video playback** — modal viewer for any recording
- **SMS sharing** — send a recording link to any phone number via Twilio Programmable Messaging
- **Front/back camera toggle** — cycles through available cameras with a throb animation indicator
- **Tekion-branded UI** — dark theme using Tekion brand colors (`#00C3B4` teal)
- **Fully mobile-optimized** — responsive layout, 48px tap targets, no horizontal overflow

---

## Tech Stack

| Layer | Technology |
|---|---|
| Hosting & backend | Twilio Serverless Functions |
| Video & recording | Twilio Video JS SDK + Compositions API |
| SMS | Twilio Programmable Messaging |
| Storage | Firebase Storage (REST API, no SDK) |
| Frontend | Vanilla HTML / CSS / JS (no framework) |

---

## Project Structure

```
├── functions/               # Twilio Serverless backend handlers
│   ├── token.js             # Creates a group room + returns a Video access token
│   ├── stop.js              # Completes the Twilio room
│   ├── compose.js           # Creates an MP4 composition from room recordings
│   ├── composition-status.js# Polls composition processing status
│   ├── upload-composition.js# Streams the MP4 from Twilio → Firebase Storage
│   ├── config.js            # Returns public Firebase config to the frontend
│   ├── send-sms.js          # Sends a recording link via SMS
│   ├── recordings.js        # Lists raw Twilio recordings for a room
│   └── recording-media.js   # Proxies recording media download
│
├── assets/                  # Static frontend files (served by Twilio)
│   ├── index.html
│   ├── app.js
│   └── styles.css
│
├── .env.example             # Required environment variables (copy to .env)
├── .twilioserverlessrc      # Twilio Serverless service name config
└── package.json
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Twilio CLI](https://www.twilio.com/docs/twilio-cli/quickstart) with the Serverless plugin
- A Twilio account with:
  - An API Key + Secret (console.twilio.com → API Keys & Tokens)
  - A phone number enabled for SMS (console.twilio.com → Phone Numbers)
- A Firebase project with Storage enabled (console.firebase.google.com)

### Install Twilio CLI and Serverless plugin

```bash
npm install -g twilio-cli
twilio plugins:install @twilio-labs/plugin-serverless
```

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/mark0106/tekionvideo.git
cd tekionvideo
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

```env
# Twilio API credentials (console.twilio.com → API Keys & Tokens)
TWILIO_API_KEY=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_SECRET=your_api_secret_here

# Firebase — Firebase Console → Project Settings → General
# Storage bucket: copy the gs:// URL without "gs://"
FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
# Web API Key: found under "Your apps" (starts with AIzaSy...)
FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Twilio phone number for outbound SMS (console.twilio.com → Phone Numbers)
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
```

### 3. Configure Firebase Storage rules

In the Firebase Console go to **Storage → Rules** and set:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

### 4. Create a Twilio CLI profile

```bash
twilio profiles:create
```

Follow the prompts and enter your Account SID, API Key, and API Secret.

---

## Running Locally

```bash
twilio serverless:start
```

The app will be available at `http://localhost:3000`.

---

## Deploying to Twilio Serverless

```bash
twilio serverless:deploy
```

On first deploy this creates a new Serverless Service. Subsequent deploys update it in place. The CLI will output the live URL, for example:

```
✔ Serverless project successfully deployed

functions
  public /token              https://your-service-dev.twil.io/token
  public /compose            https://your-service-dev.twil.io/compose
  ...

assets
  public /index.html         https://your-service-dev.twil.io/index.html
```

Open the `/index.html` URL in a browser to use the app.

### Making the service editable in the Twilio Console

```bash
twilio api:serverless:v1:services:update \
  --sid <your-service-sid> \
  --ui-editable
```

---

## How It Works

1. **Start** — user enters a display name and room name, clicks Start Video
2. **Record** — a Twilio group room is created with `recordParticipantsOnConnect: true`; all tracks are recorded server-side
3. **Stop** — the room is completed and a Twilio Composition is requested to merge tracks into a single MP4
4. **Upload** — once the composition finishes processing, the MP4 is streamed directly from Twilio → Firebase Storage (no buffering)
5. **View** — the recordings panel lists all uploads from the last 24 hours; click **View** to watch in-browser
6. **Share** — click **SMS** on any recording to send the Firebase download link to a phone number
