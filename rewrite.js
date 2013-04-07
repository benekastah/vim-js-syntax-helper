(function (exports) {
  
  var walk = (typeof acorn !== "undefined" && acorn.walk) || require("./acorn/util/walk.js");

  function ErrorPrototype() {}
  ErrorPrototype.prototype = Error.prototype;

  function ParseError(node) {
    this.node = node;
    this.line = node.loc.start.line;
    this.column = node.loc.start.column;
    this.message = "" + node.type + " (" + this.line + ", " + this.column + ")";
  }
  ParseError.prototype = new ErrorPrototype();
  ParseError.prototype.name = ParseError.name;

  var required_keys = [
    "BlockStatement", /*"Program", "Statement",*/ "EmptyStatement",
    "ExpressionStatement", "IfStatement", "LabeledStatement",
    "ContinueStatement", "BreakStatement", "WithStatement", "SwitchStatement",
    "ReturnStatement", "ThrowStatement", "TryStatement", "WhileStatement",
    "DoWhileStatement", "ForStatement", "ForInStatement", "ForInit",  
    "DebuggerStatement", "FunctionDeclaration", "VariableDeclaration",
    /*"Function", "ScopeBody", "Expression",*/ "ThisExpression", "ArrayExpression",
    "ObjectExpression", "FunctionExpression", "SequenceExpression",
    "UpdateExpression", "UnaryExpression", "LogicalExpression",
    "AssignmentExpression", "BinaryExpression", "ConditionalExpression",
    "CallExpression", "NewExpression", "MemberExpression", "Literal",
    "Identifier"
  ];
  
  var rewrite_node = function (node) {
    rewrite_rules[node.type].apply(this, arguments);
  }

  var loc_between = function (left, right, config) {
    if (!config) {
      config = {};
    }

    var halign = config.halign || 'left';
    var valign = config.valign;
    if (!valign) {
      valign = halign === 'right' ? 'bottom' :
          halign === 'center' ? halign :
          'top';
    }
    var hoffset = config.hoffset || 0;
    var voffset = config.voffset || 0;

    var start = left.loc.end;
    var end = right.loc.start;
    var linediff = end.line - start.line;
    var sameline = linediff === 0;
    align = sameline && halign === "center" ? "left" : halign;
    var max_col = halign === "left" ? start.column + hoffset : end.column - 1;
    var min_col = halign === "right" ? end.column - hoffset : start.column;
    var max_line, min_line;
    if (!sameline) {
      max_line = valign === 'top' ? start.line + voffset : end.line;
      min_line = valign === 'bottom' ? end.line - voffset : start.line;
    }
    var line, column;

    if (sameline) {
      column = Math.floor((start.column + end.column) / 2);
      column = Math.min(column, max_col);
      column = Math.max(column, min_col);
      line = start.line;
    } else {
      if (halign === "left") {
        column = max_col;
      } else if (halign === "right") {
        column = min_col;
      }

      if (valign === 'bottom') {
        line = min_line;
      } else if (valign === 'top' || linediff === 1) {
        line = max_line;
      } else {
        line = Math.floor((end.line + start.line) / 2);
      }
    }

    return {
      column: column,
      line: line
    };
  }

  var new_loc_branch = function (loc_branch, config) {
    return {
      line: loc_branch.line + (config.line || 0),
      column: loc_branch.column + (config.column || 0)
    };
  };

  var function_params = function (params, jscode, loc) {
    if (params.length) {
      for (var p = 0, plen = params.length; p < plen; p++) {
        var param = params[p];
        if (p === 0) {
          jscode.set(loc.start, '(');
        }
        rewrite_node.call(this, param, jscode);
        jscode.set(param.loc.end, ',');
      }
      jscode.set(param.loc.end, ")");
    } else {
      jscode.set(loc.start, '()');
    }
  };

  var rewrite_rules = exports.rewrite_rules = {
    Literal: function (node, jscode) {
      jscode.set(node.loc.start, node.raw);
    },

    ObjectExpression: function (node, jscode) {
      jscode.set(node.loc.start, "{");

      var properties = node.properties;
      for (var i = 0, len = properties.length; i < len; i++) {
        var property = properties[i];
        rewrite_node.call(this, property.key, jscode);
        jscode.set(loc_between(property.key, property.value), ":");
        rewrite_node.call(this, property.value, jscode);

        if (i !== (len - 1)) {
          jscode.set(property.value.loc.end, ",")
        }
      }

      jscode.set(new_loc_branch(node.loc.end, {column: -1}), "}");
    },

    Identifier: function (node, jscode) {
      if (node.name === "✖") {
        throw new ParseError(node);
      }
      jscode.set(node.loc.start, node.name);
    },

    ThisExpression: function (node, jscode) {
      jscode.set(node.loc.start, 'this');
    },

    VariableDeclaration: function (node, jscode) {
      jscode.set(node.loc.start, "var");
      var declarations = node.declarations;
      for (var i = 0, len = declarations.length; i < len; i++) {
        rewrite_node.call(this, declarations[i], jscode, i === (len - 1));
      }
    },

    VariableDeclarator: function (node, jscode, is_last) {
      if (node.init) {
        var assignment_node = {
          type: 'AssignmentExpression',
          start: node.start,
          end: node.end,
          loc: node.loc,
          left: node.id,
          right: node.init,
          operator: '='
        };
        rewrite_rules.AssignmentExpression.call(this, assignment_node, jscode);
      }
      rewrite_node.call(this, node.id, jscode);

      if (!is_last) {
        jscode.set(node.loc.end, ',');
      } else {
        jscode.set(node.loc.end, ';');
      }
    },

    AssignmentExpression: function (node, jscode) {
      rewrite_rules.BinaryExpression.call(this, node, jscode);
    },

    BlockStatement: function (node, jscode) {
      jscode.set(node.loc.start, "{");
      jscode.set(node.loc.end, "}");
      // This fixed a problem at one point, but I suspect the problem was elsewhere.
      //node.loc.end.column += 1;
    },

    ExpressionStatement: function (node, jscode) {
      jscode.set(node.expression.loc.end, ';');
    },

    EmptyStatement: function (node, jscode) {
      var end;
      if (!node.loc.end) {
        end = new_loc_branch(node.loc.start, {column: 1});
      } else {
        end = new_loc_branch(node.loc.end, {column: -1});
      }

      jscode.set(node.loc.start, '(');
      jscode.set(end, ')');
    },

    BinaryExpression: function (node, jscode) {
      jscode.set(loc_between(node.left, node.right, {hoffset: 1}), node.operator);
    },

    LogicalExpression: function (node, jscode) {
      rewrite_rules.BinaryExpression.apply(this, arguments);
    },

    UnaryExpression: function (node, jscode) {
      var loc;
      if (node.prefix) {
        loc = node.loc.start;
      } else {
        loc = node.argument.loc.end;
      }
      jscode.set(loc, node.operator);
    },

    ArrayExpression: function (node, jscode) {
      jscode.set(node.loc.start, '[');
      jscode.set(new_loc_branch(node.loc.end, {column: -1}), ']');
      var elements = node.elements;
      for (var e = 0, end = elements.length - 1; e < end; e++) {
        var el = elements[e];
        jscode.set(el.loc.end, ',');
      }
    },

    MemberExpression: function (node, jscode) {
      var object = node.object,
          property = node.property;

      if (property.type === "Identifier") {
        jscode.set(object.loc.end, '.');
        rewrite_node.call(this, node.property, jscode);
      } else {
        jscode.set(object.loc.end, '[');
        jscode.set(new_loc_branch(node.loc.end, {column: -1}), ']');
      }
    },

    // Functions
    FunctionDeclaration: function (node, jscode) {
      jscode.set(node.loc.start, 'function');
      function_params(node.params, jscode, {
        start: new_loc_branch(node.id.loc.start, {column: node.id.name.length}),
        end: node.id.loc.end
      });
      if (node.id) {
        rewrite_node.call(this, node.id, jscode);
      }
    },

    FunctionExpression: function (node, jscode) {
      var fn_word = 'function';
      jscode.set(node.loc.start, fn_word);
      var loc_branch_config = {column: fn_word.length + 1};
      function_params(node.params, jscode, {
        start: new_loc_branch(node.loc.start, {column: fn_word.length + 1}),
        end: node.loc.end
      });
      jscode.set(node.loc.end, ';');
    },

    ReturnStatement: function (node, jscode) {
      if (node.argument) {
        jscode.set(node.loc.start, "return");
        jscode.set(node.argument.loc.end, ';');
      } else {
        jscode.set(node.loc.start, "return;");
      }
    },

    CallExpression: function (node, jscode) {
      function_params(node.arguments, jscode, {
        start: node.callee.loc.end
      });
    },

    NewExpression: function (node, jscode) {
      jscode.set(node.loc.start, 'new');
      if (node.loc.end.column !== node.callee.loc.end.column) {
        rewrite_rules.CallExpression.call(this, node, jscode);
      }
    },
    // End Functions

    IfStatement: function (node, jscode) {
      jscode.set(node.loc.start, "if");
      jscode.set(new_loc_branch(node.test.loc.start, {column: -1}), '(');
      jscode.set(node.test.loc.end, ')');

      var alternate = node.alternate;
      if (alternate) {
        var _else = 'else';
        if (alternate.type === 'BlockStatement') {
          _else += ' ';
          jscode.set(new_loc_branch(alternate.loc.start, {column: 1}), '{');
        }
        jscode.set(loc_between(node.consequent, node.alternate, {valign: 'bottom', hoffset: 1, voffset: 1}), _else);
      }
    },

    ConditionalExpression: function (node, jscode) {
      jscode.set(loc_between(node.test, node.consequent, { hoffset: 1 }), '?');
      jscode.set(loc_between(node.consequent, node.alternate, { hoffset: 1 }), ':');
    },

    ForInit: function (node, jscode) {
    },

    UpdateExpression: function (node, jscode) {
      rewrite_rules.UnaryExpression.call(this, node, jscode);
    },

    ForStatement: function (node, jscode) {
      var node_for = {
            loc: {
              start: node.loc.start,
              end: new_loc_branch(node.loc.start, {column: 3})
            }
          },
          node_init = node.init,
          node_test = node.test,
          node_update = node.update;

      jscode.set(node.loc.start, 'for');
      
      if (node_init) {
        jscode.set(new_loc_branch(node_init.loc.start, {column: -1}), '(');
        jscode.set(node_init.loc.end, ';');
      } else {
        node_init = {
          loc: {
            start: loc_between(node_for, node_test || node_update || node.body, {hoffset: 1})
          }
        };
        node_init.loc.end = new_loc_branch(node_init.loc.start, {column: 1});
        jscode.set(node_init.loc.start, '(;');
      }

      if (node_test) {
        jscode.set(node_test.loc.end, ';');
      } else {
        node_test = {
          loc: {
            start: loc_between(node_init, node_update || node.body, {hoffset: 1})
          }
        };
        node_test.loc.end = new_loc_branch(node_test.loc.start, {column: 0});
        jscode.set(node_test.loc.start, ';');
      }

      if (node_update) {
        jscode.set(node_update.loc.end, ')');
      } else {
        jscode.set(loc_between(node_test, node.body, {hoffset: 1}), ')');
      }
    },

    ForInStatement: function (node, jscode) {
      jscode.set(node.loc.start, 'for');
      jscode.set(new_loc_branch(node.left.loc.start, {column: -1}), '(');
      jscode.set(loc_between(node.left, node.right, {hoffset: 1}), 'in');
      jscode.set(node.right.loc.end, ')');
    },

    ContinueStatement: function (node, jscode) {
      jscode.set(node.loc.start, 'continue');
    }
  };

  function def_error(key) {
    exports.rewrite_rules[key] = function (node) {
      console.error(key, node);
      throw "NotImplementedError: '" + key + "' is required";
    };
  }

  for (var i = 0, len = required_keys.length; i < len; i++) {
    var key = required_keys[i];
    if (!(key in exports.rewrite_rules)) {
      def_error(key);
    }
  }
  

  // JSCode is a class that allows us to set the javascript code to particular lines and columns
  // We need this so that rewrite will (as much as possible) keep the same whitespace that was passed in.
  exports.JSCode = (function () {
    var r_newline_rn = /\r\n/;
    var r_line_indentation = /^\s*/;

    function JSCode(config) {
      config || (config = {});
      var old_code = config.old_code || '';
      this.newline = r_newline_rn.test(old_code) ? '\r\n' : '\n';
      this.old_lines = old_code.split(this.newline);
      this.lines = [];
    }

    var proto = JSCode.prototype;

    function get_linno(linno) {
      return linno - 1;
    }

    proto.get = function (linno, colno) {
      linno = get_linno(linno);
      var line = this[linno];
      if (line) {
        return line[colno];
      }
    };

    proto.set = function (loc, text) {
      var linno = get_linno(loc.line);
      var colno = loc.column;
      var lines = text.split(/\r?\n/);

      // Insert the text into the javascript respecting line and column
      // positions.
      for (var l = 0, llen = lines.length; l < llen; l++) {
        var _l = l + linno;
        var line_update = lines[l];
        var clen = line_update.length;
        
        var line = this.lines[_l];
        if (!line) {
          line = this.lines[_l] = [];
        }

        // Ensure we have enough columns to precede our input.
        while (line.length < colno) {
          line.push(" ");
        }
        
        for (var c = 0; c < clen; c++) {
          var _c = c + colno;
          line[_c] = line_update.charAt(c);
        }

        // After the first path, colno needs to be reset so we will update 
        // from column 0 on subsequent lines.
        colno = 0;
      }
    };

    proto.toString = function () {
      var lines = [];

      for (var l = 0, llen = this.lines.length; l < llen; l++) {
        var line = (this.lines[l] || []).join('');
        var old_line = this.old_lines[l];
        if (old_line) {
          var indentation = old_line.match(r_line_indentation);
          line = line.replace(r_line_indentation, indentation);
        }
        lines.push(line);
      }

      return lines.join(this.newline);
    };

    return JSCode;
  })();
  
  var rusetabs

  // code is an optional argument. It is the code from which the ast is 
  // generated. Passing code in allows us to get consistent indentation.
  // rewrite_rules is also an optional argument, and allows you to customize
  // the way the code is rewritten.
  exports.rewrite = function (ast, rewrite_rules) {
    if (rewrite_rules) {
      for (var prop in exports.rewrite_rules) {
        if (!(prop in rewrite_rules)) {
          rewrite_rules[prop] = exports.rewrite_rules[prop];
        }
      }
    } else {
      rewrite_rules = exports.rewrite_rules;
    }

    var jscode = new exports.JSCode({
      old_code: ast.original_code
    });
    walk.simple(ast, rewrite_rules, null, jscode);

	var comments = ast.comments;
	if (comments && comments.length) {
		for (var c = 0, clen = comments.length; c < clen; c++) {
			var comment = comments[c];
			if (comment.block) {
				jscode.set(comment.loc.start, '/*');
			} else {
				jscode.set(comment.loc.start, '//');
			}
			jscode.set({ line: comment.loc.start.line, column: comment.loc.start.column + 2 }, comment.text);
			
			if (comment.block) {
				jscode.set(comment.loc.end, '*/');
			}
		}
	}

    return jscode.toString();
  };

  exports.get_ast = function (code, dammit) {
    var acorn = require('./acorn/acorn' + (dammit ? '_loose' : '') + '.js');

    var comments = [];
    var onComment = function (block, text, start, end, loc_start, loc_end) {
	  var comment = {
		block: block,
		text: text,
		start: start,
		end: end,
		loc: {
			start: loc_start,
			end: loc_end
		}
	  };
	  comments.push(comment);
    };

    var ast = acorn[dammit ? 'parse_dammit' : 'parse'](code, {
      locations: true,
      onComment: onComment
    });
    ast.comments = comments;
    ast.original_code = code;

    return ast;
  };

})(typeof exports === "undefined" ? acorn.rewriter = {} : exports);
