// Streams a completed Twilio Video Composition (MP4) to Firebase Storage.
const https = require('https');

exports.handler = function (context, event, callback) {
  const response = new Twilio.Response();
  response.appendHeader('Content-Type', 'application/json');
  response.appendHeader('Access-Control-Allow-Origin', '*');

  const { compositionSid, identity, roomName } = event;
  if (!compositionSid) {
    response.setStatusCode(400);
    response.setBody({ error: 'compositionSid is required' });
    return callback(null, response);
  }

  const sanitize = (s) =>
    (s || 'unknown').trim().replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '-').toLowerCase().slice(0, 40) || 'unknown';

  const ts = Date.now();
  const safeIdentity = sanitize(identity);
  const safeRoom = sanitize(roomName);
  const filename = `recordings/${ts}_${safeIdentity}_${safeRoom}_${compositionSid}.mp4`;
  const bucket = context.FIREBASE_STORAGE_BUCKET;

  const auth = Buffer.from(
    `${context.TWILIO_API_KEY}:${context.TWILIO_API_SECRET}`
  ).toString('base64');

  // Step 1 — request Twilio composition media; expect 302 → S3
  https.get(
    `https://video.twilio.com/v1/Compositions/${compositionSid}/Media`,
    { headers: { Authorization: `Basic ${auth}` } },
    (twilioRes) => {
      if (twilioRes.statusCode !== 301 && twilioRes.statusCode !== 302) {
        twilioRes.resume();
        response.setStatusCode(502);
        response.setBody({ error: `Twilio responded with ${twilioRes.statusCode}` });
        return callback(null, response);
      }

      const s3Url = twilioRes.headers.location;
      twilioRes.resume();

      // Step 2 — stream from S3
      https.get(s3Url, (s3Res) => {
        if (s3Res.statusCode !== 200) {
          s3Res.resume();
          response.setStatusCode(502);
          response.setBody({ error: `S3 responded with ${s3Res.statusCode}` });
          return callback(null, response);
        }

        // Step 3 — pipe S3 stream → Firebase Storage REST upload
        const uploadUrl =
          `https://firebasestorage.googleapis.com/v0/b/${bucket}/o` +
          `?uploadType=media&name=${encodeURIComponent(filename)}` +
          `&key=${context.FIREBASE_API_KEY}`;

        const uploadReq = https.request(
          uploadUrl,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'video/mp4',
              ...(s3Res.headers['content-length']
                ? { 'Content-Length': s3Res.headers['content-length'] }
                : {}),
            },
          },
          (uploadRes) => {
            let body = '';
            uploadRes.on('data', (chunk) => (body += chunk));
            uploadRes.on('end', () => {
              if (uploadRes.statusCode !== 200) {
                response.setStatusCode(502);
                response.setBody({
                  error: `Firebase upload failed (${uploadRes.statusCode}): ${body}`,
                });
                return callback(null, response);
              }

              const publicUrl =
                `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/` +
                `${encodeURIComponent(filename)}?alt=media`;

              response.setStatusCode(200);
              response.setBody({ url: publicUrl, filename });
              callback(null, response);
            });
          }
        );

        uploadReq.on('error', (err) => {
          response.setStatusCode(500);
          response.setBody({ error: 'Firebase upload error: ' + err.message });
          callback(null, response);
        });

        s3Res.pipe(uploadReq);
      }).on('error', (err) => {
        response.setStatusCode(500);
        response.setBody({ error: 'S3 download error: ' + err.message });
        callback(null, response);
      });
    }
  ).on('error', (err) => {
    response.setStatusCode(500);
    response.setBody({ error: 'Twilio request error: ' + err.message });
    callback(null, response);
  });
};
