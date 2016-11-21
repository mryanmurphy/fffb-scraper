const pg = require("pg");

var config = {
	user: 'postgres', //env var: PGUSER 
	database: 'postgres', //env var: PGDATABASE 
	password: 'password', //env var: PGPASSWORD 
	port: 5432, //env var: PGPORT 
	max: 10, // max number of clients in the pool 
	idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed 
};

var pool = new pg.Pool(config);

function PostgresBackend(config, emitter, logger) {
	var self = this;
	this.config = config || {};
	this.cache = {
		teams: [],
		games: [],
		players: []
	};
	this.logger = logger;

	emitter.on('flush', function (type, data) {
		self.flush(type, data);
	});
}

PostgresBackend.prototype.flush = function (type, data) {
	var self = this;

	switch (type) {
		case 'team':
			this.AddOrUpdateTeam(data);
			this.GetTeam(data, function(team) {
				data.teamID = team.id;
				self.AddOrUpdateScore(data);
			});
			break;
		
		case 'gameState':
			this.AddOrUpdateGameState(data);
			break
		
		case 'player':
			this.GetGame(data.gameID, function(game) {
				if (data.side === "home" && game.homeID) {
					data.teamID = game.homeID;
				} else if (data.side === "away" && game.awayID) {
					data.teamID = game.awayID;
				} else {
					self.logger.log(`Player with invalid side ${data.side} ${game.homeID} ${game.awayID}`, 'ERR');
					return;
				}

				self.AddOrUpdatePlayer(data);
				self.GetPlayer(data.playerID, function(player) {
					data.id = player.id;
					data.teamID = player.teamID;
					data.gameID = game.id;

					self.AddOrUpdatePlayerStatistics(data);
				});
			});
			break;
	}
};

PostgresBackend.prototype.CacheTeam = function(team) {
	if (!this.cache.teams.find(function(e) { return e.id === team.id; })) {
		this.cache.teams.push(team);
	}
};

PostgresBackend.prototype.CacheGame = function(game) {
	if (!this.cache.games.find(function(e) { return e.id === game.id; })) {
		this.cache.games.push(game);
	}
};

PostgresBackend.prototype.CachePlayer = function(player) {
	if (!this.cache.players.find(function(e) { return e.id === player.id; })) {
		this.cache.players.push(player);
	}
};

// TODO: This gotta be refactored to promise/use cache/async+await or something.
PostgresBackend.prototype.GetPlayer = function(sourceID, callback) {
	var find = this.cache.players.find(function(element) {
		return element.playerID === sourceID;
	});

	if (find) {
		callback(find);
		return;
	}

	const sql = `
SELECT 
	ID
	, SourceID
	, ActiveTeamID
FROM League_Players
WHERE SourceID = $1
`;

	var self = this;

	pool.query(sql, [sourceID], function(err, result) {
		if (err) {
			self.logger.log(err, 'ERR');
		} else if (result.rows.length) {
			var player = {
				id: result.rows[0].id,
				playerID: sourceID,
				teamID: result.rows[0].activeteamid
			};

			self.CachePlayer(player);
			callback(player);
		} else {
			self.logger.log(`Could not find player ${sourceID}`, 'ERR');
		}
	});
};

PostgresBackend.prototype.GetTeam = function(data, callback) {
	var find = this.cache.teams.find(function(element) {
		return element.city && element.city === data.city &&
		       element.name && element.name === data.name;
	});

	if (find) {
		callback(find);
		return;
	}
	
	const sql = `
SELECT ID
FROM League_Teams
WHERE City = $1 AND Name = $2
`;

	var self = this;

	pool.query(sql, [data.city, data.name], function(err, result) {
		if (err) {
			self.logger.log(err, 'ERR');
		} else if (result.rows.length) {
			data.id = result.rows[0].id;
			self.CacheTeam(data);
			callback(data);
		} else {
			self.logger.log(`Could not find team ${data.city} ${data.name}`, 'ERR');
		}
	});
};

PostgresBackend.prototype.GetGame = function(sourceID, callback) {
	var find = this.cache.games.find(function(element) {
		return element.gameID === sourceID;
	});

	if (find) {
		callback(find);
		return;
	}

	const sql = `
SELECT
	ID
	, HomeTeamID
	, AwayTeamID
FROM League_Games
WHERE SourceID = $1
`;

	var self = this,
		data = {gameID: sourceID};

	pool.query(sql, [sourceID], function(err, result) {
		if (err) {
			self.logger.log(err, 'ERR');
		} else if (result.rows.length) {
			data.id = result.rows[0].id;
			data.homeID = result.rows[0].hometeamid;
			data.awayID = result.rows[0].awayteamid;

			self.CacheGame(data);
			callback(data);
		} else {
			self.logger.log(`Could not find game ${sourceID}`, 'ERR');
		}
	});
};

