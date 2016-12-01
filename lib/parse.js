'use strict';

var doctrine = require('doctrine');
var parseMarkdown = require('./parse_markdown');
var _ = require('lodash');

/**
 * Flatteners: these methods simplify the structure of JSDoc comments
 * into a flat object structure, parsing markdown and extracting
 * information where appropriate.
 * @private
 */
var flatteners = {
  'bleno': function (result, tag) {
    result.name = tag.description
  },
  'property': function (result, tag) {
    if (!result.properties) {
      result.properties = [];
    }

    var property = {
      name: tag.name,
      lineNumber: tag.lineNumber // TODO: remove
    };

    if (tag.description) {
      property.description = parseMarkdown(tag.description);
    }

    if (tag.type) {
      property.type = tag.type;
    }

    result.properties.push(property);
  },
};

/**
 * A no-op function for unsupported tags
 * @returns {undefined} does nothing
 */
function todo() {}

/**
 * Generate a function that curries a destination key for a flattener
 * @private
 * @param {string} key the eventual destination key
 * @returns {Function} a flattener that remembers that key
 */
function synonym(key) {
  return function (result, tag) {
    return flatteners[key](result, tag, key);
  };
}

/**
 * Treat the existence of a tag as a sign to mark `key` as true in the result
 * @private
 * @param {Object} result the documentation object
 * @param {Object} tag the tag object, with a name property
 * @param {string} key destination on the result
 * @returns {undefined} operates with side-effects
 */
function flattenBoolean(result, tag, key) {
  result[key] = true;
}

/**
 * Flatten a usable-once name tag into a key
 * @private
 * @param {Object} result the documentation object
 * @param {Object} tag the tag object, with a name property
 * @param {string} key destination on the result
 * @returns {undefined} operates with side-effects
 */
function flattenName(result, tag, key) {
  result[key] = tag.description;
}


/**
 * Flatten a usable-once description tag into a key
 * @private
 * @param {Object} result the documentation object
 * @param {Object} tag the tag object, with a description property
 * @param {string} key destination on the result
 * @returns {undefined} operates with side-effects
 */
function flattenDescription(result, tag, key) {
  result[key] = tag.description;
}

/**
 * Flatten a usable-once description tag into a key and parse it as Markdown
 * @private
 * @param {Object} result the documentation object
 * @param {Object} tag the tag object, with a description property
 * @param {string} key destination on the result
 * @returns {undefined} operates with side-effects
 */
function flattenMarkdownDescription(result, tag, key) {
  result[key] = parseMarkdown(tag.description);
}

/**
 * Parse [kind shorthand](http://usejsdoc.org/tags-kind.html) into
 * both name and type tags, like `@class [<type> <name>]`
 *
 * @param {Object} result comment
 * @param {Object} tag parsed tag
 * @param {string} key tag
 * @returns {undefined} operates through side effects
 * @private
 */
function flattenKindShorthand(result, tag, key) {
  result.kind = key;

  if (tag.name) {
    result.name = tag.name;
  }

  if (tag.type) {
    result.type = tag.type;
  }
}

/**
 * Parse a comment with doctrine, decorate the result with file position and code
 * context, handle parsing errors, and fix up various infelicities in the structure
 * outputted by doctrine.
 *
 * The following tags are treated as synonyms for a canonical tag:
 *
 *  * `@virtual` ⇢ `@abstract`
 *  * `@extends` ⇢ `@augments`
 *  * `@constructor` ⇢ `@class`
 *  * `@const` ⇢ `@constant`
 *  * `@defaultvalue` ⇢ `@default`
 *  * `@desc` ⇢ `@description`
 *  * `@host` ⇢ `@external`
 *  * `@fileoverview`, `@overview` ⇢ `@file`
 *  * `@emits` ⇢ `@fires`
 *  * `@func`, `@method` ⇢ `@function`
 *  * `@var` ⇢ `@member`
 *  * `@arg`, `@argument` ⇢ `@param`
 *  * `@prop` ⇢ `@property`
 *  * `@return` ⇢ `@returns`
 *  * `@exception` ⇢ `@throws`
 *  * `@linkcode`, `@linkplain` ⇢ `@link`
 *
 * The following tags are assumed to be singletons, and are flattened
 * to a top-level property on the result whose value is extracted from
 * the tag:
 *
 *  * `@name`
 *  * `@memberof`
 *  * `@classdesc`
 *  * `@kind`
 *  * `@class`
 *  * `@constant`
 *  * `@event`
 *  * `@external`
 *  * `@file`
 *  * `@function`
 *  * `@member`
 *  * `@mixin`
 *  * `@module`
 *  * `@namespace`
 *  * `@typedef`
 *  * `@access`
 *  * `@lends`
 *  * `@description`
 *  * `@summary`
 *  * `@copyright`
 *  * `@deprecated`
 *
 * The following tags are flattened to a top-level array-valued property:
 *
 *  * `@param` (to `params` property)
 *  * `@property` (to `properties` property)
 *  * `@returns` (to `returns` property)
 *  * `@augments` (to `augments` property)
 *  * `@example` (to `examples` property)
 *  * `@throws` (to `throws` property)
 *  * `@see` (to `sees` property)
 *  * `@todo` (to `todos` property)
 *
 * The `@global`, `@static`, `@instance`, and `@inner` tags are flattened
 * to a `scope` property whose value is `"global"`, `"static"`, `"instance"`,
 * or `"inner"`.
 *
 * The `@access`, `@public`, `@protected`, and `@private` tags are flattened
 * to an `access` property whose value is `"protected"` or `"private"`.
 * The assumed default value is `"public"`, so `@access public` or `@public`
 * tags result in no `access` property.
 *
 * @param {string} comment input to be parsed
 * @param {Object} loc location of the input
 * @param {Object} context code context of the input
 * @return {Comment} an object conforming to the
 * [documentation schema](https://github.com/documentationjs/api-json)
 */
function parseJSDoc(comment, loc, context) {
  var result = doctrine.parse(comment, {
    // have doctrine itself remove the comment asterisks from content
    unwrap: true,
    // enable parsing of optional parameters in brackets, JSDoc3 style
    sloppy: true,
    // `recoverable: true` is the only way to get error information out
    recoverable: true,
    // include line numbers
    lineNumbers: true
  });

  // Reject any comment that doesn't have an @bleno tag
  if (_.findIndex(result.tags, function(item) { return item.title === 'bleno'; }) === -1 ){
    return null;
  } 

  result.loc = loc;
  result.context = context;
  result.errors = [];

  if (result.description) {
    result.description = parseMarkdown(result.description);
  }

  result.tags.forEach(function (tag) {
    if (tag.errors) {
      for (var j = 0; j < tag.errors.length; j++) {
        result.errors.push({message: tag.errors[j]});
      }
    } else if (flatteners[tag.title]) {
      flatteners[tag.title](result, tag, tag.title);
    } else {
      result.errors.push({
        message: 'unknown tag @' + tag.title,
        commentLineNumber: tag.lineNumber
      });
    }
  });

  return result;
}

module.exports = parseJSDoc;
