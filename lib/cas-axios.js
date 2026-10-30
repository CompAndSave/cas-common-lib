'use strict';

const axios = require('axios').default;
const jwt = require('jsonwebtoken');

// Use JWT The Right Way! - https://stormpath.com/blog/jwt-the-right-way
// JWT is a signing algorithm instead of encrpytion. Use it together with HTTPS for sensitive data!
// Where to Store your JWTs – Cookies vs HTML5 Web Storage - https://stormpath.com/blog/where-to-store-your-jwts-cookies-vs-html5-web-storage
// JWT should be stored in cookie with HttpOnly flag. And add Secure cookie flag at production so cookie will only be sent over HTTPS - It will avoid the XSS attack
// To avoid CSRF attack when using jwt with cookie. 
//   Ref: https://medium.com/@d.silvas/how-to-implement-csrf-protection-on-a-jwt-based-app-node-csurf-angular-bb90af2a9efd
//        https://github.com/expressjs/csurf
//        https://github.com/pillarjs/understanding-csrf
//   - User only JSON APIs
//   - Disable CORS
//   - Avoid using POST
//   - If we need to use POST and enable CORS, we may need to use CSRF tokens and csurf library to migitate the CSRF attack

/**
 * Make api call using JWT, api key is inside the reqJSON
 * 
 * @param {string} type Api call type, e.g., get, post and etc
 * @param {string} apiURL Api URL
 * @param {string} secretKey Secret key to sign the JWT
 * @param {object} reqJSON Request object with API key
 * @param {object} [headers] Request header
 * @param {string} [expiresIn=5m] Expiration on JWT
 * @param {number} [timeout] Axios request timeout in milliseconds; omitted preserves its default
 * @returns {promise} Promise with the response object
 */
const callAPI = async (type, apiURL, secretKey, reqJSON, headers, expiresIn = "5m", timeout)=> {
  const apiKey = reqJSON.api_key;
  delete reqJSON.api_key;
  let response;

  // Signing a token with 5 min of expiration
  let token = jwt.sign({
    data: reqJSON
  }, secretKey, { expiresIn: expiresIn });

  response = await axios({
    method: type.toLowerCase(),
    url: apiURL,
    headers: headers,
    data: {
      api_key:apiKey,
      data:token
    },
    ...(typeof timeout === "undefined" ? {} : { timeout })
  });
  
  // Decode the token
  let decoded = jwt.verify(response.data, secretKey);
  response.data = decoded.data;

  return Promise.resolve(response);
}

/**
 * Make api call
 * 
 * @param {string} type Api call type, e.g., get, post and etc
 * @param {string} apiURL Api URL
 * @param {object} reqJSON Request object
 * @param {object} [headers] Request header
 * @param {number} [timeout] Axios request timeout in milliseconds; omitted preserves its default
 * @returns {promise} Promise with the response object
 */
const callAPIWithoutJWT = async (type, apiURL, reqJSON, headers, timeout)=>{
  let response = await axios({
    method: type.toLowerCase(),
    url: apiURL,
    data: reqJSON,
    headers: headers,
    ...(typeof timeout === "undefined" ? {} : { timeout })
  });

  return Promise.resolve(response.data);
}

module.exports = {
  callAPI,
  callAPIWithoutJWT
};
