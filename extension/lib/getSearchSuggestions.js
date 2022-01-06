const DoofinderClient = require('./doofinder/Client')

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

  return new DoofinderClient(context).getSearchSuggestions(input.searchPhrase)
}
