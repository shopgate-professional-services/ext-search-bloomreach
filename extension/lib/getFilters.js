const BloomreachClient = require('./bloomreach/Client')

/**
 * @param {PipelineContext} context
 * @param {Object} input
 * @returns {Promise<Object>}
 */
module.exports = async (context, input) => {
  const { filters } = await new BloomreachClient(context).getFilters(input.searchPhrase)

  return { filters }
}
