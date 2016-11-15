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
		teams: {},
		games: {},
		players: {}
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
			this.AddOrUpdateScore(data);
			this.GetTeam(data, function(datum) {
				self.AddOrUpdateScore(datum);
			});
			break;
		
		case 'gameState':
			this.AddOrUpdateGameState(data);
			break
		
		case 'player':
			this.AddOrUpdatePlayer(data);
			break;
	}
};

PostgresBackend.prototype.CacheTeam = function(team) {
	if (!this.cache.teams[team.id]) {
		this.cache.teams[team.id] = team;
	}
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
			self.AddOrUpdateScore(data);
		} else {
			self.logger.log(`Team ${data.city} existed.`, 'DEBUG');
		}
	});
};

// TODO: This gotta be refactored to promise/use cache/async+await or something.
PostgresBackend.prototype.GetTeam = function(data, callback) {
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
			data.teamID = result.rows[0].id;
			callback(data);
		} else {
			self.logger.log(`Not not find team ${data.city} ${data.name}`, 'ERR');
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
		homeID = data.side === 'home' ? data.teamID : null,
		awayID = data.side === 'away' ? data.teamID : null,
		homeScore = data.side === 'home' ? data.score : null,
		awayScore = data.side === 'away' ? data.score : null;

	pool.query(sql, [data.gameID, homeID, awayID, homeScore, awayScore], function (err, result) {
		if (err) {
			self.logger.log(err, 'ERR');
		} else if (result.rows.length) {
			self.logger.log(`Saved score for ID ${result.rows[0].id} SourceID ${data.gameID}`, 'DEBUG');
		} else {
			self.logger.log('No action for AddOrUpdateScore','DEBUG');
		}
	});
};

PostgresBackend.prototype.AddOrUpdateGameState = function(data) {

}

PostgresBackend.prototype.AddOrUpdatePlayer = function(data) {
	this.AddOrUpdatePlayerStatistics(data);
}

PostgresBackend.prototype.AddOrUpdatePlayerStatistics = function(data) {
	
}

exports.init = function (config, emitter, logger) {
	var instance = new PostgresBackend(config, emitter, logger);
	return true;
};
