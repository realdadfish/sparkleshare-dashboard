var config = require('./config');

LinkCodeProvider = function() {
  this.validCodes = [];
};

LinkCodeProvider.prototype = {
  codeLen: 6,

  getNewCode: function() {
    this.gc();

    // 8 chars for linking code
    var code = Math.floor(Math.random() * Math.pow(10, this.codeLen)).toString();
    code = (new Array(this.codeLen - code.length + 1)).join("0") + code;

    this.validCodes.push({
      code: code,
      validUntil: (new Date()).getTime() + config.linkCodeValidFor
    });

    return {code: code, validFor: config.linkCodeValidFor};
  },

  gc: function() {
    var now = (new Date()).getTime();
    var newValidCodes = [];

    for (var i = 0; i < this.validCodes.length; i++) {
      if (now < this.validCodes[i].validUntil) {
        newValidCodes.push(this.validCodes[i]);
      }
    }

    this.validCodes = newValidCodes;
  },

  isCodeValid: function(code) {
    var valid = false;

    for (var i = 0; i < this.validCodes.length; i++) {
      if (this.validCodes[i].code == code && now < this.validCodes[i].validUntil) {
        this.validCodes[i].validUntil = 0;
        valid = true;
        break;
      }
    }

    this.gc();
    return valid;
  }
};

exports.LinkCodeProvider = LinkCodeProvider;
