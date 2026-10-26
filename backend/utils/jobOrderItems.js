// The items of a job order (models/JobOrder.js items): what one is called
// and every master picked on them, for the services that read the work.

// What an item is called on screen and in notifications: "Item 2 · Square
// glass" (or "Item 2") when the job order has several items, else its job
// name (null without one).
const itemLabelOf = (item, index, count) => {
    try {
        if (count > 1) return `Item ${index + 1}${item.name ? ` · ${item.name}` : ''}`;
        return item.name || null;
    } catch (err) {
        throw err;
    }
};

// Every master picked on every item, with its item: [{ itemId, itemLabel, master }].
const mastersOfItems = (items = []) => {
    try {
        return items.flatMap((item, index) => (item.masters || []).map((master) => ({
            itemId: item._id,
            itemLabel: itemLabelOf(item, index, items.length),
            master
        })));
    } catch (err) {
        throw err;
    }
};

// "Round cutting (Item 2 · Square glass)": a value with its item, when there is one to name.
const withItemLabel = (text, itemLabel) => {
    try {
        return itemLabel ? `${text} (${itemLabel})` : text;
    } catch (err) {
        throw err;
    }
};

// Whether a control is asked on an item (Control.showWhen): always without a
// tag, or when its master isn't offered on the form (offeredMasterIds);
// else when a value of that master is picked on the item (any value, or one
// of the tagged ones). picked: masterId -> the value ids picked.
const isControlShown = (control, offeredMasterIds, picked) => {
    try {
        const tag = control.showWhen;
        if (!tag) return true;
        const masterId = String(tag.masterId);
        if (!offeredMasterIds.has(masterId)) return true;
        const values = (picked.get(masterId) || []).map(String);
        if (tag.valueIds.length === 0) return values.length > 0;
        const tagged = new Set(tag.valueIds.map(String));
        return values.some((valueId) => tagged.has(valueId));
    } catch (err) {
        throw err;
    }
};

module.exports = {
    isControlShown,
    itemLabelOf,
    mastersOfItems,
    withItemLabel
};
