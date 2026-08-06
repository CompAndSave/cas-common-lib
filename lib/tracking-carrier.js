'use strict';

const VALID_TRACKING_CARRIER_LIST = Object.freeze(["ups", "fedex", "usps", "gof"]);
const VALID_TRACKING_CARRIERS = new Set(VALID_TRACKING_CARRIER_LIST);
const CARRIER_DISPLAY_NAMES = Object.freeze({ ups: "UPS", gof: "GOFO", usps: "USPS", fedex: "FedEx" });

const inferCarrierFromTrackingNumber = (trackingNumber)=> {
  const value = String(trackingNumber || "").trim();
  if (/^1Z/i.test(value)) { return "ups"; }
  if (/^GFUS/i.test(value)) { return "gof"; }
  if (/^9[2-5]\d{20,}$/.test(value)) { return "usps"; }
  if (/^(?:\d{12}|\d{15})$/.test(value)) { return "fedex"; }
  return null;
};

const normalizeCarrier = (carrier)=> {
  const normalized = String(carrier || "").trim().toLowerCase();
  return VALID_TRACKING_CARRIERS.has(normalized) ? normalized : null;
};

const carrierDisplayName = (carrier)=> CARRIER_DISPLAY_NAMES[carrier] || null;

module.exports = {
  VALID_TRACKING_CARRIER_LIST,
  VALID_TRACKING_CARRIERS,
  CARRIER_DISPLAY_NAMES,
  inferCarrierFromTrackingNumber,
  normalizeCarrier,
  carrierDisplayName
};
