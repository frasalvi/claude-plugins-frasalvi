/**
 * Review tier: plumbing
 *
 * SessionStart hook: prunes grant files unused for 30 days. Silent; never
 * fails the session.
 */
'use strict';

const { pruneGrants } = require('./lib/grants');

try {
  pruneGrants(30);
} catch {
  // pruning is best effort
}
