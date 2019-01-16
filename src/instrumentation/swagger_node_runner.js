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

const debug = require('debug')('newrelic:lisk:swagger_node_runner');

module.exports = function initialize(shim, swaggerNodeRunner, moduleName) {
	debug('init %s', moduleName);

	let runner = null;
	let middleware = null;

	shim.setFramework(shim.EXPRESS);

	function swaggerNodeRunnerMiddleware(req, res, next) {
		const operation = runner.getOperation(req);

		if (operation) {
			shim.setTransactionUri(operation.pathObject.path);
		}

		middleware.apply(runner, [req, res, next]);
	}

	function wrappedCreateCb(errors, _runner) {
		if (shim.isWrapped(this)) {
			return this;
		}
		const actualCb = this;

		if (!errors) {
			runner = _runner;
			middleware = _runner.expressMiddleware().middleware();

			shim.wrap(_runner, ['expressMiddleware'], {
				// eslint-disable-next-line no-shadow
				wrapper(shim, fn, fnName) {
					function wrapper() {
						return {
							register(app) {
								app.use(swaggerNodeRunnerMiddleware);
							},
							middleware() {
								return swaggerNodeRunnerMiddleware;
							},
						};
					}
					Object.defineProperty(wrapper, 'name', {
						value: `${fnName}Wrapper`,
						configurable: true,
					});
					return wrapper;
				},
			});
		}

		return actualCb.apply(this, [errors, _runner]);
	}

	// eslint-disable-next-line no-shadow, no-unused-vars
	function wrappedRunnerCreate(shim, fn, fnName) {
		if (shim.isWrapped(fn)) {
			return fn;
		}

		return function runnerCreateWrapper(swaggerConfig, cb) {
			fn.apply(cb, [swaggerConfig, wrappedCreateCb.bind(cb)]);
		};
	}

	shim.wrap(swaggerNodeRunner, ['create'], {
		callback: shim.LAST,
		wrapper: wrappedRunnerCreate,
	});
};
