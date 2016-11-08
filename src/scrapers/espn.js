module.exports = function() {

	const jsdom = require('jsdom');

	var _logger,
		_emitter,
		_urls = {
			board: "http://www.espn.com/nba/scoreboard",
			boxPattern: "http://(www.espn.com|espn.go.com)/nba/boxscore[?]gameId[=]\\d+"
		},

		_makeBoardRequest = function() {
			_logger.log('Querying ' + _urls.board);
			jsdom.env(_urls.board, _parseBoard);
		},

		_parseBoard = function (err, window) {
			if (err) {
				_logger.log('Error: ' + err, 'ERROR');
			}

			var regex = new RegExp(_urls.boxPattern, "gi"),
				html = window.document.body.innerHTML,
				matches = html.match(regex);

			_logger.log('Parsed ' + matches.length + ' links');
			matches.forEach(_makeBoxRequest);
		},

		_makeBoxRequest = function(url) {
			_logger.log('Querying ' + url);
			jsdom.env(url, _parseBox);
		},

		_parseBox = function(err, window) {
			if (err) {
				_logger.log('Error: ' + err, 'ERROR');
			}
			
			_logger.log('Parsed ' + window.document.title);
			var gameID = Number(window.location.search.match(/gameId=(\d+)/)[1]);
			_parseGameState(window, gameID);
			_parseTeams(window, gameID);
			_parsePlayers(window, gameID);
		},

		_parseGameState = function(window, gameID) {
			var element = window.document.querySelector('.game-status > .game-time'),
				time = element.textContent.split('-')[0].trim(),
				quarter = time !== 'Final' ? element.textContent.split('-')[1].trim() : 'Final';
			
			_emitter.emit('flush', 'gameState', {
				gameID: gameID,
				time: time,
				quarter: quarter
			});
		},

		_parseTeams = function(window, gameID) {
			var elements = window.document.querySelectorAll('.team.away,.team.home');

			if (elements) { 
				for (var i = 0; i < elements.length; i++) {
					_parseTeam(elements[i], gameID);
				}
			}
		},

		_parseTeam = function(element, gameID) {
			var city = element.querySelector('.long-name').textContent,
				name = element.querySelector('.short-name').textContent,
				abbreviation = element.querySelector('.abbrev').textContent,
				score = Number(element.querySelector('.score').textContent);
			
			_emitter.emit('flush', 'team', {
				gameID: gameID,
				city: city,
				name: name,
				abbreviation: abbreviation,
				side: element.classList.contains('home') ? 'home' : 'away',
				score: score
			});
		},

		_parsePlayers = function(window, gameID) {

		};

	return {
		init: function(config, emitter, logger) {
			_logger = logger;
			_emitter = emitter;
		},
		scrape: function() {
			_logger.log('called scrape', 'DEBUG');
			
			_makeBoardRequest();

			// _emitter.emit('flush', 'box', 'this is a test');
		}
	};
};