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

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const jobQueueInstrument = require('./instrumentation/job_queue');
const pgPromiseInstrument = require('./instrumentation/pg_promise');
const swaggerNodeRunnerInstrument = require('./instrumentation/swagger_node_runner');
const modulesWithCallbackInstrument = require('./instrumentation/modules_with_callback');

const defaults = {
	exitOnFailure: true,
	rootPath: null,
};

class LiskNewRelic {
	/**
	 *
	 * @param {Object} newrelic - newrelic object
	 * @param {Object} options - Options object
	 * @param {boolean} options.exitOnFailure - The logger object used by this plugin
	 * @param {string} options.rootPath - Root path to the lisk
	 */
	constructor(newrelic, options = {}) {
		this.newrelic = newrelic;
		this.config = Object.assign({}, defaults, options);

		assert(options.rootPath, 'root path is required parameter');

		this.errorHandler = function instrumentationError(error) {
			// this refers to newrelic and it have its own logger
			this.newrelic.shim.logger.fatal(error);

			if (this.config.exitOnFailure) {
				process.exit(1);
			}
		}.bind(this);
	}

	instrumentDatabase() {
		this.newrelic.instrumentDatastore({
			moduleName: 'pg-promise',
			onRequire: pgPromiseInstrument,
			onError: this.errorHandler,
		});
	}

	instrumentWeb() {
		this.newrelic.instrumentWebframework({
			moduleName: 'swagger-node-runner',
			onRequire: swaggerNodeRunnerInstrument,
			onError: this.errorHandler,
		});

		const controllerFolder = '/framework/src/modules/http_api/controllers/';
		const controllerMethodExtractor = (shim, controller) =>
			// eslint-disable-next-line implicit-arrow-linebreak
			Object.getOwnPropertyNames(controller).filter(name =>
				// eslint-disable-next-line implicit-arrow-linebreak
				shim.isFunction(controller[name]),
			);

		fs.readdirSync(this.config.rootPath + controllerFolder).forEach(file => {
			if (path.basename(file) !== 'index.js') {
				const controllerPath = `${this.config.rootPath}${controllerFolder}${
					file
				}`;
				const identifier = `api.controllers.${path
					.basename(file)
					.split('.')
					.slice(0, -1)
					.join('.')}`;

				this.instrumentCallbackMethods(
					controllerPath,
					identifier,
					controllerMethodExtractor,
				);
			}
		});
	}

	instrumentBackgroundJobs() {
		this.newrelic.instrumentMessages({
			moduleName: '../helpers/jobs_queue.js',
			onRequire: jobQueueInstrument.bind(this.newrelic),
			onError: this.errorHandler,
		});
	}

	/**
	 * Helper to instrument some modules with callback methods
	 *
	 * @param {string} modulePath - Module path which will be required
	 * @param {string} moduleIdentifier - Module path which will be required
	 * @param {Array.<string> | Function} callbackFunctions - Array of callback methods or function to
	 * extract from module
	 */
	instrumentCallbackMethods(modulePath, moduleIdentifier, callbackFunctions) {
		assert(modulePath, 'Must specify module path.');
		assert(moduleIdentifier, 'Must specify module identifier.');
		assert(
			// eslint-disable-next-line operator-linebreak
			this.newrelic.shim.isArray(callbackFunctions) ||
				this.newrelic.shim.isFunction(callbackFunctions),
			'Must specify callbackFunctions as array of strings or as a function',
		);

		this.newrelic.instrument({
			moduleName: modulePath,
			onRequire: modulesWithCallbackInstrument.bind(
				this,
				moduleIdentifier,
				callbackFunctions,
			),
			onError: this.errorHandler,
		});
	}
}

/**
 *
 * @param {Object} newrelic - newrelic object
 * @param {Object} options - Options object
 * @param {boolean} options.exitOnFailure - The logger object used by this plugin
 * @param {string} options.rootPath - Root path to the lisk
 *
 * @return {LiskNewRelic}
 */
module.exports = function newrelicLiskGenerator(newrelic, options) {
	return new LiskNewRelic(newrelic, options);
};
