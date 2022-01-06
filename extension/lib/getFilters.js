const DoofinderClient = require('./bloomreach/Client')

/**
 * @param {PipelineContext} context
 * @param {Object} input
 * @returns {Promise<Object>}
 */
module.exports = async (context, input) => {
  const { filters } = await new DoofinderClient(context).getFilters(input.searchPhrase)

  return { filters }
}
