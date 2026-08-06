'use strict';

const algo = require('./lib/algo.js');
const caxios = require('./lib/cas-axios.js');
const expressHelper = require('./lib/express-helper.js');
const jwt = require('./lib/jwt.js');
const timer = require('./lib/timer.js');
const Log = require('./lib/log.js');
const Logger = require('./lib/logger.js');
const TableBase = require('./lib/table.js');
const SecretsLoader = require('./lib/secrets-loader.js');
const {
    VALID_TRACKING_CARRIER_LIST,
    VALID_TRACKING_CARRIERS,
    CARRIER_DISPLAY_NAMES,
    inferCarrierFromTrackingNumber,
    normalizeCarrier,
    carrierDisplayName
} = require('./lib/tracking-carrier.js');

module.exports = {
    algo,
    caxios,
    expressHelper,
    jwt,
    timer,
    Log,
    Logger,
    TableBase,
    SecretsLoader,
    VALID_TRACKING_CARRIER_LIST,
    VALID_TRACKING_CARRIERS,
    CARRIER_DISPLAY_NAMES,
    inferCarrierFromTrackingNumber,
    normalizeCarrier,
    carrierDisplayName
};
