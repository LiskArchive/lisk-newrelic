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
module.exports = function initialize(identifier, functions, shim, module, moduleName) {
	debug('init %s', moduleName);

	let methods = null;

	if (shim.isFunction(functions)) {
		methods = functions(shim, module);
	} else if (Array.isArray(functions)) {
		methods = functions;
	}

	methods.forEach(method => {
		let object;
		let methodToWrap = method.split('.');

		if (methodToWrap.length > 2) {
			throw new Error('callBackMethods array only support one level of nesting');
		}

		if (methodToWrap.length === 2) {
			object = module.prototype[methodToWrap[0]];
			[methodToWrap] = methodToWrap;
		} else {
			object = module;
			methodToWrap = method;
		}

		shim.wrap(
			object,
			[methodToWrap],
			(functionShim, fn, fnName) => {
				function wrapper(...args) {
					const argsArray = shim.argsToArray(...args);
					const segment = functionShim.createSegment(`${identifier}.${method}`);
					shim.bindCallbackSegment(argsArray, functionShim.LAST, segment);
					fn.apply(this, argsArray);
				}

				Object.defineProperty(wrapper, 'name', { value: `${fnName}Wrapper`, configurable: true });
				return wrapper;
			},
		);
	});
};
