const casRouter = require("./lib/cas-router.js");
const casHelpers = require("./lib/cas-helper-functions");
const logger = require("./lib/logger");

let devMode = {
  enabled: false,
  user: null,
  info: null
};

/**
 * initialisation functions
 *
 * @return {object} the module itself (for fluid interface syntax like const cas = require('cas-authentication-middleware').init(...))
 */
function init(_options) {
  let options = casHelpers.registerOptions(_options);

  if (options.logger) {
    logger.setLogger(options.logger);
  }

  logger.verbose("dev mode: " + options.devMode);

  if (options.devMode) {
    devMode.enabled = true;
    devMode.user = options.devModeUser;
    devMode.info = options.devModeInfo;
    logger.verbose(
      `dev mode => the user to be used would be: ${devMode.user} (not set yet, this is just an info)`
    );
  }

  casHelpers.init(_options);
  return module.exports;
}

/**
 * CAS handler
 *
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
function casHandler(req, res, next) {
  let options = casHelpers.options;

  if (req.session && req.session[options.sessionName]) {
    logger.verbose(
      `session available (userId: ${
        req.session[options.sessionName]
      }) => no CAS cycle => next()`
    );
    next();
    return;
  }

  // no session user => start CAS cycle?
  // dev mode is handled by the login function

  logger.verbose("starting CAS cycle ...");
  let params = new URLSearchParams();
  params.set("target", getAbsoluteUrl(
    casHelpers.options.backendBaseUrl,
    req
  ));
  res.redirect(casHelpers.getUrlPathToSelf(casHelpers.options.casRouterPrefix, "login") + "?" + params.toString());
}

/**
 * Build an absolute URL pointing to exactly the page which has been requested
 * right now. This is necessary to "park" the URL and later, after CAS login,
 * perform a redirect to it. This enabled us to do "deep linking".
 *
 * Following the discussion on
 * https://stackoverflow.com/questions/10183291/how-to-get-the-full-url-in-express,
 * I decided to use the function like this
 * @param {*} backendBaseUrl backend base URL
 * @param {*} req
 */
function getAbsoluteUrl(backendBaseUrl, req) {
  if (backendBaseUrl) {
    // remove any double / in the url except after the protocol
    return (backendBaseUrl + req.originalUrl).replace(/(?<!:)\/\//g, "/");
  }

  return req.protocol + "://" + req.get("host") + req.originalUrl;
}

/**
 * return user data of the session user.
 *
 * @param req The request object
 * @return {object} the session user object consisting of { userId, userInfo}. userId is the ID of the logged in user,
 *   userInfo is any additional information we got from the CAS server as user attributes. The "userInfo" property can
 *   be null if not set. If no active session is in place, the returned object will contain only the property "userId" with
 *   a value of null.
 */
function getSessionInfo(req) {
  let options = casHelpers.options;

  if (req.session && req.session[options.sessionName]) {
    return {
      userId: req.session[options.sessionName],
      userInfo: req.session[options.sessionInfo]
    };
  } else {
    return {
      userId: null
    };
  }
}

/**
 * make sure there is a user session. If it is not, trigger one (via CAS or in dev mode)
 * This function can be used to be sure that the session is set up before the app launches.
 *
 * Otherwise, you could face the situation that the app loads, retrieves the user name (which
 * might empty at this stage because no login has happened so far) and leaves you with an
 * empty user info object.
 *
 * On the other hand, if you make use of this function, you can be sure that a valid session
 * is set up before the app starts. When fetching the session user would be the first action
 * of the app, it will return the session user correctly now.
 *
 * @param {*} req
 * @param {*} res
 */
function ensureSession(req, res) {
  // the things to be done are exactly the same as the "casHandler" does, with the difference,
  // that this function is intended to be used as an endpoint, not middleware. Thus, it must
  // finish the request (res.end())
  casHandler(req, res, () => res.end());
}

module.exports = {
  init,
  casHandler,
  casRouter,
  getSessionInfo,
  ensureSession,
  block: casHelpers.block
};
