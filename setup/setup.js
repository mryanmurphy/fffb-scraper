const pg = require("pg");

var config = {
  user: 'postgres', //env var: PGUSER 
  database: 'postgres', //env var: PGDATABASE 
  password: 'password', //env var: PGPASSWORD 
  port: 5432, //env var: PGPORT 
  max: 10, // max number of clients in the pool 
  idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed 
};
/*

*/
var tables = [
`
DROP TABLE IF EXISTS League_Teams;
CREATE TABLE League_Teams (
	ID SERIAL PRIMARY KEY
	, City varchar(50)
	, Name varchar(50)
	, Abbreviation varchar(50)
);
`,
`
DROP TABLE IF EXISTS League_Players;
CREATE TABLE League_Players (
	ID SERIAL PRIMARY KEY 
	, SourceID varchar(50)
	, Name varchar(100)
	, ActiveTeamID integer
	, IsGuard boolean
	, IsForward boolean
	, IsCenter boolean 

	-- Future fields we should have?
	-- , IsActive boolean
	-- , IsInjured boolean
	-- , InjuryStatus varchar(100)
);
`,
`
DROP TABLE IF EXISTS League_Games;
CREATE TABLE League_Games (
	ID SERIAL PRIMARY KEY 
	, SourceID varchar(50)
	, DatePlayed date
	, Quarter smallint
	, TimeRemaining time
	, HomeTeamID integer
	, AwayTeamID integer
	, HomeTeamGameNumber smallint
	, AwayTeamGameNumber smallint
	, HomePoints smallint
	, AwayPoints smallint
	, IsFinal boolean
);
`,
`
DROP TABLE IF EXISTS League_BoxScores;
CREATE TABLE League_BoxScores (
	ID SERIAL PRIMARY KEY 
	, GameID integer
	, TeamID integer
	, PlayerID integer
	, IsDNP boolean
	, DNPStatus varchar(100)
	, Minutes smallint
	, Points smallint
	, PlusMinus smallint
	, OffensiveRebounds smallint
	, DefensiveRebounds smallint
	, Assists smallint
	, Steals smallint
	, Blocks smallint
	, Turnovers smallint
	, Fouls smallint
	, FreeThrowsMade smallint
	, FreeThrowsAttempted smallint
	, TwoPointsMade smallint
	, TwoPointsAttempted smallint
	, ThreePointsMade smallint
	, ThreePointsAttempted smallint
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
		//call `done()` to release the client back to the pool 
		done();
	
		if (err) {
			console.error('error running query', err);
		}
		
	  });
  });

  console.log('Done');
});
