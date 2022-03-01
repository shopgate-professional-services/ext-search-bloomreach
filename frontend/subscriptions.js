import {
  historyReplace,
} from '@shopgate/engage/core';
import { RECEIVE_SEARCH_RESULTS, searchReceived$ } from '@shopgate/pwa-common-commerce/search';

/**
 * Subscriptions
 * @param {Function} subscribe subscribe
 */
export default (subscribe) => {
  /** Search results received */
  subscribe(searchReceived$, async ({ dispatch, action }) => {
    const { results = {} } = action;

    if (results.redirectedUrl) {
      dispatch(historyReplace({
        pathname: results.redirectedUrl,
      }));
    }
  });
};
