// Fetches the Twilio recording media URL and returns a redirect to the S3
// pre-signed URL, so the browser can download the file directly without
// exposing credentials to the client.
const https = require('https');

exports.handler = function (context, event, callback) {
  const { sid } = event;

  if (!sid) {
    const response = new Twilio.Response();
    response.setStatusCode(400);
    response.appendHeader('Content-Type', 'application/json');
    response.setBody(({ error: 'sid is required' }));
    return callback(null, response);
  }

  const auth = Buffer.from(
    `${context.ACCOUNT_SID}:${context.AUTH_TOKEN}`
  ).toString('base64');

  const mediaUrl = `https://video.twilio.com/v1/Recordings/${sid}/Media`;

  const req = https.get(
    mediaUrl,
    { headers: { Authorization: `Basic ${auth}` } },
    (res) => {
      // Twilio responds with a 302 redirect to a pre-signed S3 URL.
      // Pass that URL directly to the browser — S3 auth is embedded in
      // the query string so no credentials are leaked.
      if (res.statusCode === 301 || res.statusCode === 302) {
        const response = new Twilio.Response();
        response.setStatusCode(302);
        response.appendHeader('Location', res.headers.location);
        res.resume(); // drain the socket
        return callback(null, response);
      }

      const response = new Twilio.Response();
      response.setStatusCode(res.statusCode || 500);
      response.appendHeader('Content-Type', 'application/json');
      response.setBody(
        ({ error: `Unexpected Twilio status: ${res.statusCode}` })
      );
      res.resume();
      callback(null, response);
    }
  );

  req.on('error', (err) => {
    const response = new Twilio.Response();
    response.setStatusCode(500);
    response.appendHeader('Content-Type', 'application/json');
    response.setBody(({ error: err.message }));
    callback(null, response);
  });
};
