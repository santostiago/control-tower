require('app-module-path').addPath(__dirname);
const debug = require('debug')('statistics-plugin');
const mongoose = require('mongoose');
const StatisticService = require('plugins/sd-ct-statistics-plugin/services/statistic.service');
const statisticRouter = require('plugins/sd-ct-statistics-plugin/statistic.router');

function init() {

}

function middleware(app, plugin, generalConfig) {
    const connection = mongoose.createConnection(`${generalConfig.mongoUri}`);
    debug('Loading statistics-plugin');
    app.use(StatisticService.middleware);
    app.use(statisticRouter(connection).middleware());
}


module.exports = {
    middleware,
    init,
};
