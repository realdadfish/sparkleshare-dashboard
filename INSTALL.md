The following steps are needed to get the Dashboard running:

- Install `redis`, the nosql database, from http://redis.io or your favourite distro
- Install `nodejs` from http://nodejs.org or your favourite distro
- Install `npm`, the node package manager, as root via `curl https://npmjs.org/install.sh | sh`
- Install the dependencies `npm install express@2.5 express-messages i18n jade connect-redis redis sass mime`
- Start a redis instance
- Start the Dashboard with `/path/to/node /path/to/dashboard/app.js`

For more configuration options, see `config.js`.
