The following steps are needed to get the Dashboard running:

- Install `git` from your favourite distro
- Install `redis`, the nosql database, from http://redis.io or your favourite distro
- Install `nodejs` from http://nodejs.org or your favourite distro
- Install `npm`, the node package manager, as root via `curl https://npmjs.org/install.sh | sh`
- Install the dependencies `npm install express@2.5 express-messages i18n jade connect-redis redis sass mime`;
  **ATTENTION:** The Dashboard is currently incompatible with express-3.0 and newer, so ensure you install 2.5 as stated in the previous command.
- Start a redis instance
- Edit `config.js` and add the git repositories you want to serve publically and / or privately
- Start the Dashboard with `/path/to/node /path/to/dashboard/app.js`; to run node in production mode, prefix this command with `NODE_ENV=production`
