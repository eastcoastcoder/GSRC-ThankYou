/*
 * Facebook OAuth 2.0 guides:
 * https://developers.facebook.com/docs/facebook-login/manually-build-a-login-flow
 * https://developers.facebook.com/apps/
 */

/**
 * Authorizes and makes a request to the Facebook API.
 */
function getPageAccessToken() {
  const service = getService_();
  if (service.hasAccess()) {
    const USER_ACCESS_TOKEN = service.getAccessToken();
    const pagesResponse = UrlFetchApp.fetch(`https://graph.facebook.com/${USER_ID}/accounts?access_token=${USER_ACCESS_TOKEN}`, {
      headers: {
        'Authorization': 'Bearer ' + USER_ACCESS_TOKEN
      },
    });
    const pagesResult = JSON.parse(pagesResponse.getContentText());
    // Logger.log(JSON.stringify(pagesResult, null, 2));

    const PAGE_ACCESS_TOKEN = pagesResult.data[0]["access_token"];
    Logger.log('Acquired token')
    Logger.log(PAGE_ACCESS_TOKEN)
    return PAGE_ACCESS_TOKEN;
  } else {
    const authorizationUrl = service.getAuthorizationUrl();
    Logger.log('Open the following URL and re-run the script: %s', authorizationUrl);
    sendErrorEmail();
  }
}

/*
const isDevPayload = {
  "published" : "false",
  "unpublished_content_type": "DRAFT",
}
*/

function postToFacebook(pageAccessToken, messageText = "This is a test") {
  const response = UrlFetchApp.fetch(`https://graph.facebook.com/v18.0/${PAGE_ID}/feed`, {
    "method"  : "post",
    headers: {
      'Authorization': 'Bearer ' + pageAccessToken,
    },
    "payload" : {
      "message" : messageText,
    }
  });
  const result = JSON.parse(response.getContentText());
  Logger.log(JSON.stringify(result, null, 2));
}

/**
 * Reset the authorization state, so that it can be re-tested.
 */
function reset() {
  getService_().reset();
}

/**
 * Configures the service.
 */
function getService_() {
  return OAuth2.createService('Facebook')
      // Set the endpoint URLs.
      .setAuthorizationBaseUrl('https://www.facebook.com/dialog/oauth')
      .setTokenUrl('https://graph.facebook.com/v18.0/oauth/access_token')

      // Set the client ID and secret.
      .setClientId(CLIENT_ID)
      .setClientSecret(CLIENT_SECRET)

      // Set the name of the callback function that should be invoked to
      // complete the OAuth flow.
      .setCallbackFunction('usercallback')

      // Set the property store where authorized tokens should be persisted.
      .setPropertyStore(PropertiesService.getUserProperties());
}

/**
 * Handles the OAuth callback.
 */
function usercallback(request) {
  var service = getService_();
  var authorized = service.handleCallback(request);
  if (authorized) {
    return HtmlService.createHtmlOutput('Success!');
  } else {
    return HtmlService.createHtmlOutput('Denied.');
  }
}

/**
 * Logs the redict URI to register.
 */
function logRedirectUri() {
  Logger.log(OAuth2.getRedirectUri());
}