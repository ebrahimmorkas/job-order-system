// Whether the app is open: under maintenance (WebsiteMaster - every vendor;
// CompanyMaster - one vendor), payment not done (CompanyMaster), or the shop
// closed by the owner (CompanySettings). See services/serviceStatusService.js.

// What a blocked person is shown.
const SERVICE_STATES = {
    // Everyone, even the login page.
    MAINTENANCE: 'maintenance',
    // The owner: pay to continue.
    PAYMENT_DUE: 'paymentDue',
    // A user while the payment is not done - never told why.
    UNAVAILABLE: 'unavailable',
    // A user while the owner closed the shop (the owner keeps working).
    SHOP_CLOSED: 'shopClosed'
};
const SERVICE_STATE_VALUES = Object.values(SERVICE_STATES);

// Messages the platform owner (WebsiteMaster / CompanyMaster) or the vendor's
// owner (Company Settings > Shop) writes for the page.
const SERVICE_MESSAGE_MAX_LENGTH = 500;

// How often the server looks for a status the platform owner changed straight
// in the database (no screens) - see services/serviceStatusWatcher.js.
const SERVICE_STATUS_POLL_MS = 15 * 1000;

module.exports = {
    SERVICE_STATES,
    SERVICE_STATE_VALUES,
    SERVICE_MESSAGE_MAX_LENGTH,
    SERVICE_STATUS_POLL_MS
};
