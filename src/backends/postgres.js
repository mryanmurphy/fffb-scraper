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
	switch (type) {
		case 'team':
			AddOrUpdateTeam(data);
			break;
		
		case 'gameState':
			AddOrUpdateGameState(data);
			break
		
		case 'player':
			AddOrUpdatePlayer(data);
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
			console.error(err);
		} else {
			var team = {
				id: result.rows[0].id,
				city: data.city,
				name: data.name,
				abbreviation: data.abbreviation
			};

			data.teamID = team.id;

			self.CacheTeam(team);
			self.AddOrUpdateScore(data);	
		}
	});
};

/*
	ID SERIAL PRIMARY KEY 
	, SourceID VARCHAR(50)
	, DatePlayed DATE
	, Quarter SMALLINT
	, TimeRemaining TIME
	, HomeTeamID INTEGER
	, AwayTeamID INTEGER
	, HomeTeamGameNumber SMALLINT
	, AwayTeamGameNumber SMALLINT
	, HomePoints SMALLINT
	, AwayPoints SMALLINT
	, IsFinal BOOLEAN
*/
PostgresBackend.prototype.AddOrUpdateScore = function(data) {
	const sql = `
INSERT INTO League_Games (SourceID, HomeTeamID, HomePoints, AwayTeamID, AwayPoints)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (SourceID) DO UPDATE SET 
	HomeTeamID = EXCLUDED.HomeTeamID
	, AwayTeamID = EXCLUDED.AwayTeamID
	, HomePoints = EXCLUDED.HomePoints
	, AwayPoints = EXCLUDED.AwayPoints
RETURNING ID
`;

	var self = this,
		homeID = data.side === 'home' ? data.teamID : null,
		awayID = data.side === 'away' ? data.teamID : null,
		homeScore = data.side === 'home' ? data.score : null,
		awayScore = data.side === 'home' ? data.score : null;

	pool.query(sql, [data.gameID, homeID, awayID, homeScore, awayScore], function (err, result) {
		if (err) {
			console.error(err);
		} else {
			console.log(`Saved score for ID ${result.rows[0].id} SourceID ${game.gameID}`);
		}
	});
};

PostgresBackend.prototype.AddOrUpdateGameState = function(data) {

}

PostgresBackend.prototype.AddOrUpdatePlayer = function(data) {
	AddOrUpdatePlayerStatistics(data);
}

PostgresBackend.prototype.AddOrUpdatePlayerStatistics = function(data) {
	
}

exports.init = function (config, emitter, logger) {
	var instance = new PostgresBackend(config, emitter, logger);
	return true;
};
