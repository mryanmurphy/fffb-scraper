module.exports = function() {

	const jsdom = require('jsdom');

	var _logger,
		_emitter,
		_urls = {
			board: "http://www.espn.com/nba/scoreboard",
			boxPattern: "http://(www.espn.com|espn.go.com)/nba/boxscore[?]gameId[=]\\d+"
		},

		_makeBoardRequest = function() {
			_logger.log(`Querying ${_urls.board}`);
			jsdom.env(_urls.board, _parseBoard);
		},

		_parseBoard = function (err, window) {
			if (err) {
				_logger.log(`Error: ${err}`, 'ERROR');
			}

			var regex = new RegExp(_urls.boxPattern, "gi"),
				html = window.document.body.innerHTML,
				matches = html.match(regex);

			_logger.log(`Parsed ${matches.length} links`);
			matches.forEach(_makeBoxRequest);
		},

		_makeBoxRequest = function(url) {
			_logger.log(`Querying ${url}`);
			jsdom.env(url, _parseBox);
		},

		_parseBox = function(err, window) {
			if (err) {
				_logger.log(`Error: ${err}`, 'ERROR');
			}
			
			_logger.log(`Parsed ${window.document.title}`);
			var gameID = Number(window.location.search.match(/gameId=(\d+)/)[1]);
			_parseGameState(window, gameID);
			_parseTeams(window, gameID);
			_parsePlayers(window, gameID);
		},

		_parseGameState = function(window, gameID) {
			var element = window.document.querySelector('.game-status > .game-time'),
				time = element.textContent.split('-')[0].trim(),
				quarter = time !== 'Final' ? element.textContent.split('-')[1].trim() : 'Final';
			
			// Make time a time when the game is over.
			time = time !== 'Final' ? time : '0:00';

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
			var tableSelector = 'table.mod-data > tbody > tr',
				awayElements = window.document.querySelectorAll(`.gamepackage-away-wrap ${tableSelector}`),
				homeElements = window.document.querySelectorAll(`.gamepackage-home-wrap ${tableSelector}`);

			if (awayElements) {
				for (var i = 0; i < awayElements.length; i++) {
					if (!awayElements[i].classList.contains('highlight')) {
						_parsePlayer(awayElements[i], gameID, 'away');
					}
				}
			}

			if (homeElements) {
				for (var i = 0; i < homeElements.length; i++) {
					if (!homeElements[i].classList.contains('highlight')) {
						_parsePlayer(homeElements[i], gameID, 'home');
					}
				}
			}
		},

		_parsePlayer = function(element, gameID, side) {
			var id = Number(element.querySelector('a').href.match(/\/id\/(\d+)\//)[1]),
				name = element.querySelector('td.name > a > span').textContent,
				position = element.querySelector('td.name span.position').textContent,
				isDNP = element.querySelector('td.dnp') !== null;
			
			if (isDNP) {
				_emitter.emit('flush', 'player_dnp', {
					gameID: gameID,
					side: side,
					playerID: id,
					name: name,
					position: position,
					minutes: 0,
					dnp: true,
					dnp_reason: element.querySelector('td.dnp').textContent
				});
			} else {
				var minutes = Number(element.querySelector('td.min').textContent),
					fieldGoalsMade = Number(element.querySelector('td.fg').textContent.split('-')[0]),
					fieldGoalsAttempted = Number(element.querySelector('td.fg').textContent.split('-')[1]),
					threePointsMade = Number((element.querySelector('td.threeptm-a') || element.querySelector('td[class="3pt"]')).textContent.split('-')[0]),
					threePointsAttempted = Number((element.querySelector('td.threeptm-a') || element.querySelector('td[class="3pt"]')).textContent.split('-')[1]),
					freeThrowsMade = Number((element.querySelector('td.ftma') || element.querySelector('td.ft')).textContent.split('-')[0]),
					freeThrowsAttempted = Number((element.querySelector('td.ftma') || element.querySelector('td.ft')).textContent.split('-')[1]),
					offensiveRebounds = Number(element.querySelector('td.oreb').textContent),
					defensiveRebounds = Number(element.querySelector('td.dreb').textContent),
					assists = Number(element.querySelector('td.ast').textContent),
					steals = Number(element.querySelector('td.stl').textContent),
					blocks = Number((element.querySelector('td.blocks') || element.querySelector('td.blk')).textContent),
					turnovers = Number(element.querySelector('td.to').textContent),
					fouls = Number(element.querySelector('td.pf').textContent),
					plusMinus = Number(element.querySelector('td.plusminus').textContent),
					points = Number(element.querySelector('td.pts').textContent),
					twoPointsMade = fieldGoalsMade - threePointsMade,
					twoPointsAttempted = fieldGoalsAttempted - threePointsAttempted;
				
				_emitter.emit('flush', 'player', {
					gameID: gameID,
					side: side,
					playerID: id,
					name: name,
					position: position,
					minutes: minutes,
					threePointsMade: threePointsMade,
					threePointsAttempted: threePointsAttempted,
					twoPointsMade: twoPointsMade,
					twoPointsAttempted: twoPointsAttempted,
					freeThrowsMade: freeThrowsMade,
					freeThrowsAttempted: freeThrowsAttempted,
					offensiveRebounds: offensiveRebounds,
					defensiveRebounds: defensiveRebounds,
					assists: assists,
					steals: steals,
					blocks: blocks,
					turnovers: turnovers,
					fouls: fouls,
					plusMinus: plusMinus,
					points: points
				});
			}
		};

	return {
		init: function(config, emitter, logger) {
			_logger = logger;
			_emitter = emitter;
		},
		scrape: function() {
			_logger.log('called scrape', 'DEBUG');
			
			_makeBoardRequest();
		}
	};
};