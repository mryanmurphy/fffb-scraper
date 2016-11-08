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

/*jshint node:true */

const fs = require('fs');
const util = require('util');
const EventEmitter = require('events');
const StringDecoder = require('string_decoder').StringDecoder;

class Configurator extends EventEmitter {
    constructor(configFile) {
        super();

        this.file = configFile;
        this.self = this;
        this.config = {};
        this.oldConfig = {};

        this.updateConfig();

        fs.watch(this.file, function (event, filename) {
            if (event == 'change' && this.config.automaticConfigReload != false) {
                this.updateConfig();
            }
        });
    }

    removeComments(str) {
        str = ('__' + str + '__').split('');
        var mode = {
            singleQuote: false,
            doubleQuote: false,
            regex: false,
            blockComment: false,
            lineComment: false,
            condComp: false
        };

        for (var i = 0, l = str.length; i < l; i++) {
            if (mode.regex) {
                if (str[i] === '/' && str[i - 1] !== '\\') {
                    mode.regex = false;
                }
                continue;
            }

            if (mode.singleQuote) {
                if (str[i] === "'" && str[i - 1] !== '\\') {
                    mode.singleQuote = false;
                }
                continue;
            }

            if (mode.doubleQuote) {
                if (str[i] === '"' && str[i - 1] !== '\\') {
                    mode.doubleQuote = false;
                }
                continue;
            }

            if (mode.blockComment) {
                if (str[i] === '*' && str[i + 1] === '/') {
                    str[i + 1] = '';
                    mode.blockComment = false;
                }
                str[i] = '';
                continue;
            }

            if (mode.lineComment) {
                if (str[i + 1] === 'n' || str[i + 1] === 'r') {
                    mode.lineComment = false;
                }
                str[i] = '';
                continue;
            }

            if (mode.condComp) {
                if (str[i - 2] === '@' && str[i - 1] === '*' && str[i] === '/') {
                    mode.condComp = false;
                }
                continue;
            }

            mode.doubleQuote = str[i] === '"';
            mode.singleQuote = str[i] === "'";

            if (str[i] === '/') {
                if (str[i + 1] === '*' && str[i + 2] === '@') {
                    mode.condComp = true;
                    continue;
                }
                if (str[i + 1] === '*') {
                    str[i] = '';
                    mode.blockComment = true;
                    continue;
                }
                if (str[i + 1] === '/') {
                    str[i] = '';
                    mode.lineComment = true;
                    continue;
                }
                mode.regex = true;
            }
        }
        return str.join('').slice(2, -2);
    }

    updateConfig() {
        var self = this;
        util.log('[' + process.pid + '] reading config file: ' + this.file);

        fs.readFile(this.file, function (err, data) {
            if (err) {
                throw err;
            }
            self.oldConfig = self.config;

            const decoder = new StringDecoder('utf8');
            var configData = self.removeComments(decoder.write(data));
            self.config = JSON.parse(configData);
            self.emit('configChanged', self.config);
        });
    }
};


exports.Configurator = Configurator;

exports.configFile = function (file, callbackFunc) {
    var config = new Configurator(file);
    config.on('configChanged', function () {
        callbackFunc(config.config, config.oldConfig);
    });
};