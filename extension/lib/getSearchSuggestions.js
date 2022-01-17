const BloomreachClient = require('./bloomreach/Client')

/**
 * @param {PipelineContext} context
 * @param {Object} input
 * @returns {Promise<Object>}
 */
module.exports = async (context, input) => {
  const { useSearchSuggestions } = context.config

  if (!useSearchSuggestions) {
    return {
      suggestions: []
    }
  }

  return new BloomreachClient(context, 'suggest').getSearchSuggestions(input.searchPhrase)
}
