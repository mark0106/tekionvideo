// Creates a Twilio Video Composition (single MP4) from all tracks in a room.
exports.handler = async function (context, event, callback) {
  const response = new Twilio.Response();
  response.appendHeader('Content-Type', 'application/json');
  response.appendHeader('Access-Control-Allow-Origin', '*');

  const { roomSid } = event;
  if (!roomSid) {
    response.setStatusCode(400);
    response.setBody({ error: 'roomSid is required' });
    return callback(null, response);
  }

  try {
    const client = context.getTwilioClient();
    const composition = await client.video.v1.compositions.create({
      roomSid,
      audioSources: '*',
      videoLayout: {
        grid: { video_sources: ['*'] },
      },
      format: 'mp4',
      resolution: '1280x720',
    });

    response.setStatusCode(200);
    response.setBody({ compositionSid: composition.sid, status: composition.status });
    callback(null, response);
  } catch (err) {
    response.setStatusCode(500);
    response.setBody({ error: err.message });
    callback(null, response);
  }
};
