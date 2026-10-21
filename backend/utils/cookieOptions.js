const isProduction = process.env.NODE_ENV === 'production';

// In development the frontend (Vite, :5173) proxies /api to the backend (:5000)
// - see frontend/vite.config.js - so the browser sees the API as same-origin
// and a sameSite 'lax' cookie over plain http works. In production the cookie
// must be secure + sameSite 'none' (HTTPS only).

// Only the refresh token is a cookie. The access token is sent back in the
// response body and kept in the frontend's memory (see frontend/src/utils/apiClient.js).
const refreshTokenCookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/api/auth' // only sent to auth routes, reduces exposure
};

module.exports = {
    refreshTokenCookieOptions
};
