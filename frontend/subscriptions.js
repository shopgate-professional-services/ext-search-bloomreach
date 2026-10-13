import { historyReplace } from '@shopgate/engage/core/actions';
import { searchReceived$ } from '@shopgate/engage/search/streams';

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
