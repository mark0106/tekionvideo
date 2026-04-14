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

  client.video.v1
    .rooms(roomSid)
    .update({ status: 'completed' })
    .then(() => {
      response.setStatusCode(200);
      response.setBody(({ message: 'Room completed' }));
      callback(null, response);
    })
    .catch((err) => {
      response.setStatusCode(500);
      response.setBody(({ error: err.message }));
      callback(null, response);
    });
};
