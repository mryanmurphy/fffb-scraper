/*
 Copyright (c) 2010-2016 Etsy

 Permission is hereby granted, free of charge, to any person
 obtaining a copy of this software and associated documentation
 files (the "Software"), to deal in the Software without
 restriction, including without limitation the rights to use,
 copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the
 Software is furnished to do so, subject to the following
 conditions:

 The above copyright notice and this permission notice shall be
 included in all copies or substantial portions of the Software.
*/


/*jshint node:true, laxcomma:true */

var Logger = function(config) {
	this.config = config;
	this.backend = this.config.backend || 'stdout';
	this.level = this.config.level || "LOG_INFO";
	if (this.backend == 'stdout') {
		this.util = require('util');
	} else {
		if (this.backend == 'syslog') {
			this.util = require('modern-syslog');
			this.util.init(config.application || 'fffb_scraper', this.util.LOG_PID | this.util.LOG_ODELAY, this.util.LOG_LOCAL0);
		} else {
			throw "Logger: Should be 'stdout' or 'syslog'.";
		}
	}
};

Logger.prototype = {
	log: function(msg, type) {
		if (/^err/i.test(type)) {
			msg += '\n' + (new Error().stack);
		}

		if (this.backend == 'stdout') {
			if (!type) {
				type = 'DEBUG';
			}
			this.util.log(type + ": " + msg);
		} else {
			var level;
			if (!type) {
				level = this.level;
			} else {
				level = "LOG_" + type.toUpperCase();
			}

			if (!this.util[level]) {
				throw "Undefined log level: " + level;
			}

			this.util.log(this.util[level], msg);
		}
	}
};

exports.Logger = Logger;