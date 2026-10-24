// Calendar days as 'YYYY-MM-DD' (see constants/rbacConstants.js).

// Today on the server.
const todayString = () => {
    try {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    } catch (err) {
        throw err;
    }
};

// Whether { startDate, endDate } covers the day (endDate null = no end).
const coversDay = ({ startDate, endDate }, day) => {
    try {
        return startDate <= day && (!endDate || endDate >= day);
    } catch (err) {
        throw err;
    }
};

module.exports = {
    todayString,
    coversDay
};
