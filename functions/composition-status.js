// Returns status of a single Twilio Video Composition.
exports.handler = async function (context, event, callback) {
  const response = new Twilio.Response();
  response.appendHeader('Content-Type', 'application/json');
  response.appendHeader('Access-Control-Allow-Origin', '*');

  const { compositionSid } = event;
  if (!compositionSid) {
    response.setStatusCode(400);
    response.setBody({ error: 'compositionSid is required' });
    return callback(null, response);
  }

  try {
    const client = context.getTwilioClient();
    const comp = await client.video.v1.compositions(compositionSid).fetch();

    response.setStatusCode(200);
    response.setBody({
      sid: comp.sid,
      status: comp.status,
      duration: comp.duration,
      size: comp.size,
    });
    callback(null, response);
  } catch (err) {
    response.setStatusCode(500);
    response.setBody({ error: err.message });
    callback(null, response);
  }
};
