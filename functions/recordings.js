exports.handler = function (context, event, callback) {
  const response = new Twilio.Response();
  response.appendHeader('Content-Type', 'application/json');
  response.appendHeader('Access-Control-Allow-Origin', '*');

  const { roomSid } = event;
  if (!roomSid) {
    response.setStatusCode(400);
    response.setBody(({ error: 'roomSid is required' }));
    return callback(null, response);
  }

  const client = context.getTwilioClient();

  client.video.v1.recordings
    .list({ groupingSid: roomSid })
    .then((recordings) => {
      const data = recordings.map((r) => ({
        sid: r.sid,
        status: r.status,
        type: r.type,           // 'audio' | 'video' | 'data'
        containerFormat: r.containerFormat, // 'mka' | 'mkv'
        codec: r.codec,
        duration: r.duration,   // seconds
        size: r.size,           // bytes
        dateCreated: r.dateCreated,
      }));

      response.setStatusCode(200);
      response.setBody((data));
      callback(null, response);
    })
    .catch((err) => {
      response.setStatusCode(500);
      response.setBody(({ error: err.message }));
      callback(null, response);
    });
};