PostgresBackend.prototype.AddOrUpdateTeam = function(data) {
	const sql = `
INSERT INTO League_Teams (City,Name,Abbreviation) VALUES ($1, $2, $3)
ON CONFLICT (City,Name) DO NOTHING
RETURNING ID
`;
	var self = this;

	pool.query(sql, [data.city, data.name, data.abbreviation], function (err, result) {
		if (err) {
			self.logger.log(err, 'ERR');
		} else if (result.rows.length) {
			self.logger.log(`Added team for ID ${result.rows[0].id} SourceID ${data.city}`, 'DEBUG');

			let team = {
				id: result.rows[0].id,
				city: data.city,
				name: data.name,
				abbreviation: data.abbreviation
			};

			data.teamID = team.id;
			self.CacheTeam(team);
		} else {
			self.logger.log(`Team ${data.city} existed.`, 'DEBUG');
		}
	});
};

PostgresBackend.prototype.AddOrUpdateScore = function(data) {
	const sql = `
INSERT INTO League_Games (SourceID, HomeTeamID, AwayTeamID, HomePoints, AwayPoints)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (SourceID) DO UPDATE SET 
	HomeTeamID = COALESCE(EXCLUDED.HomeTeamID, League_Games.HomeTeamID)
	, AwayTeamID = COALESCE(EXCLUDED.AwayTeamID, League_Games.AwayTeamID)
	, HomePoints = COALESCE(EXCLUDED.HomePoints, League_Games.HomePoints)
	, AwayPoints = COALESCE(EXCLUDED.AwayPoints, League_Games.AwayPoints)
RETURNING ID
`;

	var self = this,
		cache = {
			gameID: data.gameID,
			homeID: data.side === 'home' ? data.teamID : null,
			awayID: data.side === 'away' ? data.teamID : null,
			homeScore: data.side === 'home' ? data.score : null,
			awayScore: data.side === 'away' ? data.score : null
		};

	pool.query(sql, [cache.gameID, cache.homeID, cache.awayID, cache.homeScore, cache.awayScore], function (err, result) {
		if (err) {
			self.logger.log(err, 'ERR');
		} else if (result.rows.length) {
			self.logger.log(`Saved score for ID ${result.rows[0].id} SourceID ${data.gameID}`, 'DEBUG');

			cache.id = result.rows[0].id;
			self.CacheGame(cache);
		} else {
			self.logger.log('No action for AddOrUpdateScore','DEBUG');
		}
	});
};

PostgresBackend.prototype.AddOrUpdateGameState = function(data) {
	const sql = `
INSERT INTO League_Games (SourceID, DatePlayed, Quarter, TimeRemaining, IsFinal)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (SourceID) DO UPDATE SET
	DatePlayed = EXCLUDED.DatePlayed
	, Quarter = EXCLUDED.Quarter
	, TimeRemaining = EXCLUDED.TimeRemaining
	, IsFinal = EXCLUDED.IsFinal
RETURNING ID
`;

	var self = this;

	pool.query(sql, [data.gameID, data.date, data.quarter, data.time, data.isFinal], function(err, result) {
		if (err) {
			self.logger.log(err, 'ERR');
		} else if (result.rows.length) {
			self.logger.log(`Saved game state for ID ${result.rows[0].id} SourceID ${data.gameID}`, 'DEBUG');
		} else {
			self.logger.log('No action for AddOrUpdateGameState', 'DEBUG');
		}
	});
};

