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

// date + { amount, unit } (constants/jobOrderConstants.js DURATION_UNITS), as a
// new Date. Days, months and years follow the calendar (31 Jan + 1 month =
// 3 Mar, as JavaScript dates do).
const addDuration = (date, { amount, unit }) => {
    try {
        const due = new Date(date);
        if (unit === 'seconds') due.setSeconds(due.getSeconds() + amount);
        else if (unit === 'minutes') due.setMinutes(due.getMinutes() + amount);
        else if (unit === 'hours') due.setHours(due.getHours() + amount);
        else if (unit === 'days') due.setDate(due.getDate() + amount);
        else if (unit === 'months') due.setMonth(due.getMonth() + amount);
        else if (unit === 'years') due.setFullYear(due.getFullYear() + amount);
        return due;
    } catch (err) {
        throw err;
    }
};

module.exports = {
    todayString,
    coversDay,
    addDuration
};
