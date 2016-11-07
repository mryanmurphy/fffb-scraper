/*

Required Variables:
  
  frequency:        millisecond interval to repeat scraping requests
  scraper:          which scraper to load and use

Optional Variables:

  backends:         an array of backends to load. Each backend must exist
                    by name in the directory backends/. If not specified,
                    the default console backend will be loaded.
                    * example for console :
                    [ "./backends/console" ]

  log:              log settings [object, default: undefined]
    backend:        where to log: stdout or syslog [string, default: stdout]
    application:    name of the application for syslog [string, default: fffb_scraper]
    level:          log level for [node-]syslog [string, default: LOG_INFO]

  automaticConfigReload: whether to watch the config file and reload it when it
                         changes. The default is true. Set this to false to disable.

*/

/*jshint node:true, unused:false */

{
	backends: ["./backends/console"],
	frequency: 300000,
	scraper: "./scrapers/espn"
}