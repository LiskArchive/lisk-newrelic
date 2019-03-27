/*
 * LiskHQ/lisk-newrelic
 * Copyright © 2017 Lisk Foundation
 *
 * See the LICENSE file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with the Lisk Foundation,
 * no part of this software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE file.
 *
 * Removal or modification of this copyright notice is prohibited.
 *
 */

const debug = require('debug')('newrelic:lisk:modules_with_callback');

/**
 *
 * @param {string} identifier
 * @param {Array.<string> | Function} functions
 * @param shim
 * @param module
 * @param moduleName
 */
module.exports = function initialize(
	identifier,
	functions,
	shim,
	module,
	moduleName,
) {
	debug('init %s', moduleName);

	let methods = null;

	if (shim.isFunction(functions)) {
		methods = functions(shim, module);
	} else if (Array.isArray(functions)) {
		methods = functions;
	}
	debug('methods to wrap %j', identifier, methods);

	methods.forEach(method => {
		let object;
		let methodToWrap = method.split('.');

		if (methodToWrap.length > 2) {
			throw new Error(
				'callBackMethods array only support one level of nesting',
			);
		}

		// eslint-disable-next-line no-unused-expressions
		Object.hasOwnProperty.call(module, methodToWrap[0])
			? (object = module)
			: (object = module.prototype);

		if (methodToWrap.length === 2) {
			object = object[methodToWrap[0]];
			[, methodToWrap] = methodToWrap;
		} else {
			[methodToWrap] = methodToWrap;
		}

		debug('object %s ', identifier, object);

		shim.wrap(object, [methodToWrap], (functionShim, fn, fnName) => {
			debug('creating wrapper for %s : %s', identifier, fnName);
			return shim.agent.tracer.wrapFunctionLast(
				`${identifier}.${method}`,
				null,
				fn,
			);
		});
	});
};
