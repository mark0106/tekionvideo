// Sends a recording link via SMS using Twilio Programmable Messaging.
exports.handler = async function (context, event, callback) {
  const response = new Twilio.Response();
  response.appendHeader('Content-Type', 'application/json');
  response.appendHeader('Access-Control-Allow-Origin', '*');

  const { to, recordingUrl, recordingName } = event;

  if (!to || !recordingUrl) {
    response.setStatusCode(400);
    response.setBody({ error: 'to and recordingUrl are required' });
    return callback(null, response);
  }

  if (!context.TWILIO_PHONE_NUMBER) {
    response.setStatusCode(500);
    response.setBody({ error: 'TWILIO_PHONE_NUMBER is not configured' });
    return callback(null, response);
  }

  try {
    const client = context.getTwilioClient();
    const name = recordingName || 'your recording';
    const message = await client.messages.create({
      to,
      from: context.TWILIO_PHONE_NUMBER,
      body: `Your Tekion TechCam recording for ${name} is ready to view:\n\n${recordingUrl}`,
    });

    response.setStatusCode(200);
    response.setBody({ messageSid: message.sid });
    callback(null, response);
  } catch (err) {
    response.setStatusCode(500);
    response.setBody({ error: err.message });
    callback(null, response);
  }
};
