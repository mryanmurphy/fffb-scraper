var util = require('util'),
	events = require('events'),
	config = require('./lib/config'),
	logger = require('./lib/logger'),
	backendEvents = new events.EventEmitter(),
	scraper;

function loadBackend(config, name, jack) {
	var backend = require(name);

	if (config.debug) {
		jack.log('Starting backend: ' + name, 'DEBUG');
	}

	var result = backend.init(config, backendEvents, jack);

	if (!result) {
		jack.log('Failed to start', 'ERROR');
		process.exit(1);
	}
}

function doScraping() {
	scraper.scrape();
}

config.configFile(process.argv[2], function (config) {
	var jack = new logger.Logger(config.log || {});

	if (config.debug) {
		jack.log('Using scraper ' + config.scraper, 'DEBUG'); 
	}
	scraper = require(config.scraper)();
	scraper.init(config, backendEvents, jack);

	for (var j = 0; j < config.backends.length; j++) {
		loadBackend(config, config.backends[j], jack);
	}

	doScraping();
	var timeoutID = setInterval(doScraping, config.frequency);
});	