exports.handler = function (context, event, callback) {
  const response = new Twilio.Response();
  response.appendHeader('Content-Type', 'application/json');
  response.appendHeader('Access-Control-Allow-Origin', '*');

  const { identity, roomName } = event;
  if (!identity || !roomName) {
    response.setStatusCode(400);
    response.setBody({ error: 'identity and roomName are required' });
    return callback(null, response);
  }

  const client = context.getTwilioClient();
  const AccessToken = Twilio.jwt.AccessToken;
  const VideoGrant = AccessToken.VideoGrant;

  // group rooms are required for server-side recording
  client.video.v1.rooms
    .create({
      uniqueName: roomName,
      type: 'group',
      recordParticipantsOnConnect: true,
    })
    .catch((err) => {
      // 53113 = room with this unique name already exists — fetch and reuse it
      if (err.code === 53113) {
        return client.video.v1.rooms(roomName).fetch();
      }
      throw err;
    })
    .then((room) => {
      const token = new AccessToken(
        context.ACCOUNT_SID,
        context.TWILIO_API_KEY,
        context.TWILIO_API_SECRET,
        { identity }
      );
      token.addGrant(new VideoGrant({ room: roomName }));

      response.setStatusCode(200);
      response.setBody({ token: token.toJwt(), roomSid: room.sid });
      callback(null, response);
    })
    .catch((err) => {
      response.setStatusCode(500);
      response.setBody({ error: err.message });
      callback(null, response);
    });
};
