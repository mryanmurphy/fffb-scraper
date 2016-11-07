
function ConsoleBackend(config, emitter) {
	var self = this;
	this.config = config || {};

	emitter.on('flush', function (type, data) {
		self.flush(type, data);
	});
}

ConsoleBackend.prototype.flush = function (type, data) {
	console.log('Received data of type ', type, ' at ', (new Date()));
	console.log(data);
};

exports.init = function (config, emitter) {
	var instance = new ConsoleBackend(config, emitter);
	return true;
};
