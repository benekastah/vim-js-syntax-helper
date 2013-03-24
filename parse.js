#!/usr/bin/env node

var fs = require('fs'),
  rewriter = require('./rewrite.js'),
  argv = process.argv.slice(2);

var type = argv[0];
var input = argv[1];

switch (argv.length) {
  case 1:
    input = type;
    type = '--code';
    break;

  case 2:
    break;

  default:
    throw 'Not enough arguments';
}

var file;
switch (type) {
  case '-f': case '--file':
    file = input;
    input = fs.readFile(file, 'utf8', rewrite);
    break;

  case '-c': case '--code':
    rewrite(null, input);
    break;

  default:
    throw 'Invalid input type: ' + type;
}

function rewrite(err, code) {
  if (err) throw err;

  var onComment = function () {
    console.log
  };

  var ast = rewriter.get_ast(code, true);
  var rewritten_code = rewriter.rewrite(ast);
  console.log(rewritten_code);
}
