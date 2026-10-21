const fs = require('fs');
const path = require('path');

// Loads every model file in this folder, so mongoose knows all of them (for
// checkModelsAudited) even before a route has required them.
const loadAllModels = () => {
    for (const file of fs.readdirSync(__dirname)) {
        if (file.endsWith('.js') && file !== 'index.js') {
            require(path.join(__dirname, file));
        }
    }
};

module.exports = { loadAllModels };
