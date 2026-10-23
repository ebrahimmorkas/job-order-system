require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

const CurrencyMaster = require('../models/CurrencyMaster');
const CountryMaster = require('../models/CountryMaster');
const StateMaster = require('../models/StateMaster');
const CityMaster = require('../models/CityMaster');

// The currencies, countries, states and cities the platform supports. Run
// before seedTaxMaster.
//
// Safe to re-run: each row is matched by its code (a city by its state and
// name) and updated in place, so changing a country's tax fields here and
// re-running updates it. Rows added by hand are left alone.

const CURRENCIES = [
    { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimalPlaces: 2 },
    { code: 'AED', name: 'UAE Dirham', symbol: 'AED', decimalPlaces: 2 }
];

const COUNTRIES = [
    {
        code: 'IN',
        name: 'India',
        phoneCode: '+91',
        currencyCode: 'INR',
        taxName: 'GST',
        interStateTaxLabel: 'IGST',
        taxFields: [
            {
                key: 'gstin',
                label: 'GSTIN',
                placeholder: 'e.g. 27ABCDE1234F1Z5',
                isRequired: true,
                maxLength: 15,
                // 2-digit state code + PAN + entity number + Z + check character
                pattern: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$',
                patternMessage: 'Enter a valid 15-character GSTIN, e.g. 27ABCDE1234F1Z5',
                startsWithStateTaxCode: true
            },
            {
                key: 'pan',
                label: 'PAN',
                placeholder: 'e.g. ABCDE1234F',
                isRequired: false,
                maxLength: 10,
                pattern: '^[A-Z]{5}[0-9]{4}[A-Z]$',
                patternMessage: 'Enter a valid 10-character PAN, e.g. ABCDE1234F'
            }
        ],
        postalCode: { label: 'PIN code', isRequired: true, pattern: '^[1-9][0-9]{5}$', patternMessage: 'Enter a 6-digit PIN code' },
        precedence: 1
    },
    {
        code: 'AE',
        name: 'United Arab Emirates',
        phoneCode: '+971',
        currencyCode: 'AED',
        taxName: 'VAT',
        interStateTaxLabel: null,
        taxFields: [
            {
                key: 'trn',
                label: 'TRN',
                placeholder: 'e.g. 100123456700003',
                isRequired: true,
                maxLength: 15,
                pattern: '^[0-9]{15}$',
                patternMessage: 'Enter the 15-digit Tax Registration Number'
            }
        ],
        // The UAE has no postal codes; a P.O. Box is common but optional.
        postalCode: { label: 'P.O. Box', isRequired: false, pattern: '^[0-9]{1,7}$', patternMessage: 'Enter the P.O. Box number (digits only)' },
        precedence: 2
    }
];

// India: every state and union territory, with its GST state code (the first
// two digits of a GSTIN).
const INDIA_STATES = [
    ['JK', 'Jammu and Kashmir', '01'], ['HP', 'Himachal Pradesh', '02'], ['PB', 'Punjab', '03'],
    ['CH', 'Chandigarh', '04'], ['UK', 'Uttarakhand', '05'], ['HR', 'Haryana', '06'],
    ['DL', 'Delhi', '07'], ['RJ', 'Rajasthan', '08'], ['UP', 'Uttar Pradesh', '09'],
    ['BR', 'Bihar', '10'], ['SK', 'Sikkim', '11'], ['AR', 'Arunachal Pradesh', '12'],
    ['NL', 'Nagaland', '13'], ['MN', 'Manipur', '14'], ['MZ', 'Mizoram', '15'],
    ['TR', 'Tripura', '16'], ['ML', 'Meghalaya', '17'], ['AS', 'Assam', '18'],
    ['WB', 'West Bengal', '19'], ['JH', 'Jharkhand', '20'], ['OD', 'Odisha', '21'],
    ['CG', 'Chhattisgarh', '22'], ['MP', 'Madhya Pradesh', '23'], ['GJ', 'Gujarat', '24'],
    ['DH', 'Dadra and Nagar Haveli and Daman and Diu', '26'], ['MH', 'Maharashtra', '27'],
    ['KA', 'Karnataka', '29'], ['GA', 'Goa', '30'], ['LD', 'Lakshadweep', '31'],
    ['KL', 'Kerala', '32'], ['TN', 'Tamil Nadu', '33'], ['PY', 'Puducherry', '34'],
    ['AN', 'Andaman and Nicobar Islands', '35'], ['TS', 'Telangana', '36'],
    ['AP', 'Andhra Pradesh', '37'], ['LA', 'Ladakh', '38']
];

// UAE: the seven emirates (no tax code).
const UAE_STATES = [
    ['AZ', 'Abu Dhabi'], ['DU', 'Dubai'], ['SH', 'Sharjah'], ['AJ', 'Ajman'],
    ['UQ', 'Umm Al Quwain'], ['RK', 'Ras Al Khaimah'], ['FU', 'Fujairah']
];

const STATES = {
    IN: INDIA_STATES.map(([code, name, taxCode]) => ({ code, name, taxCode })),
    AE: UAE_STATES.map(([code, name]) => ({ code, name, taxCode: null }))
};

// [country code, state code, city name]
const CITIES = [
    ['IN', 'MH', 'Mumbai'],
    ['AE', 'AZ', 'Abu Dhabi'], ['AE', 'DU', 'Dubai'], ['AE', 'SH', 'Sharjah'], ['AE', 'AJ', 'Ajman'],
    ['AE', 'UQ', 'Umm Al Quwain'], ['AE', 'RK', 'Ras Al Khaimah'], ['AE', 'FU', 'Fujairah']
];

const UPSERT = { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true, runValidators: true };

async function seedLocationMasters() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const currencyIds = {};
        for (const currency of CURRENCIES) {
            const doc = await CurrencyMaster.findOneAndUpdate({ code: currency.code }, { $set: currency }, UPSERT);
            currencyIds[currency.code] = doc._id;
        }

        const countryIds = {};
        for (const { currencyCode, ...country } of COUNTRIES) {
            const doc = await CountryMaster.findOneAndUpdate(
                { code: country.code },
                { $set: { ...country, currencyId: currencyIds[currencyCode] } },
                UPSERT
            );
            countryIds[country.code] = doc._id;
        }

        const stateIds = {};
        for (const [countryCode, states] of Object.entries(STATES)) {
            for (const state of states) {
                const countryId = countryIds[countryCode];
                const doc = await StateMaster.findOneAndUpdate({ countryId, code: state.code }, { $set: { ...state, countryId } }, UPSERT);
                stateIds[`${countryCode}-${state.code}`] = doc._id;
            }
        }

        for (const [countryCode, stateCode, name] of CITIES) {
            const stateId = stateIds[`${countryCode}-${stateCode}`];
            await CityMaster.findOneAndUpdate({ stateId, name }, { $set: { stateId, countryId: countryIds[countryCode], name } }, UPSERT);
        }

        process.stdout.write(`Location masters: ${CURRENCIES.length} currencies, ${COUNTRIES.length} countries, ${Object.keys(stateIds).length} states, ${CITIES.length} cities.\n`);
        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        process.stderr.write(`seedLocationMasters failed: ${error.message}\n`);
        await mongoose.connection.close();
        process.exit(1);
    }
}

seedLocationMasters();
