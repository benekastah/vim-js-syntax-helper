
var rewriter = require('../rewrite.js');

exports.Tester = Tester;
function Tester() {
  this.errors = [];
  
  for (var name in rewriter.rewrite_rules) {
    this.namespace = name;

    try {
      if (name in this.tests) {
        this.tests[name].call(this);
      } else {
        this.assert("Test implemented", false);
      }
    } catch (e) {
      console.error(e);
      this.errors.push(e);
    }

    this.namespace = null;
    this.code = null;
  }

  if (this.errors.length) {
    console.log('Ran tests with ' + this.errors.length + ' errors');
    console.log();
  }
}

Tester.prototype.rewrite = function (code) {
  var ast = rewriter.get_ast(code, true);
  var rewritten_code = rewriter.rewrite(ast);
  return rewritten_code;
};

Tester.prototype.assert = function (message, trueArg) {
  if (this.namespace) {
    message = this.namespace + ': ' + message;
  }

  try {
    console.assert(trueArg);
    console.log('✓', message);
  }
  catch (e) {
    this.errors.push(e);
    console.error('✖', message);
  }
};

Tester.prototype.assertEqual = function (a, b) {
  if (arguments.length === 1) {
    b = this.rewrite(a);
  }
  this.assert(JSON.stringify(a) + " equals " + JSON.stringify(b), a === b);
};

Tester.prototype.assertAddedSemicolon = function (a, b) {
  var args = [].slice.call(arguments);
  args[0] = a + ';';
  this.assertEqual.apply(this, args);
};

Tester.pass = function () {};

Tester.prototype.tests = {
  Literal: function () {
    var code;
    code = 'something';
    this.assertAddedSemicolon(code);
  },

  ObjectExpression: function () {
    var code;

    code = '({})';
    this.assertAddedSemicolon(code);

    code = '({a: 1})';
    this.assertAddedSemicolon(code);

    code = '({a:1})';
    this.assertAddedSemicolon(code);

    code = '({\n'+
    '  a: 1\n'+
    '  b: 2\n'+
    '  c: 3\n'+
    '})';
    this.assertEqual('({\n'+
                '  a: 1,\n'+
                '  b: 2,\n'+
                '  c: 3\n'+
                '});', this.rewrite(code));
  },

  Identifier: function () {
    var code;

    code = 'var asdf';
    this.assertAddedSemicolon(code);

    code = 'asdf = 5';
    this.assertAddedSemicolon(code);
  },

  ThisExpression: function () {
    var code;

    code = 'this';
    this.assertAddedSemicolon(code);

    code = 'var five = this.five';
    this.assertAddedSemicolon(code);
  },

  VariableDeclaration: function () {
    var code;

    code = 'var five';
    this.assertAddedSemicolon(code);

    code = 'var six = 6'
    this.assertAddedSemicolon(code);
  },

  VariableDeclarator: Tester.pass,

  AssignmentExpression: function () {
    var code;

    code = 'seven =  "seven"'
    this.assertAddedSemicolon(code);
  },

  BlockStatement: function () {
    var code;

    code = '{}';
    this.assertEqual(code);

    code = '{ console.log(" here is a block ") }';
    this.assertEqual('{ console.log(" here is a block "); }', this.rewrite(code));
  },

  ExpressionStatement: function () {
    var code;

    code = '1';
    this.assertAddedSemicolon(code);
  },

  EmptyStatement: function () {
    var code;

    code = ';';
    this.assertEqual(code);

    code = '    ;'
    this.assertEqual(code);
  },

  BinaryExpression: function () {
    var code;

    code = '1 + 1';
    this.assertAddedSemicolon(code);

    code = '1* 1';
    this.assertAddedSemicolon(code);

    code = '1 %  6';
    this.assertAddedSemicolon(code);
  },

  LogicalExpression: function () {
    var code;

    code = '4 > 77';
    this.assertAddedSemicolon(code);

    code = '5 === 3';
    this.assertAddedSemicolon(code);

    code = '5  == 3';
    this.assertAddedSemicolon(code);
  },

  UnaryExpression: function () {
    var code;

    code = '+1';
    this.assertAddedSemicolon(code);

    code = '- 1';
    this.assertAddedSemicolon(code);
  },

  ArrayExpression: function () {
    var code;

    code = '[]';
    this.assertAddedSemicolon(code);

    code = 'var a = [1, 2, 3, 4]';
    this.assertAddedSemicolon(code);

    code = 'var a = [1 2 3 4]';
    this.assertEqual('var a = [1,2,3,4];', this.rewrite(code));

    var answer = 'var a = [\n'+
    '  1,\n'+
    '  2,\n'+
    '  3\n'+
    '];';
    
    code = 'var a = [\n'+
    '  1\n'+
    '  2\n'+
    '  3\n'+
    ']';
    this.assertEqual(answer, this.rewrite(code));

    code = 'var a = [\n'+
    '  1,\n'+
    '  2,\n'+
    '  3,\n'+
    '];';
    this.assertEqual(answer, this.rewrite(code));
  },

  MemberExpression: function () {
    var code;

    code = 'a.b.c';
    this.assertAddedSemicolon(code);

    code = 'a[b].c';
    this.assertAddedSemicolon(code);

    code = 'x = x[5]';
    this.assertAddedSemicolon(code);

    code = 'var div = document.createElement("div");'
    this.assertEqual(code);
  },

  FunctionDeclaration: function () {
    var code;

    code = 'function named(x, y, z) {}';
    this.assertEqual(code);

    code = 'function named(x y z) {}';
    this.assertEqual('function named(x,y,z) {}', this.rewrite(code));
  },

  FunctionExpression: function () {
    var code;

    code = '(function () {})';
    this.assertAddedSemicolon(code);

    code = 'var fn = function (x, y, z) {}';
    this.assertAddedSemicolon(code);

    code = 'var fn = function (x y z) {}';
    this.assertAddedSemicolon('var fn = function (x,y,z) {}');
  },

  ReturnStatement: function () {
    var code;

    code = 'function ret() { return 5 }';
    this.assertEqual('function ret() { return 5; }', this.rewrite(code));
  }
};

new Tester();
