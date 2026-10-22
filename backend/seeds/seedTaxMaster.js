require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');

const TaxMaster = require('../models/TaxMaster');
const CountryMaster = require('../models/CountryMaster');

// The tax rates of each country. Run after seedLocationMasters.
//
// Insert-only: a rate whose code already exists is skipped, never updated -
// job orders keep the rate they were charged, so a changed rate must close
// the old row (applicableTo) and get a new code here (see models/TaxMaster.js).
//
// precedence is the order in the dropdown; isDefault is picked in advance for
// a vendor who hasn't chosen their own default rate.

// India - GST since 22 Sep 2025 (GST 2.0): 5% and 18% standard slabs, 40%
// for luxury / sin goods, plus the special rates for precious metals and
// stones. Components hold the split within one state (CGST + SGST); between
// two states it is IGST at the same total - decided on the invoice, not here.
const GST_FROM = '2025-09-22';
const gstComponents = (rate) => (rate > 0 ? [{ label: 'CGST', rate: rate / 2 }, { label: 'SGST', rate: rate / 2 }] : []);
const INDIA_TAXES = [
    { code: 'IN_GST_18', name: 'GST 18%', totalRate: 18, isDefault: true },
    { code: 'IN_GST_5', name: 'GST 5%', totalRate: 5 },
    { code: 'IN_GST_40', name: 'GST 40%', totalRate: 40 },
    { code: 'IN_GST_3', name: 'GST 3%', totalRate: 3 },
    { code: 'IN_GST_1_5', name: 'GST 1.5%', totalRate: 1.5 },
    { code: 'IN_GST_0_25', name: 'GST 0.25%', totalRate: 0.25 },
    { code: 'IN_GST_0', name: 'GST 0% (Nil rated)', totalRate: 0 },
    { code: 'IN_GST_EXEMPT', name: 'GST Exempt', totalRate: 0 }
].map((tax) => ({ ...tax, components: gstComponents(tax.totalRate), applicableFrom: GST_FROM }));

// UAE - VAT since 1 Jan 2018. (Excise tax is paid by the producer / importer
// and is already inside the price, so it is not charged on a job order.)
const UAE_TAXES = [
    { code: 'AE_VAT_5', name: 'VAT 5%', totalRate: 5, isDefault: true },
    { code: 'AE_VAT_0', name: 'VAT 0% (Zero rated)', totalRate: 0 },
    { code: 'AE_VAT_EXEMPT', name: 'VAT Exempt', totalRate: 0 }
].map((tax) => ({ ...tax, components: [], applicableFrom: '2018-01-01' }));

const TAXES = { IN: INDIA_TAXES, AE: UAE_TAXES };

async function seedTaxMaster() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        let added = 0;
        for (const [countryCode, taxes] of Object.entries(TAXES)) {
            const country = await CountryMaster.findOne({ code: countryCode }).select('_id').lean();
            if (!country) throw new Error(`Country ${countryCode} not found. Please run seedLocationMasters first.`);

            for (const [index, tax] of taxes.entries()) {
                if (await TaxMaster.exists({ code: tax.code })) continue;
                await TaxMaster.create({
                    ...tax,
                    countryId: country._id,
                    applicableFrom: new Date(`${tax.applicableFrom}T00:00:00.000Z`),
                    isDefault: tax.isDefault === true,
                    precedence: index + 1
                });
                added += 1;
            }
        }

        process.stdout.write(`Tax rates: ${added} added.\n`);
        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        process.stderr.write(`seedTaxMaster failed: ${error.message}\n`);
        await mongoose.connection.close();
        process.exit(1);
    }
}

seedTaxMaster();
