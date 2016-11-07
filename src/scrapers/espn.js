module.exports = function() {

	var jack,
		emitter;

	return {
		init: function(config, events, logger) {
			jack = logger;
			emitter = events;
		},
		scrape: function() {
			jack.log('called scrape', 'DEBUG');
			emitter.emit('flush', 'box', 'this is a test');
		}
	};
};