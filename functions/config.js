// Returns public client configuration — only non-secret values.
exports.handler = function (context, event, callback) {
  const response = new Twilio.Response();
  response.appendHeader('Content-Type', 'application/json');
  response.appendHeader('Access-Control-Allow-Origin', '*');
  response.setStatusCode(200);
  response.setBody({
    storageBucket: context.FIREBASE_STORAGE_BUCKET,
    apiKey: context.FIREBASE_API_KEY,
  });
  callback(null, response);
};
