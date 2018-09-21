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

const debug = require('debug')('newrelic:lisk:job_queue');

module.exports = function initialize(shim, jobQueue, moduleName) {
	debug('init %s', moduleName);

	const newrelic = this;

	// eslint-disable-next-line prefer-arrow-callback
	shim.wrap(jobQueue, ['register'], function jobRegisterWrapper(
		// eslint-disable-next-line no-shadow
		shim,
		originalRegister,
		fnName,
	) {
		debug('wrapping %s', fnName);

		if (shim.isWrapped(originalRegister)) {
			return originalRegister;
		}

		return function wrappedRegister(name, originalJob, time) {
			function wrappedJob(cb) {
				newrelic.startBackgroundTransaction(name, 'jobQueue', () => {
					const transaction = newrelic.getTransaction();
					originalJob.call(this, () => {
						transaction.end();
						cb.call(this);
					});
				});
			}

			originalRegister.call(this, name, wrappedJob, time);
		};
	});
};
