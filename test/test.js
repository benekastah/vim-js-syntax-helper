
var rewriter = require('../rewrite.js');

exports.Tester = Tester;
function Tester(tests_to_run) {
  this.errors = [];

  if (tests_to_run && !tests_to_run.length) {
    this.tests_to_run = null;
  } else {
    this.tests_to_run = tests_to_run;
  }
  
  for (var name in rewriter.rewrite_rules) {
    if (this.tests_to_run && this.tests_to_run.indexOf(name) < 0) {
      continue;
    }

    this.namespace = name;

    try {
      if (name in this.node_tests) {
        this.node_tests[name].call(this);
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
  // console.log(JSON.stringify(ast, null, 2));
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
  if (args.length === 1) {
    args[1] = this.rewrite(a);
  }
  this.assertEqual.apply(this, args);
};

Tester.pass = function () {};

Tester.prototype.node_tests = {
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

    code = '1 * 1';
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

    code = '5 ==     3';
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

    code = 'a[b]';
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
  },

  CallExpression: function () {
    var code;

    code = 'someFunction()';
    this.assertAddedSemicolon(code);

    code = 'someFunction(1, 2, 3)';
    this.assertAddedSemicolon(code);

    code = 'someFunction(1 2 3)';
    this.assertEqual('someFunction(1,2,3);', this.rewrite(code));
  },

  NewExpression: function () {
    var code;

    code = 'new thing()';
    this.assertAddedSemicolon(code);

    code = 'new thing';
    this.assertAddedSemicolon(code);

    code = 'new thing(1, 2, 3)';
    this.assertAddedSemicolon(code);

    code = 'new thing(1 2 3)';
    this.assertEqual('new thing(1,2,3);', this.rewrite(code));
  },

  IfStatement: function () {
    var code;

    code = 'if (test) {\n'+
           '  doThis();\n'+
           '}';
    this.assertEqual(code);

    code = 'if (test) {\n'+
           '  doThis();\n'+
           '} else {\n'+
           '  doThat();\n'+
           '}';
    this.assertEqual(code);

    code = code.replace(/\s+/g, '');
    this.assertEqual(code);

    code = 'if (thing) console.log(1)';
    this.assertAddedSemicolon(code);

    code = 'if (thing) console.log(1)\n'+
           'else console.log(2)';
    this.assertEqual('if (thing) console.log(1);\n'+
                     'else console.log(2);', this.rewrite(code));

    code = code.replace(/\n/g, ' ');
    this.assertEqual('if (thing) console.log(1);else console.log(2);', this.rewrite(code));
  },

  ConditionalExpression: function () {
    var code;

    code = 'a ? b : c';
    this.assertAddedSemicolon(code);

    code = 'a ? b :\n'+
           'c ? d :\n'+
           'e';
    this.assertAddedSemicolon(code);
  },

  ForInit: Tester.pass,

  UpdateExpression: Tester.pass,

  ForStatement: function () {
    var code;

    code = 'for (;;) {}';
    this.assertEqual(code);

    code = 'for (var i = 0;;) {}';
    this.assertEqual(code);

    code = 'for (; x < 5;) {}';
    this.assertEqual(code);

    code = 'for (;; i += 1) {}';
    this.assertEqual(code);

    code = 'for (var i = 0; i < 4;) {}';
    this.assertEqual(code);

    code = 'for (var i = 0;; i++) {}';
    this.assertEqual(code);

    code = 'for (; i < 5; i++) {}';
    this.assertEqual(code);

    code = 'for (var i = 0; i < 6; i++) console.log(i)';
    this.assertAddedSemicolon(code);
  },

  ForInStatement: function () {
    var code;

    code = 'for (var p in obj) console.log(obj[p])';
    this.assertAddedSemicolon(code);

    code = 'for (var p in obj) {}';
    this.assertEqual(code);
  },

  ContinueStatement: function () {
    var code;

    code = 'for (;;) continue';
    this.assertAddedSemicolon(code);
  },

  LabeledStatement: function () {
    var code;

    code = 'aLabel:\n'+
           'for (;;) {\n'+
           '  break aLabel;\n'+
           '}';
    this.assertEqual(code);

    code = 'aLabel:\n'+
           'for (;;) continue aLabel';
    this.assertAddedSemicolon(code);
  },

  BreakStatement: function () {
    var code;

    code = 'for (;;) break';
    this.assertAddedSemicolon(code);
  },

  WithStatement: function () {
    var code;

    code = 'with (obj) console.log(a)';
    this.assertAddedSemicolon(code);

    code = 'with (obj) {}';
    this.assertEqual(code);
  },

  SwitchStatement: function () {
    var code;

    code = 'switch (obj.x) {\n'+
           'case 1:\n'+
           '  doAThing();\n'+
           '  break;\n'+
           '\n'+
           'case 2:\n'+
           'case 3:\n'+
           '  doAnotherThing();\n'+
           '  break;\n'+
           '\n'+
           'default:\n'+
           '  doTheDefaultThing();\n'+
           '}';
    this.assertEqual(code);
  },

  ThrowStatement: function () {
    var code;

    code = 'throw ""';
    this.assertAddedSemicolon(code);
  },

  TryStatement: function () {
    var code;

    code = 'try { doAThing() }\ncatch (e) {}';
    this.assertEqual('try { doAThing(); }\ncatch (e) {}', code);

    code = code.replace(/\n/g, ' ');
    this.assertEqual('try { doAThing(); } catch (e) {}', code);
  },

  WhileStatement: function () {
    var code;

    code = 'while (1) {}';
    this.assertEqual(code);
  },

  DoWhileStatement: function () {
    var code;

    code = 'do i += 1\n'+
           'while (i < 100)';
    this.assertEqual('do i += 1;\n'+
                     'while (i < 100);', this.rewrite(code));

    code = 'do {} while (1)';
    this.assertAddedSemicolon(code);
  },

  DebuggerStatement: function () {
    var code;

    code = 'debugger';
    this.assertAddedSemicolon(code);
  },

  SequenceExpression: function () {
    var code;

    code = '(a, b, c, d)';
    this.assertAddedSemicolon(code);
  }
};

new Tester(process.argv.slice(2));
