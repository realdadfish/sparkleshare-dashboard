exports.folders = [
  { type: 'git', name: 'Public GIT folder', path: '/path/to/bare/git1.git', pub: true },
  { type: 'git', name: 'Private GIT folder', path: '/path/to/bare/git2.git', pub: false }
];

exports.listen = {
  port: 3000,
  host: null
};

exports.https = {
  enabled: false,
  key: '/path/to/private.key',
  cert: '/path/to/cert.crt'
};

exports.basepath = '';
exports.externalUrl = null;

// 300 sec
exports.linkCodeValidFor = 300;

// none | min | info | debug
exports.logging = 'none';