PostgresBackend.prototype.AddOrUpdatePlayer = function(data) {
	const sql = `
INSERT INTO League_Players (SourceID, Name, ActiveTeamID, IsGuard, IsForward, IsCenter)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (SourceID) DO UPDATE SET
	Name = EXCLUDED.Name
	, ActiveTeamID = EXCLUDED.ActiveTeamID
	, IsGuard = EXCLUDED.IsGuard
	, IsForward = EXCLUDED.IsForward
	, IsCenter = EXCLUDED.IsCenter
RETURNING ID
`;
	
	var self = this,
		isGuard = /g/i.test(data.position),
		isForward = /f/i.test(data.position),
		isCenter = /c/i.test(data.position);
	
	pool.query(sql, [data.playerID, data.name, data.teamID, isGuard, isForward, isCenter], function(err, result) {
		if (err) {
			self.logger.log(err, 'ERR');
		} else if (result.rows.length) {
			self.logger.log(`Saved player for ID ${result.rows[0].id} SourceID ${data.gameID} [${data.name}]`, 'DEBUG');

			// Make sure teamID gets cached too.
			data.id = result.rows[0].id;
			self.CachePlayer(data);
		} else {
			self.logger.log('No action for AddOrUpdatePlayer', 'DEBUG');
		}
	});
};

// must have gameID and playerID to INSERT
// should have teamID 
PostgresBackend.prototype.AddOrUpdatePlayerStatistics = function(data) {
	var self = this;

	function onInsert(err, result) {
		if (err) {
			self.logger.log(err, 'ERR');
		} else if (result.rows.length) {
			self.logger.log(`Saved box for ID ${result.rows[0].id}`, 'DEBUG');
		} else {
			self.logger.log('No action for AddOrUpdatePlayerStatistics', 'DEBUG');
		}
	};
	
	const sql = `
INSERT INTO League_BoxScores (
	GameID
	, TeamID
	, PlayerID
	, IsDNP
	, DNPStatus
	, Minutes
	, Points
	, PlusMinus
	, OffensiveRebounds
	, DefensiveRebounds
	, Assists
	, Steals
	, Blocks
	, Turnovers
	, Fouls
	, FreeThrowsMade
	, FreeThrowsAttempted
	, TwoPointsMade
	, TwoPointsAttempted
	, ThreePointsMade
	, ThreePointsAttempted
) VALUES (
	$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
	$12, $13, $14, $15, $16, $17, $18, $19, $20, $21
)
ON CONFLICT (GameID, PlayerID) DO UPDATE SET
	TeamID = EXCLUDED.TeamID
	, IsDNP = EXCLUDED.IsDNP
	, DNPStatus = EXCLUDED.DNPStatus
	, Minutes = EXCLUDED.Minutes
	, Points = EXCLUDED.Points
	, PlusMinus = EXCLUDED.PlusMinus
	, OffensiveRebounds = EXCLUDED.OffensiveRebounds
	, DefensiveRebounds = EXCLUDED.DefensiveRebounds
	, Assists = EXCLUDED.Assists
	, Steals = EXCLUDED.Steals
	, Blocks = EXCLUDED.Blocks
	, Turnovers = EXCLUDED.Turnovers
	, Fouls = EXCLUDED.Fouls
	, FreeThrowsMade = EXCLUDED.FreeThrowsMade
	, FreeThrowsAttempted = EXCLUDED.FreeThrowsAttempted
	, TwoPointsMade = EXCLUDED.TwoPointsMade
	, TwoPointsAttempted = EXCLUDED.TwoPointsAttempted
	, ThreePointsMade = EXCLUDED.ThreePointsMade
	, ThreePointsAttempted = EXCLUDED.ThreePointsAttempted
RETURNING ID
`, dnpSQL = `
INSERT INTO League_BoxScores (GameID, TeamID, PlayerID, IsDNP, DNPStatus)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (GameID, PlayerID) DO UPDATE SET
	TeamID = EXCLUDED.TeamID
	, IsDNP = EXCLUDED.IsDNP
	, DNPStatus = EXCLUDED.DNPStatus
RETURNING ID
`;

	if (data.dnp) {
		pool.query(dnpSQL, [data.gameID, data.teamID, data.id, true, data.dnp_reason], onInsert);
	} else {
		pool.query(sql, [
			data.gameID,
			data.teamID,
			data.id,
			false,
			null,
			data.minutes,
			data.points,
			data.plusMinus,
			data.offensiveRebounds,
			data.defensiveRebounds,
			data.assists,
			data.steals,
			data.blocks,
			data.turnovers,
			data.fouls,
			data.freeThrowsMade,
			data.freeThrowsAttempted,
			data.twoPointsMade,
			data.twoPointsAttempted,
			data.threePointsMade,
			data.threePointsAttempted
		], onInsert);
	}
};

exports.init = function (config, emitter, logger) {
	var instance = new PostgresBackend(config, emitter, logger);
	return true;
};
