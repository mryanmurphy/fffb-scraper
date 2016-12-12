const pg = require("pg");

var config = {
	user: 'postgres', //env var: PGUSER 
	database: 'postgres', //env var: PGDATABASE 
	password: 'password', //env var: PGPASSWORD 
	port: 5432, //env var: PGPORT 
	max: 10, // max number of clients in the pool 
	idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed 
};

var tables = [
`
DROP TABLE IF EXISTS League_Teams;
CREATE TABLE League_Teams (
	ID SERIAL PRIMARY KEY
	, City VARCHAR(50) NOT NULL
	, Name VARCHAR(50) NOT NULL
	, Abbreviation VARCHAR(50) NOT NULL
	, UNIQUE(City, Name)
);
`,
`
DROP TABLE IF EXISTS League_Players;
CREATE TABLE League_Players (
	ID SERIAL PRIMARY KEY 
	, SourceID VARCHAR(50) UNIQUE
	, DateCreated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
	, DateModified TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
	, FirstName VARCHAR(100)
	, LastName VARCHAR(100)
	, ActiveTeamID INTEGER
	, IsGuard BOOLEAN
	, IsForward BOOLEAN
	, IsCenter BOOLEAN 

	-- Future fields we should have?
	-- , IsActive BOOLEAN
	-- , IsInjured BOOLEAN
	-- , InjuryStatus VARCHAR(100)
);
`,
`
DROP TABLE IF EXISTS League_Games;
CREATE TABLE League_Games (
	ID SERIAL PRIMARY KEY 
	, SourceID VARCHAR(50) UNIQUE NOT NULL
	, DateCreated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
	, DateModified TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
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
);
`,
`
DROP TABLE IF EXISTS League_BoxScores;
CREATE TABLE League_BoxScores (
	ID SERIAL PRIMARY KEY 
	, DateCreated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
	, DateModified TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
	, GameID INTEGER NOT NULL
	, TeamID INTEGER NOT NULL
	, PlayerID INTEGER NOT NULL
	, IsDNP BOOLEAN
	, DNPStatus VARCHAR(100)
	, Minutes SMALLINT
	, Points SMALLINT
	, PlusMinus SMALLINT
	, OffensiveRebounds SMALLINT
	, DefensiveRebounds SMALLINT
	, Assists SMALLINT
	, Steals SMALLINT
	, Blocks SMALLINT
	, Turnovers SMALLINT
	, Fouls SMALLINT
	, FreeThrowsMade SMALLINT
	, FreeThrowsAttempted SMALLINT
	, TwoPointsMade SMALLINT
	, TwoPointsAttempted SMALLINT
	, ThreePointsMade SMALLINT
	, ThreePointsAttempted SMALLINT
	, UNIQUE(GameID, PlayerID)
);
`
];

(new pg.Pool(config)).connect(function(err, client, done) {
  if(err) {
    return console.error('error fetching client from pool', err);
  }

  tables.forEach(function(value) {
	  console.log("Running: ", value);

	  client.query(value, function(err, result) {
		if (err) {
			process.exitCode = 1;
			console.error('error running query', err);
		}
		
	  });
  });

  done();
  console.log('Done');
});
